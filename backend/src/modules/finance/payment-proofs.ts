import type { Actor } from '../../auth/rbac'
import type { Db, Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { parseAmountMinor } from '../../shared/money'
import { notifyInternal } from '../core/client-writes'
import { notify } from '../core/notifications'
import { postReceipt } from './receivables'

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : str(v))
const day = (v: unknown) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10))

/** S12c-1: a client's proof of payment for an invoice; Finance verifies it by posting the receipt (the official amount). */
export async function submitPaymentProof(tx: Queryable, actor: Actor, partyId: string, invoiceId: string, input: Record<string, unknown>, today: string, requestId: string) {
  const problems: FieldErrors = {}
  const reference = typeof input.reference === 'string' ? input.reference.trim() : ''
  if (!reference || reference.length > 120) problems.reference = ['Nomor referensi transfer wajib diisi (maks. 120 karakter).']
  let amount = 0n
  try { amount = parseAmountMinor(input.amountMinor, 'amountMinor') } catch { problems.amountMinor = ['Nominal harus angka rupiah > 0.'] }
  const transferDate = typeof input.transferDate === 'string' && isIsoDate(input.transferDate) ? input.transferDate : null
  if (!transferDate) problems.transferDate = ['Tanggal transfer harus YYYY-MM-DD.']
  else if (transferDate > today) problems.transferDate = ['Tanggal transfer tidak boleh di masa depan.']
  const opt = (v: unknown, field: string, max: number) => {
    if (v === undefined || v === null || v === '') return null
    if (typeof v !== 'string' || v.trim().length > max) { problems[field] = [`Maksimal ${max} karakter.`]; return null }
    return v.trim() || null
  }
  const senderBank = opt(input.senderBank, 'senderBank', 100)
  const note = opt(input.note, 'note', 1000)
  const fileName = opt(input.fileName, 'fileName', 200)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const [inv] = await tx.query<{ id: string; number: string | null; project_id: string; outstanding_minor: string }>(
    `select i.id, i.number, i.project_id, b.total_minor - b.paid_minor - b.credited_minor as outstanding_minor
       from customer_invoices i join v_customer_invoice_balances b on b.invoice_id = i.id
      where i.id = $1 and i.party_id = $2 and i.status = 'issued' for update of i`, [invoiceId, partyId])
  if (!inv) throw errors.notFound('Invoice')
  if (BigInt(inv.outstanding_minor) <= 0n) throw rule('Invoice ini sudah lunas.')
  if (amount > BigInt(inv.outstanding_minor)) throw errors.validation({ amountMinor: [`Nominal melebihi sisa tagihan (${inv.outstanding_minor}).`] })
  if ((await tx.query("select 1 from payment_proofs where customer_invoice_id = $1 and status = 'submitted'", [invoiceId])).length)
    throw rule('Bukti pembayaran sebelumnya masih menunggu verifikasi.')
  const id = await nextId(tx, 'PPF-')
  await tx.query(
    `insert into payment_proofs (id, customer_invoice_id, party_id, submitted_by, reference, amount_minor, transfer_date, sender_bank, note, file_name)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, invoiceId, partyId, actor.userId, reference, amount.toString(), transferDate, senderBank, note, fileName])
  const finance = await tx.query<{ id: string }>("select id from users where role = 'finance' and status = 'active' order by id")
  for (const u of finance) {
    await notifyInternal(tx, actor, u.id, { type: 'reminder', title: `Bukti bayar ${inv.number ?? invoiceId} menunggu verifikasi`,
      body: `Ref. ${reference} — Rp ${amount.toString()} (transfer ${transferDate}).`, entityType: 'invoice', entityId: invoiceId })
  }
  await recordAudit(tx, { action: 'finance.payment_proof_submitted', actorUserId: actor.userId, entityType: 'customer_invoice', entityId: invoiceId, requestId,
    after: { proofId: id, reference, amountMinor: amount.toString(), transferDate } })
  return { id }
}

export async function listPaymentProofs(db: Queryable, filter: { id?: string; invoiceId?: string; partyId?: string; status?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select pp.*, i.number as invoice_number, i.project_id, pt.name as party_name, su.name as submitted_by_name
       from payment_proofs pp
       join customer_invoices i on i.id = pp.customer_invoice_id
       join parties pt on pt.id = pp.party_id
       left join users su on su.id = pp.submitted_by
      where ($1::text is null or pp.id = $1) and ($2::text is null or pp.customer_invoice_id = $2)
        and ($3::text is null or pp.party_id = $3) and ($4::text is null or pp.status = $4)
      order by pp.created_at desc, pp.id desc`,
    [filter.id ?? null, filter.invoiceId ?? null, filter.partyId ?? null, filter.status ?? null])
  return rows.map(r => ({
    id: r.id as string,
    invoiceId: r.customer_invoice_id as string,
    invoiceNumber: str(r.invoice_number),
    partyId: r.party_id as string,
    partyName: r.party_name as string,
    projectId: r.project_id as string,
    submittedBy: r.submitted_by as string,
    submittedByName: str(r.submitted_by_name),
    reference: r.reference as string,
    amountMinor: String(r.amount_minor),
    transferDate: day(r.transfer_date)!,
    senderBank: str(r.sender_bank),
    note: str(r.note),
    fileName: str(r.file_name),
    status: r.status as string,
    reviewedBy: str(r.reviewed_by),
    reviewedAt: iso(r.reviewed_at),
    rejectionReason: str(r.rejection_reason),
    receiptTransactionId: str(r.receipt_transaction_id),
    submittedAt: iso(r.created_at)!
  }))
}

export type PaymentProofView = Awaited<ReturnType<typeof listPaymentProofs>>[number]

/** The client sees its own proof without staff ids or the Finance transaction. */
export const clientPaymentProof = (p: PaymentProofView) => ({
  id: p.id, status: p.status, reference: p.reference, amountMinor: p.amountMinor, transferDate: p.transferDate, senderBank: p.senderBank,
  note: p.note, fileName: p.fileName, submittedAt: p.submittedAt, reviewedAt: p.reviewedAt, rejectionReason: p.rejectionReason
})

/** The first time the client opens an issued (or void) invoice of its own. */
export async function markInvoiceViewed(tx: Queryable, partyId: string, invoiceId: string) {
  const [inv] = await tx.query<{ client_viewed_at: Date | null }>(
    "select client_viewed_at from customer_invoices where id = $1 and party_id = $2 and status in ('issued', 'void') for update", [invoiceId, partyId])
  if (!inv) throw errors.notFound('Invoice')
  if (!inv.client_viewed_at) await tx.query('update customer_invoices set client_viewed_at = now() where id = $1', [invoiceId])
  const [row] = await tx.query<{ client_viewed_at: Date }>('select client_viewed_at from customer_invoices where id = $1', [invoiceId])
  return { viewedAt: row!.client_viewed_at.toISOString() }
}

/** Kept for the Db-typed callers (Finance invoice detail). */
export const paymentProofsOfInvoice = (db: Db, invoiceId: string) => listPaymentProofs(db, { invoiceId })

async function lockProof(tx: Queryable, id: string) {
  const [p] = await tx.query<{ id: string; customer_invoice_id: string; party_id: string; submitted_by: string; status: string; reference: string; project_id: string }>(
    `select pp.id, pp.customer_invoice_id, pp.party_id, pp.submitted_by, pp.status, pp.reference, i.project_id
       from payment_proofs pp join customer_invoices i on i.id = pp.customer_invoice_id where pp.id = $1 for update of pp`, [id])
  if (!p) throw errors.notFound('Bukti pembayaran')
  if (p.status !== 'submitted') throw rule('Bukti pembayaran ini sudah diputuskan.')
  return p
}

/** Finance verify a proof by posting the receipt it describes (Finance sets the official amount and account). */
export async function verifyPaymentProof(tx: Queryable, actor: Actor, id: string, input: { bankAccountId: string; amountMinor: string; effectiveDate: string; reference?: string }, requestId: string) {
  const p = await lockProof(tx, id)
  const receipt = await postReceipt(tx, actor, {
    bankAccountId: input.bankAccountId, amountMinor: input.amountMinor, effectiveDate: input.effectiveDate, partyId: p.party_id, projectId: p.project_id,
    reference: input.reference?.trim() || p.reference, memo: `Bukti bayar client ${id}`,
    allocations: [{ invoiceId: p.customer_invoice_id, amountMinor: input.amountMinor }]
  }, requestId)
  await tx.query("update payment_proofs set status = 'verified', reviewed_by = $2, reviewed_at = now(), receipt_transaction_id = $3 where id = $1", [id, actor.userId, receipt.transactionId])
  await notify(tx, { userId: p.submitted_by, actorUserId: actor.userId, type: 'reminder', title: 'Pembayaran Anda telah diverifikasi',
    body: `Bukti ${p.reference} untuk invoice ${p.customer_invoice_id} telah kami terima.`, entityType: 'invoice', entityId: p.customer_invoice_id })
  await recordAudit(tx, { action: 'finance.payment_proof_verified', actorUserId: actor.userId, entityType: 'customer_invoice', entityId: p.customer_invoice_id, requestId,
    after: { proofId: id, transactionId: receipt.transactionId, amountMinor: input.amountMinor } })
  return { id, transactionId: receipt.transactionId }
}

export async function rejectPaymentProof(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, requestId: string) {
  const reason = typeof reasonInput === 'string' ? reasonInput.trim() : ''
  if (!reason) throw errors.validation({ reason: ['Alasan penolakan wajib diisi.'] })
  const p = await lockProof(tx, id)
  await tx.query("update payment_proofs set status = 'rejected', reviewed_by = $2, reviewed_at = now(), rejection_reason = $3 where id = $1", [id, actor.userId, reason.slice(0, 1000)])
  await notify(tx, { userId: p.submitted_by, actorUserId: actor.userId, type: 'reminder', title: 'Bukti pembayaran Anda ditolak',
    body: reason, entityType: 'invoice', entityId: p.customer_invoice_id })
  await recordAudit(tx, { action: 'finance.payment_proof_rejected', actorUserId: actor.userId, entityType: 'customer_invoice', entityId: p.customer_invoice_id, requestId, reason })
}
