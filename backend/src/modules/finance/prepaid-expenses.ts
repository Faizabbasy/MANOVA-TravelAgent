import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { errors } from '../../http/errors'
import { paginate, parsePageQuery } from '../../http/envelope'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { postCashSource } from '../accounting/cash-source'
import { postPrepaidAmortization } from '../accounting/prepaid'
import { getBook } from '../accounting/setup'
import { parseMovementAmount, todayBusinessDate } from './common'
import { assertOutflowFits, lockPostableAccount, validateEffectiveDate } from './postings'
import { endOfMonth } from './cashflow'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
export interface PrepaidExpenseInput {
  bankAccountId: string; amountMinor: string; effectiveDate: string; description: string; evidenceRef: string
  startMonth: string; months: number; method: 'equal-months'
}

function requiredText(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim().length < 3 || value.trim().length > 200) throw errors.validation({ [field]: ['Isi 3–200 karakter.'] })
  return value.trim()
}
function month(value: unknown, field: string) {
  if (typeof value !== 'string' || !MONTH.test(value) || value < '1900-01' || value > '2199-12') throw errors.validation({ [field]: ['Periode harus YYYY-MM (1900–2199).'] })
  return value
}

/** One source action: a real company payment and its immutable service schedule. Never an immediate office expense. */
export async function payPrepaidExpense(tx: Queryable, actor: Actor, input: PrepaidExpenseInput, requestId: string) {
  await getBook(tx, true)
  const description = requiredText(input.description, 'description'), evidenceRef = requiredText(input.evidenceRef, 'evidenceRef')
  const amount = parseMovementAmount(input.amountMinor), date = validateEffectiveDate(input.effectiveDate)
  const start = month(input.startMonth, 'startMonth')
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 120) throw errors.validation({ months: ['Isi 1–120 bulan.'] })
  if (input.method !== 'equal-months') throw errors.validation({ method: ['Pilih metode bulanan sama besar secara eksplisit.'] })
  if (amount < BigInt(input.months)) throw errors.validation({ amountMinor: ['Nominal harus cukup untuk minimal satu rupiah per bulan.'] })
  if (date > `${start}-01`) throw errors.validation({ startMonth: ['Pembayaran di muka tidak boleh setelah awal masa manfaat. Biaya yang sudah terjadi memerlukan alur biaya/utang.'] })
  // Evidence identity serialises different request keys; it never silently merges two distinct payments.
  await tx.query('select pg_advisory_xact_lock(hashtext($1))', [`prepaid-evidence:${evidenceRef}`])
  if ((await tx.query('select 1 from prepaid_expenses where evidence_ref=$1', [evidenceRef])).length) throw errors.conflict('Bukti biaya ini sudah mempunyai jadwal. Buka sumber yang ada; jangan membayar ulang.')
  const account = await lockPostableAccount(tx, input.bankAccountId, date)
  await assertOutflowFits(tx, account, date, amount)
  const [cash] = await tx.query<{ id: string }>(`insert into financial_transactions
    (bank_account_id,direction,amount_minor,currency,kind,effective_date,memo,reference,created_by)
    values ($1,'out',$2,$3,'prepaid_opex',$4,$5,$6,$7) returning id`, [account.id, amount.toString(), account.currency, date, description, evidenceRef, actor.userId])
  const id = await nextId(tx, 'PPE-')
  await tx.query(`insert into prepaid_expenses(id,transaction_id,description,evidence_ref,starts_on,months,method,created_by)
    values ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, cash!.id, description, evidenceRef, `${start}-01`, input.months, input.method, actor.userId])
  const result = await postCashSource(tx, actor, cash!.id, requestId)
  await recordAudit(tx, { action: 'finance.prepaid_expense_paid', actorUserId: actor.userId, entityType: 'prepaid_expense', entityId: id, requestId,
    after: { transactionId: cash!.id, amountMinor: amount.toString(), startsOn: `${start}-01`, months: input.months, method: input.method, evidenceRef } })
  return { id, transactionId: cash!.id, accountingStatus: result?.status ?? 'off' }
}

/** Exact equal-month allocation; the last month includes the integer remainder. No rate or accounting default. */
export function prepaidMonthAmount(total: bigint, months: number, index: number) {
  if (index < 0 || index >= months) return 0n
  const monthly = total / BigInt(months)
  return index === months - 1 ? total - monthly * BigInt(months - 1) : monthly
}
export function prepaidMonth(start: string, index: number) {
  const n = Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7)) - 1 + index
  return `${Math.floor(n / 12)}-${String(n % 12 + 1).padStart(2, '0')}`
}

/** Completed service months only. Scheduler/retry uses this same function and the source/month PK. No cash writes. */
export async function runPrepaidAmortization(tx: Queryable, actor: Actor, input: { throughPeriod: string }, requestId: string) {
  await getBook(tx, true)
  const through = month(input.throughPeriod, 'throughPeriod')
  if (endOfMonth(`${through}-01`) > todayBusinessDate()) throw errors.validation({ throughPeriod: ['Hanya bulan manfaat yang sudah berakhir yang dapat dibebankan.'] })
  await tx.query('select pg_advisory_xact_lock(hashtext($1))', ['prepaid-amortization-run'])
  const plans = await tx.query<{ id: string; starts_on: string; months: number; amount_minor: string }>(`select p.id,p.starts_on,p.months,t.amount_minor
    from prepaid_expenses p join financial_transactions t on t.id=p.transaction_id
    where not exists(select 1 from financial_transactions r where r.reversal_of_id=t.id) order by p.id for update of p`)
  const booked: { prepaidExpenseId: string; period: string; amountMinor: string }[] = []
  for (const p of plans) {
    const done = new Set((await tx.query<{ period: string }>('select period from prepaid_expense_amortizations where prepaid_expense_id=$1', [p.id])).map(r => r.period))
    for (let i = 0; i < p.months; i++) {
      const period = prepaidMonth(p.starts_on, i)
      if (period > through) break
      if (done.has(period)) continue
      const amount = prepaidMonthAmount(BigInt(p.amount_minor), p.months, i)
      await tx.query('insert into prepaid_expense_amortizations(prepaid_expense_id,period,amount_minor,created_by) values ($1,$2,$3,$4)', [p.id, period, amount.toString(), actor.userId])
      await postPrepaidAmortization(tx, actor, p.id, period, requestId)
      booked.push({ prepaidExpenseId: p.id, period, amountMinor: amount.toString() })
    }
  }
  if (booked.length) await recordAudit(tx, { action: 'finance.prepaid_amortization_run', actorUserId: actor.userId, entityType: 'prepaid_amortization', entityId: through, requestId, after: { booked } })
  return { throughPeriod: through, booked }
}

export async function listPrepaidExpenses(tx: Queryable, asOf: string, query: { limit?: string; cursor?: string } = {}) {
  validateEffectiveDate(asOf, 'asOf')
  const { limit, after } = parsePageQuery(query)
  const rows = await tx.query<{ id: string; transaction_id: string; description: string; evidence_ref: string; starts_on: string; months: number
    amount_minor: string; effective_date: string; amortized: string; reversed: boolean }>(`select p.*,t.amount_minor,t.effective_date,
      coalesce((select sum(a.amount_minor) from prepaid_expense_amortizations a where a.prepaid_expense_id=p.id
        and (date_trunc('month',(a.period || '-01')::date)+interval '1 month - 1 day')::date <= $1),0) as amortized,
      exists(select 1 from financial_transactions r where r.reversal_of_id=t.id and r.effective_date <= $1) as reversed
    from prepaid_expenses p join financial_transactions t on t.id=p.transaction_id where t.effective_date <= $1
      and ($2::text is null or p.id > $2) order by p.id limit $3`, [asOf, after, limit + 1])
  return { asOf, currency: 'IDR' as const, ...paginate(rows.map(p => ({ id: p.id, transactionId: p.transaction_id, description: p.description, evidenceRef: p.evidence_ref,
    paidOn: p.effective_date, startMonth: p.starts_on.slice(0, 7), months: p.months, method: 'equal-months' as const,
    totalMinor: p.amount_minor, amortizedMinor: p.amortized, remainingMinor: p.reversed ? '0' : (BigInt(p.amount_minor) - BigInt(p.amortized)).toString(),
    status: p.reversed ? 'reversed' as const : BigInt(p.amortized) === BigInt(p.amount_minor) ? 'completed' as const : 'open' as const })), limit) }
}
