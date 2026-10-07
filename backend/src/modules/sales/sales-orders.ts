import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { parseAmountMinor } from '../../shared/money'
import { createParty } from '../core/party-writes'
import { cancelTravelersOfOrder } from '../core/travelers'

/**
 * Sales orders (S6b): B2C standalone orders and Group Trip participant bookings. Status runs
 * draft → paid → ongoing → done (cancelled from any open status). A Group Trip order becomes paid only through the
 * Finance DP confirmation. Seats of a Group Trip: capacity − pax of paid/ongoing/done − pax of drafts.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
export const SALES_ORDER_STATUSES = ['draft', 'paid', 'ongoing', 'done', 'cancelled'] as const
const FLOW: Record<string, string[]> = { draft: ['paid', 'cancelled'], paid: ['ongoing', 'cancelled'], ongoing: ['done', 'cancelled'], done: [], cancelled: [] }

export async function listSalesOrders(db: Queryable, filter: { id?: string; projectId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select s.id, s.project_id, s.party_id, p.name as party_name, s.lead_id, s.destination, s.travel_start_date::text as travel_start_date,
            s.travel_end_date::text as travel_end_date, s.traveler_count, s.price_minor, s.status, s.status_reason, s.note,
            s.paid_on::text as paid_on, s.created_on::text as created_on, s.updated_at
       from sales_order_refs s join parties p on p.id = s.party_id
      where ($1::text is null or s.id = $1) and ($2::text is null or s.project_id = $2) order by s.id`,
    [filter.id ?? null, filter.projectId ?? null]
  )
  return rows.map(r => ({
    id: r.id as string,
    projectId: (r.project_id ?? null) as string | null,
    partyId: r.party_id as string,
    partyName: r.party_name as string,
    leadId: (r.lead_id ?? null) as string | null,
    destination: (r.destination ?? null) as string | null,
    travelStartDate: (r.travel_start_date ?? null) as string | null,
    travelEndDate: (r.travel_end_date ?? null) as string | null,
    travelerCount: Number(r.traveler_count),
    priceMinor: String(r.price_minor),
    status: r.status as string,
    statusReason: (r.status_reason ?? null) as string | null,
    note: (r.note ?? null) as string | null,
    paidOn: (r.paid_on ?? null) as string | null,
    createdOn: r.created_on as string,
    updatedAt: new Date(r.updated_at as string).toISOString()
  }))
}

export type SalesOrderView = Awaited<ReturnType<typeof listSalesOrders>>[number]

export async function projectSeats(q: Queryable, projectId: string, lock = false) {
  const [p] = await q.query<{ traveler_count: number; is_group_trip: boolean }>(
    `select traveler_count, is_group_trip from projects where id = $1${lock ? ' for update' : ''}`, [projectId])
  if (!p) throw errors.notFound('Project')
  if (!p.is_group_trip) throw rule('Project ini bukan Group Trip.')
  const [s] = await q.query<{ filled: string; held: string }>(
    `select coalesce(sum(traveler_count) filter (where status in ('paid', 'ongoing', 'done')), 0) as filled,
            coalesce(sum(traveler_count) filter (where status = 'draft'), 0) as held
       from sales_order_refs where project_id = $1`, [projectId])
  const capacity = Number(p.traveler_count)
  const filled = Number(s!.filled)
  const held = Number(s!.held)
  return { capacity, filled, held, available: Math.max(0, capacity - filled - held) }
}

export interface SalesOrderRow {
  partyId: string
  projectId: string | null
  leadId: string | null
  destination: string
  travelStartDate: string
  travelEndDate: string
  travelerCount: number
  priceMinor: bigint
  note: string | null
}

/** Inserts the order; the caller checks seats (and locks the project) for a Group Trip booking. */
export async function insertSalesOrder(tx: Queryable, actor: Actor, row: SalesOrderRow, today: string, requestId: string): Promise<{ id: string }> {
  const id = await nextId(tx, 'SLO-')
  await tx.query(
    `insert into sales_order_refs (id, project_id, party_id, lead_id, destination, travel_start_date, travel_end_date, traveler_count, price_minor, note, created_on)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, row.projectId, row.partyId, row.leadId, row.destination, row.travelStartDate, row.travelEndDate, row.travelerCount, row.priceMinor.toString(), row.note, today]
  )
  await recordAudit(tx, {
    action: 'sales_order.created', actorUserId: actor.userId, entityType: 'sales_order', entityId: id, requestId,
    after: { ...row, priceMinor: row.priceMinor.toString() }
  })
  return { id }
}

export async function createSalesOrder(tx: Queryable, actor: Actor, input: Record<string, unknown>, today: string, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const destination = typeof input.destination === 'string' ? input.destination.trim() : ''
  if (!destination) problems.destination = ['Destinasi wajib diisi.']
  else if (destination.length > 200) problems.destination = ['Destinasi maksimal 200 karakter.']
  for (const f of ['travelStartDate', 'travelEndDate'] as const) {
    if (typeof input[f] !== 'string' || !isIsoDate(input[f] as string)) problems[f] = ['Tanggal harus format YYYY-MM-DD.']
  }
  if (!problems.travelEndDate && !problems.travelStartDate && (input.travelStartDate as string) > (input.travelEndDate as string)) {
    problems.travelEndDate = ['Tanggal selesai tidak boleh sebelum tanggal mulai.']
  }
  const pax = input.travelerCount
  if (!Number.isInteger(pax) || (pax as number) < 1 || (pax as number) > 10_000) problems.travelerCount = ['Jumlah traveler minimal 1.']
  let price = 0n
  try { price = parseAmountMinor(input.priceMinor, 'priceMinor') } catch { problems.priceMinor = ['Harga harus angka rupiah lebih dari 0.'] }
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 2000) : null
  let partyId: string | undefined
  if (input.partyId !== undefined && input.partyId !== null) {
    const found = typeof input.partyId === 'string' && ID_PATTERN.test(input.partyId)
      ? (await tx.query<{ id: string }>('select id from parties where id = $1', [input.partyId]))[0]
      : undefined
    if (!found) problems.partyId = ['Customer tidak ditemukan.']
    else partyId = found.id
  } else if (typeof input.customerName !== 'string' || !input.customerName.trim()) {
    problems.customerName = ['Nama customer wajib diisi.']
  }
  if (Object.keys(problems).length) throw errors.validation(problems)
  if (!partyId) {
    partyId = (await createParty(tx, actor, { name: (input.customerName as string).trim(), partyType: 'individual', lifecycleStatus: 'client' }, requestId)).id
  }
  return insertSalesOrder(tx, actor, {
    partyId, projectId: null, leadId: null, destination, travelStartDate: input.travelStartDate as string,
    travelEndDate: input.travelEndDate as string, travelerCount: pax as number, priceMinor: price, note
  }, today, requestId)
}

export async function changeSalesOrderStatus(tx: Queryable, actor: Actor, id: string, to: unknown, reasonInput: unknown, today: string, requestId: string): Promise<void> {
  if (!(SALES_ORDER_STATUSES as readonly unknown[]).includes(to)) throw errors.validation({ to: [`Status harus salah satu dari: ${SALES_ORDER_STATUSES.join(', ')}.`] })
  const reason = typeof reasonInput === 'string' && reasonInput.trim() ? reasonInput.trim().slice(0, 1000) : null
  if (to === 'cancelled' && !reason) throw errors.validation({ reason: ['Alasan pembatalan wajib diisi.'] })
  const [so] = await tx.query<{ status: string; project_id: string | null }>('select status, project_id from sales_order_refs where id = $1 for update', [id])
  if (!so) throw errors.notFound('Sales order')
  if (!FLOW[so.status]!.includes(to as string)) throw rule(`Status tidak bisa berpindah dari ${so.status} ke ${to as string}.`)
  if (to === 'paid' && so.project_id) throw rule('Booking Group Trip menjadi paid lewat konfirmasi DP di Finance.')
  const invoices = to === 'cancelled'
    ? (await tx.query<{ id: string }>("select id from customer_invoices where sales_order_id = $1 and status <> 'void'", [id])).map(r => r.id)
    : []
  await tx.query(
    `update sales_order_refs set status = $2, status_reason = $3, status_changed_at = now(), updated_at = now(),
       paid_on = case when $2 = 'paid' then $4::date else paid_on end
     where id = $1`,
    [id, to, to === 'cancelled' ? reason : null, today]
  )
  // S7a: a cancelled booking's travelers are cancelled too (and leave their rooms).
  if (to === 'cancelled') await cancelTravelersOfOrder(tx, id, 'Order dibatalkan')
  await recordAudit(tx, {
    action: 'sales_order.status_changed', actorUserId: actor.userId, entityType: 'sales_order', entityId: id, requestId, reason,
    before: { status: so.status }, after: { status: to }, details: invoices.length ? { invoiceIds: invoices } : undefined
  })
}
