import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { businessDateOf } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { bookingBilledNetMinor } from '../finance/summaries'
import {
  BOOKING_INITIAL_STATUS,
  BOOKING_LOCKED_FOR_EDIT,
  BOOKING_STATUSES,
  BOOKING_TRANSITIONS,
  cleanDetails,
  defaultServiceLabel,
  departureDateOf,
  miceTotals,
  serviceStatusFor,
  serviceTypeOf
} from './booking-rules'
import { actorName, recordProjectActivity } from './activities'
import { BOOKING_LABEL, bookingHasFinance, setBookingStatus } from './booking-status'
import type { BookingType } from './repository'
import { insertService, money } from './service-writes'

/**
 * Bookings (S4a): flight/hotel/transport/MICE on `booking_refs`. Core columns + `details` (UI-owned shape).
 * Sell price, net cost and departure date are what Finance reads; MICE prices and every departure date are
 * derived from `details`. A booking always sits on a project service whose status follows the booking.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const PREFIX: Record<BookingType, 'FLT-' | 'HTL-' | 'TRN-' | 'MICE-'> = { flight: 'FLT-', hotel: 'HTL-', transport: 'TRN-', mice: 'MICE-' }
const rupiah = (v: bigint) => `Rp ${v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

function reference(value: unknown, problems: FieldErrors): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') { problems.reference = ['Harus teks.']; return undefined }
  const s = value.trim()
  if (s.length > 100) { problems.reference = ['Maksimal 100 karakter.']; return undefined }
  return s || null
}

function prices(type: BookingType, input: Record<string, unknown>, problems: FieldErrors) {
  if (type === 'mice') {
    for (const k of ['sellAmountMinor', 'netCostMinor']) if (input[k] !== undefined) problems[k] = ['Harga MICE dihitung dari BOQ.']
    return { sell: undefined, net: undefined }
  }
  return { sell: money(input.sellAmountMinor, 'sellAmountMinor', problems), net: money(input.netCostMinor, 'netCostMinor', problems) }
}

export async function createBooking(tx: Queryable, actor: Actor, type: BookingType, projectId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const details = cleanDetails(type, input.details ?? {}, problems)
  const ref = reference(input.reference, problems)
  const { sell, net } = prices(type, input, problems)
  const serviceType = serviceTypeOf(type)
  const label = typeof input.label === 'string' && input.label.trim() ? input.label.trim().slice(0, 200) : defaultServiceLabel(serviceType)
  let serviceId: string | undefined
  if (input.serviceId !== undefined && input.serviceId !== null) {
    const [s] = typeof input.serviceId === 'string' && ID_PATTERN.test(input.serviceId)
      ? await tx.query<{ id: string }>('select id from project_services where id = $1 and project_id = $2 and service_type = $3 for update', [input.serviceId, projectId, serviceType])
      : []
    if (!s) problems.serviceId = ['Layanan tidak ditemukan di project ini untuk jenis booking ini.']
    else serviceId = s.id
  }
  if (Object.keys(problems).length) throw errors.validation(problems)

  // S4b: an active booking already on the chosen service needs an explicit "create anyway" (flagged duplicate).
  let duplicateOf: { type: string; id: string }[] = []
  if (serviceId) {
    duplicateOf = await tx.query<{ type: string; id: string }>(
      `select booking_type as type, booking_id as id from booking_refs
        where service_id = $1 and status not in ('cancelled', 'refunded', 'no-show', 'completed')
        order by booking_type, booking_id`,
      [serviceId]
    )
    if (duplicateOf.length && input.allowDuplicate !== true) {
      throw new AppError(409, 'CONFLICT', 'Sudah ada booking aktif untuk layanan ini.', { details: { conflicts: duplicateOf } })
    }
  }
  const duplicateNote = duplicateOf.length && typeof input.duplicateNote === 'string' && input.duplicateNote.trim() ? input.duplicateNote.trim().slice(0, 1000) : null

  const status = BOOKING_INITIAL_STATUS[type]
  const serviceStatus = serviceStatusFor(type, status)
  let serviceCreated = false
  if (!serviceId) {
    const [reuse] = await tx.query<{ id: string }>(
      `select ps.id from project_services ps
        where ps.project_id = $1 and ps.service_type = $2 and ps.status = 'not-started' and ps.booking_reference is null
          and not exists (select 1 from booking_refs b where b.service_id = ps.id)
        order by ps.id limit 1 for update`,
      [projectId, serviceType]
    )
    if (reuse) {
      serviceId = reuse.id
    } else {
      serviceId = await insertService(tx, { projectId, type: serviceType, label, status: serviceStatus })
      serviceCreated = true
    }
  }
  await tx.query('update project_services set status = $2, booking_reference = coalesce($3, booking_reference), updated_at = now() where id = $1', [serviceId, serviceStatus, ref ?? null])

  const totals = type === 'mice' ? miceTotals(details!) : { sellMinor: sell ?? null, netMinor: net ?? null }
  const id = await nextId(tx, PREFIX[type])
  await tx.query(
    `insert into booking_refs (booking_type, booking_id, project_id, service_id, status, reference, sell_amount_minor, net_cost_minor, departure_date, details,
       flagged_duplicate, duplicate_of, duplicate_note)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text::jsonb, $11, $12::text::jsonb, $13)`,
    [type, id, projectId, serviceId, status, ref ?? null, totals.sellMinor, totals.netMinor, departureDateOf(type, details!), JSON.stringify(details),
      duplicateOf.length > 0, JSON.stringify(duplicateOf), duplicateNote]
  )
  if (serviceCreated) {
    await recordAudit(tx, { action: 'service.created', actorUserId: actor.userId, entityType: 'project_service', entityId: serviceId, requestId, after: { projectId, type: serviceType, label, viaBooking: id } })
  }
  // S7d: an intentional duplicate is a change the team has to review.
  if (duplicateOf.length) {
    await recordProjectActivity(tx, {
      projectId, actorUserId: actor.userId, sourceAction: 'booking.duplicate', sourceEntityId: id, isChange: true,
      message: `${BOOKING_LABEL[type]} Booking ${id} dibuat sebagai duplicate booking yang disengaja (booking aktif lain untuk service yang sama: ${duplicateOf.map(d => d.id).join(', ')}) — dikonfirmasi oleh ${await actorName(tx, actor.userId)}.${duplicateNote ? ` Catatan: ${duplicateNote}` : ''}`
    })
  }
  await recordAudit(tx, { action: 'booking.created', actorUserId: actor.userId, entityType: 'booking', entityId: id, requestId, after: { type, projectId, serviceId, status, sellAmountMinor: totals.sellMinor } })
  return { id }
}

const FORBIDDEN = ['type', 'id', 'projectId', 'serviceId', 'status', 'statusReason', 'departureDate', 'provenance']

export async function updateBooking(tx: Queryable, actor: Actor, type: BookingType, id: string, input: Record<string, unknown>, requestId: string): Promise<void> {
  const blocked = Object.keys(input).filter(k => FORBIDDEN.includes(k))
  if (blocked.length) throw errors.validation(Object.fromEntries(blocked.map(k => [k, ['Tidak bisa diubah lewat edit booking.']])))
  const [cur] = await tx.query<{ status: string; service_id: string | null; reference: string | null; sell_amount_minor: string | null; net_cost_minor: string | null; details: Record<string, unknown> }>(
    'select status, service_id, reference, sell_amount_minor, net_cost_minor, details from booking_refs where booking_type = $1 and booking_id = $2 for update',
    [type, id]
  )
  if (!cur) throw errors.notFound('Booking')
  if (BOOKING_LOCKED_FOR_EDIT[type].includes(cur.status)) throw rule(`Booking berstatus ${cur.status} tidak bisa diedit lagi.`)
  const problems: FieldErrors = {}
  const details = input.details === undefined ? cur.details : cleanDetails(type, input.details, problems)
  const ref = reference(input.reference, problems)
  const { sell, net } = prices(type, input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)

  const totals = type === 'mice' ? miceTotals(details!) : null
  const nextSell = totals ? totals.sellMinor : sell === undefined ? cur.sell_amount_minor : sell
  const nextNet = totals ? totals.netMinor : net === undefined ? cur.net_cost_minor : net
  if (nextSell !== cur.sell_amount_minor) {
    const billed = await bookingBilledNetMinor(tx, type, id)
    if (billed > 0n && BigInt(nextSell ?? 0) < billed) {
      throw rule(`Harga jual tidak boleh di bawah yang sudah ditagih (${rupiah(billed)}). Kalau harga memang turun, minta Finance membuat credit note dulu.`)
    }
  }
  const nextRef = ref === undefined ? cur.reference : ref
  await tx.query(
    `update booking_refs set details = $3::text::jsonb, reference = $4, sell_amount_minor = $5, net_cost_minor = $6, departure_date = $7, updated_at = now()
      where booking_type = $1 and booking_id = $2`,
    [type, id, JSON.stringify(details), nextRef, nextSell, nextNet, departureDateOf(type, details!)]
  )
  // Only a real change of the booking reference moves the service reference (an unchanged null must not wipe it).
  if (nextRef !== cur.reference && cur.service_id) await tx.query('update project_services set booking_reference = $2, updated_at = now() where id = $1', [cur.service_id, nextRef])
  await recordAudit(tx, {
    action: 'booking.updated', actorUserId: actor.userId, entityType: 'booking', entityId: id, requestId,
    before: { reference: cur.reference, sellAmountMinor: cur.sell_amount_minor, netCostMinor: cur.net_cost_minor },
    after: { reference: nextRef, sellAmountMinor: nextSell, netCostMinor: nextNet, detailsChanged: input.details !== undefined }
  })
}

const PENALTY_OUTCOMES = ['no-show', 'refunded']

export async function changeBookingStatus(tx: Queryable, actor: Actor, type: BookingType, id: string, to: unknown, reasonInput: unknown, requestId: string, extra: { penaltyMinor?: unknown; refundEligible?: unknown } = {}): Promise<void> {
  if (typeof to !== 'string' || !BOOKING_STATUSES[type].includes(to)) throw errors.validation({ to: [`Status harus salah satu dari: ${BOOKING_STATUSES[type].join(', ')}.`] })
  // S8: a no-show / refunded booking keeps its penalty in a cancellation record (a `cancelled` one goes through Finance).
  const penaltyInput = extra.penaltyMinor
  let penalty: string | null = null
  if (penaltyInput !== undefined && penaltyInput !== null && penaltyInput !== '') {
    if (!PENALTY_OUTCOMES.includes(to)) throw errors.validation({ penaltyMinor: ['Denda hanya untuk status no-show atau refunded.'] })
    if (typeof penaltyInput !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(penaltyInput)) throw errors.validation({ penaltyMinor: ['Denda harus angka bulat ≥ 0, dikirim sebagai teks.'] })
    penalty = penaltyInput
  }
  if (extra.refundEligible !== undefined && typeof extra.refundEligible !== 'boolean') throw errors.validation({ refundEligible: ['Harus ya/tidak.'] })
  const refundEligible = typeof extra.refundEligible === 'boolean' ? extra.refundEligible : to === 'refunded'
  const reason = typeof reasonInput === 'string' && reasonInput.trim() ? reasonInput.trim().slice(0, 1000) : null
  if ((to === 'cancelled' || to === 'refunded') && !reason) throw errors.validation({ reason: ['Alasan wajib diisi untuk pembatalan/refund.'] })
  const [cur] = await tx.query<{ status: string }>('select status from booking_refs where booking_type = $1 and booking_id = $2 for update', [type, id])
  if (!cur) throw errors.notFound('Booking')
  if (!BOOKING_TRANSITIONS[type][cur.status]?.includes(to)) throw rule(`Status booking tidak bisa diubah dari ${cur.status} ke ${to}.`)
  if (to === 'cancelled' && await bookingHasFinance(tx, type, id)) {
    throw rule('Booking ini sudah punya transaksi Finance — ajukan pembatalan lewat Finance.')
  }
  await setBookingStatus(tx, actor, type, id, cur.status, to, reason, requestId)
  if (PENALTY_OUTCOMES.includes(to)) {
    const [b] = await tx.query<{ project_id: string }>('select project_id from booking_refs where booking_type = $1 and booking_id = $2', [type, id])
    const cnx = await nextId(tx, 'CNX-')
    await tx.query(
      `insert into booking_cancellations (id, project_id, booking_type, booking_id, outcome, reason, penalty_minor, refund_eligible, cancelled_by, cancelled_on)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [cnx, b!.project_id, type, id, to, reason ?? (to === 'no-show' ? 'Traveler tidak hadir (no-show).' : 'Tiket di-refund.'), penalty, refundEligible, actor.userId, businessDateOf(new Date())]
    )
    await recordAudit(tx, { action: 'booking.cancellation_recorded', actorUserId: actor.userId, entityType: 'booking', entityId: id, requestId,
      after: { cancellationId: cnx, outcome: to, penaltyMinor: penalty } })
  }
}

export async function listBookingCancellations(db: Queryable, projectId?: string) {
  const rows = await db.query<Record<string, unknown>>(
    `select id, project_id, booking_type, booking_id, outcome, reason, penalty_minor::text as penalty_minor, refund_eligible, cancelled_by, cancelled_on::text as cancelled_on
       from booking_cancellations where ($1::text is null or project_id = $1) order by cancelled_on desc, id desc`, [projectId ?? null])
  return rows.map(r => ({
    id: r.id as string,
    projectId: r.project_id as string,
    bookingType: r.booking_type as string,
    bookingId: r.booking_id as string,
    outcome: r.outcome as string,
    reason: r.reason as string,
    penaltyMinor: r.penalty_minor === null ? null : String(r.penalty_minor),
    refundEligible: r.refund_eligible as boolean,
    cancelledBy: r.cancelled_by as string,
    cancelledOn: r.cancelled_on as string
  }))
}
