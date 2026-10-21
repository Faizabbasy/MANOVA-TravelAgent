import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { findPolicy, postBusinessEvent } from './posting'
import { openingCovers } from './opening'
import { roleCodes } from './recognition'
import { getBook } from './setup'

/** Recognise the service month once, reducing the same prepaid balance. Cash never moves here. */
export async function postPrepaidAmortization(tx: Queryable, actor: Actor, id: string, period: string, requestId: string) {
  const [a] = await tx.query<{ amount_minor: string; ends_on: string; paid_on: string; transaction_id: string; method: string }>(`select a.amount_minor,p.transaction_id,p.method,t.effective_date as paid_on,
    (date_trunc('month',(a.period || '-01')::date)+interval '1 month - 1 day')::date::text as ends_on
    from prepaid_expense_amortizations a join prepaid_expenses p on p.id=a.prepaid_expense_id join financial_transactions t on t.id=p.transaction_id
    where a.prepaid_expense_id=$1 and a.period=$2`, [id, period])
  if (!a) throw errors.notFound('Beban dibayar di muka')
  const book = await getBook(tx, true)
  if (!book || book.mode === 'off') return
  if (a.ends_on < book.cutover_date) {
    if (book.mode === 'active') throw new AppError(422, 'ACCOUNTING_REVIEW_REQUIRED', 'Beban sebelum cutover harus masuk saldo awal, bukan jurnal periode baru.')
    return
  }
  const code = await roleCodes(tx, book)
  const p = await findPolicy(tx, book, 'prepaid_opex', a.ends_on)
  let pendingReason: { code: string; message: string } | undefined
  if (p?.settings.method !== a.method) pendingReason = { code: 'PREPAID_METHOD_REQUIRED', message: 'Validasi metode pembebanan biaya dibayar di muka sebelum membukukan beban.' }
  const [original] = await tx.query(`select 1 from accounting_events e join accounting_posting_registry r on r.event_id=e.id and r.book_id=e.book_id
    where e.book_id=$1 and e.source_type='financial_transaction' and e.source_id=$2 and r.status='posted'`, [book.id, a.transaction_id])
  if (!original && !(a.paid_on < book.cutover_date && await openingCovers(tx, book.id, 'prepaid_expense', id))) {
    pendingReason = { code: 'PREPAID_SOURCE_REQUIRED', message: 'Pembayaran asal atau saldo awal biaya dibayar di muka belum dibukukan. Selesaikan sumber terlebih dahulu.' }
  }
  return postBusinessEvent(tx, actor, { sourceType: 'prepaid_amortization', sourceId: `${id}:${period}`, sourceVersion: '1', kind: 'source_recorded',
    effectiveDate: a.ends_on, snapshot: { prepaidExpenseId: id, transactionId: a.transaction_id, period, amountMinor: a.amount_minor, method: a.method },
    policyKind: 'prepaid_opex', description: `Beban bulanan ${id} ${period}`, pendingReason,
    lines: [{ accountCode: code('office-expense'), debitMinor: a.amount_minor, creditMinor: '0' }, { accountCode: code('prepaid-office'), debitMinor: '0', creditMinor: a.amount_minor }] }, requestId)
}
