import type { AppEnv } from '../config/env'
import { hashPassword } from '../auth/password'
import type { RoleId } from '../auth/rbac'
import { syncIdSequences } from '../shared/ids'
import type { Db } from './client'
import demoCore from './seeds/demo-core.json'

/**
 * Demo seed (ADR-004): core references + one login per role, IDs identical to the frontend fixtures.
 * Idempotent upsert; refuses to run in production. Contains no invoices, payments or balances — mock
 * finance history must never be mistaken for real cash.
 */

export interface DemoCoreSeed {
  source: string
  parties: { id: string; name: string; lifecycleStatus: 'prospect' | 'client'; partyType: 'company' | 'individual' | null; preferredCurrency: string | null }[]
  vendors: { id: string; name: string; serviceType: string; status: string }[]
  users: { id: string; email: string; name: string; role: RoleId; status: 'active' | 'suspended'; partyId: string | null; vendorId: string | null }[]
  projects: {
    id: string
    name: string
    partyId: string
    destination: string | null
    travelStartDate: string | null
    travelEndDate: string | null
    status: string
    ownerUserId: string | null
    teamUserIds: string[]
    /** Owned by the Project module; minor units as a decimal string. */
    contractValueMinor: string | null
    characteristic?: 'normal' | 'high-change' | 'complex'
    serviceScope?: string[]
    travelerCount?: number
    isGroupTrip?: boolean
    leadId?: string | null
    sourceQuotationId?: string | null
    tourLeaderName?: string | null
    tourLeaderPhone?: string | null
    emergencyContactName?: string | null
    emergencyContactPhone?: string | null
    meetingPoint?: string | null
  }[]
  projectServices: { id: string; projectId: string; serviceType: string; vendorId: string | null }[]
  bookingRefs: {
    bookingType: 'flight' | 'hotel' | 'transport' | 'mice'
    bookingId: string
    projectId: string
    serviceId: string | null
    /** Owned by the Booking module. */
    sellAmountMinor: string | null
    departureDate: string | null
  }[]
  serviceOrders: { id: string; vendorId: string; projectId: string | null; serviceId: string | null }[]
  /** Group Trip participant bookings (owned by Sales); each is billed to its own customer. */
  salesOrders: { id: string; projectId: string; partyId: string; priceMinor: string; travelerCount: number }[]
}

export const DEMO_CORE = demoCore as DemoCoreSeed
export const DEFAULT_DEMO_PASSWORD = 'manova-demo'

export class SeedRefusedError extends Error {
  override name = 'SeedRefusedError'
}

export interface SeedResult {
  parties: number
  vendors: number
  users: number
  projects: number
  projectServices: number
  bookingRefs: number
  serviceOrders: number
  salesOrders: number
}

export async function seedDemo(db: Db, options: { appEnv: AppEnv; password?: string; seed?: DemoCoreSeed }): Promise<SeedResult> {
  if (options.appEnv === 'production') {
    throw new SeedRefusedError('Demo seed is disabled in production (APP_ENV=production).')
  }
  // A demo seed must never touch real data: refuse outright when any real (non-demo) row exists, e.g. a
  // production database reached with APP_ENV unset. Upserts below are additionally limited to demo rows.
  const [real] = await db.query<{ n: number }>(
    `select (select count(*) from users where provenance <> 'demo-fixture')
          + (select count(*) from parties where provenance <> 'demo-fixture')
          + (select count(*) from vendors where provenance <> 'demo-fixture')
          + (select count(*) from projects where provenance <> 'demo-fixture') as n`
  )
  if (Number(real?.n ?? 0) > 0) {
    throw new SeedRefusedError('This database already holds non-demo data; the demo seed only runs on a demo/dev database.')
  }

  const seed = options.seed ?? DEMO_CORE
  const passwordHash = await hashPassword(options.password ?? DEFAULT_DEMO_PASSWORD)
  const P = 'demo-fixture'

  await db.transaction(async tx => {
    for (const p of seed.parties) {
      await tx.query(
        `insert into parties (id, name, lifecycle_status, party_type, preferred_currency, provenance)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do update set name = excluded.name, lifecycle_status = excluded.lifecycle_status,
           party_type = excluded.party_type, preferred_currency = excluded.preferred_currency, updated_at = now()
         where parties.provenance = 'demo-fixture'`,
        [p.id, p.name, p.lifecycleStatus, p.partyType, p.preferredCurrency, P]
      )
    }
    for (const v of seed.vendors) {
      await tx.query(
        `insert into vendors (id, name, service_type, status, provenance) values ($1, $2, $3, $4, $5)
         on conflict (id) do update set name = excluded.name, service_type = excluded.service_type,
           status = excluded.status, updated_at = now()
         where vendors.provenance = 'demo-fixture'`,
        [v.id, v.name, v.serviceType, v.status, P]
      )
    }
    for (const u of seed.users) {
      await tx.query(
        `insert into users (id, email, name, role, party_id, vendor_id, status, password_hash, provenance)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (id) do update set email = excluded.email, name = excluded.name, role = excluded.role,
           party_id = excluded.party_id, vendor_id = excluded.vendor_id, status = excluded.status,
           password_hash = excluded.password_hash, updated_at = now()
         where users.provenance = 'demo-fixture'`,
        [u.id, u.email, u.name, u.role, u.partyId, u.vendorId, u.status, passwordHash, P]
      )
    }
    for (const p of seed.projects) {
      await tx.query(
        `insert into projects (id, name, party_id, destination, travel_start_date, travel_end_date, status, owner_user_id, provenance, contract_value_minor,
                               characteristic, service_scope, traveler_count, is_group_trip, lead_id, source_quotation_id,
                               tour_leader_name, tour_leader_phone, emergency_contact_name, emergency_contact_phone, meeting_point)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                 (select coalesce(array_agg(x), '{}'::text[]) from jsonb_array_elements_text($12::text::jsonb) as x),
                 $13, $14, $15, $16, $17, $18, $19, $20, $21)
         on conflict (id) do update set name = excluded.name, party_id = excluded.party_id,
           destination = excluded.destination, travel_start_date = excluded.travel_start_date,
           travel_end_date = excluded.travel_end_date, status = excluded.status,
           owner_user_id = excluded.owner_user_id, contract_value_minor = excluded.contract_value_minor,
           characteristic = excluded.characteristic, service_scope = excluded.service_scope,
           traveler_count = excluded.traveler_count, is_group_trip = excluded.is_group_trip,
           lead_id = excluded.lead_id, source_quotation_id = excluded.source_quotation_id,
           tour_leader_name = excluded.tour_leader_name, tour_leader_phone = excluded.tour_leader_phone,
           emergency_contact_name = excluded.emergency_contact_name, emergency_contact_phone = excluded.emergency_contact_phone,
           meeting_point = excluded.meeting_point, updated_at = now()
         where projects.provenance = 'demo-fixture'`,
        [p.id, p.name, p.partyId, p.destination, p.travelStartDate, p.travelEndDate, p.status, p.ownerUserId, P, p.contractValueMinor,
          p.characteristic ?? 'normal', JSON.stringify(p.serviceScope ?? []), p.travelerCount ?? 0, p.isGroupTrip ?? false,
          p.leadId ?? null, p.sourceQuotationId ?? null, p.tourLeaderName ?? null, p.tourLeaderPhone ?? null,
          p.emergencyContactName ?? null, p.emergencyContactPhone ?? null, p.meetingPoint ?? null]
      )
      for (const userId of p.teamUserIds) {
        await tx.query('insert into project_members (project_id, user_id) values ($1, $2) on conflict do nothing', [p.id, userId])
      }
    }
    for (const s of seed.projectServices) {
      await tx.query(
        `insert into project_services (id, project_id, service_type, vendor_id, provenance) values ($1, $2, $3, $4, $5)
         on conflict (id) do update set project_id = excluded.project_id, service_type = excluded.service_type,
           vendor_id = excluded.vendor_id
         where project_services.provenance = 'demo-fixture'`,
        [s.id, s.projectId, s.serviceType, s.vendorId, P]
      )
    }
    for (const b of seed.bookingRefs) {
      await tx.query(
        `insert into booking_refs (booking_type, booking_id, project_id, service_id, provenance, sell_amount_minor, departure_date)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (booking_type, booking_id) do update set project_id = excluded.project_id, service_id = excluded.service_id,
           sell_amount_minor = excluded.sell_amount_minor, departure_date = excluded.departure_date
         where booking_refs.provenance = 'demo-fixture'`,
        [b.bookingType, b.bookingId, b.projectId, b.serviceId, P, b.sellAmountMinor, b.departureDate]
      )
    }
    for (const so of seed.serviceOrders) {
      await tx.query(
        `insert into service_orders (id, vendor_id, project_id, service_id, provenance) values ($1, $2, $3, $4, $5)
         on conflict (id) do update set vendor_id = excluded.vendor_id, project_id = excluded.project_id,
           service_id = excluded.service_id
         where service_orders.provenance = 'demo-fixture'`,
        [so.id, so.vendorId, so.projectId, so.serviceId, P]
      )
    }
    for (const so of seed.salesOrders ?? []) {
      await tx.query(
        `insert into sales_order_refs (id, project_id, party_id, price_minor, traveler_count, provenance) values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do update set project_id = excluded.project_id, party_id = excluded.party_id,
           price_minor = excluded.price_minor, traveler_count = excluded.traveler_count
         where sales_order_refs.provenance = 'demo-fixture'`,
        [so.id, so.projectId, so.partyId, so.priceMinor, so.travelerCount, P]
      )
    }
    // New IDs created through the API must continue after the fixtures (PRJ-341 …).
    await syncIdSequences(tx)
    await tx.query(
      `insert into audit_events (action, entity_type, details) values ('seed.demo_applied', 'database', $1::text::jsonb)`,
      [JSON.stringify({ source: seed.source, users: seed.users.length, projects: seed.projects.length })]
    )
  })

  return {
    parties: seed.parties.length,
    vendors: seed.vendors.length,
    users: seed.users.length,
    projects: seed.projects.length,
    projectServices: seed.projectServices.length,
    bookingRefs: seed.bookingRefs.length,
    serviceOrders: seed.serviceOrders.length,
    salesOrders: (seed.salesOrders ?? []).length
  }
}
