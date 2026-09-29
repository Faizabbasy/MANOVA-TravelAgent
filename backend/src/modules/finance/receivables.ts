import type { Actor } from '../../auth/rbac'
import type { Db, Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { isUniqueViolation, MAX_MOVEMENT_MINOR, parseMovementAmount, rule, todayBusinessDate } from './common'
import { lockPostableAccount, resolveReferences, trimOrNull, validateEffectiveDate, validateReason } from './postings'

/**
 * Receivables (Phase 3): billing schedule → customer invoice (draft → issued → void) → receipts with
 * allocations, plus credit notes that reduce what a customer owes. Outstanding always comes from
 * v_customer_invoice_balances: total − active allocations − issued credit notes.
 */

export const INVOICE_TYPES = ['dp', 'progress', 'final', 'other'] as const
type InvoiceType = (typeof INVOICE_TYPES)[number]

function requireDate(value: unknown, field: string, opts: { notFuture?: boolean } = {}): string {
  if (typeof value !== 'string' || !isIsoDate(value)) throw errors.validation({ [field]: ['Tanggal harus berformat YYYY-MM-DD.'] })
  if (opts.notFuture && value > todayBusinessDate()) throw errors.validation({ [field]: ['Tanggal tidak boleh di masa depan.'] })
  return value
}

function optionalDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  return requireDate(value, field)
}

function requireInvoiceType(value: unknown): InvoiceType {
  if (typeof value !== 'string' || !(INVOICE_TYPES as readonly string[]).includes(value)) {
    throw errors.validation({ invoiceType: ['Jenis tagihan: dp (uang muka), progress (termin), final (pelunasan), atau other.'] })
  }
  return value as InvoiceType
}

async function lockProjectRef(tx: Queryable, input: { projectId?: string; booking?: { type: string; id: string } }) {
  if (!input.projectId && !input.booking) throw errors.validation({ projectId: ['Pilih project.'] })
  const refs = await resolveReferences(tx, { projectId: input.projectId, booking: input.booking })
  const [project] = await tx.query<{ id: string; party_id: string; name: string; party_name: string }>(
    'select p.id, p.party_id, p.name, pa.name as party_name from projects p join parties pa on pa.id = p.party_id where p.id = $1',
    [refs.projectId]
  )
  return { refs, project: project! }
}

// ── Billing schedule ─────────────────────────────────────────────────────────────────────────────────

export interface ScheduleInput {
  projectId: string
  booking?: { type: string; id: string }
  label: string
  invoiceType: string
  amountMinor: string
  plannedDate: string
}

export async function createScheduleItem(tx: Queryable, actor: Actor, input: ScheduleInput, requestId: string) {
  const invoiceType = requireInvoiceType(input.invoiceType)
  const amount = parseMovementAmount(input.amountMinor)
  const plannedDate = requireDate(input.plannedDate, 'plannedDate')
  if (!input.label?.trim()) throw errors.validation({ label: ['Nama termin wajib diisi (contoh "DP 30%").'] })
  const { refs } = await lockProjectRef(tx, input)
  const [row] = await tx.query<{ id: string }>(
    `insert into billing_schedule_items (project_id, booking_type, booking_id, label, invoice_type, amount_minor, planned_date, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [refs.projectId, refs.bookingType, refs.bookingId, input.label.trim().slice(0, 120), invoiceType, amount.toString(), plannedDate, actor.userId]
  )
  await recordAudit(tx, {
    action: 'finance.schedule_created', actorUserId: actor.userId, entityType: 'billing_schedule_item', entityId: row!.id, requestId,
    after: { projectId: refs.projectId, invoiceType, amountMinor: amount.toString(), plannedDate }
  })
  return { id: row!.id }
}

export async function updateScheduleItem(
  tx: Queryable, actor: Actor, id: string,
  input: { label?: string; amountMinor?: string; plannedDate?: string; invoiceType?: string }, requestId: string
) {
  const [item] = await tx.query<{ status: string }>('select status from billing_schedule_items where id = $1 for update', [id])
  if (!item) throw errors.notFound('Termin')
  if (item.status !== 'planned') throw rule('Hanya termin yang masih direncanakan yang bisa diubah.')
  const [linked] = await tx.query("select id from customer_invoices where billing_schedule_item_id = $1 and status <> 'void'", [id])
  if (linked) throw rule(`Termin ini sudah dipakai invoice ${linked.id}. Ubah invoicenya, bukan terminnya.`)
  const amount = input.amountMinor === undefined ? null : parseMovementAmount(input.amountMinor).toString()
  const plannedDate = input.plannedDate === undefined ? null : requireDate(input.plannedDate, 'plannedDate')
  const invoiceType = input.invoiceType === undefined ? null : requireInvoiceType(input.invoiceType)
  if (input.label !== undefined && !input.label.trim()) throw errors.validation({ label: ['Nama termin wajib diisi.'] })
  await tx.query(
    `update billing_schedule_items set label = coalesce($2, label), amount_minor = coalesce($3, amount_minor),
       planned_date = coalesce($4, planned_date), invoice_type = coalesce($5, invoice_type), updated_at = now() where id = $1`,
    [id, input.label?.trim().slice(0, 120) ?? null, amount, plannedDate, invoiceType]
  )
  await recordAudit(tx, { action: 'finance.schedule_updated', actorUserId: actor.userId, entityType: 'billing_schedule_item', entityId: id, requestId, after: input })
  return { id }
}

export async function cancelScheduleItem(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, requestId: string) {
  const reason = validateReason(reasonInput)
  const [item] = await tx.query<{ status: string }>('select status from billing_schedule_items where id = $1 for update', [id])
  if (!item) throw errors.notFound('Termin')
  if (item.status !== 'planned') throw rule('Hanya termin yang masih direncanakan yang bisa dibatalkan.')
  const [linked] = await tx.query("select id from customer_invoices where billing_schedule_item_id = $1 and status <> 'void'", [id])
  if (linked) throw rule(`Termin ini sudah dipakai invoice ${linked.id}. Hapus draft atau void invoicenya dulu.`)
  await tx.query("update billing_schedule_items set status = 'cancelled', updated_at = now() where id = $1", [id])
  await recordAudit(tx, { action: 'finance.schedule_cancelled', actorUserId: actor.userId, entityType: 'billing_schedule_item', entityId: id, requestId, reason })
  return { id }
}

export async function listSchedule(db: Db, filter: { projectId?: string; status?: string }) {
  const params: unknown[] = []
  const where: string[] = []
  if (filter.projectId) {
    if (!ID_PATTERN.test(filter.projectId)) throw errors.validation({ projectId: ['Project tidak valid.'] })
    params.push(filter.projectId); where.push(`s.project_id = $${params.length}`)
  }
  if (filter.status) {
    if (!['planned', 'invoiced', 'cancelled'].includes(filter.status)) throw errors.validation({ status: ['Status: planned, invoiced, atau cancelled.'] })
    params.push(filter.status); where.push(`s.status = $${params.length}`)
  }
  const rows = await db.query<Record<string, any>>(
    `select s.*, p.name as project_name,
            (select i.id from customer_invoices i where i.billing_schedule_item_id = s.id and i.status <> 'void') as invoice_id
       from billing_schedule_items s join projects p on p.id = s.project_id
      ${where.length ? `where ${where.join(' and ')}` : ''}
      order by s.planned_date, s.id limit 500`,
    params
  )
  return rows.map(r => ({
    id: r.id, project: { id: r.project_id, name: r.project_name }, booking: r.booking_id ? { type: r.booking_type, id: r.booking_id } : null,
    label: r.label, invoiceType: r.invoice_type, amountMinor: r.amount_minor, plannedDate: r.planned_date, status: r.status, invoiceId: r.invoice_id
  }))
}

// ── Customer invoices ────────────────────────────────────────────────────────────────────────────────

interface LineInput { description: string; amountMinor: string }

function validateLines(lines: LineInput[] | undefined): { description: string; amount: bigint }[] {
  if (!Array.isArray(lines) || lines.length === 0) throw errors.validation({ lines: ['Tambahkan minimal satu baris tagihan.'] })
  if (lines.length > 50) throw errors.validation({ lines: ['Maksimal 50 baris.'] })
  const parsed = lines.map((l, i) => {
    if (!l.description?.trim()) throw errors.validation({ [`lines.${i}.description`]: ['Keterangan wajib diisi.'] })
    return { description: l.description.trim().slice(0, 300), amount: parseMovementAmount(l.amountMinor, `lines.${i}.amountMinor`) }
  })
  if (parsed.reduce((s, l) => s + l.amount, 0n) > MAX_MOVEMENT_MINOR) {
    throw errors.validation({ lines: ['Total invoice melebihi batas per dokumen (Rp 1.000.000.000.000.000).'] })
  }
  return parsed
}

async function replaceLines(tx: Queryable, invoiceId: string, lines: { description: string; amount: bigint }[]): Promise<bigint> {
  await tx.query('delete from customer_invoice_lines where invoice_id = $1', [invoiceId])
  let total = 0n
  let position = 1
  for (const line of lines) {
    await tx.query('insert into customer_invoice_lines (invoice_id, position, description, amount_minor) values ($1, $2, $3, $4)',
      [invoiceId, position++, line.description, line.amount.toString()])
    total += line.amount
  }
  return total
}

export interface InvoiceDraftInput {
  projectId?: string
  booking?: { type: string; id: string }
  billingScheduleItemId?: string
  invoiceType?: string
  lines?: LineInput[]
  dueDate?: string
  expectedDate?: string
  notes?: string
}

export async function createInvoiceDraft(tx: Queryable, actor: Actor, input: InvoiceDraftInput, requestId: string) {
  let schedule: { id: string; project_id: string; booking_type: string | null; booking_id: string | null; label: string; invoice_type: string; amount_minor: string; status: string } | undefined
  if (input.billingScheduleItemId) {
    if (!ID_PATTERN.test(input.billingScheduleItemId)) throw errors.validation({ billingScheduleItemId: ['Termin tidak valid.'] })
    ;[schedule] = await tx.query<NonNullable<typeof schedule> & Record<string, unknown>>('select * from billing_schedule_items where id = $1 for update', [input.billingScheduleItemId])
    if (!schedule) throw errors.validation({ billingScheduleItemId: ['Termin tidak ditemukan.'] })
    if (schedule.status !== 'planned') throw rule('Termin ini sudah ditagih atau dibatalkan.')
    const [linked] = await tx.query("select id from customer_invoices where billing_schedule_item_id = $1 and status <> 'void'", [schedule.id])
    if (linked) throw rule(`Termin ini sudah punya invoice ${linked.id}.`)
    if (input.projectId && input.projectId !== schedule.project_id) throw errors.validation({ projectId: ['Project berbeda dengan project termin.'] })
  }
  const projectInput = {
    projectId: input.projectId ?? schedule?.project_id,
    booking: input.booking ?? (schedule?.booking_id ? { type: schedule.booking_type!, id: schedule.booking_id } : undefined)
  }
  const { refs, project } = await lockProjectRef(tx, projectInput)
  const invoiceType = requireInvoiceType(input.invoiceType ?? schedule?.invoice_type)
  const lines = validateLines(input.lines ?? (schedule ? [{ description: schedule.label, amountMinor: schedule.amount_minor }] : undefined))
  const dueDate = optionalDate(input.dueDate, 'dueDate')
  const expectedDate = optionalDate(input.expectedDate, 'expectedDate')

  let row: { id: string } | undefined
  try {
    ;[row] = await tx.query<{ id: string }>(
      `insert into customer_invoices (project_id, party_id, booking_type, booking_id, billing_schedule_item_id, invoice_type, due_date, expected_date, notes, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [project.id, project.party_id, refs.bookingType, refs.bookingId, schedule?.id ?? null, invoiceType, dueDate, expectedDate, trimOrNull(input.notes, 1000), actor.userId]
    )
  } catch (err) {
    // Backstop for a concurrent draft on the same schedule item (the check above runs without a unique lock).
    if (isUniqueViolation(err)) throw new AppError(409, 'CONFLICT', 'Termin ini baru saja dipakai invoice lain. Muat ulang daftar termin.')
    throw err
  }
  const total = await replaceLines(tx, row!.id, lines)
  await tx.query('update customer_invoices set total_minor = $2 where id = $1', [row!.id, total.toString()])
  await recordAudit(tx, {
    action: 'finance.invoice_drafted', actorUserId: actor.userId, entityType: 'customer_invoice', entityId: row!.id, requestId,
    after: { projectId: project.id, partyId: project.party_id, invoiceType, totalMinor: total.toString() }
  })
  return { id: row!.id }
}

async function lockInvoice(tx: Queryable, id: string) {
  if (!ID_PATTERN.test(id)) throw errors.notFound('Invoice')
  const [inv] = await tx.query<Record<string, any>>('select * from customer_invoices where id = $1 for update', [id])
  if (!inv) throw errors.notFound('Invoice')
  return inv
}

export async function updateInvoiceDraft(tx: Queryable, actor: Actor, id: string, input: InvoiceDraftInput, requestId: string) {
  const inv = await lockInvoice(tx, id)
  if (inv.status !== 'draft') throw rule('Invoice yang sudah terbit tidak bisa diubah. Pakai credit note atau void.')
  if (input.projectId || input.booking || input.billingScheduleItemId) throw errors.validation({ projectId: ['Project, booking, dan termin tidak bisa dipindah; buat draft baru.'] })
  const invoiceType = input.invoiceType === undefined ? null : requireInvoiceType(input.invoiceType)
  const dueDate = input.dueDate === undefined ? undefined : optionalDate(input.dueDate, 'dueDate')
  const expectedDate = input.expectedDate === undefined ? undefined : optionalDate(input.expectedDate, 'expectedDate')
  let total: bigint | null = null
  if (input.lines !== undefined) total = await replaceLines(tx, id, validateLines(input.lines))
  await tx.query(
    `update customer_invoices set invoice_type = coalesce($2, invoice_type),
       due_date = case when $3::boolean then $4::date else due_date end,
       expected_date = case when $5::boolean then $6::date else expected_date end,
       notes = case when $7::boolean then $8 else notes end,
       total_minor = coalesce($9, total_minor), updated_at = now() where id = $1`,
    [id, invoiceType, dueDate !== undefined, dueDate ?? null, expectedDate !== undefined, expectedDate ?? null,
      input.notes !== undefined, trimOrNull(input.notes, 1000), total?.toString() ?? null]
  )
  await recordAudit(tx, { action: 'finance.invoice_draft_updated', actorUserId: actor.userId, entityType: 'customer_invoice', entityId: id, requestId })
  return { id }
}

export async function deleteInvoiceDraft(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const inv = await lockInvoice(tx, id)
  if (inv.status !== 'draft') throw rule('Hanya draft yang bisa dihapus. Invoice terbit di-void.')
  await tx.query('delete from customer_invoices where id = $1', [id])
  await recordAudit(tx, { action: 'finance.invoice_draft_deleted', actorUserId: actor.userId, entityType: 'customer_invoice', entityId: id, requestId })
  return { id }
}

/** Issuing makes the invoice a receivable: number, dates and amounts freeze. No money moves. */
export async function issueInvoice(tx: Queryable, actor: Actor, id: string, input: { issueDate?: string; dueDate?: string }, requestId: string) {
  const inv = await lockInvoice(tx, id)
  if (inv.status !== 'draft') throw rule('Invoice ini sudah terbit atau dibatalkan.')
  const issueDate = input.issueDate === undefined ? todayBusinessDate() : requireDate(input.issueDate, 'issueDate', { notFuture: true })
  const dueDate = input.dueDate !== undefined ? requireDate(input.dueDate, 'dueDate') : inv.due_date
  if (!dueDate) throw errors.validation({ dueDate: ['Tanggal jatuh tempo wajib diisi sebelum invoice diterbitkan.'] })
  if (dueDate < issueDate) throw errors.validation({ dueDate: ['Jatuh tempo tidak boleh sebelum tanggal terbit.'] })
  if (BigInt(inv.total_minor) <= 0n) throw rule('Total invoice harus lebih dari 0.')

  const [ctx] = await tx.query<{ project_name: string; party_name: string; contract_value_minor: string | null; invoiced: string }>(
    `select p.name as project_name, pa.name as party_name, p.contract_value_minor,
            coalesce((select sum(b.total_minor - b.credited_minor) from customer_invoices i join v_customer_invoice_balances b on b.invoice_id = i.id
                       where i.project_id = p.id and i.status = 'issued'), 0) as invoiced
       from projects p join parties pa on pa.id = p.party_id where p.id = $1`,
    [inv.project_id]
  )
  const [numbered] = await tx.query<{ number: string }>(
    `select 'INV-' || to_char($1::date, 'YYYY') || '-' || lpad(nextval('finance_invoice_number_seq')::text, 5, '0') as number`, [issueDate]
  )
  await tx.query(
    `update customer_invoices set status = 'issued', number = $2, issue_date = $3, due_date = $4, issued_by = $5, issued_at = now(),
       billing_snapshot = $6::text::jsonb, updated_at = now() where id = $1`,
    [id, numbered!.number, issueDate, dueDate, actor.userId, JSON.stringify({ partyName: ctx!.party_name, projectName: ctx!.project_name })]
  )
  if (inv.billing_schedule_item_id) {
    await tx.query("update billing_schedule_items set status = 'invoiced', updated_at = now() where id = $1", [inv.billing_schedule_item_id])
  }
  // Advisory, never blocking: billing beyond the contract value is sometimes right (change requests).
  const warnings: { code: string; message: string }[] = []
  if (ctx!.contract_value_minor !== null && BigInt(ctx!.invoiced) + BigInt(inv.total_minor) > BigInt(ctx!.contract_value_minor)) {
    warnings.push({ code: 'EXCEEDS_CONTRACT_VALUE', message: 'Total tagihan project ini kini melebihi nilai kontrak. Pastikan ada perubahan pesanan yang disetujui.' })
  }
  await recordAudit(tx, {
    action: 'finance.invoice_issued', actorUserId: actor.userId, entityType: 'customer_invoice', entityId: id, requestId,
    after: { number: numbered!.number, issueDate, dueDate, totalMinor: inv.total_minor }
  })
  return { id, number: numbered!.number, warnings }
}

export async function voidInvoice(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, requestId: string) {
  const reason = validateReason(reasonInput)
  const inv = await lockInvoice(tx, id)
  if (inv.status !== 'issued') throw rule(inv.status === 'draft' ? 'Draft cukup dihapus, tidak perlu di-void.' : 'Invoice ini sudah dibatalkan.')
  const [b] = await tx.query<{ paid_minor: string }>('select paid_minor from v_customer_invoice_balances where invoice_id = $1', [id])
  const [cn] = await tx.query("select id from credit_notes where customer_invoice_id = $1 and status = 'issued'", [id])
  if (BigInt(b!.paid_minor) > 0n || cn) {
    throw rule('Invoice ini masih punya pembayaran atau credit note. Batalkan pembayaran / credit note-nya dulu; riwayat uang tidak dihapus.')
  }
  await tx.query("update customer_invoices set status = 'void', void_reason = $2, voided_by = $3, voided_at = now(), updated_at = now() where id = $1", [id, reason, actor.userId])
  if (inv.billing_schedule_item_id) {
    await tx.query("update billing_schedule_items set status = 'planned', updated_at = now() where id = $1", [inv.billing_schedule_item_id])
  }
  await recordAudit(tx, { action: 'finance.invoice_voided', actorUserId: actor.userId, entityType: 'customer_invoice', entityId: id, requestId, reason })
  return { id }
}

export async function setInvoiceExpectation(tx: Queryable, actor: Actor, id: string, input: { expectedDate: string | null; reason: string }, requestId: string) {
  const reason = validateReason(input.reason)
  const inv = await lockInvoice(tx, id)
  if (inv.status !== 'issued') throw rule('Perkiraan tanggal bayar hanya untuk invoice yang sudah terbit.')
  const expectedDate = input.expectedDate === null ? null : requireDate(input.expectedDate, 'expectedDate')
  await tx.query('update customer_invoices set expected_date = $2, expected_reason = $3, updated_at = now() where id = $1', [id, expectedDate, reason])
  await recordAudit(tx, {
    action: 'finance.invoice_expectation_set', actorUserId: actor.userId, entityType: 'customer_invoice', entityId: id, requestId, reason,
    before: { expectedDate: inv.expected_date }, after: { expectedDate }
  })
  return { id }
}

export async function setInvoiceDispute(tx: Queryable, actor: Actor, id: string, input: { disputed: boolean; reason: string }, requestId: string) {
  const reason = validateReason(input.reason)
  const inv = await lockInvoice(tx, id)
  if (inv.status !== 'issued') throw rule('Sengketa hanya untuk invoice yang sudah terbit.')
  if (inv.is_disputed === input.disputed) throw rule(input.disputed ? 'Invoice ini sudah ditandai sengketa.' : 'Invoice ini tidak sedang disengketakan.')
  await tx.query('update customer_invoices set is_disputed = $2, dispute_reason = $3, updated_at = now() where id = $1', [id, input.disputed, input.disputed ? reason : null])
  await recordAudit(tx, {
    action: input.disputed ? 'finance.invoice_disputed' : 'finance.invoice_dispute_resolved',
    actorUserId: actor.userId, entityType: 'customer_invoice', entityId: id, requestId, reason
  })
  return { id }
}

// ── Credit notes ─────────────────────────────────────────────────────────────────────────────────────

async function invoiceOutstanding(q: Queryable, id: string): Promise<bigint> {
  const [b] = await q.query<{ total_minor: string; paid_minor: string; credited_minor: string }>(
    'select total_minor, paid_minor, credited_minor from v_customer_invoice_balances where invoice_id = $1', [id]
  )
  return BigInt(b!.total_minor) - BigInt(b!.paid_minor) - BigInt(b!.credited_minor)
}

/** Reduces what the customer still owes (never below zero). Money already received needs a refund (Phase 5). */
export async function issueCreditNote(tx: Queryable, actor: Actor, input: { invoiceId: string; amountMinor: string; reason: string }, requestId: string) {
  const amount = parseMovementAmount(input.amountMinor)
  const reason = validateReason(input.reason)
  const inv = await lockInvoice(tx, input.invoiceId)
  if (inv.status !== 'issued') throw rule('Credit note hanya untuk invoice yang sudah terbit.')
  const outstanding = await invoiceOutstanding(tx, inv.id)
  if (amount > outstanding) {
    throw new AppError(422, 'RULE_VIOLATION', 'Credit note melebihi sisa tagihan. Untuk uang yang sudah diterima, gunakan refund.', {
      details: { outstandingMinor: outstanding.toString(), requestedMinor: amount.toString() }
    })
  }
  const [row] = await tx.query<{ id: string }>(
    `insert into credit_notes (customer_invoice_id, amount_minor, reason, created_by) values ($1, $2, $3, $4) returning id`,
    [inv.id, amount.toString(), reason, actor.userId]
  )
  await recordAudit(tx, {
    action: 'finance.credit_note_issued', actorUserId: actor.userId, entityType: 'credit_note', entityId: row!.id, requestId, reason,
    after: { invoiceId: inv.id, amountMinor: amount.toString() }
  })
  return { id: row!.id, outstandingMinor: (outstanding - amount).toString() }
}

export async function voidCreditNote(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, requestId: string) {
  const reason = validateReason(reasonInput)
  if (!ID_PATTERN.test(id)) throw errors.notFound('Credit note')
  const [cn] = await tx.query<{ status: string; customer_invoice_id: string; refund_id: string | null }>('select status, customer_invoice_id, refund_id from credit_notes where id = $1 for update', [id])
  if (!cn) throw errors.notFound('Credit note')
  if (cn.refund_id) throw rule(`Credit note ini bagian dari kasus pembatalan ${cn.refund_id} dan tidak bisa dibatalkan sendiri.`)
  if (cn.status !== 'issued') throw rule('Credit note ini sudah dibatalkan.')
  await lockInvoice(tx, cn.customer_invoice_id)
  await tx.query("update credit_notes set status = 'void', void_reason = $2, voided_by = $3, voided_at = now() where id = $1", [id, reason, actor.userId])
  await recordAudit(tx, { action: 'finance.credit_note_voided', actorUserId: actor.userId, entityType: 'credit_note', entityId: id, requestId, reason })
  return { id }
}

// ── Receipts (money in from a customer) ──────────────────────────────────────────────────────────────

interface AllocationInput { invoiceId: string; amountMinor: string }

/**
 * Allocates part of a receipt to issued invoices of the same customer. Invoices are locked in id order,
 * each allocation ≤ its outstanding, and the total ≤ what is still unallocated on the receipt.
 */
async function allocateToInvoices(tx: Queryable, actor: Actor, receipt: { id: string; party_id: string; unallocated: bigint }, allocations: AllocationInput[]) {
  if (!Array.isArray(allocations)) return []
  const seen = new Set<string>()
  const parsed = allocations.map((a, i) => {
    if (!a?.invoiceId || !ID_PATTERN.test(a.invoiceId)) throw errors.validation({ [`allocations.${i}.invoiceId`]: ['Invoice tidak valid.'] })
    if (seen.has(a.invoiceId)) throw errors.validation({ [`allocations.${i}.invoiceId`]: ['Invoice yang sama muncul dua kali.'] })
    seen.add(a.invoiceId)
    return { invoiceId: a.invoiceId, amount: parseMovementAmount(a.amountMinor, `allocations.${i}.amountMinor`), index: i }
  })
  const total = parsed.reduce((s, a) => s + a.amount, 0n)
  if (total > receipt.unallocated) {
    throw errors.validation({ allocations: [`Total alokasi (${total}) melebihi uang yang belum dialokasikan (${receipt.unallocated}).`] })
  }
  const results: { invoiceId: string; amountMinor: string; outstandingMinor: string }[] = []
  for (const a of [...parsed].sort((x, y) => x.invoiceId.localeCompare(y.invoiceId))) {
    const [inv] = await tx.query<{ id: string; status: string; party_id: string; number: string | null }>(
      'select id, status, party_id, number from customer_invoices where id = $1 for update', [a.invoiceId]
    )
    const field = `allocations.${a.index}.invoiceId`
    if (!inv) throw errors.validation({ [field]: ['Invoice tidak ditemukan.'] })
    if (inv.status !== 'issued') throw errors.validation({ [field]: [`Invoice ${inv.number ?? inv.id} belum terbit atau sudah dibatalkan.`] })
    if (inv.party_id !== receipt.party_id) throw errors.validation({ [field]: ['Invoice ini milik customer lain.'] })
    const outstanding = await invoiceOutstanding(tx, inv.id)
    if (a.amount > outstanding) {
      throw errors.validation({ [`allocations.${a.index}.amountMinor`]: [`Melebihi sisa tagihan ${inv.number} (${outstanding}).`] })
    }
    await tx.query('insert into payment_allocations (transaction_id, target_type, target_id, amount_minor, created_by) values ($1, $2, $3, $4, $5)',
      [receipt.id, 'customer_invoice', inv.id, a.amount.toString(), actor.userId])
    results.push({ invoiceId: inv.id, amountMinor: a.amount.toString(), outstandingMinor: (outstanding - a.amount).toString() })
  }
  return results
}

export interface ReceiptInput {
  bankAccountId: string
  amountMinor: string
  effectiveDate: string
  partyId: string
  projectId?: string
  booking?: { type: string; id: string }
  counterparty?: string
  reference?: string
  memo?: string
  allocations?: AllocationInput[]
}

/** Money in from a customer. Whatever is not allocated stays as the customer's advance (uang muka). */
export async function postReceipt(tx: Queryable, actor: Actor, input: ReceiptInput, requestId: string) {
  const amount = parseMovementAmount(input.amountMinor)
  const effectiveDate = validateEffectiveDate(input.effectiveDate)
  if (!input.partyId) throw errors.validation({ partyId: ['Pilih customer yang membayar.'] })
  const refs = await resolveReferences(tx, { projectId: input.projectId, booking: input.booking, partyId: input.partyId })
  if (refs.projectId) {
    const [p] = await tx.query<{ party_id: string }>('select party_id from projects where id = $1', [refs.projectId])
    if (p!.party_id !== input.partyId) throw errors.validation({ projectId: ['Project ini milik customer lain.'] })
  }
  const account = await lockPostableAccount(tx, input.bankAccountId, effectiveDate)
  const [row] = await tx.query<{ id: string }>(
    `insert into financial_transactions (bank_account_id, direction, amount_minor, currency, kind, effective_date, project_id, booking_type, booking_id,
       party_id, counterparty, reference, memo, created_by)
     values ($1, 'in', $2, $3, 'customer_receipt', $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
    [account.id, amount.toString(), account.currency, effectiveDate, refs.projectId, refs.bookingType, refs.bookingId, input.partyId,
      trimOrNull(input.counterparty, 200), trimOrNull(input.reference, 120), trimOrNull(input.memo), actor.userId]
  )
  const allocations = await allocateToInvoices(tx, actor, { id: row!.id, party_id: input.partyId, unallocated: amount }, input.allocations ?? [])
  const allocated = allocations.reduce((s, a) => s + BigInt(a.amountMinor), 0n)
  await recordAudit(tx, {
    action: 'finance.receipt_posted', actorUserId: actor.userId, entityType: 'financial_transaction', entityId: row!.id, requestId,
    after: { accountId: account.id, partyId: input.partyId, amountMinor: amount.toString(), effectiveDate, allocations }
  })
  return { transactionId: row!.id, allocations, unallocatedMinor: (amount - allocated).toString() }
}

/** Allocate a customer's advance (an earlier receipt) to invoices issued later. */
export async function allocateReceipt(tx: Queryable, actor: Actor, transactionId: string, allocations: AllocationInput[], requestId: string) {
  if (!ID_PATTERN.test(transactionId)) throw errors.notFound('Penerimaan')
  const [t] = await tx.query<{ id: string; kind: string; party_id: string; unallocated_minor: string }>(
    `select t.id, t.kind, t.party_id, u.unallocated_minor from financial_transactions t
       left join v_unallocated_payments u on u.transaction_id = t.id where t.id = $1`, [transactionId]
  )
  if (!t || t.kind !== 'customer_receipt') throw errors.notFound('Penerimaan')
  if (!allocations?.length) throw errors.validation({ allocations: ['Pilih minimal satu invoice.'] })
  // Serialise allocations of the same receipt, THEN read what is left (it may have been reversed meanwhile).
  await tx.query('select pg_advisory_xact_lock(hashtext($1))', [`alloc:${transactionId}`])
  const [fresh] = await tx.query<{ unallocated_minor: string }>('select unallocated_minor from v_unallocated_payments where transaction_id = $1', [transactionId])
  if (!fresh) throw rule('Penerimaan ini sudah dibatalkan.')
  const result = await allocateToInvoices(tx, actor, { id: t.id, party_id: t.party_id, unallocated: BigInt(fresh!.unallocated_minor) }, allocations)
  const allocated = result.reduce((s, a) => s + BigInt(a.amountMinor), 0n)
  await recordAudit(tx, { action: 'finance.receipt_allocated', actorUserId: actor.userId, entityType: 'financial_transaction', entityId: transactionId, requestId, after: { allocations: result } })
  return { transactionId, allocations: result, unallocatedMinor: (BigInt(fresh!.unallocated_minor) - allocated).toString() }
}

// ── Reads ────────────────────────────────────────────────────────────────────────────────────────────

const INVOICE_SELECT = `
  select i.*, p.name as project_name, pa.name as party_name, b.paid_minor, b.credited_minor,
         (b.total_minor - b.paid_minor - b.credited_minor) as outstanding_minor
    from customer_invoices i
    join projects p on p.id = i.project_id
    join parties pa on pa.id = i.party_id
    join v_customer_invoice_balances b on b.invoice_id = i.id`

export function invoiceRowDto(r: Record<string, any>, today = todayBusinessDate()) {
  const outstanding = BigInt(r.outstanding_minor)
  const paid = BigInt(r.paid_minor)
  // 'credited': brought to zero by credit notes without any money received — not "paid".
  const settlement = r.status !== 'issued' ? null
    : outstanding === 0n ? (paid === 0n ? 'credited' : 'paid')
      : paid > 0n || BigInt(r.credited_minor) > 0n ? 'partial' : 'open'
  const overdue = r.status === 'issued' && outstanding > 0n && r.due_date < today
  return {
    id: r.id,
    number: r.number,
    project: { id: r.project_id, name: r.project_name },
    party: { id: r.party_id, name: r.party_name },
    booking: r.booking_id ? { type: r.booking_type, id: r.booking_id } : null,
    billingScheduleItemId: r.billing_schedule_item_id,
    invoiceType: r.invoice_type,
    status: r.status,
    /** Derived for issued invoices: open / partial / paid / credited (zeroed by credit notes, no money). */
    settlement,
    overdue,
    daysOverdue: overdue ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${r.due_date}T00:00:00Z`)) / 86_400_000) : 0,
    currency: r.currency,
    totalMinor: r.total_minor,
    paidMinor: r.paid_minor,
    creditedMinor: r.credited_minor,
    outstandingMinor: r.status === 'issued' ? r.outstanding_minor : '0',
    issueDate: r.issue_date,
    dueDate: r.due_date,
    expectedDate: r.expected_date,
    expectedReason: r.expected_reason,
    isDisputed: r.is_disputed,
    disputeReason: r.dispute_reason,
    notes: r.notes,
    voidReason: r.void_reason,
    createdAt: (r.created_at as Date).toISOString(),
    issuedAt: r.issued_at ? (r.issued_at as Date).toISOString() : null
  }
}

export async function getInvoice(db: Db, id: string) {
  if (!ID_PATTERN.test(id)) throw errors.notFound('Invoice')
  const [row] = await db.query<Record<string, any>>(`${INVOICE_SELECT} where i.id = $1`, [id])
  if (!row) throw errors.notFound('Invoice')
  const lines = await db.query<Record<string, any>>('select position, description, amount_minor from customer_invoice_lines where invoice_id = $1 order by position', [id])
  const payments = await db.query<Record<string, any>>(
    `select a.transaction_id, a.amount_minor, a.created_at, t.effective_date, t.bank_account_id, ba.code as account_code, t.reference,
            exists (select 1 from financial_transactions r where r.reversal_of_id = t.id) as reversed
       from payment_allocations a join financial_transactions t on t.id = a.transaction_id join bank_accounts ba on ba.id = t.bank_account_id
      where a.target_type = 'customer_invoice' and a.target_id = $1 order by t.effective_date, a.id`, [id]
  )
  const credits = await db.query<Record<string, any>>('select id, effect, refund_id, amount_minor, reason, status, created_at from credit_notes where customer_invoice_id = $1 order by id', [id])
  return {
    ...invoiceRowDto(row),
    billingSnapshot: row.billing_snapshot,
    lines: lines.map(l => ({ position: l.position, description: l.description, amountMinor: l.amount_minor })),
    payments: payments.map(p => ({
      transactionId: p.transaction_id, amountMinor: p.amount_minor, effectiveDate: p.effective_date,
      account: { id: p.bank_account_id, code: p.account_code }, reference: p.reference, reversed: p.reversed
    })),
    creditNotes: credits.map(c => ({
      id: c.id, effect: c.effect as 'reduce_receivable' | 'refund_liability', refundId: (c.refund_id ?? null) as string | null,
      amountMinor: c.amount_minor, reason: c.reason, status: c.status, createdAt: (c.created_at as Date).toISOString()
    }))
  }
}

export interface InvoiceListFilter {
  status?: string
  settlement?: string
  partyId?: string
  projectId?: string
  dueTo?: string
  cursor?: string
  limit: number
}

function encodeDueCursor(r: { sort_date: string; id: string }) {
  return Buffer.from(JSON.stringify([r.sort_date, r.id]), 'utf8').toString('base64url')
}
function decodeDueCursor(cursor: string): [string, string] {
  try {
    const v = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (Array.isArray(v) && v.length === 2 && isIsoDate(v[0]) && ID_PATTERN.test(v[1])) return v as [string, string]
  } catch {}
  throw errors.validation({ cursor: ['Cursor tidak valid.'] })
}

/**
 * Receivables worklist: issued invoices ordered by due date (soonest first).
 * settlement: 'outstanding' (default: open + partial), 'overdue', 'paid', or 'all'.
 * Summary totals cover the whole filter.
 */
export async function listReceivables(db: Db, filter: InvoiceListFilter) {
  const today = todayBusinessDate()
  const params: unknown[] = []
  const where = ["i.status = 'issued'"]
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.split('?').join(`$${params.length}`)) }
  const settlement = filter.settlement ?? 'outstanding'
  if (!['outstanding', 'overdue', 'paid', 'all'].includes(settlement)) throw errors.validation({ settlement: ['Pilihan: outstanding, overdue, paid, all.'] })
  if (settlement === 'outstanding') where.push('(b.total_minor - b.paid_minor - b.credited_minor) > 0')
  if (settlement === 'paid') where.push('(b.total_minor - b.paid_minor - b.credited_minor) = 0')
  if (settlement === 'overdue') { where.push('(b.total_minor - b.paid_minor - b.credited_minor) > 0'); add('i.due_date < ?', today) }
  if (filter.partyId) { if (!ID_PATTERN.test(filter.partyId)) throw errors.validation({ partyId: ['Customer tidak valid.'] }); add('i.party_id = ?', filter.partyId) }
  if (filter.projectId) { if (!ID_PATTERN.test(filter.projectId)) throw errors.validation({ projectId: ['Project tidak valid.'] }); add('i.project_id = ?', filter.projectId) }
  if (filter.dueTo) { if (!isIsoDate(filter.dueTo)) throw errors.validation({ dueTo: ['Tanggal harus berformat YYYY-MM-DD.'] }); add('i.due_date <= ?', filter.dueTo) }

  const base = where.join(' and ')
  params.push(today)
  const todayParam = `$${params.length}`
  const [summary] = await db.query<{ outstanding: string; overdue: string; count: string }>(
    `select coalesce(sum(b.total_minor - b.paid_minor - b.credited_minor), 0) as outstanding,
            coalesce(sum(case when i.due_date < ${todayParam} then b.total_minor - b.paid_minor - b.credited_minor end), 0) as overdue,
            count(*) as count
       from customer_invoices i join v_customer_invoice_balances b on b.invoice_id = i.id where ${base}`,
    params
  )
  const pageParams = params.slice(0, -1)
  let pageWhere = base
  if (filter.cursor) {
    const [d, id] = decodeDueCursor(filter.cursor)
    pageParams.push(d, id.length, id)
    const n = pageParams.length
    pageWhere += ` and (i.due_date, length(i.id), i.id) > ($${n - 2}::date, $${n - 1}::int, $${n})`
  }
  pageParams.push(filter.limit + 1)
  const rows = await db.query<Record<string, any>>(
    `${INVOICE_SELECT} where ${pageWhere} order by i.due_date, length(i.id), i.id limit $${pageParams.length}`, pageParams
  )
  const items = rows.slice(0, filter.limit)
  const last = items[items.length - 1]
  return {
    items: items.map(r => invoiceRowDto(r, today)),
    summary: { outstandingMinor: summary!.outstanding, overdueMinor: summary!.overdue, count: Number(summary!.count), asOf: today },
    pagination: { limit: filter.limit, nextCursor: rows.length > filter.limit && last ? encodeDueCursor({ sort_date: last.due_date, id: last.id }) : null }
  }
}

/** All customer invoices incl. drafts and void, newest first (management view). */
export async function listInvoices(db: Db, filter: { status?: string; projectId?: string; partyId?: string; limit: number }) {
  const params: unknown[] = []
  const where: string[] = []
  if (filter.status) {
    if (!['draft', 'issued', 'void'].includes(filter.status)) throw errors.validation({ status: ['Status: draft, issued, atau void.'] })
    params.push(filter.status); where.push(`i.status = $${params.length}`)
  }
  if (filter.projectId) { params.push(filter.projectId); where.push(`i.project_id = $${params.length}`) }
  if (filter.partyId) { params.push(filter.partyId); where.push(`i.party_id = $${params.length}`) }
  params.push(filter.limit)
  const rows = await db.query<Record<string, any>>(
    `${INVOICE_SELECT} ${where.length ? `where ${where.join(' and ')}` : ''} order by i.created_at desc, i.id desc limit $${params.length}`, params
  )
  return rows.map(r => invoiceRowDto(r))
}
