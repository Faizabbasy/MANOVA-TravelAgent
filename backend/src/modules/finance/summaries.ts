import type { Db, Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { errors } from '../../http/errors'
import { todayBusinessDate } from './common'
import { invoiceRowDto } from './receivables'
import { vendorInvoiceDto } from './payables'
import { activeCaseFor, type RefundSettlementState } from './refunds'

/**
 * Finance context for other screens, computed from the same records as the Finance menus (no copies).
 * Two shapes (ADR-007 #3):
 *  - full   (finance.view-project-finance: Finance, Super Admin) — amounts, lists, profitability
 *  - status (project-order.view-payment-status: Admin)            — payment status WITHOUT any amount
 */

export type PaymentStatus = 'not_invoiced' | 'awaiting_payment' | 'dp_received' | 'partially_paid' | 'up_to_date' | 'paid' | 'overdue' | 'cancelled'

const STATUS_LABEL: Record<PaymentStatus, string> = {
  not_invoiced: 'Belum ditagih',
  awaiting_payment: 'Menunggu pembayaran',
  dp_received: 'DP diterima',
  partially_paid: 'Dibayar sebagian',
  up_to_date: 'Tagihan terbit sudah lunas',
  paid: 'Lunas',
  overdue: 'Terlambat',
  cancelled: 'Dibatalkan'
}

export interface InvoiceBalanceRow extends Record<string, any> {
  invoice_type: string
  status: string
  due_date: string
  total_minor: string
  paid_minor: string
  credited_minor: string
  outstanding_minor: string
}

/**
 * One rule for every screen. Overdue beats everything. "Lunas" only when every issued invoice is settled AND
 * nothing is left to bill (`moreToBill`: planned billing, or invoiced below the contract/sell value) —
 * Admin sees only this label, so it must not claim "paid" while most of the contract is not invoiced yet.
 * Invoices zeroed purely by credit notes (no money) are left out: they are neither owed nor paid.
 */
function derivePaymentStatus(invoices: InvoiceBalanceRow[], today: string, moreToBill: boolean): PaymentStatus {
  const issued = invoices.filter(i => i.status === 'issued' && !(BigInt(i.outstanding_minor) === 0n && BigInt(i.paid_minor) === 0n))
  if (!issued.length) return 'not_invoiced'
  const outstanding = (i: InvoiceBalanceRow) => BigInt(i.outstanding_minor)
  if (issued.some(i => outstanding(i) > 0n && i.due_date < today)) return 'overdue'
  const dp = issued.filter(i => i.invoice_type === 'dp')
  if (issued.every(i => outstanding(i) === 0n)) {
    if (!moreToBill) return 'paid'
    return dp.length ? 'dp_received' : 'up_to_date'
  }
  if (dp.length && dp.every(i => outstanding(i) === 0n)) return 'dp_received'
  if (issued.some(i => BigInt(i.paid_minor) > 0n || BigInt(i.credited_minor) > 0n)) return 'partially_paid'
  return 'awaiting_payment'
}

export function statusView(invoices: InvoiceBalanceRow[], today: string, moreToBill: boolean) {
  const status = derivePaymentStatus(invoices, today, moreToBill)
  const open = invoices.filter(i => i.status === 'issued' && BigInt(i.outstanding_minor) > 0n)
  return {
    paymentStatus: status,
    label: STATUS_LABEL[status],
    hasOverdue: open.some(i => i.due_date < today),
    openInvoiceCount: open.length,
    nextDueDate: open.map(i => i.due_date).sort()[0] ?? null,
    /** Facts the operational workflow gates on (no amounts): a DP invoice is issued / money was received on one. */
    dpInvoiced: invoices.some(i => i.status === 'issued' && i.invoice_type === 'dp'),
    dpReceived: invoices.some(i => i.status === 'issued' && i.invoice_type === 'dp' && BigInt(i.paid_minor) > 0n)
  }
}

const sum = (rows: Record<string, any>[], key: string) => rows.reduce((s, r) => s + BigInt(r[key] ?? 0), 0n)

/**
 * A live cancellation case overrides the payment status ("Dibatalkan") everywhere, including for Admin. Full
 * views add the refund figures; status views only the case state.
 */
function cancellationView (c: Record<string, any> | null, full: boolean) {
  if (!c) return null
  const settlement: RefundSettlementState = c.status !== 'approved' ? null
    : BigInt(c.refundable_minor) === 0n ? 'none' : BigInt(c.outstanding_minor) === 0n ? 'settled' : BigInt(c.settled_minor) > 0n ? 'partial' : 'unpaid'
  const base = { refundId: c.id as string, subjectType: c.subject_type as string, status: c.status as string, settlement, cancelDate: c.cancel_date as string }
  if (!full) return base
  return {
    ...base,
    refundableMinor: c.refundable_minor as string,
    settledMinor: c.settled_minor as string,
    outstandingMinor: c.outstanding_minor as string,
    retainedMinor: c.retained_minor as string,
    writtenOffMinor: c.written_off_minor as string
  }
}

export function withCancellation<T extends { paymentStatus: PaymentStatus; label: string; hasOverdue: boolean }> (status: T, c: Record<string, any> | null): T {
  if (!c) return status
  return { ...status, paymentStatus: 'cancelled', label: STATUS_LABEL.cancelled, hasOverdue: false }
}

export const INVOICES_WITH_BALANCE = `
  select i.*, p.name as project_name, pa.name as party_name, b.paid_minor, b.credited_minor,
         -- unpaid balances written off by a cancellation: billed all the same (not "still to bill")
         coalesce((select sum(c.amount_minor) from credit_notes c where c.customer_invoice_id = i.id and c.status = 'issued' and c.effect = 'reduce_receivable' and c.refund_id is not null), 0) as cancel_writeoff_minor,
         (b.total_minor - b.paid_minor - b.credited_minor) as outstanding_minor
    from customer_invoices i
    join projects p on p.id = i.project_id
    join parties pa on pa.id = i.party_id
    join v_customer_invoice_balances b on b.invoice_id = i.id`

export const VENDOR_INVOICES_WITH_BALANCE = `
  select v.*, ve.name as vendor_name, p.name as project_name, b.paid_minor, (b.total_minor - b.paid_minor) as outstanding_minor
    from vendor_invoices v
    join vendors ve on ve.id = v.vendor_id
    left join projects p on p.id = v.project_id
    join v_vendor_invoice_balances b on b.vendor_invoice_id = v.id`

function receivableTotals(invoices: InvoiceBalanceRow[], today: string) {
  const issued = invoices.filter(i => i.status === 'issued')
  return {
    invoicedMinor: sum(issued, 'total_minor').toString(),
    creditedMinor: sum(issued, 'credited_minor').toString(),
    receivedMinor: sum(issued, 'paid_minor').toString(),
    outstandingMinor: sum(issued, 'outstanding_minor').toString(),
    overdueMinor: sum(issued.filter(i => i.due_date < today), 'outstanding_minor').toString(),
    invoiceCount: issued.length,
    draftCount: invoices.filter(i => i.status === 'draft').length
  }
}

function payableTotals(rows: Record<string, any>[], today: string) {
  const approved = rows.filter(r => r.status === 'approved')
  const review = rows.filter(r => ['submitted', 'under_review'].includes(r.status))
  return {
    approvedMinor: sum(approved, 'total_minor').toString(),
    paidMinor: sum(approved, 'paid_minor').toString(),
    outstandingMinor: sum(approved, 'outstanding_minor').toString(),
    overdueMinor: sum(approved.filter(r => r.due_date < today), 'outstanding_minor').toString(),
    pendingReviewMinor: sum(review, 'total_minor').toString(),
    pendingReviewCount: review.length,
    invoiceCount: approved.length
  }
}

/** Expenses booked against a project, leaving out reversed pairs (they never happened). */
async function projectExpenses(db: Db, where: string, params: unknown[]): Promise<bigint> {
  const [row] = await db.query<{ total: string }>(
    `select coalesce(sum(t.amount_minor), 0) as total from financial_transactions t
      where t.kind = 'expense' and t.reversal_of_id is null
        and not exists (select 1 from financial_transactions r where r.reversal_of_id = t.id) and ${where}`,
    params
  )
  return BigInt(row!.total)
}

/** Something is still to be billed: planned schedule items, or issued invoices (net of credits) below the contract value. */
/** The same rule for every project at once (or one project): project id → still something to bill. */
export async function moreToBillByProject(db: Queryable, projectId: string | null = null): Promise<Map<string, boolean>> {
  const rows = await db.query<{ id: string; planned: string; contract: string | null; billed: string }>(
    `select p.id,
            (select count(*) from billing_schedule_items s where s.project_id = p.id and s.status = 'planned') as planned,
            p.contract_value_minor as contract,
            coalesce((select sum(b.total_minor - b.credited_minor + coalesce((select sum(c.amount_minor) from credit_notes c where c.customer_invoice_id = i.id and c.status = 'issued' and c.effect = 'reduce_receivable' and c.refund_id is not null), 0)) from customer_invoices i join v_customer_invoice_balances b on b.invoice_id = i.id
                       where i.project_id = p.id and i.status = 'issued'), 0) as billed
       from projects p${projectId ? ' where p.id = $1' : ''}`,
    projectId ? [projectId] : []
  )
  return new Map(rows.map(r => [r.id, Number(r.planned) > 0 || (r.contract !== null && BigInt(r.billed) < BigInt(r.contract))]))
}

async function projectHasMoreToBill(db: Db, projectId: string): Promise<boolean> {
  return (await moreToBillByProject(db, projectId)).get(projectId) ?? false
}

export async function projectFinanceSummary(db: Db, projectId: string, full: boolean) {
  const today = todayBusinessDate()
  const [project] = await db.query<{ id: string; contract_value_minor: string | null; contract_currency: string }>(
    'select id, contract_value_minor, contract_currency from projects where id = $1', [projectId]
  )
  if (!project) throw errors.notFound('Project')
  const invoices = await db.query<InvoiceBalanceRow>(`${INVOICES_WITH_BALANCE} where i.project_id = $1 and i.status <> 'void' order by i.due_date nulls last, i.id`, [projectId])
  const cancelled = await activeCaseFor(db, { type: 'project', id: projectId, projectId })
  const status = withCancellation(statusView(invoices, today, cancelled ? false : await projectHasMoreToBill(db, projectId)), cancelled)
  if (!full) return { projectId, view: 'status' as const, ...status, cancellation: cancellationView(cancelled, false) }

  const vendorInvoices = await db.query<Record<string, any>>(`${VENDOR_INVOICES_WITH_BALANCE} where v.project_id = $1 and v.status not in ('rejected', 'void') order by v.due_date, v.id`, [projectId])
  const [schedule] = await db.query<{ total: string }>(
    "select coalesce(sum(amount_minor), 0) as total from billing_schedule_items where project_id = $1 and status = 'planned'", [projectId]
  )
  const receivable = receivableTotals(invoices, today)
  const payable = payableTotals(vendorInvoices, today)
  const expenses = await projectExpenses(db, 't.project_id = $1', [projectId])
  // Refunds granted on cancellation reduce revenue (refund_liability credit notes), never the receivable.
  const [refundCredits] = await db.query<{ total: string }>(
    `select coalesce(sum(c.amount_minor), 0) as total from credit_notes c join customer_invoices i on i.id = c.customer_invoice_id
      where i.project_id = $1 and c.status = 'issued' and c.effect = 'refund_liability'`, [projectId]
  )
  const [refunds] = await db.query<{ open: string; outstanding: string }>(
    `select count(*) filter (where r.status = 'requested' or (r.status = 'approved' and b.refundable_minor - b.settled_minor > 0)) as open,
            coalesce(sum(b.refundable_minor - b.settled_minor) filter (where r.status = 'approved'), 0) as outstanding
       from refunds r join v_refund_balances b on b.refund_id = r.id where r.project_id = $1`, [projectId]
  )
  // Write-offs from cancellations reduce what is owed, not what was billed; revenue nets them and refunds.
  const writeOffs = sum(invoices.filter(i => i.status === 'issued'), 'cancel_writeoff_minor')
  const billed = BigInt(receivable.invoicedMinor) - BigInt(receivable.creditedMinor) + writeOffs
  const revenue = billed - writeOffs - BigInt(refundCredits!.total)
  const cost = BigInt(payable.approvedMinor) + expenses
  const contract = project.contract_value_minor === null ? null : BigInt(project.contract_value_minor)
  // A cancelled project has nothing left to bill.
  const uninvoiced = contract === null ? null : cancelled ? 0n : contract - billed > 0n ? contract - billed : 0n
  return {
    projectId,
    view: 'full' as const,
    ...status,
    currency: project.contract_currency,
    contractValueMinor: project.contract_value_minor,
    receivable: { ...receivable, uninvoicedMinor: uninvoiced?.toString() ?? null, scheduledNotInvoicedMinor: schedule!.total },
    payable,
    projectExpensesMinor: expenses.toString(),
    cancellation: cancellationView(cancelled, true),
    /** Every refund case of the project (whole project or per booking): still to decide or to pay. */
    refunds: { openCount: Number(refunds!.open), outstandingMinor: refunds!.outstanding, refundCreditedMinor: refundCredits!.total },
    /** Accrual view: revenue = invoiced − credit notes − refunds granted; cost = approved vendor invoices + project expenses. */
    profitability: {
      revenueMinor: revenue.toString(),
      costMinor: cost.toString(),
      grossProfitMinor: (revenue - cost).toString(),
      marginBasisPoints: revenue > 0n ? Number(((revenue - cost) * 10_000n) / revenue) : null
    },
    invoices: invoices.map(i => invoiceRowDto(i, today)),
    vendorInvoices: vendorInvoices.map(v => vendorInvoiceDto(v, today))
  }
}

export async function bookingFinanceSummary(db: Db, type: string, id: string, full: boolean) {
  const today = todayBusinessDate()
  const [booking] = await db.query<{ project_id: string; sell_amount_minor: string | null; departure_date: string | null }>(
    'select project_id, sell_amount_minor, departure_date from booking_refs where booking_type = $1 and booking_id = $2', [type, id]
  )
  if (!booking) throw errors.notFound('Booking')
  const invoices = await db.query<InvoiceBalanceRow>(
    `${INVOICES_WITH_BALANCE} where i.booking_type = $1 and i.booking_id = $2 and i.status <> 'void' order by i.due_date nulls last, i.id`, [type, id]
  )
  const [plannedForBooking] = await db.query<{ n: string }>(
    "select count(*) as n from billing_schedule_items where booking_type = $1 and booking_id = $2 and status = 'planned'", [type, id]
  )
  const billedNet = invoices.filter(i => i.status === 'issued').reduce((s, i) => s + BigInt(i.total_minor) - BigInt(i.credited_minor) + BigInt(i.cancel_writeoff_minor), 0n)
  const moreToBill = Number(plannedForBooking!.n) > 0 || (booking.sell_amount_minor !== null && billedNet < BigInt(booking.sell_amount_minor))
  const cancelled = await activeCaseFor(db, { type: type as 'flight', id, projectId: booking.project_id })
  const status = withCancellation(statusView(invoices, today, cancelled ? false : moreToBill), cancelled)
  if (!full) return { booking: { type, id }, projectId: booking.project_id, view: 'status' as const, ...status, cancellation: cancellationView(cancelled, false) }
  const vendorInvoices = await db.query<Record<string, any>>(
    `${VENDOR_INVOICES_WITH_BALANCE} where v.booking_type = $1 and v.booking_id = $2 and v.status not in ('rejected', 'void') order by v.due_date, v.id`, [type, id]
  )
  return {
    booking: { type, id },
    projectId: booking.project_id,
    view: 'full' as const,
    ...status,
    sellAmountMinor: booking.sell_amount_minor,
    departureDate: booking.departure_date,
    cancellation: cancellationView(cancelled, true),
    receivable: receivableTotals(invoices, today),
    payable: payableTotals(vendorInvoices, today),
    invoices: invoices.map(i => invoiceRowDto(i, today)),
    vendorInvoices: vendorInvoices.map(v => vendorInvoiceDto(v, today))
  }
}

export async function vendorFinanceSummary(db: Db, vendorId: string, full: boolean) {
  const today = todayBusinessDate()
  if (!(await db.query('select 1 from vendors where id = $1', [vendorId])).length) throw errors.notFound('Vendor')
  const rows = await db.query<Record<string, any>>(`${VENDOR_INVOICES_WITH_BALANCE} where v.vendor_id = $1 order by v.due_date desc, v.id desc`, [vendorId])
  const open = rows.filter(r => r.status === 'approved' && BigInt(r.outstanding_minor) > 0n)
  const status = {
    pendingReviewCount: rows.filter(r => ['submitted', 'under_review'].includes(r.status)).length,
    awaitingPaymentCount: open.length,
    overdueCount: open.filter(r => r.due_date < today).length,
    nextDueDate: open.map(r => r.due_date as string).sort()[0] ?? null
  }
  if (!full) return { vendorId, view: 'status' as const, ...status }
  const [advance] = await db.query<{ total: string }>(
    'select coalesce(sum(unallocated_minor), 0) as total from v_unallocated_payments where kind = $1 and vendor_id = $2', ['vendor_payment', vendorId]
  )
  return {
    vendorId,
    view: 'full' as const,
    ...status,
    payable: payableTotals(rows, today),
    /** Paid to this vendor but not yet matched to an invoice (deposit). */
    depositUnallocatedMinor: advance!.total,
    invoices: rows.slice(0, 50).map(r => vendorInvoiceDto(r, today))
  }
}

export async function partyFinanceSummary(db: Db, partyId: string, full: boolean) {
  const today = todayBusinessDate()
  if (!(await db.query('select 1 from parties where id = $1', [partyId])).length) throw errors.notFound('Customer')
  const invoices = await db.query<InvoiceBalanceRow>(`${INVOICES_WITH_BALANCE} where i.party_id = $1 and i.status <> 'void' order by i.due_date desc nulls last, i.id desc`, [partyId])
  const projects = await db.query<{ id: string }>('select id from projects where party_id = $1', [partyId])
  let moreToBill = false
  for (const p of projects) if (await projectHasMoreToBill(db, p.id)) { moreToBill = true; break }
  const status = statusView(invoices, today, moreToBill)
  if (!full) return { partyId, view: 'status' as const, ...status }
  const [advance] = await db.query<{ total: string }>(
    'select coalesce(sum(unallocated_minor), 0) as total from v_unallocated_payments where kind = $1 and party_id = $2', ['customer_receipt', partyId]
  )
  return {
    partyId,
    view: 'full' as const,
    ...status,
    receivable: receivableTotals(invoices, today),
    /** Received from this customer but not yet matched to an invoice (uang muka). */
    advanceUnallocatedMinor: advance!.total,
    invoices: invoices.slice(0, 50).map(i => invoiceRowDto(i, today))
  }
}

/** Receipts / vendor payments that still hold unallocated money (customer advances, vendor deposits). */
export async function listAdvances(db: Db, filter: { type?: string; partyId?: string; vendorId?: string }) {
  const kind = filter.type === 'vendor' ? 'vendor_payment' : filter.type === 'customer' || filter.type === undefined ? 'customer_receipt' : null
  if (!kind) throw errors.validation({ type: ['Pilihan: customer atau vendor.'] })
  const params: unknown[] = [kind]
  let where = 'u.kind = $1 and u.unallocated_minor > 0'
  if (filter.partyId) { if (!ID_PATTERN.test(filter.partyId)) throw errors.validation({ partyId: ['Customer tidak valid.'] }); params.push(filter.partyId); where += ` and u.party_id = $${params.length}` }
  if (filter.vendorId) { if (!ID_PATTERN.test(filter.vendorId)) throw errors.validation({ vendorId: ['Vendor tidak valid.'] }); params.push(filter.vendorId); where += ` and u.vendor_id = $${params.length}` }
  const rows = await db.query<Record<string, any>>(
    `select u.*, pa.name as party_name, ve.name as vendor_name, ba.code as account_code
       from v_unallocated_payments u
       join bank_accounts ba on ba.id = u.bank_account_id
       left join parties pa on pa.id = u.party_id
       left join vendors ve on ve.id = u.vendor_id
      where ${where} order by u.effective_date, u.transaction_id limit 500`,
    params
  )
  return rows.map(r => ({
    transactionId: r.transaction_id,
    kind: r.kind,
    effectiveDate: r.effective_date,
    account: { id: r.bank_account_id, code: r.account_code },
    party: r.party_id ? { id: r.party_id, name: r.party_name } : null,
    vendor: r.vendor_id ? { id: r.vendor_id, name: r.vendor_name } : null,
    projectId: r.project_id,
    amountMinor: r.amount_minor,
    unallocatedMinor: r.unallocated_minor
  }))
}
