import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { findPolicy, originalLines, postBusinessEvent, type JournalLine } from './posting'
import { roleBalance, roleCodes } from './recognition'
import { getBook } from './setup'

async function bookFor(tx: Queryable, date: string) {
  const book = await getBook(tx, true)
  if (!book || book.mode === 'off') return null
  if (date < book.cutover_date) {
    if (book.mode === 'active') throw new AppError(422, 'ACCOUNTING_REVIEW_REQUIRED', 'Kejadian sebelum cutover memerlukan koreksi saldo awal yang dapat ditelusuri.')
    return null
  }
  return book
}

/**
 * Approved spending evidence of an employee: cost (project trip cost, or the company category's mapped role) out
 * of the cash the employee holds; anything beyond it is owed back to the employee as a reimbursement.
 */
export async function postExpenseClaimSource(tx: Queryable, actor: Actor, id: string, requestId: string, voidReason?: string, voidDate?: string) {
  const [c] = await tx.query<Record<string, any>>('select id,employee_id,project_id,category,amount_minor,spent_on,evidence_ref from employee_expense_claims where id=$1', [id])
  if (!c) throw errors.notFound('Bukti pengeluaran')
  const book = await bookFor(tx, voidDate ?? c.spent_on)
  if (!book) return
  if (voidReason) {
    const [original] = await tx.query<{ id: string }>(`select j.id from accounting_journals j join accounting_events e on e.id=j.event_id
      where j.book_id=$1 and e.source_type='employee_expense_claim' and e.source_id=$2 and e.event_kind='source_recorded' and j.status='posted' and j.reversal_of_id is null`, [book.id, id])
    return postBusinessEvent(tx, actor, { sourceType: 'employee_expense_claim', sourceId: id, sourceVersion: 'void', kind: 'source_voided', effectiveDate: voidDate!,
      snapshot: { ...c, correctionReason: voidReason }, policyKind: 'employee_advance', description: `Pembatalan bukti ${id}`,
      lines: original ? await originalLines(tx, original.id) : [], reversalOfId: original?.id, correctionReason: voidReason,
      ...(original ? {} : { pendingReason: { code: 'OPENING_SOURCE_MAPPING_REQUIRED', message: 'Bukti asal belum mempunyai jurnal.' } }) }, requestId)
  }
  const code = await roleCodes(tx, book)
  const policy = await findPolicy(tx, book, 'employee_advance', c.spent_on)
  const classifications = policy?.settings.classifications as Record<string, string> | undefined
  // A project trip cost is direct cost of that trip; a company category must be mapped explicitly by policy.
  const role = c.category === 'trip' ? 'direct-cost' : classifications?.[c.category]
  const amount = BigInt(c.amount_minor)
  const held = await roleBalance(tx, book, 'employee-advance', { employeeId: c.employee_id }, c.spent_on)
  const fromAdvance = held > 0n ? (held < amount ? held : amount) : 0n
  const dims = { projectId: c.project_id, employeeId: c.employee_id }
  const lines: JournalLine[] = role && code(role) ? [
    { accountCode: code(role), debitMinor: amount.toString(), creditMinor: '0', projectId: c.project_id },
    ...(fromAdvance > 0n ? [{ accountCode: code('employee-advance'), debitMinor: '0', creditMinor: fromAdvance.toString(), ...dims }] : []),
    ...(amount > fromAdvance ? [{ accountCode: code('reimbursement-payable'), debitMinor: '0', creditMinor: (amount - fromAdvance).toString(), ...dims }] : [])
  ] : []
  return postBusinessEvent(tx, actor, { sourceType: 'employee_expense_claim', sourceId: id, sourceVersion: '1', kind: 'source_recorded', effectiveDate: c.spent_on,
    snapshot: c, policyKind: 'employee_advance', description: `Bukti pengeluaran ${c.evidence_ref}`, lines,
    ...(lines.length ? {} : { pendingReason: { code: 'CASH_CLASSIFICATION_REQUIRED', message: 'Tentukan sifat kategori biaya ini pada kebijakan uang jalan. Bukti belum otomatis menjadi beban.' } }) }, requestId)
}

/**
 * Approved payroll: salary expense for the period and a payable to each employee (net). Deductions owed to
 * third parties (tax, social security) need an explicit mapping; an unknown treatment is never booked as zero.
 */
export async function postPayrollSource(tx: Queryable, actor: Actor, runId: string, requestId: string) {
  const [run] = await tx.query<{ id: string; period: string }>('select id,period from payroll_runs where id=$1', [runId])
  if (!run) throw errors.notFound('Payroll')
  // The expense belongs to the payroll month (accrual), whatever day it was approved or paid.
  const [period] = await tx.query<{ end: string }>("select (date_trunc('month', ($1 || '-01')::date) + interval '1 month - 1 day')::date::text as end", [run.period])
  const end = period!.end
  const book = await bookFor(tx, end)
  if (!book) return
  const lines = await tx.query<{ employee_id: string; gross: string; deduction: string }>(`select employee_id,(base_salary_minor+allowance_minor)::text as gross,deduction_minor::text as deduction
    from payroll_lines where payroll_run_id=$1 order by employee_id`, [runId])
  const code = await roleCodes(tx, book)
  const policy = await findPolicy(tx, book, 'payroll', end)
  const deductionRole = policy?.settings.deductionRole as string | undefined
  const hasDeduction = lines.some(l => BigInt(l.deduction) > 0n)
  const out: JournalLine[] = []
  for (const l of lines) {
    const gross = BigInt(l.gross), deduction = BigInt(l.deduction), net = gross - deduction
    if (gross > 0n) out.push({ accountCode: code('payroll-expense'), debitMinor: gross.toString(), creditMinor: '0', employeeId: l.employee_id })
    if (net > 0n) out.push({ accountCode: code('payroll-payable'), debitMinor: '0', creditMinor: net.toString(), employeeId: l.employee_id })
    if (deduction > 0n && deductionRole && code(deductionRole)) out.push({ accountCode: code(deductionRole), debitMinor: '0', creditMinor: (deduction > gross ? gross : deduction).toString() })
  }
  const pendingReason = lines.some(l => BigInt(l.deduction) > BigInt(l.gross))
    ? { code: 'PAYROLL_NEGATIVE_NET', message: 'Potongan melebihi gaji kotor. Periksa baris payroll sebelum dibukukan.' }
    : hasDeduction && !(deductionRole && code(deductionRole))
      ? { code: 'DEDUCTION_TREATMENT_REQUIRED', message: 'Tentukan perlakuan potongan gaji (pajak/iuran) pada kebijakan payroll. Potongan tidak dianggap nol.' }
      : undefined
  return postBusinessEvent(tx, actor, { sourceType: 'payroll_run', sourceId: runId, sourceVersion: '1', kind: 'source_recorded', effectiveDate: end,
    snapshot: { runId, period: run.period, lines }, policyKind: 'payroll', description: `Gaji periode ${run.period}`, lines: out, pendingReason }, requestId)
}
