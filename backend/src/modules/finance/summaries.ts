import type { Db } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { errors } from '../../http/errors'
import { todayBusinessDate } from './common'
import { invoiceRowDto } from './receivables'
import { vendorInvoiceDto } from './payables'

/**
 * Finance context for other screens, computed from the same records as the Finance menus (no copies).
 * Two shapes (ADR-007 #3):
 *  - full   (finance.view-project-finance: Finance, Super Admin) — amounts, lists, profitability
 *  - status (project-order.view-payment-status: Admin)            — payment status WITHOUT any amount
 */

export type PaymentStatus = 'not_invoiced' | 'awaiting_payment' | 'dp_received' | 'partially_paid' | 'paid' | 'overdue'

const STATUS_LABEL: Record<PaymentStatus, string> = {
  not_invoiced: 'Belum ditagih',
  awaiting_payment: 'Menunggu pembayaran',
  dp_received: 'DP diterima',
  partially_paid: 'Dibayar sebagian',
  paid: 'Lunas',
  overdue: 'Terlambat'
}

interface InvoiceBalanceRow extends Record<string, any> {
  invoice_type: string
  status: string
  due_date: string
  total_minor: string
  paid_minor: string
  credited_minor: string
  outstanding_minor: string
}

/** One rule for every screen: overdue beats everything; DP counts once every DP invoice is settled. */
function derivePaymentStatus(invoices: InvoiceBalanceRow[], today: string): PaymentStatus {
  const issued = invoices.filter(i => i.status === 'issued')
  if (!issued.length) return 'not_invoiced'
  const outstanding = (i: InvoiceBalanceRow) => BigInt(i.outstanding_minor)
  if (issued.some(i => outstanding(i) > 0n && i.due_date < today)) return 'overdue'
  if (issued.every(i => outstanding(i) === 0n)) return 'paid'
  const dp = issued.filter(i => i.invoice_type === 'dp')
  if (dp.length && dp.every(i => outstanding(i) === 0n)) return 'dp_received'
  if (issued.some(i => BigInt(i.paid_minor) > 0n || BigInt(i.credited_minor) > 0n)) return 'partially_paid'
  return 'awaiting_payment'
}

function statusView(invoices: InvoiceBalanceRow[], today: string) {
  const status = derivePaymentStatus(invoices, today)
  const open = invoices.filter(i => i.status === 'issued' && BigInt(i.outstanding_minor) > 0n)
  return {
    paymentStatus: status,
    label: STATUS_LABEL[status],
    hasOverdue: open.some(i => i.due_date < today),
    openInvoiceCount: open.length,
    nextDueDate: open.map(i => i.due_date).sort()[0] ?? null
  }
}

const sum = (rows: Record<string, any>[], key: string) => rows.reduce((s, r) => s + BigInt(r[key] ?? 0), 0n)

const INVOICES_WITH_BALANCE = `
  select i.*, p.name as project_name, pa.name as party_name, b.paid_minor, b.credited_minor,
         (b.total_minor - b.paid_minor - b.credited_minor) as outstanding_minor
    from customer_invoices i
    join projects p on p.id = i.project_id
    join parties pa on pa.id = i.party_id
    join v_customer_invoice_balances b on b.invoice_id = i.id`

const VENDOR_INVOICES_WITH_BALANCE = `
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

export async function projectFinanceSummary(db: Db, projectId: string, full: boolean) {
  const today = todayBusinessDate()
  const [project] = await db.query<{ id: string; contract_value_minor: string | null; contract_currency: string }>(
    'select id, contract_value_minor, contract_currency from projects where id = $1', [projectId]
  )
  if (!project) throw errors.notFound('Project')
  const invoices = await db.query<InvoiceBalanceRow>(`${INVOICES_WITH_BALANCE} where i.project_id = $1 and i.status <> 'void' order by i.due_date nulls last, i.id`, [projectId])
  const status = statusView(invoices, today)
  if (!full) return { projectId, view: 'status' as const, ...status }

  const vendorInvoices = await db.query<Record<string, any>>(`${VENDOR_INVOICES_WITH_BALANCE} where v.project_id = $1 and v.status not in ('rejected', 'void') order by v.due_date, v.id`, [projectId])
  const [schedule] = await db.query<{ total: string }>(
    "select coalesce(sum(amount_minor), 0) as total from billing_schedule_items where project_id = $1 and status = 'planned'", [projectId]
  )
  const receivable = receivableTotals(invoices, today)
  const payable = payableTotals(vendorInvoices, today)
  const expenses = await projectExpenses(db, 't.project_id = $1', [projectId])
  const revenue = BigInt(receivable.invoicedMinor) - BigInt(receivable.creditedMinor)
  const cost = BigInt(payable.approvedMinor) + expenses
  const contract = project.contract_value_minor === null ? null : BigInt(project.contract_value_minor)
  const uninvoiced = contract === null ? null : contract - revenue > 0n ? contract - revenue : 0n
  return {
    projectId,
    view: 'full' as const,
    ...status,
    currency: project.contract_currency,
    contractValueMinor: project.contract_value_minor,
    receivable: { ...receivable, uninvoicedMinor: uninvoiced?.toString() ?? null, scheduledNotInvoicedMinor: schedule!.total },
    payable,
    projectExpensesMinor: expenses.toString(),
    /** Accrual view: revenue = invoiced − credit notes; cost = approved vendor invoices + project expenses. */
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
  const status = statusView(invoices, today)
  if (!full) return { booking: { type, id }, projectId: booking.project_id, view: 'status' as const, ...status }
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
  const status = statusView(invoices, today)
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
