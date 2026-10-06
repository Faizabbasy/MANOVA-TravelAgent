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
  parties: ({ id: string; name: string; lifecycleStatus: 'prospect' | 'client'; partyType: 'company' | 'individual' | null; preferredCurrency: string | null; poRequired?: boolean; accountOwnerUserId?: string | null } &
    Partial<Record<keyof typeof PARTY_PROFILE_COLUMNS, string | null>>)[]
  vendors: { id: string; name: string; serviceType: string; status: string; contactName?: string | null; contactPhone?: string | null; category?: string | null }[]
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
    /** Project Order workflow (S3b), dates as YYYY-MM-DD. */
    handoverAcceptedAt?: string | null
    handoverAcceptedBy?: string | null
    readyAt?: string | null
    financeSettledAt?: string | null
    closedAt?: string | null
    closedBy?: string | null
    finalNote?: string | null
    clientFeedback?: string | null
  }[]
  /** S4a: label, status, booking reference and budget per service line. */
  projectServices: { id: string; projectId: string; serviceType: string; vendorId: string | null; label?: string; status?: string; bookingReference?: string | null; budgetMinor?: string | null }[]
  bookingRefs: {
    bookingType: 'flight' | 'hotel' | 'transport' | 'mice'
    bookingId: string
    projectId: string
    serviceId: string | null
    /** Owned by the Booking module. */
    sellAmountMinor: string | null
    departureDate: string | null
    /** S4a: the full booking — core columns plus the UI-owned `details`. */
    status?: string
    reference?: string | null
    statusReason?: string | null
    netCostMinor?: string | null
    details?: Record<string, unknown>
  }[]
  serviceOrders: { id: string; vendorId: string; projectId: string | null; serviceId: string | null }[]
  /** Group Trip participant bookings (owned by Sales); each is billed to its own customer. */
  salesOrders: { id: string; projectId: string; partyId: string; priceMinor: string; travelerCount: number }[]
  /** CRM (S1): contact persons and the activity log per customer. */
  partyContacts?: { id: string; partyId: string; name: string; title: string; email: string | null; phone: string | null }[]
  partyActivities?: { id: string; partyId: string; leadId: string | null; type: string; message: string; ownerUserId: string; activityDate: string; dueAt: string | null }[]
  /** Vendor (S2): contact persons, catalog and document records (metadata only). */
  vendorContacts?: { id: string; vendorId: string; name: string; title: string; email: string | null; phone: string | null }[]
  vendorProducts?: { id: string; vendorId: string; name: string; category: string; description: string | null; priceMinor: string | null }[]
  vendorDocuments?: { id: string; vendorId: string; name: string; type: string; uploadedOn: string }[]
}

/** Seed key → `parties` column for the customer profile (S1). `creditLimitMinor` is Finance's figure (ADR-007). */
export const PARTY_PROFILE_COLUMNS = {
  industry: 'industry',
  companyType: 'company_type',
  size: 'size',
  address: 'address',
  city: 'city',
  province: 'province',
  country: 'country',
  postalCode: 'postal_code',
  phone: 'phone',
  email: 'email',
  website: 'website',
  registrationNumber: 'registration_number',
  npwp: 'npwp',
  billingName: 'billing_name',
  billingAddress: 'billing_address',
  paymentTerm: 'payment_term',
  travelPreferences: 'travel_preferences',
  creditLimitMinor: 'credit_limit_minor'
} as const

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
    const profileColumns = Object.values(PARTY_PROFILE_COLUMNS)
    for (const p of seed.parties) {
      const profile = Object.keys(PARTY_PROFILE_COLUMNS).map(k => (p as Record<string, unknown>)[k] ?? null)
      const base = 6
      await tx.query(
        `insert into parties (id, name, lifecycle_status, party_type, preferred_currency, provenance, po_required, ${profileColumns.join(', ')})
         values ($1, $2, $3, $4, $5, $6, $7, ${profileColumns.map((_, i) => `$${base + 2 + i}`).join(', ')})
         on conflict (id) do update set name = excluded.name, lifecycle_status = excluded.lifecycle_status,
           party_type = excluded.party_type, preferred_currency = excluded.preferred_currency, po_required = excluded.po_required,
           ${profileColumns.map(c => `${c} = excluded.${c}`).join(', ')}, updated_at = now()
         where parties.provenance = 'demo-fixture'`,
        [p.id, p.name, p.lifecycleStatus, p.partyType, p.preferredCurrency, P, p.poRequired ?? false, ...profile]
      )
    }
    for (const v of seed.vendors) {
      await tx.query(
        `insert into vendors (id, name, service_type, status, provenance, contact_name, contact_phone, category) values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (id) do update set name = excluded.name, service_type = excluded.service_type,
           status = excluded.status, contact_name = excluded.contact_name, contact_phone = excluded.contact_phone,
           category = excluded.category, updated_at = now()
         where vendors.provenance = 'demo-fixture'`,
        [v.id, v.name, v.serviceType, v.status, P, v.contactName ?? null, v.contactPhone ?? null, v.category ?? null]
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
    // Account owners reference users, so they are set once the users exist.
    for (const p of seed.parties) {
      await tx.query(
        "update parties set account_owner_user_id = $2 where id = $1 and provenance = 'demo-fixture'",
        [p.id, p.accountOwnerUserId ?? null]
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
      await tx.query(
        `update projects set handover_accepted_at = $2::date, handover_accepted_by = $3, ready_at = $4::date, finance_settled_at = $5::date,
           closed_at = $6::date, closed_by = $7, final_note = $8, client_feedback = $9
         where id = $1 and provenance = 'demo-fixture'`,
        [p.id, p.handoverAcceptedAt ?? null, p.handoverAcceptedBy ?? null, p.readyAt ?? null, p.financeSettledAt ?? null,
          p.closedAt ?? null, p.closedBy ?? null, p.finalNote ?? null, p.clientFeedback ?? null]
      )
    }
    for (const s of seed.projectServices) {
      await tx.query(
        `insert into project_services (id, project_id, service_type, vendor_id, provenance, label, status, booking_reference, budget_minor)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (id) do update set project_id = excluded.project_id, service_type = excluded.service_type,
           vendor_id = excluded.vendor_id, label = excluded.label, status = excluded.status,
           booking_reference = excluded.booking_reference, budget_minor = excluded.budget_minor
         where project_services.provenance = 'demo-fixture'`,
        // A missing label gets its type's name from the insert trigger (0022).
        [s.id, s.projectId, s.serviceType, s.vendorId, P, s.label ?? null, s.status ?? 'not-started', s.bookingReference ?? null, s.budgetMinor ?? null]
      )
    }
    for (const b of seed.bookingRefs) {
      await tx.query(
        `insert into booking_refs (booking_type, booking_id, project_id, service_id, provenance, sell_amount_minor, departure_date,
           status, reference, status_reason, net_cost_minor, details)
         values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, case when $1 = 'mice' then 'planning' else 'requested' end), $9, $10, $11, $12::text::jsonb)
         on conflict (booking_type, booking_id) do update set project_id = excluded.project_id, service_id = excluded.service_id,
           sell_amount_minor = excluded.sell_amount_minor, departure_date = excluded.departure_date, status = excluded.status,
           reference = excluded.reference, status_reason = excluded.status_reason, net_cost_minor = excluded.net_cost_minor,
           details = excluded.details
         where booking_refs.provenance = 'demo-fixture'`,
        [b.bookingType, b.bookingId, b.projectId, b.serviceId, P, b.sellAmountMinor, b.departureDate,
          b.status ?? null, b.reference ?? null, b.statusReason ?? null, b.netCostMinor ?? null, JSON.stringify(b.details ?? {})]
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
    for (const c of seed.partyContacts ?? []) {
      await tx.query(
        `insert into party_contacts (id, party_id, name, title, email, phone, provenance) values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (id) do update set party_id = excluded.party_id, name = excluded.name, title = excluded.title,
           email = excluded.email, phone = excluded.phone
         where party_contacts.provenance = 'demo-fixture'`,
        [c.id, c.partyId, c.name, c.title, c.email, c.phone, P]
      )
    }
    for (const a of seed.partyActivities ?? []) {
      await tx.query(
        `insert into party_activities (id, party_id, lead_id, type, message, owner_user_id, activity_date, due_at, provenance)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (id) do update set party_id = excluded.party_id, lead_id = excluded.lead_id, type = excluded.type,
           message = excluded.message, owner_user_id = excluded.owner_user_id, activity_date = excluded.activity_date, due_at = excluded.due_at
         where party_activities.provenance = 'demo-fixture'`,
        [a.id, a.partyId, a.leadId, a.type, a.message, a.ownerUserId, a.activityDate, a.dueAt, P]
      )
    }
    for (const c of seed.vendorContacts ?? []) {
      await tx.query(
        `insert into vendor_contacts (id, vendor_id, name, title, email, phone, provenance) values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (id) do update set vendor_id = excluded.vendor_id, name = excluded.name, title = excluded.title, email = excluded.email, phone = excluded.phone
         where vendor_contacts.provenance = 'demo-fixture'`,
        [c.id, c.vendorId, c.name, c.title, c.email, c.phone, P]
      )
    }
    for (const p of seed.vendorProducts ?? []) {
      await tx.query(
        `insert into vendor_products (id, vendor_id, name, category, description, price_minor, provenance) values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (id) do update set vendor_id = excluded.vendor_id, name = excluded.name, category = excluded.category,
           description = excluded.description, price_minor = excluded.price_minor
         where vendor_products.provenance = 'demo-fixture'`,
        [p.id, p.vendorId, p.name, p.category, p.description, p.priceMinor, P]
      )
    }
    for (const d of seed.vendorDocuments ?? []) {
      await tx.query(
        `insert into vendor_documents (id, vendor_id, name, type, uploaded_on, provenance) values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do update set vendor_id = excluded.vendor_id, name = excluded.name, type = excluded.type, uploaded_on = excluded.uploaded_on
         where vendor_documents.provenance = 'demo-fixture'`,
        [d.id, d.vendorId, d.name, d.type, d.uploadedOn, P]
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
