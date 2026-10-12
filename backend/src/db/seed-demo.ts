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
    /** S4b: a booking deliberately created next to an active one. */
    flaggedDuplicate?: boolean
  }[]
  serviceOrders: {
    id: string
    vendorId: string
    projectId: string | null
    serviceId: string | null
    /** S4b: procurement state of the order. */
    status?: string
    netCostMinor?: string | null
    lineItems?: unknown[]
    statusReason?: string | null
    acknowledgedAt?: string | null
    fulfilledAt?: string | null
  }[]
  /** S4b: vendor quotations per service. */
  vendorQuotations?: { id: string; vendorId: string; projectId: string; serviceId: string | null; serviceType: string; amountMinor: string; status: string; notes: string | null; submittedOn: string }[]
  /** S4b: attempt log of bookings. */
  bookingAttempts?: { id: string; bookingType: string; bookingId: string; outcome: string; note: string | null; attemptedAt: string }[]
  /** Group Trip participant bookings (owned by Sales); each is billed to its own customer. */
  /** S6b: B2C standalone orders (no project) and Group Trip participant bookings, with status and trip details. */
  salesOrders: { id: string; projectId: string | null; partyId: string; priceMinor: string; travelerCount: number; status?: string; destination?: string | null; travelStartDate?: string | null; travelEndDate?: string | null; note?: string | null; createdOn?: string | null; leadId?: string | null }[]
  /** Participants (S7a): traveler groups, travelers and the rooming list. */
  travelerGroups?: { id: string; projectId: string; name: string; paxCount: number; roomingNote: string | null }[]
  travelers?: {
    id: string; projectId: string; groupId: string | null; partyId: string | null; leadId: string | null; salesOrderId: string | null; name: string
    passportNumber: string | null; passportExpiryDate: string | null; idNumber: string | null; visaNumber: string | null; visaExpiryDate: string | null
    emergencyContactName: string | null; emergencyContactPhone: string | null; specialRequest: string | null; dietaryRestrictions: string | null
    accessibilityNeeds: string | null; companionOfTravelerId: string | null; documentsVerifiedOn: string | null; documentsVerifiedBy: string | null
    isVip: boolean; cancelReason: string | null; replacedByTravelerId: string | null; replacesTravelerId: string | null
  }[]
  roomAssignments?: { id: string; projectId: string; groupId: string; roomLabel: string; roomType: string; travelerIds: string[] }[]
  /** Master data, 16 categories (S10b); `data` holds the category's fields. */
  masterData?: { id: string; category: string; isActive: boolean; data: Record<string, unknown> }[]
  /** The travel agency's own profile (S10b, singleton ORG-001). */
  organizationProfile?: { legalName: string; displayName: string; address: string; defaultCurrencyCode: string; businessHours: string; contactEmail: string; contactPhone: string; updatedBy: string | null; updatedOn: string } | null
  /** MANOVA-owned assets, maintenance and checkouts (S11a); money as decimal strings. */
  assets?: { id: string; code: string; name: string; category: string; brand: string | null; serialNumber: string | null; purchasedOn: string; purchasePriceMinor: string | null; condition: string; status: string; location: string; quantity: number; note: string | null }[]
  assetMaintenance?: { id: string; assetId: string; type: string; scheduledOn: string; completedOn: string | null; status: string; vendorName: string | null; costMinor: string | null; note: string | null; intervalDays: number | null }[]
  assetCheckouts?: { id: string; assetId: string; projectId: string | null; borrowedBy: string; checkedOutOn: string; dueOn: string; returnedOn: string | null; status: string; conditionOnReturn: string | null; note: string | null }[]
  /** In-app notifications (S9b). */
  notifications?: { id: string; userId: string; type: string; title: string; body: string; entityType: string | null; entityId: string | null; category: string | null; read: boolean; createdOn: string }[]
  /** Document metadata and messages (S9). */
  documents?: {
    id: string; entityType: string; entityId: string; projectId: string | null; name: string; category: string; version: number; accessLevel: string; sourceType: string
    previewRoute: string | null; uploadedBy: string | null; uploadedOn: string | null; generatedOn: string | null; expiresOn: string | null; supersedesId: string | null
    verified: boolean; verifiedBy: string | null; verifiedOn: string | null
  }[]
  messages?: {
    id: string; entityType: string; entityId: string; projectId: string | null; channel: string; senderId: string; body: string; mentions: string[]; sentAt: string
    deliveryStatus: string; deliveryChannel: string | null; attachmentName: string | null; readBy: string[]
  }[]
  /** Change requests, incidents and pre-Finance booking cancellations (S8). */
  changeRequests?: {
    id: string; projectId: string; source: string; requestedBy: string; submittedOn: string; affectedEntities: { entityType: string; entityId: string }[]
    beforeSummary: string; afterSummary: string; operationalImpact: string | null; commercialImpactMinor: string | null; financialImpactNote: string | null
    timelineImpactNote: string | null; status: string; decidedBy: string | null; decidedOn: string | null; rejectionReason: string | null; activityId: string | null
  }[]
  incidents?: {
    id: string; projectId: string; bookingType: string | null; bookingId: string | null; title: string; description: string; severity: string; ownerId: string
    status: string; escalatedTo: string | null; communicationLog: { id: string; at: string; from: string; message: string }[]; resolutionNote: string | null; resolvedOn: string | null
  }[]
  bookingCancellations?: {
    id: string; projectId: string; bookingType: string; bookingId: string; reason: string; penaltyMinor: string | null; refundEligible: boolean; cancelledBy: string; cancelledOn: string
  }[]
  /** Project activity log (S7d). */
  activities?: {
    id: string; projectId: string; message: string; isChange: boolean; reviewed: boolean; createdOn: string; category: string | null; reason: string | null
    requestedBy: string | null; beforeValue: string | null; afterValue: string | null; impactNote: string | null; approvalStatus: string | null; approvedBy: string | null
  }[]
  /** Project tasks and milestones (S7c). */
  tasks?: {
    id: string; projectId: string | null; title: string; status: string; dueOn: string | null; isMilestone: boolean; dependsOn: string | null
    assignedTo: string | null; blockedReason: string | null
  }[]
  milestones?: {
    id: string; projectId: string; stepKey: string | null; name: string; plannedOn: string; actualOn: string | null; ownerId: string | null
    status: string; note: string | null; budgetMinor: string | null; deliverables: { id: string; label: string; done: boolean }[]
  }[]
  /** Daily itinerary items (S7b). */
  itineraryItems?: {
    id: string; projectId: string; date: string; time: string | null; title: string; description: string | null; serviceType: string | null
    groupId: string | null; timezone: string | null; location: string | null; visibleToClient: boolean; vendorId: string | null; vendorAmountMinor: string | null
  }[]
  /** CRM (S1): contact persons and the activity log per customer. */
  partyContacts?: { id: string; partyId: string; name: string; title: string; email: string | null; phone: string | null }[]
  partyActivities?: { id: string; partyId: string; leadId: string | null; type: string; message: string; ownerUserId: string; activityDate: string; dueAt: string | null }[]
  /** Sales (S6a): leads with their requirement and B2C fields, lead activities, client quotations (version rows). */
  leads?: {
    id: string; name: string; companyName: string | null; title: string | null; source: string; stage: string; ownerUserId: string
    handedOverTo: string | null; phone: string | null; email: string | null; qualificationNotes: string | null; expectedCloseDate: string | null
    createdOn: string; lastUpdatedOn: string; archived: boolean; partyId: string | null; qualifiedOn: string | null
    serviceCategory: string | null; destination: string | null; travelStartDate: string | null; travelEndDate: string | null
    travelerEstimate: number | null; serviceScope: string[]; requirementSummary: string | null; budgetRange: string | null
    dateFlexible: boolean | null; decisionMaker: string | null; urgency: string | null; specialRequestNote: string | null; b2c: Record<string, unknown>
  }[]
  leadActivities?: { id: string; leadId: string; type: string; message: string; ownerUserId: string; activityDate: string; dueOn: string | null }[]
  quotations?: {
    id: string; leadId: string; createdOn: string; sentToClientOn: string | null
    versions: { version: number; status: string; amountMinor: string; decidedBy: string | null; decisionNote: string | null; content: Record<string, unknown> }[]
  }[]
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
  leads: number
  quotations: number
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
         on conflict (id) do update set email = excluded.email, name = excluded.name,
           -- S10a: a role or status the Super Admin changed through the API survives a demo re-seed.
           role = case when users.changed_by_api_at is null then excluded.role else users.role end,
           party_id = excluded.party_id, vendor_id = excluded.vendor_id,
           status = case when users.changed_by_api_at is null then excluded.status else users.status end,
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
    // S6a: leads and quotations before projects (projects.lead_id / source_quotation_id reference them). A re-seed
    // refreshes the fixture text but never a lead's stage, archive state or customer, nor quotation versions/status —
    // the API owns those.
    for (const l of seed.leads ?? []) {
      await tx.query(
        `insert into leads (id, name, company_name, title, source, stage, owner_user_id, handed_over_to, phone, email, qualification_notes,
           expected_close_date, created_on, last_updated_on, archived, party_id, qualified_on, service_category, destination, travel_start_date,
           travel_end_date, traveler_estimate, service_scope, requirement_summary, budget_range, date_flexible, decision_maker, urgency,
           special_request_note, b2c, provenance)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23::text::jsonb,
                 $24, $25, $26, $27, $28, $29, $30::text::jsonb, $31)
         on conflict (id) do update set name = excluded.name, company_name = excluded.company_name, title = excluded.title,
           source = excluded.source, phone = excluded.phone, email = excluded.email
         where leads.provenance = 'demo-fixture'`,
        [l.id, l.name, l.companyName, l.title, l.source, l.stage, l.ownerUserId, l.handedOverTo, l.phone, l.email, l.qualificationNotes,
          l.expectedCloseDate, l.createdOn, l.lastUpdatedOn, l.archived, l.partyId, l.qualifiedOn, l.serviceCategory, l.destination,
          l.travelStartDate, l.travelEndDate, l.travelerEstimate, JSON.stringify(l.serviceScope), l.requirementSummary, l.budgetRange,
          l.dateFlexible, l.decisionMaker, l.urgency, l.specialRequestNote, JSON.stringify(l.b2c), P]
      )
    }
    for (const a of seed.leadActivities ?? []) {
      await tx.query(
        `insert into lead_activities (id, lead_id, type, message, owner_user_id, activity_date, due_on, provenance) values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (id) do update set message = excluded.message, due_on = excluded.due_on where lead_activities.provenance = 'demo-fixture'`,
        [a.id, a.leadId, a.type, a.message, a.ownerUserId, a.activityDate, a.dueOn, P]
      )
    }
    const QUOTATION_MONEY = ['discountMinor', 'taxMinor', 'markupMinor', 'estimatedCostMinor', 'estimatedMarginMinor'] as const
    for (const q of seed.quotations ?? []) {
      const latest = q.versions[q.versions.length - 1]!
      const inserted = await tx.query<{ id: string }>(
        `insert into quotations (id, lead_id, current_version, sent_to_client_on, created_on, provenance) values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do nothing returning id`,
        [q.id, q.leadId, latest.version, q.sentToClientOn, q.createdOn, P]
      )
      if (!inserted.length) continue // an existing quotation: its versions belong to the API now
      for (const v of q.versions) {
        const c = v.content
        await tx.query(
          `insert into quotation_versions (quotation_id, version, amount_minor, discount_minor, tax_minor, markup_minor, estimated_cost_minor,
             estimated_margin_minor, currency, payment_terms, valid_until, terms_and_conditions, inclusions, exclusions, cancellation_policy,
             proposed_itinerary_note, cost_sheet_id, service_breakdown, status, decided_by, decided_at, decision_note, created_on)
           values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9, 'IDR'), $10, $11, $12, $13, $14, $15, $16, $17, $18::text::jsonb, $19, $20::text,
                   case when $20::text is null then null else now() end, $21, $22)`,
          [q.id, v.version, v.amountMinor, ...QUOTATION_MONEY.map(k => c[k] ?? null), c.currency ?? null, c.paymentTerms ?? null, c.validUntil ?? null,
            c.termsAndConditions ?? null, c.inclusions ?? null, c.exclusions ?? null, c.cancellationPolicy ?? null, c.proposedItineraryNote ?? null,
            c.costSheetId ?? null, JSON.stringify(c.serviceBreakdown ?? []), v.status, v.decidedBy, v.decisionNote, q.createdOn]
        )
      }
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
           status, reference, status_reason, net_cost_minor, details, flagged_duplicate)
         values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, case when $1 = 'mice' then 'planning' else 'requested' end), $9, $10, $11, $12::text::jsonb, $13)
         on conflict (booking_type, booking_id) do update set project_id = excluded.project_id, service_id = excluded.service_id,
           sell_amount_minor = excluded.sell_amount_minor, departure_date = excluded.departure_date, status = excluded.status,
           reference = excluded.reference, status_reason = excluded.status_reason, net_cost_minor = excluded.net_cost_minor,
           details = excluded.details, flagged_duplicate = excluded.flagged_duplicate
         where booking_refs.provenance = 'demo-fixture'`,
        [b.bookingType, b.bookingId, b.projectId, b.serviceId, P, b.sellAmountMinor, b.departureDate,
          b.status ?? null, b.reference ?? null, b.statusReason ?? null, b.netCostMinor ?? null, JSON.stringify(b.details ?? {}), b.flaggedDuplicate ?? false]
      )
    }
    // S4b: a re-seed never resets quotation or service order status — the API owns it (accept supersedes, vendor
    // changes cancel); resetting would break "one accepted per service" / "one active order per service + vendor".
    for (const q of seed.vendorQuotations ?? []) {
      await tx.query(
        `insert into vendor_quotations (id, vendor_id, project_id, service_id, service_type, amount_minor, status, notes, submitted_on, provenance)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (id) do update set vendor_id = excluded.vendor_id, project_id = excluded.project_id, service_id = excluded.service_id,
           service_type = excluded.service_type, amount_minor = excluded.amount_minor, notes = excluded.notes,
           submitted_on = excluded.submitted_on
         where vendor_quotations.provenance = 'demo-fixture'`,
        [q.id, q.vendorId, q.projectId, q.serviceId, q.serviceType, q.amountMinor, q.status, q.notes, q.submittedOn, P]
      )
    }
    for (const so of seed.serviceOrders) {
      await tx.query(
        `insert into service_orders (id, vendor_id, project_id, service_id, provenance, status, net_cost_minor, line_items, status_reason, acknowledged_at, fulfilled_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8::text::jsonb, $9, $10::date, $11::date)
         on conflict (id) do update set vendor_id = excluded.vendor_id, project_id = excluded.project_id,
           service_id = excluded.service_id, net_cost_minor = excluded.net_cost_minor, line_items = excluded.line_items
         where service_orders.provenance = 'demo-fixture'`,
        [so.id, so.vendorId, so.projectId, so.serviceId, P, so.status ?? 'draft', so.netCostMinor ?? null, JSON.stringify(so.lineItems ?? []),
          so.statusReason ?? null, so.acknowledgedAt ?? null, so.fulfilledAt ?? null]
      )
    }
    for (const a of seed.bookingAttempts ?? []) {
      await tx.query(
        `insert into booking_attempts (id, booking_type, booking_id, outcome, note, attempted_at, provenance)
         values ($1, $2, $3, $4, $5, ($6::timestamp at time zone 'Asia/Jakarta'), $7)
         on conflict (id) do update set outcome = excluded.outcome, note = excluded.note, attempted_at = excluded.attempted_at
         where booking_attempts.provenance = 'demo-fixture'`,
        [a.id, a.bookingType, a.bookingId, a.outcome, a.note, a.attemptedAt, P]
      )
    }
    // S6b: trip details refresh; the status only while the API never changed it (status_changed_at is null).
    for (const so of seed.salesOrders ?? []) {
      await tx.query(
        `insert into sales_order_refs (id, project_id, party_id, price_minor, traveler_count, status, destination, travel_start_date,
           travel_end_date, note, created_on, lead_id, paid_on, provenance)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, coalesce($11::date, current_date), $12, case when $6 in ('paid', 'ongoing', 'done') then $11::date end, $13)
         on conflict (id) do update set project_id = excluded.project_id, party_id = excluded.party_id, price_minor = excluded.price_minor,
           traveler_count = excluded.traveler_count, destination = excluded.destination, travel_start_date = excluded.travel_start_date,
           travel_end_date = excluded.travel_end_date, note = excluded.note, created_on = excluded.created_on, lead_id = excluded.lead_id,
           status = case when sales_order_refs.status_changed_at is null then excluded.status else sales_order_refs.status end,
           paid_on = case when sales_order_refs.status_changed_at is null then excluded.paid_on else sales_order_refs.paid_on end
         where sales_order_refs.provenance = 'demo-fixture'`,
        [so.id, so.projectId ?? null, so.partyId, so.priceMinor, so.travelerCount, so.status ?? 'draft', so.destination ?? null,
          so.travelStartDate ?? null, so.travelEndDate ?? null, so.note ?? null, so.createdOn ?? null, so.leadId ?? null, P]
      )
    }
    // S7a: participants. A re-seed refreshes fixture rows the API never changed (changed_by_api_at is null).
    for (const g of seed.travelerGroups ?? []) {
      await tx.query(
        `insert into traveler_groups (id, project_id, name, pax_count, rooming_note, provenance) values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do update set name = excluded.name, pax_count = excluded.pax_count, rooming_note = excluded.rooming_note
         where traveler_groups.provenance = 'demo-fixture' and traveler_groups.changed_by_api_at is null`,
        [g.id, g.projectId, g.name, g.paxCount, g.roomingNote, P]
      )
    }
    const TRAVELER_COLUMNS = ['group_id', 'party_id', 'lead_id', 'sales_order_id', 'name', 'passport_number', 'passport_expiry_date', 'id_number',
      'visa_number', 'visa_expiry_date', 'emergency_contact_name', 'emergency_contact_phone', 'special_request', 'dietary_restrictions',
      'accessibility_needs', 'documents_verified_on', 'documents_verified_by', 'is_vip', 'cancelled', 'cancel_reason'] as const
    for (const tr of seed.travelers ?? []) {
      const vals = [tr.groupId, tr.partyId, tr.leadId, tr.salesOrderId, tr.name, tr.passportNumber, tr.passportExpiryDate, tr.idNumber, tr.visaNumber,
        tr.visaExpiryDate, tr.emergencyContactName, tr.emergencyContactPhone, tr.specialRequest, tr.dietaryRestrictions, tr.accessibilityNeeds,
        tr.documentsVerifiedOn, tr.documentsVerifiedBy, tr.isVip, tr.cancelReason !== null, tr.cancelReason]
      await tx.query(
        `insert into travelers (id, project_id, ${TRAVELER_COLUMNS.join(', ')}, provenance)
         values ($1, $2, ${TRAVELER_COLUMNS.map((_, i) => `$${i + 3}`).join(', ')}, $${TRAVELER_COLUMNS.length + 3})
         on conflict (id) do update set ${TRAVELER_COLUMNS.map(c => `${c} = excluded.${c}`).join(', ')}
         where travelers.provenance = 'demo-fixture' and travelers.changed_by_api_at is null`,
        [tr.id, tr.projectId, ...vals, P]
      )
    }
    // Self references once every traveler exists.
    for (const tr of seed.travelers ?? []) {
      await tx.query(
        `update travelers set companion_of = $2, replaced_by = $3, replaces = $4
          where id = $1 and provenance = 'demo-fixture' and changed_by_api_at is null`,
        [tr.id, tr.companionOfTravelerId, tr.replacedByTravelerId, tr.replacesTravelerId]
      )
    }
    for (const r of seed.roomAssignments ?? []) {
      await tx.query(
        `insert into room_assignments (id, project_id, group_id, room_label, room_type, traveler_ids, provenance) values ($1, $2, $3, $4, $5, $6::text::jsonb, $7)
         on conflict (id) do update set room_label = excluded.room_label, room_type = excluded.room_type, traveler_ids = excluded.traveler_ids
         where room_assignments.provenance = 'demo-fixture' and room_assignments.changed_by_api_at is null`,
        [r.id, r.projectId, r.groupId, r.roomLabel, r.roomType, JSON.stringify(r.travelerIds), P]
      )
    }
    // S7d: activity log. A re-seed refreshes fixture rows no one reviewed or decided through the API (reviewed_at is null).
    const ACTIVITY_COLUMNS = ['project_id', 'message', 'is_change', 'reviewed', 'category', 'reason', 'requested_by', 'before_value', 'after_value',
      'impact_note', 'approval_status', 'approved_by', 'created_at'] as const
    for (const a of seed.activities ?? []) {
      await tx.query(
        `insert into project_activities (id, ${ACTIVITY_COLUMNS.join(', ')}, provenance)
         values ($1, ${ACTIVITY_COLUMNS.map((_, n) => `$${n + 2}`).join(', ')}, $${ACTIVITY_COLUMNS.length + 2})
         on conflict (id) do update set ${ACTIVITY_COLUMNS.map(c => `${c} = excluded.${c}`).join(', ')}
         where project_activities.provenance = 'demo-fixture' and project_activities.reviewed_at is null`,
        [a.id, a.projectId, a.message, a.isChange, a.reviewed, a.category, a.reason, a.requestedBy, a.beforeValue, a.afterValue, a.impactNote,
          a.approvalStatus, a.approvedBy, `${a.createdOn}T09:00:00+07:00`, P]
      )
    }
    // S10b: master data and the organization profile. Rows an admin changed through the API are left alone.
    for (const m of seed.masterData ?? []) {
      await tx.query(
        `insert into master_data_records (id, category, is_active, data, provenance) values ($1, $2, $3, $4::text::jsonb, $5)
         on conflict (id) do update set category = excluded.category, is_active = excluded.is_active, data = excluded.data, updated_at = now()
         where master_data_records.provenance = 'demo-fixture' and master_data_records.changed_by_api_at is null`,
        [m.id, m.category, m.isActive, JSON.stringify(m.data), P]
      )
    }
    if (seed.organizationProfile) {
      const o = seed.organizationProfile
      await tx.query(
        `insert into organization_profile (id, legal_name, display_name, address, default_currency_code, business_hours, contact_email, contact_phone,
                                           updated_by, updated_at, provenance)
         values ('ORG-001', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (id) do update set legal_name = excluded.legal_name, display_name = excluded.display_name, address = excluded.address,
           default_currency_code = excluded.default_currency_code, business_hours = excluded.business_hours, contact_email = excluded.contact_email,
           contact_phone = excluded.contact_phone, updated_by = excluded.updated_by, updated_at = excluded.updated_at
         where organization_profile.provenance = 'demo-fixture' and organization_profile.changed_by_api_at is null`,
        [o.legalName, o.displayName, o.address, o.defaultCurrencyCode, o.businessHours, o.contactEmail, o.contactPhone, o.updatedBy, `${o.updatedOn}T09:00:00+07:00`, P]
      )
    }
    // S11a: assets, maintenance and checkouts. Rows changed through the API are left alone.
    const keep = (table: string) => `where ${table}.provenance = 'demo-fixture' and ${table}.changed_by_api_at is null`
    for (const a of seed.assets ?? []) {
      await tx.query(
        `insert into assets (id, code, name, category, brand, serial_number, purchased_on, purchase_price_minor, condition, status, location, quantity, note, provenance)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         on conflict (id) do update set code = excluded.code, name = excluded.name, category = excluded.category, brand = excluded.brand,
           serial_number = excluded.serial_number, purchased_on = excluded.purchased_on, purchase_price_minor = excluded.purchase_price_minor,
           condition = excluded.condition, status = excluded.status, location = excluded.location, quantity = excluded.quantity, note = excluded.note, updated_at = now()
         ${keep('assets')}`,
        [a.id, a.code, a.name, a.category, a.brand, a.serialNumber, a.purchasedOn, a.purchasePriceMinor, a.condition, a.status, a.location, a.quantity, a.note, P]
      )
    }
    for (const m of seed.assetMaintenance ?? []) {
      await tx.query(
        `insert into asset_maintenance (id, asset_id, type, scheduled_on, completed_on, status, vendor_name, cost_minor, note, interval_days, provenance)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         on conflict (id) do update set type = excluded.type, scheduled_on = excluded.scheduled_on, completed_on = excluded.completed_on, status = excluded.status,
           vendor_name = excluded.vendor_name, cost_minor = excluded.cost_minor, note = excluded.note, interval_days = excluded.interval_days, updated_at = now()
         ${keep('asset_maintenance')}`,
        [m.id, m.assetId, m.type, m.scheduledOn, m.completedOn, m.status, m.vendorName, m.costMinor, m.note, m.intervalDays, P]
      )
    }
    for (const c of seed.assetCheckouts ?? []) {
      await tx.query(
        `insert into asset_checkouts (id, asset_id, project_id, borrowed_by, checked_out_on, due_on, returned_on, status, condition_on_return, note, provenance)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         on conflict (id) do update set project_id = excluded.project_id, borrowed_by = excluded.borrowed_by, checked_out_on = excluded.checked_out_on,
           due_on = excluded.due_on, returned_on = excluded.returned_on, status = excluded.status, condition_on_return = excluded.condition_on_return,
           note = excluded.note, updated_at = now()
         ${keep('asset_checkouts')}`,
        [c.id, c.assetId, c.projectId, c.borrowedBy, c.checkedOutOn, c.dueOn, c.returnedOn, c.status, c.conditionOnReturn, c.note, P]
      )
    }
    // S9b: notifications. A re-seed refreshes the text of fixture rows but keeps what users read.
    for (const x of seed.notifications ?? []) {
      await tx.query(
        `insert into notifications (id, user_id, type, title, body, entity_type, entity_id, category, read, created_at, provenance)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         on conflict (id) do update set title = excluded.title, body = excluded.body
         where notifications.provenance = 'demo-fixture'`,
        [x.id, x.userId, x.type, x.title, x.body, x.entityType, x.entityId, x.category, x.read, `${x.createdOn}T09:00:00+07:00`, P]
      )
    }
    // S9: documents (versions linked in a second pass) and messages. Only fixture rows are refreshed; API rows are untouched.
    const DOC_COLUMNS = ['entity_type', 'entity_id', 'project_id', 'name', 'category', 'version', 'access_level', 'source_type', 'preview_route', 'uploaded_by',
      'uploaded_on', 'generated_on', 'expires_on', 'verified', 'verified_by', 'verified_on'] as const
    for (const d of seed.documents ?? []) {
      await tx.query(
        `insert into documents (id, ${DOC_COLUMNS.join(', ')}, provenance)
         values ($1, ${DOC_COLUMNS.map((_, n) => `$${n + 2}`).join(', ')}, $${DOC_COLUMNS.length + 2})
         on conflict (id) do update set ${DOC_COLUMNS.map(c => `${c} = excluded.${c}`).join(', ')}
         where documents.provenance = 'demo-fixture'`,
        [d.id, d.entityType, d.entityId, d.projectId, d.name, d.category, d.version, d.accessLevel, d.sourceType, d.previewRoute, d.uploadedBy,
          d.uploadedOn, d.generatedOn, d.expiresOn, d.verified, d.verifiedBy, d.verifiedOn, P]
      )
    }
    for (const d of seed.documents ?? []) {
      if (d.supersedesId) await tx.query("update documents set supersedes_id = $2 where id = $1 and provenance = 'demo-fixture'", [d.id, d.supersedesId])
    }
    for (const m of seed.messages ?? []) {
      await tx.query(
        `insert into messages (id, entity_type, entity_id, project_id, channel, sender_id, body, mentions, delivery_status, delivery_channel, attachment_name, read_by, sent_at, provenance)
         values ($1, $2, $3, $4, $5, $6, $7, $8::text::jsonb, $9, $10, $11, $12::text::jsonb, $13, $14)
         on conflict (id) do update set body = excluded.body, mentions = excluded.mentions, delivery_status = excluded.delivery_status, read_by = excluded.read_by
         where messages.provenance = 'demo-fixture'`,
        [m.id, m.entityType, m.entityId, m.projectId, m.channel, m.senderId, m.body, JSON.stringify(m.mentions), m.deliveryStatus, m.deliveryChannel, m.attachmentName,
          JSON.stringify(m.readBy), m.sentAt.length === 10 ? `${m.sentAt}T09:00:00+07:00` : m.sentAt, P]
      )
    }
    // S8: change requests (after their CHG- entries), incidents and pre-Finance cancellations; API-changed rows are kept.
    const CR_COLUMNS = ['project_id', 'source', 'requested_by', 'affected_entities', 'before_summary', 'after_summary', 'operational_impact', 'commercial_impact_minor',
      'financial_impact_note', 'timeline_impact_note', 'status', 'decided_by', 'decided_at', 'rejection_reason', 'implemented_at', 'activity_id', 'created_at'] as const
    for (const r of seed.changeRequests ?? []) {
      const decidedAt = r.decidedOn ? `${r.decidedOn}T09:00:00+07:00` : null
      await tx.query(
        `insert into change_requests (id, ${CR_COLUMNS.join(', ')}, provenance)
         values ($1, $2, $3, $4, $5::text::jsonb, ${CR_COLUMNS.slice(4).map((_, n) => `$${n + 6}`).join(', ')}, $${CR_COLUMNS.length + 2})
         on conflict (id) do update set ${CR_COLUMNS.map(c => `${c} = excluded.${c}`).join(', ')}
         where change_requests.provenance = 'demo-fixture' and change_requests.changed_by_api_at is null`,
        [r.id, r.projectId, r.source, r.requestedBy, JSON.stringify(r.affectedEntities), r.beforeSummary, r.afterSummary, r.operationalImpact, r.commercialImpactMinor,
          r.financialImpactNote, r.timelineImpactNote, r.status, r.decidedBy, decidedAt, r.rejectionReason ?? (r.status === 'rejected' ? 'Ditolak' : null),
          r.status === 'implemented' ? decidedAt ?? `${r.submittedOn}T09:00:00+07:00` : null, r.activityId, `${r.submittedOn}T09:00:00+07:00`, P]
      )
    }
    const INC_COLUMNS = ['project_id', 'booking_type', 'booking_id', 'title', 'description', 'severity', 'owner_id', 'status', 'escalated_to', 'communication_log',
      'resolution_note', 'resolved_at'] as const
    for (const i of seed.incidents ?? []) {
      await tx.query(
        `insert into incidents (id, ${INC_COLUMNS.join(', ')}, provenance)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::text::jsonb, $12, $13, $14)
         on conflict (id) do update set ${INC_COLUMNS.map(c => `${c} = excluded.${c}`).join(', ')}
         where incidents.provenance = 'demo-fixture' and incidents.changed_by_api_at is null`,
        [i.id, i.projectId, i.bookingType, i.bookingId, i.title, i.description, i.severity, i.ownerId, i.status, i.escalatedTo, JSON.stringify(i.communicationLog),
          i.resolutionNote, i.resolvedOn ? `${i.resolvedOn}T09:00:00+07:00` : null, P]
      )
    }
    for (const x of seed.bookingCancellations ?? []) {
      await tx.query(
        `insert into booking_cancellations (id, project_id, booking_type, booking_id, outcome, reason, penalty_minor, refund_eligible, cancelled_by, cancelled_on, provenance)
         values ($1, $2, $3, $4, 'cancelled', $5, $6, $7, $8, $9, $10)
         on conflict (id) do update set reason = excluded.reason, penalty_minor = excluded.penalty_minor, refund_eligible = excluded.refund_eligible
         where booking_cancellations.provenance = 'demo-fixture'`,
        [x.id, x.projectId, x.bookingType, x.bookingId, x.reason, x.penaltyMinor, x.refundEligible, x.cancelledBy, x.cancelledOn, P]
      )
    }
    // S7c: tasks and milestones. A re-seed refreshes fixture rows the API never changed.
    const TASK_COLUMNS = ['project_id', 'title', 'status', 'due_on', 'is_milestone', 'assigned_to', 'is_blocked', 'blocked_reason'] as const
    for (const tk of seed.tasks ?? []) {
      await tx.query(
        `insert into project_tasks (id, ${TASK_COLUMNS.join(', ')}, provenance)
         values ($1, ${TASK_COLUMNS.map((_, n) => `$${n + 2}`).join(', ')}, $${TASK_COLUMNS.length + 2})
         on conflict (id) do update set ${TASK_COLUMNS.map(c => `${c} = excluded.${c}`).join(', ')}
         where project_tasks.provenance = 'demo-fixture' and project_tasks.changed_by_api_at is null`,
        [tk.id, tk.projectId, tk.title, tk.status, tk.dueOn, tk.isMilestone, tk.assignedTo, tk.blockedReason !== null, tk.blockedReason, P]
      )
    }
    // Dependencies once every task exists.
    for (const tk of seed.tasks ?? []) {
      await tx.query("update project_tasks set depends_on = $2 where id = $1 and provenance = 'demo-fixture' and changed_by_api_at is null", [tk.id, tk.dependsOn])
    }
    const MILESTONE_COLUMNS = ['project_id', 'step_key', 'name', 'planned_on', 'actual_on', 'owner_id', 'status', 'note', 'budget_minor', 'deliverables'] as const
    for (const m of seed.milestones ?? []) {
      await tx.query(
        `insert into project_milestones (id, ${MILESTONE_COLUMNS.join(', ')}, provenance)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::text::jsonb, $12)
         on conflict (id) do update set ${MILESTONE_COLUMNS.map(c => `${c} = excluded.${c}`).join(', ')}
         where project_milestones.provenance = 'demo-fixture' and project_milestones.changed_by_api_at is null`,
        [m.id, m.projectId, m.stepKey, m.name, m.plannedOn, m.actualOn, m.ownerId, m.status, m.note, m.budgetMinor, JSON.stringify(m.deliverables), P]
      )
    }
    // S7b: daily itinerary items. A re-seed refreshes fixture rows the API never changed.
    const ITINERARY_COLUMNS = ['date', 'time', 'title', 'description', 'service_type', 'group_id', 'timezone', 'location', 'visible_to_client', 'vendor_id', 'vendor_amount_minor'] as const
    for (const i of seed.itineraryItems ?? []) {
      await tx.query(
        `insert into itinerary_items (id, project_id, ${ITINERARY_COLUMNS.join(', ')}, provenance)
         values ($1, $2, ${ITINERARY_COLUMNS.map((_, n) => `$${n + 3}`).join(', ')}, $${ITINERARY_COLUMNS.length + 3})
         on conflict (id) do update set ${ITINERARY_COLUMNS.map(c => `${c} = excluded.${c}`).join(', ')}
         where itinerary_items.provenance = 'demo-fixture' and itinerary_items.changed_by_api_at is null`,
        [i.id, i.projectId, i.date, i.time, i.title, i.description, i.serviceType, i.groupId, i.timezone, i.location, i.visibleToClient, i.vendorId, i.vendorAmountMinor, P]
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
    salesOrders: (seed.salesOrders ?? []).length,
    leads: (seed.leads ?? []).length,
    quotations: (seed.quotations ?? []).length
  }
}
