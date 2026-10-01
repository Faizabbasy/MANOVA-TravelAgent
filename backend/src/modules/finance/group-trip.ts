import type { Actor } from '../../auth/rbac'
import type { Db, Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { errors } from '../../http/errors'
import { parseMovementAmount, rule } from './common'
import { validateEffectiveDate } from './postings'
import { createInvoiceDraft, issueInvoice, postReceipt } from './receivables'

/**
 * Group Trip B2C — DP per participant booking (sales order). Confirming the DP issues one invoice for the full
 * booking price to the participant (not the trip organiser) and records the DP received against it, in one
 * transaction. The rest is paid later like any invoice. Mirrors the V2 rule: DP at least 30% of the price.
 */

export const MINIMUM_DP_PERCENT = 30n

const PAYMENT_LABEL = { not_invoiced: 'Menunggu DP', invoiced: 'Belum dibayar', dp_received: 'DP diterima', paid: 'Lunas' } as const
type SalesOrderPaymentStatus = keyof typeof PAYMENT_LABEL

type SalesOrderRow = { id: string; project_id: string; party_id: string; price_minor: string }

async function readSalesOrder (q: Queryable, id: string, lock = false): Promise<SalesOrderRow> {
  if (!ID_PATTERN.test(id)) throw errors.notFound('Sales order')
  const [so] = await q.query<SalesOrderRow>(
    `select id, project_id, party_id, price_minor from sales_order_refs where id = $1${lock ? ' for update' : ''}`, [id])
  if (!so) throw errors.notFound('Sales order')
  return so
}

export function minimumDp (price: bigint): bigint {
  return (price * MINIMUM_DP_PERCENT + 99n) / 100n
}

export interface ConfirmDpInput { bankAccountId: string; dpAmountMinor: string; effectiveDate: string; dueDate: string }

export async function confirmGroupTripDp (tx: Queryable, actor: Actor, id: string, input: ConfirmDpInput, requestId: string) {
  const so = await readSalesOrder(tx, id, true)
  const price = BigInt(so.price_minor)
  const dp = parseMovementAmount(input.dpAmountMinor, 'dpAmountMinor')
  const minimum = minimumDp(price)
  if (dp < minimum) throw errors.validation({ dpAmountMinor: [`DP minimal ${minimum} (30% dari harga booking ${price}).`] })
  if (dp > price) throw errors.validation({ dpAmountMinor: [`DP melebihi harga booking (${price}).`] })
  const effectiveDate = validateEffectiveDate(input.effectiveDate)
  const [existing] = await tx.query<{ id: string }>("select id from customer_invoices where sales_order_id = $1 and status <> 'void'", [so.id])
  if (existing) throw rule(`DP sales order ini sudah dikonfirmasi (invoice ${existing.id}).`)

  const draft = await createInvoiceDraft(tx, actor, {
    salesOrderId: so.id,
    invoiceType: 'dp',
    dueDate: input.dueDate,
    lines: [{ description: `Booking Group Trip ${so.id}`, amountMinor: price.toString() }]
  }, requestId)
  const issued = await issueInvoice(tx, actor, draft.id, { issueDate: effectiveDate, dueDate: input.dueDate }, requestId)
  const receipt = await postReceipt(tx, actor, {
    bankAccountId: input.bankAccountId,
    amountMinor: dp.toString(),
    effectiveDate,
    partyId: so.party_id,
    projectId: so.project_id,
    reference: so.id,
    allocations: [{ invoiceId: draft.id, amountMinor: dp.toString() }]
  }, requestId)
  return {
    invoiceId: draft.id,
    invoiceNumber: issued.number,
    transactionId: receipt.transactionId,
    outstandingMinor: receipt.allocations[0]!.outstandingMinor,
    minimumDpMinor: minimum.toString()
  }
}

/** Finance/Super Admin get the figures; Admin the status label only (server-decided, never amounts). */
export async function salesOrderFinanceSummary (db: Db, id: string, full: boolean) {
  const so = await readSalesOrder(db, id)
  // The base DP invoice plus any debit notes on it (same sales_order_id), issued ones only.
  const rows = await db.query<{ id: string; invoice_type: string; total_minor: string; paid_minor: string; credited_minor: string }>(
    `select i.id, i.invoice_type, b.total_minor, b.paid_minor, b.credited_minor
       from customer_invoices i join v_customer_invoice_balances b on b.invoice_id = i.id
      where i.sales_order_id = $1 and i.status = 'issued'`, [so.id])
  const base = rows.find(r => r.invoice_type !== 'debit_note')
  const sum = (key: 'total_minor' | 'paid_minor' | 'credited_minor') => rows.reduce((s, r) => s + BigInt(r[key]), 0n)
  const invoiced = sum('total_minor')
  const received = sum('paid_minor')
  const outstanding = base ? invoiced - received - sum('credited_minor') : BigInt(so.price_minor)
  const paymentStatus: SalesOrderPaymentStatus = !base ? 'not_invoiced' : outstanding === 0n ? 'paid' : received > 0n ? 'dp_received' : 'invoiced'
  const label = PAYMENT_LABEL[paymentStatus]
  if (!full) return { view: 'status' as const, salesOrderId: so.id, paymentStatus, label }
  return {
    view: 'full' as const,
    salesOrderId: so.id,
    priceMinor: so.price_minor,
    invoicedMinor: invoiced.toString(),
    receivedMinor: received.toString(),
    outstandingMinor: outstanding.toString(),
    invoiceId: base?.id ?? null,
    paymentStatus,
    label
  }
}
