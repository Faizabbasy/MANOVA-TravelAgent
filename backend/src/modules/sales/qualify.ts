import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { parseAmountMinor } from '../../shared/money'
import { createActivity, createParty } from '../core/party-writes'
import { missingQualification } from './lead-rules'
import { insertLeadActivity, lockLead } from './lead-writes'
import { wonProjectId } from './repository'
import { insertSalesOrder, projectSeats } from './sales-orders'

/**
 * Qualify (S6a): the same required fields as the form, then the customer — the one named, else one with the same
 * name and kind, else a new one (company → prospect, individual → client) owned by the Account Executive.
 * S6b: an Individual Travel lead qualified with a price also gets its standalone sales order, and a Group Trip lead
 * is booked on the trip when its seats are there (waitlisted otherwise).
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)

export interface QualifyInput { customerKind?: unknown; partyId?: unknown; priceMinor?: unknown; travelerCount?: unknown }

async function assertNoActiveOrder(tx: Queryable, leadId: string) {
  const [active] = await tx.query<{ id: string }>("select id from sales_order_refs where lead_id = $1 and status <> 'cancelled' limit 1", [leadId])
  if (active) throw new AppError(409, 'CONFLICT', `Lead ini sudah punya order ${active.id}.`, { details: { salesOrderId: active.id } })
}

export async function qualifyLead(tx: Queryable, actor: Actor, id: string, input: QualifyInput, today: string, requestId: string): Promise<{ salesOrderId?: string }> {
  const lead = await lockLead(tx, id)
  let partyId = lead.party_id
  if (!(lead.stage === 'qualified' && partyId)) {
    if (await wonProjectId(tx, id)) throw rule('Lead ini sudah menjadi project.')
    if (lead.archived) throw rule('Lead ini diarsip — buka kembali sebelum qualify.')
    const kind = input.customerKind ?? (lead.service_category === 'individual-travel' ? 'individual' : 'company')
    if (kind !== 'company' && kind !== 'individual') throw errors.validation({ customerKind: ['Pilih perusahaan atau individu.'] })
    const missing = missingQualification(lead)
    if (missing.length) {
      throw new AppError(422, 'RULE_VIOLATION', `Lengkapi data qualification dulu: ${missing.join(', ')}.`, { details: { missing } })
    }

    if (input.partyId !== undefined && input.partyId !== null) {
      const found = typeof input.partyId === 'string' && ID_PATTERN.test(input.partyId)
        ? (await tx.query<{ id: string }>('select id from parties where id = $1', [input.partyId]))[0]
        : undefined
      if (!found) throw errors.validation({ partyId: ['Customer tidak ditemukan.'] })
      partyId = found.id
    } else {
      const name = (kind === 'company' ? lead.company_name || lead.name : lead.name).trim()
      const [same] = await tx.query<{ id: string }>(
        `select id from parties where lower(name) = lower($1) and ${kind === 'company' ? "coalesce(party_type, 'company') <> 'individual'" : "party_type = 'individual'"} order by id limit 1`,
        [name]
      )
      partyId = same?.id ?? (await createParty(tx, actor, {
        name,
        partyType: kind,
        lifecycleStatus: kind === 'individual' ? 'client' : 'prospect',
        accountOwnerUserId: lead.handed_over_to ?? lead.owner_user_id
      }, requestId)).id
    }

    await tx.query("update leads set stage = 'qualified', party_id = $2, qualified_on = $3, unqualified_reason = null, last_updated_on = $3, updated_at = now() where id = $1",
      [id, partyId, today])
    const ae = lead.handed_over_to ?? lead.owner_user_id
    await insertLeadActivity(tx, id, 'note', 'Lead Qualified', ae, today)
    if (lead.handed_over_to) {
      const [user] = await tx.query<{ name: string }>('select name from users where id = $1', [lead.handed_over_to])
      await insertLeadActivity(tx, id, 'note', `Lead Assigned to Account Executive (${user?.name ?? lead.handed_over_to})`, ae, today)
    }
    if (lead.service_category !== 'individual-travel') {
      await createActivity(tx, actor, partyId!, { type: 'note', message: `Lead ${id} qualified — siap dibuatkan Quotation.`, leadId: id }, today, requestId)
    }
    await recordAudit(tx, { action: 'lead.qualified', actorUserId: actor.userId, entityType: 'lead', entityId: id, requestId, after: { partyId, customerKind: kind } })
  }

  if (input.priceMinor === undefined) return {}
  // S6b: Individual Travel qualified with a price → its standalone order.
  if (lead.service_category !== 'individual-travel') throw errors.validation({ priceMinor: ['Harga order hanya untuk lead Individual Travel.'] })
  let price: bigint
  try { price = parseAmountMinor(input.priceMinor, 'priceMinor') } catch { throw errors.validation({ priceMinor: ['Harga harus angka rupiah lebih dari 0.'] }) }
  const pax = input.travelerCount ?? lead.traveler_estimate
  if (!Number.isInteger(pax) || (pax as number) < 1) throw errors.validation({ travelerCount: ['Jumlah traveler minimal 1.'] })
  await assertNoActiveOrder(tx, id)
  const [trip] = await tx.query<{ destination: string; travel_start_date: string; travel_end_date: string }>(
    'select destination, travel_start_date::text as travel_start_date, travel_end_date::text as travel_end_date from leads where id = $1', [id])
  const { id: salesOrderId } = await insertSalesOrder(tx, actor, {
    partyId: partyId!, projectId: null, leadId: id, destination: trip!.destination, travelStartDate: trip!.travel_start_date,
    travelEndDate: trip!.travel_end_date, travelerCount: pax as number, priceMinor: price, note: null
  }, today, requestId)
  await tx.query("update leads set b2c = b2c || jsonb_build_object('salesOrderId', $2::text), updated_at = now() where id = $1", [id, salesOrderId])
  return { salesOrderId }
}

const ACCEPTANCE = ['accept', 'need-discussion', 'not-suitable'] as const
const READINESS = ['ready', 'need-follow-up', 'still-considering'] as const

/**
 * Group Trip B2C (S6b): the project row is locked, so two leads racing for the last seats queue here. Enough seats →
 * the lead is qualified (individual customer) and booked with a draft order (awaiting DP); otherwise it is
 * waitlisted — answers saved, no order, stage unchanged.
 */
export async function qualifyGroupTrip(tx: Queryable, actor: Actor, leadId: string, input: Record<string, unknown>, today: string, requestId: string): Promise<{ outcome: 'qualified' | 'waitlist'; salesOrderId?: string }> {
  const problems: FieldErrors = {}
  const counts = (['adultCount', 'childCount', 'infantCount'] as const).map((f) => {
    const v = input[f] ?? 0
    if (!Number.isInteger(v) || (v as number) < 0) { problems[f] = ['Jumlah harus angka ≥ 0.']; return 0 }
    return v as number
  })
  const pax = counts[0]! + counts[1]! + counts[2]!
  if (!problems.adultCount && pax < 1) problems.adultCount = ['Minimal satu peserta.']
  if (!(ACCEPTANCE as readonly unknown[]).includes(input.priceAcceptance)) problems.priceAcceptance = ['Pilih penerimaan harga.']
  if (!(READINESS as readonly unknown[]).includes(input.bookingReadiness)) problems.bookingReadiness = ['Pilih kesiapan booking.']
  let price = 0n
  try { price = parseAmountMinor(input.priceMinor, 'priceMinor') } catch { problems.priceMinor = ['Harga harus angka rupiah lebih dari 0.'] }
  if (typeof input.projectId !== 'string' || !ID_PATTERN.test(input.projectId)) problems.projectId = ['Pilih project Group Trip.']
  if (Object.keys(problems).length) throw errors.validation(problems)
  const projectId = input.projectId as string

  const lead = await lockLead(tx, leadId)
  if (lead.service_category !== 'individual-travel') throw rule('Hanya lead Individual Travel yang bisa ikut Group Trip.')
  if (lead.archived) throw rule('Lead ini diarsip.')
  await assertNoActiveOrder(tx, leadId)
  const seats = await projectSeats(tx, projectId, true) // locks the project: concurrent qualifies queue here
  const [project] = await tx.query<{ destination: string; travel_start_date: string; travel_end_date: string }>(
    'select destination, travel_start_date::text as travel_start_date, travel_end_date::text as travel_end_date from projects where id = $1', [projectId])
  const answers = {
    groupTripProjectId: projectId, b2cAdultCount: counts[0], b2cChildCount: counts[1], b2cInfantCount: counts[2],
    b2cPriceAcceptance: input.priceAcceptance, b2cBookingReadiness: input.bookingReadiness
  }
  if (pax > seats.available) {
    await tx.query('update leads set b2c = b2c || $2::text::jsonb, last_updated_on = $3, updated_at = now() where id = $1',
      [leadId, JSON.stringify({ ...answers, b2cQualificationResult: 'waitlist' }), today])
    await recordAudit(tx, {
      action: 'lead.group_trip_waitlisted', actorUserId: actor.userId, entityType: 'lead', entityId: leadId, requestId,
      after: { projectId, pax, available: seats.available }
    })
    return { outcome: 'waitlist' }
  }

  // Seats are there: the trip fills the lead's empty travel fields, then the S6a qualify (individual customer) and the booking.
  await tx.query(
    `update leads set destination = coalesce(destination, $2), travel_start_date = coalesce(travel_start_date, $3::date),
       travel_end_date = coalesce(travel_end_date, $4::date), traveler_estimate = coalesce(traveler_estimate, $5) where id = $1`,
    [leadId, project!.destination, project!.travel_start_date, project!.travel_end_date, pax])
  await qualifyLead(tx, actor, leadId, { customerKind: 'individual' }, today, requestId)
  const [after] = await tx.query<{ party_id: string }>('select party_id from leads where id = $1', [leadId])
  const { id: salesOrderId } = await insertSalesOrder(tx, actor, {
    partyId: after!.party_id, projectId, leadId, destination: project!.destination, travelStartDate: project!.travel_start_date,
    travelEndDate: project!.travel_end_date, travelerCount: pax, priceMinor: price, note: null
  }, today, requestId)
  await tx.query('update leads set b2c = b2c || $2::text::jsonb, last_updated_on = $3, updated_at = now() where id = $1',
    [leadId, JSON.stringify({ ...answers, b2cQualificationResult: 'qualified', projectId, salesOrderId }), today])
  await insertLeadActivity(tx, leadId, 'note', `Booking ${salesOrderId} dibuat untuk Group Trip ${projectId}, status Awaiting DP`, actor.userId, today)
  return { outcome: 'qualified', salesOrderId }
}
