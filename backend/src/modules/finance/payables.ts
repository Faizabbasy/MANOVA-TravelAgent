import type { Actor } from '../../auth/rbac'
import type { Db, Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { isUniqueViolation, parseMovementAmount, rule, todayBusinessDate } from './common'
import { assertOutflowFits, lockPostableAccount, resolveReferences, trimOrNull, validateEffectiveDate, validateReason } from './postings'

/**
 * Payables (Phase 3): vendor invoice (submitted → under_review → approved | rejected; approved → void)
 * → vendor payments with allocations (partial allowed; unallocated = vendor deposit). Only APPROVED
 * invoices are payables; approval never moves money. Outstanding = total − active allocations.
 */

function requireDate(value: unknown, field: string, opts: { notFuture?: boolean } = {}): string {
  if (typeof value !== 'string' || !isIsoDate(value)) throw errors.validation({ [field]: ['Tanggal harus berformat YYYY-MM-DD.'] })
  if (opts.notFuture && value > todayBusinessDate()) throw errors.validation({ [field]: ['Tanggal tidak boleh di masa depan.'] })
  return value
}

export interface VendorInvoiceInput {
  vendorId: string
  vendorInvoiceNumber: string
  serviceOrderId?: string
  projectId?: string
  booking?: { type: string; id: string }
  invoiceDate: string
  dueDate: string
  expectedDate?: string
  totalMinor: string
  notes?: string
}

async function resolveVendorLinks(tx: Queryable, input: Pick<VendorInvoiceInput, 'vendorId' | 'serviceOrderId' | 'projectId' | 'booking'>) {
  if (!input.vendorId || !ID_PATTERN.test(input.vendorId) || !(await tx.query('select 1 from vendors where id = $1', [input.vendorId])).length) {
    throw errors.validation({ vendorId: ['Vendor tidak ditemukan.'] })
  }
  let projectId = input.projectId
  if (input.serviceOrderId) {
    if (!ID_PATTERN.test(input.serviceOrderId)) throw errors.validation({ serviceOrderId: ['Service order tidak valid.'] })
    const [so] = await tx.query<{ vendor_id: string; project_id: string | null }>('select vendor_id, project_id from service_orders where id = $1', [input.serviceOrderId])
    if (!so) throw errors.validation({ serviceOrderId: ['Service order tidak ditemukan.'] })
    if (so.vendor_id !== input.vendorId) throw errors.validation({ serviceOrderId: ['Service order ini milik vendor lain.'] })
    if (projectId && so.project_id && projectId !== so.project_id) throw errors.validation({ projectId: [`Service order ini untuk project ${so.project_id}.`] })
    projectId = projectId ?? so.project_id ?? undefined
  }
  const refs = await resolveReferences(tx, { projectId, booking: input.booking })
  if (refs.bookingId) {
    const [b] = await tx.query<{ vendor_id: string | null }>(
      'select ps.vendor_id from booking_refs b left join project_services ps on ps.id = b.service_id where b.booking_type = $1 and b.booking_id = $2',
      [refs.bookingType, refs.bookingId]
    )
    if (b?.vendor_id && b.vendor_id !== input.vendorId) throw errors.validation({ booking: ['Booking ini dilayani vendor lain.'] })
  }
  return refs
}

export async function createVendorInvoice(tx: Queryable, actor: Actor, input: VendorInvoiceInput, requestId: string) {
  const total = parseMovementAmount(input.totalMinor, 'totalMinor')
  const invoiceDate = requireDate(input.invoiceDate, 'invoiceDate', { notFuture: true })
  const dueDate = requireDate(input.dueDate, 'dueDate')
  if (dueDate < invoiceDate) throw errors.validation({ dueDate: ['Jatuh tempo tidak boleh sebelum tanggal invoice.'] })
  const expectedDate = input.expectedDate ? requireDate(input.expectedDate, 'expectedDate') : null
  const number = input.vendorInvoiceNumber?.trim()
  if (!number) throw errors.validation({ vendorInvoiceNumber: ['Nomor invoice vendor wajib diisi.'] })
  const refs = await resolveVendorLinks(tx, input)
  try {
    const [row] = await tx.query<{ id: string }>(
      `insert into vendor_invoices (vendor_id, vendor_invoice_number, service_order_id, project_id, booking_type, booking_id,
         invoice_date, due_date, expected_date, total_minor, notes, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
      [input.vendorId, number.slice(0, 80), input.serviceOrderId ?? null, refs.projectId, refs.bookingType, refs.bookingId,
        invoiceDate, dueDate, expectedDate, total.toString(), trimOrNull(input.notes, 1000), actor.userId]
    )
    await recordAudit(tx, {
      action: 'finance.vendor_invoice_recorded', actorUserId: actor.userId, entityType: 'vendor_invoice', entityId: row!.id, requestId,
      after: { vendorId: input.vendorId, number, totalMinor: total.toString(), dueDate }
    })
    return { id: row!.id }
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, 'CONFLICT', `Invoice nomor ${number} dari vendor ini sudah tercatat.`, { fieldErrors: { vendorInvoiceNumber: ['Nomor sudah tercatat untuk vendor ini.'] } })
    }
    throw err
  }
}

async function lockVendorInvoice(tx: Queryable, id: string) {
  if (!ID_PATTERN.test(id)) throw errors.notFound('Invoice vendor')
  const [inv] = await tx.query<Record<string, any>>('select * from vendor_invoices where id = $1 for update', [id])
  if (!inv) throw errors.notFound('Invoice vendor')
  return inv
}

export async function updateVendorInvoice(tx: Queryable, actor: Actor, id: string, input: Partial<VendorInvoiceInput>, requestId: string) {
  const inv = await lockVendorInvoice(tx, id)
  if (!['submitted', 'under_review'].includes(inv.status)) throw rule('Invoice vendor yang sudah direview tidak bisa diubah.')
  const total = input.totalMinor === undefined ? null : parseMovementAmount(input.totalMinor, 'totalMinor').toString()
  const invoiceDate = input.invoiceDate === undefined ? inv.invoice_date : requireDate(input.invoiceDate, 'invoiceDate', { notFuture: true })
  const dueDate = input.dueDate === undefined ? inv.due_date : requireDate(input.dueDate, 'dueDate')
  if (dueDate < invoiceDate) throw errors.validation({ dueDate: ['Jatuh tempo tidak boleh sebelum tanggal invoice.'] })
  if (input.vendorId || input.serviceOrderId || input.projectId || input.booking) {
    throw errors.validation({ vendorId: ['Vendor, service order, dan project tidak bisa dipindah; catat ulang invoicenya.'] })
  }
  try {
    await tx.query(
      `update vendor_invoices set vendor_invoice_number = coalesce($2, vendor_invoice_number), total_minor = coalesce($3, total_minor),
         invoice_date = $4, due_date = $5, notes = case when $6::boolean then $7 else notes end, updated_at = now() where id = $1`,
      [id, input.vendorInvoiceNumber?.trim().slice(0, 80) || null, total, invoiceDate, dueDate, input.notes !== undefined, trimOrNull(input.notes, 1000)]
    )
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, 'CONFLICT', 'Nomor invoice itu sudah tercatat untuk vendor ini.', { fieldErrors: { vendorInvoiceNumber: ['Nomor sudah tercatat.'] } })
    throw err
  }
  await recordAudit(tx, { action: 'finance.vendor_invoice_updated', actorUserId: actor.userId, entityType: 'vendor_invoice', entityId: id, requestId })
  return { id }
}

/** Review decisions. Approval makes it a payable; it does not pay it. */
export async function reviewVendorInvoice(
  tx: Queryable, actor: Actor, id: string,
  input: { action: string; note?: string; reason?: string; matchStatus?: string }, requestId: string
) {
  const inv = await lockVendorInvoice(tx, id)
  const matchStatus = input.matchStatus ?? null
  if (matchStatus !== null && !['matched', 'unmatched', 'disputed'].includes(matchStatus)) {
    throw errors.validation({ matchStatus: ['Status kecocokan: matched, unmatched, atau disputed.'] })
  }
  const note = trimOrNull(input.note, 1000)
  if (input.action === 'start_review') {
    if (inv.status !== 'submitted') throw rule('Hanya invoice yang baru masuk yang bisa mulai direview.')
    await tx.query("update vendor_invoices set status = 'under_review', match_status = coalesce($2, match_status), review_note = coalesce($3, review_note), updated_at = now() where id = $1", [id, matchStatus, note])
  } else if (input.action === 'approve') {
    if (!['submitted', 'under_review'].includes(inv.status)) throw rule('Invoice ini sudah diputuskan.')
    if ((matchStatus ?? inv.match_status) === 'disputed') throw rule('Invoice yang kecocokannya disengketakan tidak bisa disetujui. Selesaikan dulu atau tolak.')
    await tx.query(
      "update vendor_invoices set status = 'approved', match_status = coalesce($2, match_status), review_note = coalesce($3, review_note), reviewed_by = $4, reviewed_at = now(), updated_at = now() where id = $1",
      [id, matchStatus, note, actor.userId]
    )
  } else if (input.action === 'reject') {
    if (!['submitted', 'under_review'].includes(inv.status)) throw rule('Invoice ini sudah diputuskan.')
    const reason = validateReason(input.reason)
    await tx.query(
      "update vendor_invoices set status = 'rejected', rejected_reason = $2, match_status = coalesce($3, match_status), reviewed_by = $4, reviewed_at = now(), updated_at = now() where id = $1",
      [id, reason, matchStatus, actor.userId]
    )
  } else {
    throw errors.validation({ action: ['Aksi: start_review, approve, atau reject.'] })
  }
  await recordAudit(tx, {
    action: `finance.vendor_invoice_${input.action === 'start_review' ? 'review_started' : input.action === 'approve' ? 'approved' : 'rejected'}`,
    actorUserId: actor.userId, entityType: 'vendor_invoice', entityId: id, requestId, reason: input.reason ?? null,
    before: { status: inv.status }, after: { matchStatus }
  })
  return { id }
}

export async function voidVendorInvoice(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, requestId: string) {
  const reason = validateReason(reasonInput)
  const inv = await lockVendorInvoice(tx, id)
  if (inv.status !== 'approved') throw rule('Hanya invoice vendor yang sudah disetujui yang bisa di-void. Yang belum disetujui cukup ditolak.')
  const [b] = await tx.query<{ paid_minor: string }>('select paid_minor from v_vendor_invoice_balances where vendor_invoice_id = $1', [id])
  if (BigInt(b!.paid_minor) > 0n) throw rule('Invoice vendor ini sudah dibayar sebagian/penuh. Batalkan pembayarannya dulu.')
  await tx.query("update vendor_invoices set status = 'void', void_reason = $2, updated_at = now() where id = $1", [id, reason])
  await recordAudit(tx, { action: 'finance.vendor_invoice_voided', actorUserId: actor.userId, entityType: 'vendor_invoice', entityId: id, requestId, reason })
  return { id }
}

export async function setVendorInvoiceExpectation(tx: Queryable, actor: Actor, id: string, input: { expectedDate: string | null; reason: string }, requestId: string) {
  const reason = validateReason(input.reason)
  const inv = await lockVendorInvoice(tx, id)
  if (['rejected', 'void'].includes(inv.status)) throw rule('Invoice ini tidak lagi menjadi kewajiban.')
  const expectedDate = input.expectedDate === null ? null : requireDate(input.expectedDate, 'expectedDate')
  await tx.query('update vendor_invoices set expected_date = $2, expected_reason = $3, updated_at = now() where id = $1', [id, expectedDate, reason])
  await recordAudit(tx, {
    action: 'finance.vendor_invoice_expectation_set', actorUserId: actor.userId, entityType: 'vendor_invoice', entityId: id, requestId, reason,
    before: { expectedDate: inv.expected_date }, after: { expectedDate }
  })
  return { id }
}

// ── Vendor payments (money out) ──────────────────────────────────────────────────────────────────────

interface VendorAllocationInput { vendorInvoiceId: string; amountMinor: string }

async function allocateToVendorInvoices(tx: Queryable, actor: Actor, payment: { id: string; vendor_id: string; unallocated: bigint }, allocations: VendorAllocationInput[]) {
  if (!Array.isArray(allocations)) return []
  const seen = new Set<string>()
  const parsed = allocations.map((a, i) => {
    if (!a?.vendorInvoiceId || !ID_PATTERN.test(a.vendorInvoiceId)) throw errors.validation({ [`allocations.${i}.vendorInvoiceId`]: ['Invoice vendor tidak valid.'] })
    if (seen.has(a.vendorInvoiceId)) throw errors.validation({ [`allocations.${i}.vendorInvoiceId`]: ['Invoice yang sama muncul dua kali.'] })
    seen.add(a.vendorInvoiceId)
    return { id: a.vendorInvoiceId, amount: parseMovementAmount(a.amountMinor, `allocations.${i}.amountMinor`), index: i }
  })
  const total = parsed.reduce((s, a) => s + a.amount, 0n)
  if (total > payment.unallocated) throw errors.validation({ allocations: [`Total alokasi (${total}) melebihi uang yang belum dialokasikan (${payment.unallocated}).`] })
  const results: { vendorInvoiceId: string; amountMinor: string; outstandingMinor: string }[] = []
  for (const a of [...parsed].sort((x, y) => x.id.localeCompare(y.id))) {
    const [inv] = await tx.query<{ id: string; status: string; vendor_id: string; vendor_invoice_number: string }>(
      'select id, status, vendor_id, vendor_invoice_number from vendor_invoices where id = $1 for update', [a.id]
    )
    const field = `allocations.${a.index}.vendorInvoiceId`
    if (!inv) throw errors.validation({ [field]: ['Invoice vendor tidak ditemukan.'] })
    if (inv.status !== 'approved') throw errors.validation({ [field]: [`Invoice ${inv.vendor_invoice_number} belum disetujui (atau sudah ditolak/void).`] })
    if (inv.vendor_id !== payment.vendor_id) throw errors.validation({ [field]: ['Invoice ini milik vendor lain.'] })
    const [b] = await tx.query<{ total_minor: string; paid_minor: string }>('select total_minor, paid_minor from v_vendor_invoice_balances where vendor_invoice_id = $1', [inv.id])
    const outstanding = BigInt(b!.total_minor) - BigInt(b!.paid_minor)
    if (a.amount > outstanding) throw errors.validation({ [`allocations.${a.index}.amountMinor`]: [`Melebihi sisa utang ${inv.vendor_invoice_number} (${outstanding}).`] })
    await tx.query('insert into payment_allocations (transaction_id, target_type, target_id, amount_minor, created_by) values ($1, $2, $3, $4, $5)',
      [payment.id, 'vendor_invoice', inv.id, a.amount.toString(), actor.userId])
    results.push({ vendorInvoiceId: inv.id, amountMinor: a.amount.toString(), outstandingMinor: (outstanding - a.amount).toString() })
  }
  return results
}

export interface VendorPaymentInput {
  bankAccountId: string
  amountMinor: string
  effectiveDate: string
  vendorId: string
  projectId?: string
  counterparty?: string
  reference?: string
  memo?: string
  allocations?: VendorAllocationInput[]
}

/** Money out to a vendor. Unallocated remainder = vendor deposit, settled against later invoices. */
export async function postVendorPayment(tx: Queryable, actor: Actor, input: VendorPaymentInput, requestId: string) {
  const amount = parseMovementAmount(input.amountMinor)
  const effectiveDate = validateEffectiveDate(input.effectiveDate)
  if (!input.vendorId) throw errors.validation({ vendorId: ['Pilih vendor yang dibayar.'] })
  const refs = await resolveReferences(tx, { vendorId: input.vendorId, projectId: input.projectId })
  const account = await lockPostableAccount(tx, input.bankAccountId, effectiveDate)
  await assertOutflowFits(tx, account, effectiveDate, amount)
  const [row] = await tx.query<{ id: string }>(
    `insert into financial_transactions (bank_account_id, direction, amount_minor, currency, kind, effective_date, project_id, vendor_id,
       counterparty, reference, memo, created_by)
     values ($1, 'out', $2, $3, 'vendor_payment', $4, $5, $6, $7, $8, $9, $10) returning id`,
    [account.id, amount.toString(), account.currency, effectiveDate, refs.projectId, input.vendorId,
      trimOrNull(input.counterparty, 200), trimOrNull(input.reference, 120), trimOrNull(input.memo), actor.userId]
  )
  const allocations = await allocateToVendorInvoices(tx, actor, { id: row!.id, vendor_id: input.vendorId, unallocated: amount }, input.allocations ?? [])
  const allocated = allocations.reduce((s, a) => s + BigInt(a.amountMinor), 0n)
  await recordAudit(tx, {
    action: 'finance.vendor_payment_posted', actorUserId: actor.userId, entityType: 'financial_transaction', entityId: row!.id, requestId,
    after: { accountId: account.id, vendorId: input.vendorId, amountMinor: amount.toString(), effectiveDate, allocations }
  })
  return { transactionId: row!.id, allocations, unallocatedMinor: (amount - allocated).toString() }
}

export async function allocateVendorPayment(tx: Queryable, actor: Actor, transactionId: string, allocations: VendorAllocationInput[], requestId: string) {
  if (!ID_PATTERN.test(transactionId)) throw errors.notFound('Pembayaran vendor')
  const [t] = await tx.query<{ id: string; kind: string; vendor_id: string; unallocated_minor: string | null }>(
    `select t.id, t.kind, t.vendor_id, u.unallocated_minor from financial_transactions t
       left join v_unallocated_payments u on u.transaction_id = t.id where t.id = $1`, [transactionId]
  )
  if (!t || t.kind !== 'vendor_payment') throw errors.notFound('Pembayaran vendor')
  if (t.unallocated_minor === null) throw rule('Pembayaran ini sudah dibatalkan.')
  if (!allocations?.length) throw errors.validation({ allocations: ['Pilih minimal satu invoice vendor.'] })
  await tx.query('select pg_advisory_xact_lock(hashtext($1))', [`alloc:${transactionId}`])
  const [fresh] = await tx.query<{ unallocated_minor: string }>('select unallocated_minor from v_unallocated_payments where transaction_id = $1', [transactionId])
  const result = await allocateToVendorInvoices(tx, actor, { id: t.id, vendor_id: t.vendor_id, unallocated: BigInt(fresh!.unallocated_minor) }, allocations)
  const allocated = result.reduce((s, a) => s + BigInt(a.amountMinor), 0n)
  await recordAudit(tx, { action: 'finance.vendor_payment_allocated', actorUserId: actor.userId, entityType: 'financial_transaction', entityId: transactionId, requestId, after: { allocations: result } })
  return { transactionId, allocations: result, unallocatedMinor: (BigInt(fresh!.unallocated_minor) - allocated).toString() }
}

// ── Reads ────────────────────────────────────────────────────────────────────────────────────────────

const VENDOR_INVOICE_SELECT = `
  select v.*, ve.name as vendor_name, p.name as project_name, b.paid_minor, (b.total_minor - b.paid_minor) as outstanding_minor
    from vendor_invoices v
    join vendors ve on ve.id = v.vendor_id
    left join projects p on p.id = v.project_id
    join v_vendor_invoice_balances b on b.vendor_invoice_id = v.id`

export function vendorInvoiceDto(r: Record<string, any>, today = todayBusinessDate()) {
  const outstanding = BigInt(r.outstanding_minor)
  const isPayable = r.status === 'approved'
  const overdue = isPayable && outstanding > 0n && r.due_date < today
  return {
    id: r.id,
    vendor: { id: r.vendor_id, name: r.vendor_name },
    vendorInvoiceNumber: r.vendor_invoice_number,
    serviceOrderId: r.service_order_id,
    project: r.project_id ? { id: r.project_id, name: r.project_name } : null,
    booking: r.booking_id ? { type: r.booking_type, id: r.booking_id } : null,
    status: r.status,
    matchStatus: r.match_status,
    settlement: !isPayable ? null : outstanding === 0n ? 'paid' : BigInt(r.paid_minor) > 0n ? 'partial' : 'open',
    overdue,
    daysOverdue: overdue ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${r.due_date}T00:00:00Z`)) / 86_400_000) : 0,
    currency: r.currency,
    totalMinor: r.total_minor,
    paidMinor: r.paid_minor,
    outstandingMinor: isPayable ? r.outstanding_minor : '0',
    invoiceDate: r.invoice_date,
    dueDate: r.due_date,
    expectedDate: r.expected_date,
    expectedReason: r.expected_reason,
    notes: r.notes,
    reviewNote: r.review_note,
    rejectedReason: r.rejected_reason,
    voidReason: r.void_reason,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at ? (r.reviewed_at as Date).toISOString() : null,
    createdAt: (r.created_at as Date).toISOString()
  }
}

export async function getVendorInvoice(db: Db, id: string) {
  if (!ID_PATTERN.test(id)) throw errors.notFound('Invoice vendor')
  const [row] = await db.query<Record<string, any>>(`${VENDOR_INVOICE_SELECT} where v.id = $1`, [id])
  if (!row) throw errors.notFound('Invoice vendor')
  const payments = await db.query<Record<string, any>>(
    `select a.transaction_id, a.amount_minor, t.effective_date, t.bank_account_id, ba.code as account_code, t.reference,
            exists (select 1 from financial_transactions r where r.reversal_of_id = t.id) as reversed
       from payment_allocations a join financial_transactions t on t.id = a.transaction_id join bank_accounts ba on ba.id = t.bank_account_id
      where a.target_type = 'vendor_invoice' and a.target_id = $1 order by t.effective_date, a.id`, [id]
  )
  return {
    ...vendorInvoiceDto(row),
    payments: payments.map(p => ({
      transactionId: p.transaction_id, amountMinor: p.amount_minor, effectiveDate: p.effective_date,
      account: { id: p.bank_account_id, code: p.account_code }, reference: p.reference, reversed: p.reversed
    }))
  }
}

/**
 * Payables worklist. `view`:
 *  - 'outstanding' (default): approved with money still owed, soonest due first
 *  - 'overdue' | 'paid' | 'review' (submitted + under_review) | 'all'
 */
export async function listPayables(db: Db, filter: { view?: string; vendorId?: string; projectId?: string; dueTo?: string; limit: number; cursor?: string }) {
  const today = todayBusinessDate()
  const view = filter.view ?? 'outstanding'
  const params: unknown[] = []
  const where: string[] = []
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.split('?').join(`$${params.length}`)) }
  switch (view) {
    case 'outstanding': where.push("v.status = 'approved'", '(b.total_minor - b.paid_minor) > 0'); break
    case 'overdue': where.push("v.status = 'approved'", '(b.total_minor - b.paid_minor) > 0'); add('v.due_date < ?', today); break
    case 'paid': where.push("v.status = 'approved'", '(b.total_minor - b.paid_minor) = 0'); break
    case 'review': where.push("v.status in ('submitted', 'under_review')"); break
    case 'all': break
    default: throw errors.validation({ view: ['Pilihan: outstanding, overdue, paid, review, all.'] })
  }
  if (filter.vendorId) { if (!ID_PATTERN.test(filter.vendorId)) throw errors.validation({ vendorId: ['Vendor tidak valid.'] }); add('v.vendor_id = ?', filter.vendorId) }
  if (filter.projectId) { if (!ID_PATTERN.test(filter.projectId)) throw errors.validation({ projectId: ['Project tidak valid.'] }); add('v.project_id = ?', filter.projectId) }
  if (filter.dueTo) { if (!isIsoDate(filter.dueTo)) throw errors.validation({ dueTo: ['Tanggal harus berformat YYYY-MM-DD.'] }); add('v.due_date <= ?', filter.dueTo) }
  const base = where.length ? where.join(' and ') : 'true'

  const sumParams = [...params, today]
  const t = `$${sumParams.length}`
  const [summary] = await db.query<{ outstanding: string; overdue: string; review_total: string; review_count: string; count: string }>(
    `select coalesce(sum(case when v.status = 'approved' then b.total_minor - b.paid_minor end), 0) as outstanding,
            coalesce(sum(case when v.status = 'approved' and v.due_date < ${t} then b.total_minor - b.paid_minor end), 0) as overdue,
            coalesce(sum(case when v.status in ('submitted', 'under_review') then b.total_minor end), 0) as review_total,
            count(*) filter (where v.status in ('submitted', 'under_review')) as review_count,
            count(*) as count
       from vendor_invoices v join v_vendor_invoice_balances b on b.vendor_invoice_id = v.id where ${base}`,
    sumParams
  )
  const pageParams = [...params]
  let pageWhere = base
  if (filter.cursor) {
    let d: string, id: string
    try {
      const parsed = JSON.parse(Buffer.from(filter.cursor, 'base64url').toString('utf8'))
      if (!Array.isArray(parsed) || !isIsoDate(parsed[0]) || !ID_PATTERN.test(parsed[1])) throw new Error()
      ;[d, id] = parsed
    } catch {
      throw errors.validation({ cursor: ['Cursor tidak valid.'] })
    }
    pageParams.push(d, id.length, id)
    const n = pageParams.length
    pageWhere += ` and (v.due_date, length(v.id), v.id) > ($${n - 2}::date, $${n - 1}::int, $${n})`
  }
  pageParams.push(filter.limit + 1)
  const rows = await db.query<Record<string, any>>(
    `${VENDOR_INVOICE_SELECT} where ${pageWhere} order by v.due_date, length(v.id), v.id limit $${pageParams.length}`, pageParams
  )
  const items = rows.slice(0, filter.limit)
  const last = items[items.length - 1]
  return {
    items: items.map(r => vendorInvoiceDto(r, today)),
    summary: {
      outstandingMinor: summary!.outstanding,
      overdueMinor: summary!.overdue,
      pendingReviewMinor: summary!.review_total,
      pendingReviewCount: Number(summary!.review_count),
      count: Number(summary!.count),
      asOf: today
    },
    pagination: {
      limit: filter.limit,
      nextCursor: rows.length > filter.limit && last ? Buffer.from(JSON.stringify([last.due_date, last.id]), 'utf8').toString('base64url') : null
    }
  }
}
