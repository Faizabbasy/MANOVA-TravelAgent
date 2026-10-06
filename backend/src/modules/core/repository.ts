import { ROLE_DEFINITIONS, type Actor } from '../../auth/rbac'
import type { Db } from '../../db/client'
import { isPortalActor, projectScopeOf, projectScopeSql } from './scope'

/**
 * Read access to the core reference bridge. Every function takes the actor and applies scope in SQL, so a
 * caller cannot forget it. Portal actors (client/vendor) get a reduced DTO: no owner/team IDs, no
 * provenance, no vendor links they do not own.
 */

export const PROJECT_STATUSES = ['draft', 'planning', 'confirmed', 'in-progress', 'ongoing-trip', 'completed', 'on-hold', 'cancelled'] as const
export const BOOKING_TYPES = ['flight', 'hotel', 'transport', 'mice'] as const
export type BookingType = (typeof BOOKING_TYPES)[number]

interface ProjectRow extends Record<string, unknown> {
  id: string
  name: string
  party_id: string
  party_name: string
  destination: string | null
  travel_start_date: string | null
  travel_end_date: string | null
  status: string
  owner_user_id: string | null
  team_user_ids: string[] | null
  provenance: string
  contract_value_minor: string | null
  contract_currency: string
  characteristic: string
  service_scope: string[]
  traveler_count: number
  is_group_trip: boolean
  lead_id: string | null
  source_quotation_id: string | null
  tour_leader_name: string | null
  tour_leader_phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  meeting_point: string | null
}

export interface ProjectPortalView {
  id: string
  name: string
  destination: string | null
  travelStartDate: string | null
  travelEndDate: string | null
  status: string
}

export interface ProjectInternalView extends ProjectPortalView {
  partyId: string
  partyName: string
  ownerUserId: string | null
  teamUserIds: string[]
  provenance: string
  /** Owned by the Project module. Null when not set, or when the role may not see commercial figures. */
  contractValueMinor: string | null
  contractCurrency: string
  characteristic: string
  serviceScope: string[]
  travelerCount: number
  isGroupTrip: boolean
  leadId: string | null
  sourceQuotationId: string | null
  tourLeaderName: string | null
  tourLeaderPhone: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  meetingPoint: string | null
}

function projectView(actor: Actor, r: ProjectRow): ProjectPortalView | ProjectInternalView {
  const base: ProjectPortalView = {
    id: r.id,
    name: r.name,
    destination: r.destination,
    travelStartDate: r.travel_start_date,
    travelEndDate: r.travel_end_date,
    status: r.status
  }
  if (isPortalActor(actor)) return base
  return {
    ...base,
    partyId: r.party_id,
    partyName: r.party_name,
    ownerUserId: r.owner_user_id,
    teamUserIds: r.team_user_ids ?? [],
    provenance: r.provenance,
    contractValueMinor: canSeeCommercials(actor) ? r.contract_value_minor : null,
    contractCurrency: r.contract_currency,
    characteristic: r.characteristic,
    serviceScope: r.service_scope ?? [],
    travelerCount: r.traveler_count,
    isGroupTrip: r.is_group_trip,
    leadId: r.lead_id,
    sourceQuotationId: r.source_quotation_id,
    tourLeaderName: r.tour_leader_name,
    tourLeaderPhone: r.tour_leader_phone,
    emergencyContactName: r.emergency_contact_name,
    emergencyContactPhone: r.emergency_contact_phone,
    meetingPoint: r.meeting_point
  }
}

/** Contract value and booking sell price follow the same rule as the UI (`canViewFullFinancials`). */
function canSeeCommercials(actor: Actor): boolean {
  return ROLE_DEFINITIONS[actor.role].canViewFullFinancials
}

const PROJECT_SELECT = `
  select p.id, p.name, p.party_id, pa.name as party_name, p.destination, p.travel_start_date, p.travel_end_date,
         p.status, p.owner_user_id, p.provenance, p.contract_value_minor, p.contract_currency,
         p.characteristic, p.service_scope, p.traveler_count, p.is_group_trip, p.lead_id, p.source_quotation_id,
         p.tour_leader_name, p.tour_leader_phone, p.emergency_contact_name, p.emergency_contact_phone, p.meeting_point,
         (select array_agg(pm.user_id order by pm.user_id) from project_members pm where pm.project_id = p.id) as team_user_ids
    from projects p
    join parties pa on pa.id = p.party_id`

export async function listProjects(
  db: Db,
  actor: Actor,
  filter: { status?: string; partyId?: string; after: string | null; limit: number }
) {
  const params: unknown[] = []
  const where = [projectScopeSql(projectScopeOf(actor), params)]
  if (filter.status) { params.push(filter.status); where.push(`p.status = $${params.length}`) }
  if (filter.partyId && !isPortalActor(actor)) { params.push(filter.partyId); where.push(`p.party_id = $${params.length}`) }
  if (filter.after) { params.push(filter.after); where.push(`p.id > $${params.length}`) }
  params.push(filter.limit + 1)
  const rows = await db.query<ProjectRow>(`${PROJECT_SELECT} where ${where.join(' and ')} order by p.id limit $${params.length}`, params)
  return rows.map(r => projectView(actor, r))
}

export async function getProject(db: Db, actor: Actor, id: string) {
  const params: unknown[] = [id]
  const scope = projectScopeSql(projectScopeOf(actor), params)
  const [row] = await db.query<ProjectRow>(`${PROJECT_SELECT} where p.id = $1 and ${scope}`, params)
  if (!row) return null

  // Vendors only see the bookings attached to their own services.
  const bookingParams: unknown[] = [id]
  let vendorFilter = ''
  if (actor.role === 'vendor') {
    bookingParams.push(actor.vendorId)
    vendorFilter = `and ps.vendor_id = $${bookingParams.length}`
  }
  const bookings = await db.query<{ booking_type: BookingType; booking_id: string }>(
    `select b.booking_type, b.booking_id
       from booking_refs b left join project_services ps on ps.id = b.service_id
      where b.project_id = $1 ${vendorFilter}
      order by b.booking_type, b.booking_id`,
    bookingParams
  )
  return { ...projectView(actor, row), bookings: bookings.map(b => ({ type: b.booking_type, id: b.booking_id })) }
}

interface PartyRow extends Record<string, unknown> {
  id: string
  name: string
  lifecycle_status: string
  party_type: string | null
  preferred_currency: string | null
  provenance: string
}

const partyView = (actor: Actor, r: PartyRow) => ({
  id: r.id,
  name: r.name,
  lifecycleStatus: r.lifecycle_status,
  partyType: r.party_type,
  preferredCurrency: r.preferred_currency,
  ...(isPortalActor(actor) ? {} : { provenance: r.provenance })
})

export async function listParties(db: Db, actor: Actor, page: { after: string | null; limit: number }) {
  const rows = await db.query<PartyRow>(
    `select id, name, lifecycle_status, party_type, preferred_currency, provenance from parties
      where ($1::text is null or id > $1) order by id limit $2`,
    [page.after, page.limit + 1]
  )
  return rows.map(r => partyView(actor, r))
}

/** Clients may read only their own party; vendors none. Callers enforce the internal module check. */
export async function getParty(db: Db, actor: Actor, id: string) {
  if (actor.role === 'vendor') return null
  if (actor.role === 'client' && actor.partyId !== id) return null
  const [row] = await db.query<PartyRow>(
    'select id, name, lifecycle_status, party_type, preferred_currency, provenance from parties where id = $1',
    [id]
  )
  return row ? partyView(actor, row) : null
}

interface VendorRow extends Record<string, unknown> {
  id: string
  name: string
  service_type: string
  status: string
  provenance: string
}

const vendorView = (actor: Actor, r: VendorRow) => ({
  id: r.id,
  name: r.name,
  serviceType: r.service_type,
  status: r.status,
  ...(isPortalActor(actor) ? {} : { provenance: r.provenance })
})

export async function listVendors(db: Db, actor: Actor, page: { after: string | null; limit: number }) {
  const rows = await db.query<VendorRow>(
    `select id, name, service_type, status, provenance from vendors
      where ($1::text is null or id > $1) order by id limit $2`,
    [page.after, page.limit + 1]
  )
  return rows.map(r => vendorView(actor, r))
}

/** Vendors may read only themselves; clients none. Callers enforce the internal module check. */
export async function getVendor(db: Db, actor: Actor, id: string) {
  if (actor.role === 'client') return null
  if (actor.role === 'vendor' && actor.vendorId !== id) return null
  const [row] = await db.query<VendorRow>('select id, name, service_type, status, provenance from vendors where id = $1', [id])
  return row ? vendorView(actor, row) : null
}

interface ServiceOrderRow extends Record<string, unknown> {
  id: string
  vendor_id: string
  vendor_name: string
  project_id: string | null
  service_id: string | null
}

/** Internal roles with vendor/finance access see any service order; a vendor only its own; clients none. */
export async function getServiceOrder(db: Db, actor: Actor, id: string) {
  if (actor.role === 'client') return null
  const params: unknown[] = [id]
  let vendorFilter = ''
  if (actor.role === 'vendor') {
    params.push(actor.vendorId)
    vendorFilter = `and so.vendor_id = $${params.length}`
  }
  const [row] = await db.query<ServiceOrderRow>(
    `select so.id, so.vendor_id, v.name as vendor_name, so.project_id, so.service_id
       from service_orders so join vendors v on v.id = so.vendor_id
      where so.id = $1 ${vendorFilter}`,
    params
  )
  if (!row) return null
  return { id: row.id, vendorId: row.vendor_id, vendorName: row.vendor_name, projectId: row.project_id, serviceId: row.service_id }
}

interface BookingRow extends Record<string, unknown> {
  booking_type: BookingType
  booking_id: string
  project_id: string
  service_id: string | null
  service_type: string | null
  vendor_id: string | null
  sell_amount_minor: string | null
  departure_date: string | null
}

/** Resolves a typed booking reference (the key finance records will carry) within the actor's scope. */
export async function getBookingRef(db: Db, actor: Actor, type: BookingType, id: string) {
  const params: unknown[] = [type, id]
  const scope = projectScopeSql(projectScopeOf(actor), params)
  let vendorFilter = ''
  if (actor.role === 'vendor') {
    params.push(actor.vendorId)
    vendorFilter = `and ps.vendor_id = $${params.length}`
  }
  const [row] = await db.query<BookingRow>(
    `select b.booking_type, b.booking_id, b.project_id, b.service_id, ps.service_type, ps.vendor_id, b.sell_amount_minor, b.departure_date
       from booking_refs b
       join projects p on p.id = b.project_id
       left join project_services ps on ps.id = b.service_id
      where b.booking_type = $1 and b.booking_id = $2 and ${scope} ${vendorFilter}`,
    params
  )
  if (!row) return null
  const base = { type: row.booking_type, id: row.booking_id, projectId: row.project_id }
  if (isPortalActor(actor)) return base
  return {
    ...base,
    serviceId: row.service_id,
    serviceType: row.service_type,
    vendorId: row.vendor_id,
    departureDate: row.departure_date,
    sellAmountMinor: canSeeCommercials(actor) ? row.sell_amount_minor : null
  }
}
