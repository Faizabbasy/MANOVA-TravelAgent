import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { findPolicy, originalLines, postBusinessEvent, type JournalLine } from './posting'
import { getBook, type BookRow } from './setup'

type Pending = { code: string; message: string }
interface Dims { projectId?: string | null; salesOrderId?: string | null; partyId?: string | null; vendorId?: string | null }

export async function roleCodes(tx: Queryable, book: BookRow) {
  const rows = await tx.query<{ code: string; control_role: string }>('select code,control_role from accounting_accounts where book_id=$1', [book.id])
  const map = new Map(rows.map(r => [r.control_role, r.code]))
  return (role: string) => map.get(role) ?? ''
}

/**
 * Posted debit-minus-credit of one control role for a contract (sales order, else project + customer) or a
 * vendor + project, up to a date. Splits (liability vs revenue, accrual vs prepaid) are derived from the ledger,
 * never from a browser total.
 */
export async function roleBalance(tx: Queryable, book: BookRow, role: string, key: { salesOrderId?: string | null; projectId?: string | null; partyId?: string | null; vendorId?: string | null; employeeId?: string | null }, asOf: string) {
  const params: unknown[] = [book.id, role, asOf]
  let where: string
  if (key.employeeId) {
    // Staff funds are one position per employee across projects.
    params.push(key.employeeId)
    where = 'l.employee_id=$4'
  } else if (key.vendorId) {
    params.push(key.vendorId, key.projectId ?? null, key.salesOrderId ?? null)
    where = 'l.vendor_id=$4 and l.project_id is not distinct from $5 and l.sales_order_id is not distinct from $6'
  } else if (key.salesOrderId) {
    params.push(key.salesOrderId)
    where = 'l.sales_order_id=$4'
  } else {
    params.push(key.projectId ?? null, key.partyId ?? null)
    where = 'l.sales_order_id is null and l.project_id is not distinct from $4 and l.party_id is not distinct from $5'
  }
  const [row] = await tx.query<{ balance: string }>(`select coalesce(sum(l.debit_minor-l.credit_minor),0) as balance
    from accounting_journal_lines l join accounting_journals j on j.id=l.journal_id and j.status='posted'
    join accounting_accounts a on a.book_id=l.book_id and a.code=l.account_code
    where l.book_id=$1 and a.control_role=$2 and j.effective_date <= $3 and ${where}`, params)
  return BigInt(row!.balance)
}

const min = (a: bigint, b: bigint) => (a < b ? a : b)
const pos = (a: bigint) => (a > 0n ? a : 0n)

function lines(code: (r: string) => string, dims: Dims, parts: [role: string, side: 'debit' | 'credit', amount: bigint, extra?: Dims][]): JournalLine[] {
  return parts.filter(p => p[2] > 0n).map(([role, side, amount, extra]) => ({
    accountCode: code(role), debitMinor: side === 'debit' ? amount.toString() : '0', creditMinor: side === 'credit' ? amount.toString() : '0',
    projectId: dims.projectId ?? null, salesOrderId: dims.salesOrderId ?? null, partyId: dims.partyId ?? null, vendorId: dims.vendorId ?? null, ...extra
  }))
}

/** Void of a derived source: exact compensation of what was posted, or pending when nothing was posted. */
async function postVoid(tx: Queryable, actor: Actor, book: BookRow, sourceType: string, id: string, date: string, policyKind: string, snapshot: Record<string, unknown>, reason: string, requestId: string) {
  const [original] = await tx.query<{ id: string }>(`select j.id from accounting_journals j join accounting_events e on e.id=j.event_id
    where j.book_id=$1 and e.source_type=$2 and e.source_id=$3 and e.event_kind='source_recorded' and j.status='posted' and j.reversal_of_id is null`, [book.id, sourceType, id])
  return postBusinessEvent(tx, actor, { sourceType, sourceId: id, sourceVersion: 'void', kind: 'source_voided', effectiveDate: date,
    snapshot: { ...snapshot, correctionReason: reason }, policyKind, description: `Pembatalan ${id}`,
    lines: original ? await originalLines(tx, original.id) : [], reversalOfId: original?.id, correctionReason: reason,
    ...(original ? {} : { pendingReason: { code: 'OPENING_SOURCE_MAPPING_REQUIRED', message: 'Catatan asal belum mempunyai jurnal. Tinjau sumber sebelum membalik.' } }) }, requestId)
}

async function activeBook(tx: Queryable, date: string) {
  const book = await getBook(tx, true)
  if (!book || book.mode === 'off') return null
  if (date < book.cutover_date) {
    if (book.mode === 'active') throw new AppError(422, 'ACCOUNTING_REVIEW_REQUIRED', 'Kejadian sebelum cutover memerlukan koreksi saldo awal yang dapat ditelusuri.')
    return null
  }
  return book
}

/**
 * Customer side: delivered service moves deferred billing (contract liability) to revenue; delivery beyond what
 * was billed becomes a contract asset, reclassed to AR by the later invoice (never revenue twice).
 * Supplier side: received service becomes direct cost from prepaid first, the rest an accrued supplier cost.
 */
export async function postFulfillmentSource(tx: Queryable, actor: Actor, id: string, requestId: string, voidReason?: string, voidDate?: string) {
  const [f] = await tx.query<Record<string, any>>(`select id,side,project_id,sales_order_id,service_id,booking_type,booking_id,service_order_id,party_id,vendor_id,
    amount_minor,fulfilled_on,basis,is_final from service_fulfillments where id=$1`, [id])
  if (!f) throw errors.notFound('Pemenuhan jasa')
  const customer = f.side === 'customer'
  const policyKind = customer ? 'fulfillment' : 'supplier_fulfillment'
  const book = await activeBook(tx, voidDate ?? f.fulfilled_on)
  if (!book) return
  if (voidReason) return postVoid(tx, actor, book, 'service_fulfillment', id, voidDate!, policyKind, f, voidReason, requestId)
  const code = await roleCodes(tx, book)
  const amount = BigInt(f.amount_minor)
  const policy = await findPolicy(tx, book, policyKind, f.fulfilled_on)
  let parts: Parameters<typeof lines>[2] = [], pendingReason: Pending | undefined
  const dims: Dims = customer ? { projectId: f.project_id, salesOrderId: f.sales_order_id, partyId: f.party_id } : { projectId: f.project_id, salesOrderId:f.sales_order_id, vendorId: f.vendor_id }
  if (customer) {
    if (policy?.principal_agent !== 'principal' || policy.recognition !== 'fulfillment') {
      pendingReason = { code: 'RECOGNITION_POLICY_REQUIRED', message: 'Tentukan peran prinsipal/agen dan waktu pengakuan jasa ini. Jasa diberikan belum otomatis menjadi pendapatan.' }
    } else {
      const deferred = pos(-(await roleBalance(tx, book, 'contract-liability', dims, f.fulfilled_on)))
      const fromLiability = min(deferred, amount)
      parts = [['contract-liability', 'debit', fromLiability], ['contract-asset', 'debit', amount - fromLiability], ['service-revenue', 'credit', amount]]
    }
  } else if (policy?.recognition !== 'supplier-fulfillment') {
    pendingReason = { code: 'COST_POLICY_REQUIRED', message: 'Tentukan kebijakan pengakuan biaya supplier. Jasa diterima belum otomatis menjadi biaya.' }
  } else if (policy.settings.costMatching === 'receipt-links') {
    parts = [['direct-cost', 'debit', amount], ['accrued-cost', 'credit', amount]]
  } else if (book.purpose === 'rehearsal' && policy.validation_status === 'test-only') {
    const prepaid = pos(await roleBalance(tx, book, 'prepaid-trip', dims, f.fulfilled_on))
    const fromPrepaid = min(prepaid, amount)
    parts = [['direct-cost', 'debit', amount], ['prepaid-trip', 'credit', fromPrepaid], ['accrued-cost', 'credit', amount - fromPrepaid]]
  } else {
    pendingReason = { code:'SUPPLIER_MATCH_POLICY_REQUIRED',message:'Lengkapi kebijakan pencocokan invoice ke penerimaan jasa. Profil produksi tidak memakai perkiraan saldo vendor gabungan.' }
  }
  return postBusinessEvent(tx, actor, { sourceType: 'service_fulfillment', sourceId: id, sourceVersion: '1', kind: 'source_recorded', effectiveDate: f.fulfilled_on,
    snapshot: f, policyKind, description: `${customer ? 'Jasa diberikan' : 'Jasa supplier diterima'} ${id}`, lines: lines(code, dims, parts), pendingReason }, requestId)
}

/** Supplier owes money back: recovery of a recognised cost, or an unused deposit becoming a claim. Not revenue. */
export async function postSupplierClaimSource(tx: Queryable, actor: Actor, id: string, requestId: string, voidReason?: string, voidDate?: string) {
  const [c] = await tx.query<Record<string, any>>('select id,vendor_id,project_id,sales_order_id,basis,source_payment_id,amount_minor,recognized_on from supplier_claims where id=$1', [id])
  if (!c) throw errors.notFound('Klaim supplier')
  if (!c.sales_order_id) delete c.sales_order_id // Preserve fingerprints of existing pending events.
  const book = await activeBook(tx, voidDate ?? c.recognized_on)
  if (!book) return
  if (voidReason) return postVoid(tx, actor, book, 'supplier_claim', id, voidDate!, 'supplier_claim', c, voidReason, requestId)
  const code = await roleCodes(tx, book)
  const amount = BigInt(c.amount_minor)
  const claimDims: Dims = { projectId: c.project_id, salesOrderId:c.sales_order_id, vendorId: c.vendor_id }
  let parts: Parameters<typeof lines>[2]
  if (c.basis === 'deposit-recovery') {
    // The advance keeps the dimensions of the original deposit; the claim follows it.
    const [p] = await tx.query<{ project_id: string | null }>('select project_id from financial_transactions where id=$1', [c.source_payment_id])
    parts = [['supplier-claim', 'debit', amount], ['supplier-advance', 'credit', amount, { projectId: p?.project_id ?? null,salesOrderId:null }]]
  } else parts = [['supplier-claim', 'debit', amount], ['direct-cost', 'credit', amount]]
  return postBusinessEvent(tx, actor, { sourceType: 'supplier_claim', sourceId: id, sourceVersion: '1', kind: 'source_recorded', effectiveDate: c.recognized_on,
    snapshot: c, policyKind: 'supplier_claim', description: `Klaim supplier ${id}`, lines: lines(code, claimDims, parts) }, requestId)
}

/**
 * Credit note: lowers AR (reduce_receivable) or creates a refund obligation (refund_liability). It first reduces
 * what was billed but not yet earned; only the remainder adjusts recognised revenue. Settlement later moves cash.
 */
export async function postCreditNoteSource(tx: Queryable, actor: Actor, id: string, requestId: string, voidReason?: string, voidDate?: string) {
  const [c] = await tx.query<Record<string, any>>(`select c.id,c.customer_invoice_id,c.effect,c.amount_minor,c.refund_id,
    (c.created_at at time zone coalesce((select timezone from accounting_books where singleton),'Asia/Jakarta'))::date::text as credit_date,
    i.project_id,i.party_id,i.sales_order_id from credit_notes c join customer_invoices i on i.id=c.customer_invoice_id where c.id=$1`, [id])
  if (!c) throw errors.notFound('Credit note')
  const book = await activeBook(tx, voidDate ?? c.credit_date)
  if (!book) return
  if (voidReason) return postVoid(tx, actor, book, 'credit_note', id, voidDate!, 'refund', c, voidReason, requestId)
  const code = await roleCodes(tx, book)
  const amount = BigInt(c.amount_minor)
  const dims: Dims = { projectId: c.project_id, salesOrderId: c.sales_order_id, partyId: c.party_id }
  const policy = await findPolicy(tx, book, 'customer_billing', c.credit_date)
  let parts: Parameters<typeof lines>[2] = [], pendingReason: Pending | undefined
  if (policy?.principal_agent !== 'principal') {
    pendingReason = { code: 'INVOICE_POLICY_REQUIRED', message: 'Koreksi tagihan mengikuti kebijakan penagihan kontrak yang belum lengkap.' }
  } else {
    const deferred = pos(-(await roleBalance(tx, book, 'contract-liability', dims, c.credit_date)))
    const fromLiability = min(deferred, amount)
    parts = [['contract-liability', 'debit', fromLiability], ['service-revenue', 'debit', amount - fromLiability],
      [c.effect === 'refund_liability' ? 'refund-payable' : 'receivable', 'credit', amount]]
  }
  return postBusinessEvent(tx, actor, { sourceType: 'credit_note', sourceId: id, sourceVersion: '1', kind: 'source_recorded', effectiveDate: c.credit_date,
    snapshot: c, policyKind: 'refund', description: `${c.effect === 'refund_liability' ? 'Kewajiban refund' : 'Pengurangan tagihan'} ${id}`,
    lines: lines(code, dims, parts), pendingReason }, requestId)
}
