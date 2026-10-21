import type { Actor } from '../../auth/rbac'
import type { Db, Queryable } from '../../db/client'
import { postCashSource } from '../accounting/cash-source'
import { postExpenseClaimSource } from '../accounting/staff'
import { getBook } from '../accounting/setup'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { isUniqueViolation, parseMovementAmount, rule, todayBusinessDate } from './common'
import { assertOutflowFits, lockPostableAccount, trimOrNull, validateEffectiveDate, validateReason } from './postings'

/**
 * Kasbon / uang jalan (owner accounting F5): cash given to an employee is a position the employee holds, not
 * an expense. Approved evidence turns it into cost; leftover cash comes back; overspending is reimbursed once.
 * All money moves through financial_transactions (the one cash book).
 */

export type StaffCashKind = 'employee_advance' | 'employee_advance_return' | 'employee_reimbursement'
export interface StaffCashInput { bankAccountId: string; employeeId: string; projectId?: string; amountMinor: string; effectiveDate: string; reference?: string; memo?: string }

async function lockEmployee(tx: Queryable, employeeId: unknown) {
  if (typeof employeeId !== 'string' || !ID_PATTERN.test(employeeId)) throw errors.validation({ employeeId: ['Pilih karyawan.'] })
  const [e] = await tx.query<{ id: string; status: string }>('select id, status from employees where id = $1 for update', [employeeId])
  if (!e) throw errors.validation({ employeeId: ['Karyawan tidak ditemukan.'] })
  return e
}

/** Net staff position; > 0 the employee holds company cash, < 0 the company owes a reimbursement. */
async function staffNet(tx: Queryable, employeeId: string) {
  const [b] = await tx.query<{ net_minor: string }>('select net_minor from v_employee_fund_balances where employee_id = $1', [employeeId])
  return BigInt(b?.net_minor ?? '0')
}

export async function postStaffCash(tx: Queryable, actor: Actor, kind: StaffCashKind, input: StaffCashInput, requestId: string) {
  await getBook(tx, true)
  const employee = await lockEmployee(tx, input.employeeId)
  const amount = parseMovementAmount(input.amountMinor)
  const effectiveDate = validateEffectiveDate(input.effectiveDate)
  const projectId = input.projectId ? input.projectId : null
  if (projectId && (!ID_PATTERN.test(projectId) || !(await tx.query('select 1 from projects where id = $1', [projectId])).length)) {
    throw errors.validation({ projectId: ['Project tidak ditemukan.'] })
  }
  const net = await staffNet(tx, employee.id)
  if (kind === 'employee_advance' && employee.status === 'resigned') throw rule('Karyawan sudah keluar; uang jalan baru tidak dapat diberikan.')
  if (kind === 'employee_advance_return' && amount > net) {
    throw errors.validation({ amountMinor: [`Melebihi uang jalan yang masih dipegang karyawan (${net > 0n ? net : 0n}).`] })
  }
  if (kind === 'employee_reimbursement' && amount > -net) {
    throw errors.validation({ amountMinor: [`Melebihi reimbursement yang terutang ke karyawan (${net < 0n ? -net : 0n}).`] })
  }
  const account = await lockPostableAccount(tx, input.bankAccountId, effectiveDate)
  const direction = kind === 'employee_advance_return' ? 'in' : 'out'
  if (direction === 'out') await assertOutflowFits(tx, account, effectiveDate, amount)
  const [row] = await tx.query<{ id: string }>(
    `insert into financial_transactions (bank_account_id, direction, amount_minor, currency, kind, effective_date, project_id, employee_id, reference, memo, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
    [account.id, direction, amount.toString(), account.currency, kind, effectiveDate, projectId, employee.id, trimOrNull(input.reference, 120), trimOrNull(input.memo), actor.userId])
  await postCashSource(tx, actor, row!.id, requestId)
  await recordAudit(tx, { action: `finance.${kind}_posted`, actorUserId: actor.userId, entityType: 'financial_transaction', entityId: row!.id, requestId,
    after: { employeeId: employee.id, projectId, accountId: account.id, amountMinor: amount.toString(), effectiveDate } })
  return { transactionId: row!.id, employeeId: employee.id, netMinor: (await staffNet(tx, employee.id)).toString() }
}

/** Company-only cost categories a staff receipt may carry (a trip cost is linked to its project instead). */
export const COMPANY_CLAIM_CATEGORIES = ['office', 'marketing', 'technology', 'travel', 'professional', 'bank_fee', 'tax', 'other'] as const

export interface ExpenseClaimInput { employeeId: string; projectId?: string; category: string; amountMinor: string; spentOn: string; evidenceRef: string; description: string }

export async function recordExpenseClaim(tx: Queryable, actor: Actor, input: ExpenseClaimInput, requestId: string) {
  await getBook(tx, true)
  const employee = await lockEmployee(tx, input.employeeId)
  const amount = parseMovementAmount(input.amountMinor)
  const spentOn = validateEffectiveDate(input.spentOn, 'spentOn')
  if (spentOn > todayBusinessDate()) throw errors.validation({ spentOn: ['Tanggal pengeluaran tidak boleh di masa depan.'] })
  const projectId = input.projectId ? input.projectId : null
  const category = projectId ? 'trip' : input.category
  if (projectId) {
    if (!ID_PATTERN.test(projectId) || !(await tx.query('select 1 from projects where id = $1', [projectId])).length) throw errors.validation({ projectId: ['Project tidak ditemukan.'] })
  } else if (!(COMPANY_CLAIM_CATEGORIES as readonly string[]).includes(category)) {
    throw errors.validation({ category: ['Pilih kategori biaya perusahaan, atau project untuk biaya perjalanan.'] })
  }
  const evidenceRef = input.evidenceRef?.trim() ?? ''
  if (evidenceRef.length < 3 || evidenceRef.length > 120) throw errors.validation({ evidenceRef: ['Isi nomor/identitas bukti (3–120 karakter).'] })
  const description = input.description?.trim() ?? ''
  if (description.length < 3 || description.length > 500) throw errors.validation({ description: ['Jelaskan pengeluaran (3–500 karakter).'] })
  const id = await nextId(tx, 'EXC-')
  try {
    await tx.query(`insert into employee_expense_claims (id, employee_id, project_id, category, amount_minor, spent_on, evidence_ref, description, created_by)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, employee.id, projectId, category, amount.toString(), spentOn, evidenceRef, description, actor.userId])
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, 'CONFLICT', `Bukti ${evidenceRef} sudah pernah dipertanggungjawabkan.`)
    throw err
  }
  await recordAudit(tx, { action: 'finance.expense_claim_recorded', actorUserId: actor.userId, entityType: 'employee_expense_claim', entityId: id, requestId,
    after: { employeeId: employee.id, projectId, category, amountMinor: amount.toString(), spentOn, evidenceRef } })
  const posting = await postExpenseClaimSource(tx, actor, id, requestId)
  const net = await staffNet(tx, employee.id)
  return { id, accountingStatus: posting?.status ?? 'off', netMinor: net.toString() }
}

export async function voidExpenseClaim(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, requestId: string) {
  await getBook(tx, true)
  const reason = validateReason(reasonInput)
  if (!ID_PATTERN.test(id)) throw errors.notFound('Bukti pengeluaran')
  const [c] = await tx.query<{ status: string; employee_id: string }>('select status, employee_id from employee_expense_claims where id = $1 for update', [id])
  if (!c) throw errors.notFound('Bukti pengeluaran')
  if (c.status === 'void') throw rule('Bukti ini sudah dibatalkan.')
  await lockEmployee(tx, c.employee_id)
  // Voiding raises what the employee holds (or lowers what is owed): the cost is reversed, the cash position stays.
  await tx.query("update employee_expense_claims set status = 'void', void_reason = $2, voided_by = $3, voided_at = now() where id = $1", [id, reason, actor.userId])
  await recordAudit(tx, { action: 'finance.expense_claim_voided', actorUserId: actor.userId, entityType: 'employee_expense_claim', entityId: id, requestId, reason })
  await postExpenseClaimSource(tx, actor, id, requestId, reason, todayBusinessDate())
  return { id, netMinor: (await staffNet(tx, c.employee_id)).toString() }
}

/** Per employee: what they hold or are owed, and the movements behind it (one definition, server-side). */
export async function staffFunds(db: Db, filter: { employeeId?: string } = {}) {
  const employeeId = filter.employeeId && ID_PATTERN.test(filter.employeeId) ? filter.employeeId : null
  if (filter.employeeId && !employeeId) throw errors.notFound('Karyawan')
  const balances = await db.query<{ id: string; name: string; status: string; net_minor: string }>(`select e.id, e.name, e.status, b.net_minor from employees e
    join v_employee_fund_balances b on b.employee_id = e.id where ($1::text is null or e.id = $1)
    and ($1::text is not null or b.net_minor <> 0 or exists (select 1 from financial_transactions t where t.employee_id = e.id) or exists (select 1 from employee_expense_claims c where c.employee_id = e.id))
    order by e.name`, [employeeId])
  if (employeeId && !balances.length) throw errors.notFound('Karyawan')
  const movements = await db.query<Record<string, any>>(`select * from (
      select t.id, t.employee_id, t.kind as type, t.amount_minor, t.effective_date as date, t.project_id, coalesce(t.memo, t.reference) as note, null::text as evidence_ref,
        case when t.reversal_of_id is not null or exists (select 1 from financial_transactions r where r.reversal_of_id = t.id) then 'reversed' else 'recorded' end as status
        from financial_transactions t where t.employee_id is not null and ($1::text is null or t.employee_id = $1)
      union all
      select c.id, c.employee_id, 'expense_claim', c.amount_minor, c.spent_on, c.project_id, c.description, c.evidence_ref, c.status
        from employee_expense_claims c where ($1::text is null or c.employee_id = $1)
    ) m order by date desc, id desc limit 300`, [employeeId])
  return {
    employees: balances.map(b => {
      const net = BigInt(b.net_minor)
      return { employeeId: b.id, name: b.name, status: b.status, heldMinor: (net > 0n ? net : 0n).toString(), owedToEmployeeMinor: (net < 0n ? -net : 0n).toString() }
    }),
    movements: movements.map(m => ({ id: m.id as string, employeeId: m.employee_id as string,
      type: m.type as StaffCashKind | 'expense_claim', amountMinor: m.amount_minor as string, date: m.date as string, projectId: m.project_id ?? null,
      note: m.note ?? null, evidenceRef: m.evidence_ref ?? null, status: m.status as 'recorded' | 'void' | 'reversed' }))
  }
}
