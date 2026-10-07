/**
 * Regenerates src/db/seeds/demo-core.json from the frontend demo fixtures so backend reference IDs match
 * the IDs the UI and its deep links already use (PTY-001, VND-006, PRJ-101, FLT-1011 …).
 *
 *   bun run seed:extract
 *
 * Dev-time tool only: it reads frontend source files, the running backend never does. Only reference
 * fields are extracted — no prices, invoices or payments (mock finance is not real cash; see ADR-004).
 * Output is sorted and has no timestamp, so re-running on unchanged fixtures produces an identical file.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { HOTEL_BOOKINGS } from '../../frontend/app/data/accommodation'
import { BOOKING_ORCHESTRATION_RECORDS } from '../../frontend/app/data/booking-orchestration'
import { MICE_EVENTS } from '../../frontend/app/data/mice'
import { LEADS, LEAD_ACTIVITIES } from '../../frontend/app/data/leads'
import { CONTACTS, PARTIES, PARTY_ACTIVITIES } from '../../frontend/app/data/parties'
import { SERVICE_ORDERS } from '../../frontend/app/data/procurement'
import { CORE_BOOKING_KEYS, departureDateOf, miceTotals } from '../src/modules/core/booking-rules'
import { PROJECT_SERVICES, PROJECTS } from '../../frontend/app/data/projects'
import { SALES_ORDERS } from '../../frontend/app/data/sales-orders'
import { QUOTATIONS } from '../../frontend/app/data/quotations'
import { FLIGHT_BOOKINGS } from '../../frontend/app/data/ticketing'
import { TRANSPORT_BOOKINGS } from '../../frontend/app/data/transportation'
import { USERS } from '../../frontend/app/data/users'
import { VENDOR_CONTACTS, VENDOR_DOCUMENTS, VENDOR_PRODUCTS, VENDOR_QUOTATIONS, VENDORS } from '../../frontend/app/data/vendors'
import type { DemoCoreSeed } from '../src/db/seed-demo'

const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id)
const dateOnly = (value?: string) => (value ? value.slice(0, 10) : null)
const warnings: string[] = []
const USER_IDS = new Set(USERS.map(u => u.id))
/** A user reference kept only when that user is seeded (FK); otherwise null with a warning. */
const seededUser = (id: string | undefined, what: string): string | null => {
  if (!id) { return null }
  if (USER_IDS.has(id)) { return id }
  warnings.push(`${what}: ${id} is not a seeded user — dropped`)
  return null
}

const services = [...PROJECT_SERVICES].sort(byId).map(s => ({
  id: s.id,
  projectId: s.projectId,
  serviceType: s.type,
  vendorId: s.vendorId ?? null,
  label: s.label,
  status: s.status,
  bookingReference: s.bookingReference ?? null,
  budgetMinor: s.budgetIdr === undefined ? null : String(Math.round(s.budgetIdr))
}))
const serviceProject = new Map(services.map(s => [s.id, s.projectId]))

/** Whole rupiah as a minor-unit string, or null when the booking has no price yet. */
const minor = (idr: number | undefined) => (idr === undefined ? null : String(Math.round(idr)))

/** The UI-owned part of a booking: everything except its core columns (same split as the API, S4a). */
const detailsOf = (b: object) => Object.fromEntries(Object.entries(b).filter(([k]) => !(CORE_BOOKING_KEYS as readonly string[]).includes(k)))

function bookingRef(
  bookingType: DemoCoreSeed['bookingRefs'][number]['bookingType'],
  b: { id: string; projectId: string; serviceId?: string; status: string; statusReason?: string; netCostIdr?: number; sellPriceIdr?: number; pnr?: string; confirmationNumber?: string }
) {
  let serviceId = b.serviceId ?? null
  if (serviceId && serviceProject.get(serviceId) !== b.projectId) {
    warnings.push(`${b.id}: service ${serviceId} belongs to ${serviceProject.get(serviceId) ?? 'no project'}, not ${b.projectId}; link dropped`)
    serviceId = null
  }
  const details = detailsOf(b)
  // Same derivations as the booking API: MICE prices from the BOQ, departure date from the details.
  const totals = bookingType === 'mice' ? miceTotals(details) : { sellMinor: minor(b.sellPriceIdr), netMinor: minor(b.netCostIdr) }
  return {
    bookingType,
    bookingId: b.id,
    projectId: b.projectId,
    serviceId,
    sellAmountMinor: totals.sellMinor,
    departureDate: departureDateOf(bookingType, details),
    status: b.status,
    reference: b.pnr ?? b.confirmationNumber ?? null,
    statusReason: b.statusReason ?? null,
    netCostMinor: totals.netMinor,
    details,
    flaggedDuplicate: BOOKING_ORCHESTRATION_RECORDS.some(r => r.bookingType === bookingType && r.bookingId === b.id && r.flaggedDuplicate === true)
  }
}

const seed: DemoCoreSeed = {
  source: 'frontend/app/data/{users,parties,vendors,projects,ticketing,accommodation,transportation,mice,procurement,sales-orders}.ts',
  parties: [...PARTIES].sort(byId).map(p => ({
    id: p.id,
    name: p.name,
    lifecycleStatus: p.lifecycleStatus,
    partyType: p.partyType ?? null,
    preferredCurrency: p.preferredCurrency ?? null,
    industry: p.industry ?? null,
    companyType: p.companyType ?? null,
    size: p.size ?? null,
    address: p.address ?? null,
    city: p.city ?? null,
    province: p.province ?? null,
    country: p.country ?? null,
    postalCode: p.postalCode ?? null,
    phone: p.phone ?? null,
    email: p.email ?? null,
    website: p.website ?? null,
    accountOwnerUserId: p.accountOwnerId ?? null,
    registrationNumber: p.registrationNumber ?? null,
    npwp: p.npwp ?? null,
    billingName: p.billingName ?? null,
    billingAddress: p.billingAddress ?? null,
    paymentTerm: p.paymentTerm ?? null,
    poRequired: p.poRequired ?? false,
    travelPreferences: p.travelPreferences ?? null,
    // Finance-owned (ADR-007); the only money figure on a customer.
    creditLimitMinor: minor(p.creditLimitIdr)
  })),
  vendors: [...VENDORS].sort(byId).map(v => ({
    id: v.id,
    name: v.name,
    serviceType: v.serviceType,
    status: v.status ?? 'active',
    contactName: v.contactName ?? null,
    contactPhone: v.contactPhone ?? null,
    category: v.category ?? null
  })),
  vendorContacts: [...VENDOR_CONTACTS].sort(byId).map(c => ({ id: c.id, vendorId: c.vendorId, name: c.name, title: c.title, email: c.email ?? null, phone: c.phone ?? null })),
  vendorProducts: [...VENDOR_PRODUCTS].sort(byId).map(p => ({ id: p.id, vendorId: p.vendorId, name: p.name, category: p.category, description: p.description ?? null, priceMinor: minor(p.priceIdr) })),
  vendorDocuments: [...VENDOR_DOCUMENTS].sort(byId).map(d => ({ id: d.id, vendorId: d.vendorId, name: d.name, type: d.type, uploadedOn: dateOnly(d.uploadedAt)! })),
  users: [...USERS].sort(byId).map(u => ({
    id: u.id,
    email: u.email.toLowerCase(),
    name: u.name,
    role: u.role as DemoCoreSeed['users'][number]['role'],
    status: u.status,
    partyId: u.role === 'client' ? u.clientPartyId ?? null : null,
    vendorId: u.role === 'vendor' ? u.vendorId ?? null : null
  })),
  projects: [...PROJECTS].sort(byId).map(p => ({
    id: p.id,
    name: p.name,
    partyId: p.partyId,
    destination: p.destination ?? null,
    travelStartDate: dateOnly(p.travelStartDate),
    travelEndDate: dateOnly(p.travelEndDate),
    status: p.status,
    ownerUserId: p.ownerId ?? null,
    teamUserIds: [...new Set<string>(p.teamUserIds ?? [])].sort(),
    // Project value = accepted quotation amount (the only project-value field in the fixtures).
    contractValueMinor: minor(p.quotationAmountIdr),
    characteristic: p.characteristic,
    serviceScope: [...p.serviceScope],
    travelerCount: p.travelerCount,
    isGroupTrip: p.isGroupTrip ?? false,
    leadId: p.leadId ?? null,
    sourceQuotationId: p.sourceQuotationId ?? null,
    tourLeaderName: p.tourLeaderName ?? null,
    tourLeaderPhone: p.tourLeaderPhone ?? null,
    emergencyContactName: p.emergencyContactName ?? null,
    emergencyContactPhone: p.emergencyContactPhone ?? null,
    meetingPoint: p.meetingPoint ?? null,
    handoverAcceptedAt: dateOnly(p.handoverAcceptedAt),
    handoverAcceptedBy: seededUser(p.handoverAcceptedBy, `project ${p.id} handoverAcceptedBy`),
    readyAt: dateOnly(p.readyAt),
    financeSettledAt: p.closureChecklist?.financeSettled ? (dateOnly(p.closedAt) ?? dateOnly(p.travelEndDate)) : null,
    closedAt: dateOnly(p.closedAt),
    closedBy: seededUser(p.closedBy, `project ${p.id} closedBy`),
    finalNote: p.closureChecklist?.finalNote ?? null,
    clientFeedback: p.closureChecklist?.clientFeedback ?? null
  })),
  projectServices: services,
  bookingRefs: [
    ...FLIGHT_BOOKINGS.map(b => bookingRef('flight', b)),
    ...HOTEL_BOOKINGS.map(b => bookingRef('hotel', b)),
    ...TRANSPORT_BOOKINGS.map(b => bookingRef('transport', b)),
    ...MICE_EVENTS.map(b => bookingRef('mice', b))
  ].sort((a, b) => a.bookingType.localeCompare(b.bookingType) || a.bookingId.localeCompare(b.bookingId)),
  /** S4b: quotations recorded per service (a link to a service of another project is dropped). */
  vendorQuotations: [...VENDOR_QUOTATIONS].sort(byId).map((q) => {
    let serviceId = q.serviceId ?? null
    if (serviceId && serviceProject.get(serviceId) !== q.projectId) {
      warnings.push(`${q.id}: service ${serviceId} is not part of ${q.projectId}; link dropped`)
      serviceId = null
    }
    return { id: q.id, vendorId: q.vendorId, projectId: q.projectId, serviceId, serviceType: q.serviceType, amountMinor: String(Math.round(q.amountIdr)), status: q.status, notes: q.notes ?? null, submittedOn: q.submittedAt.slice(0, 10) }
  }),
  serviceOrders: [...SERVICE_ORDERS].sort(byId).map(so => {
    const projectId = so.projectId ?? null
    let serviceId = so.serviceId ?? null
    if (serviceId && serviceProject.get(serviceId) !== projectId) {
      warnings.push(`${so.id}: service ${serviceId} is not part of ${projectId ?? 'no project'}; link dropped`)
      serviceId = null
    }
    return {
      id: so.id,
      vendorId: so.vendorId,
      projectId,
      serviceId,
      status: so.status,
      netCostMinor: minor(so.netCostIdr),
      lineItems: so.lineItems,
      statusReason: so.statusReason ?? null,
      acknowledgedAt: so.acknowledgedAt ?? null,
      fulfilledAt: so.fulfilledAt ?? null
    }
  }),
  /** Group Trip participant bookings only (standalone B2C orders have no project). */
  partyContacts: [...CONTACTS].sort(byId).map(c => ({ id: c.id, partyId: c.partyId, name: c.name, title: c.title, email: c.email ?? null, phone: c.phone ?? null })),
  partyActivities: [...PARTY_ACTIVITIES].sort(byId).filter((a) => {
    if (USER_IDS.has(a.ownerId)) { return true }
    warnings.push(`activity ${a.id}: owner ${a.ownerId} is not a seeded user — skipped`)
    return false
  }).map(a => ({
    id: a.id,
    partyId: a.partyId,
    leadId: a.leadId ?? null,
    type: a.type,
    message: a.message,
    ownerUserId: a.ownerId,
    activityDate: dateOnly(a.createdAt)!,
    dueAt: dateOnly(a.dueAt)
  })),
  leads: [...LEADS].sort(byId).map(l => ({
    id: l.id,
    name: l.name,
    companyName: l.companyName ?? null,
    title: l.title ?? null,
    source: l.source,
    stage: l.stage,
    ownerUserId: seededUser(l.ownerId, `lead ${l.id} owner`) ?? 'USR-001',
    handedOverTo: seededUser(l.handedOverTo, `lead ${l.id} AE`),
    phone: l.phone ?? null,
    email: l.email ?? null,
    qualificationNotes: l.qualificationNotes ?? null,
    expectedCloseDate: dateOnly(l.expectedCloseDate),
    createdOn: dateOnly(l.createdAt)!,
    lastUpdatedOn: dateOnly(l.lastUpdatedAt)!,
    archived: l.archived,
    partyId: l.partyId ?? null,
    qualifiedOn: dateOnly(l.qualifiedAt),
    serviceCategory: l.serviceCategory ?? null,
    destination: l.destination ?? null,
    travelStartDate: dateOnly(l.travelStartDate),
    travelEndDate: dateOnly(l.travelEndDate),
    travelerEstimate: l.travelerEstimate ?? null,
    serviceScope: l.serviceScope ?? [],
    requirementSummary: l.requirementSummary ?? null,
    budgetRange: l.budgetRange ?? null,
    dateFlexible: l.dateFlexible ?? null,
    decisionMaker: l.decisionMaker ?? null,
    urgency: l.urgency ?? null,
    specialRequestNote: l.specialRequestNote ?? null,
    // B2C / Group Trip fields stay as they are until S6b; the group-trip project and local sales order ride along.
    b2c: Object.fromEntries(Object.entries({
      groupTripProjectId: l.groupTripProjectId,
      b2cAdultCount: l.b2cAdultCount,
      b2cChildCount: l.b2cChildCount,
      b2cInfantCount: l.b2cInfantCount,
      b2cPriceAcceptance: l.b2cPriceAcceptance,
      b2cBookingReadiness: l.b2cBookingReadiness,
      b2cQualificationResult: l.b2cQualificationResult,
      b2cNextFollowUpDate: l.b2cNextFollowUpDate,
      projectId: l.serviceCategory === 'individual-travel' && !PROJECTS.some(p => p.leadId === l.id) ? l.projectId : undefined,
      salesOrderId: l.salesOrderId
    }).filter(([, v]) => v !== undefined))
  })),
  leadActivities: [...LEAD_ACTIVITIES].sort(byId).map(a => ({
    id: a.id,
    leadId: a.leadId,
    type: a.type,
    message: a.message,
    ownerUserId: seededUser(a.ownerId, `lead activity ${a.id}`) ?? 'USR-001',
    activityDate: dateOnly(a.createdAt)!,
    dueOn: dateOnly(a.dueAt)
  })),
  quotations: [...QUOTATIONS].sort(byId).map((q) => {
    const content: Record<string, unknown> = Object.fromEntries(Object.entries({
      discountMinor: q.discountIdr,
      taxMinor: q.taxIdr,
      markupMinor: q.markupIdr,
      estimatedCostMinor: q.estimatedCostIdr,
      estimatedMarginMinor: q.estimatedMarginIdr,
      currency: q.currency,
      paymentTerms: q.paymentTerms,
      validUntil: q.validUntil,
      termsAndConditions: q.termsAndConditions,
      inclusions: q.inclusions,
      exclusions: q.exclusions,
      cancellationPolicy: q.cancellationPolicy,
      proposedItineraryNote: q.proposedItineraryNote,
      costSheetId: q.costSheetId,
      serviceBreakdown: q.serviceBreakdown?.map(s => ({ service: s.service, ...(s.description ? { description: s.description } : {}), amountMinor: String(Math.round(s.amountIdr)) }))
    }).filter(([, v]) => v !== undefined).map(([k, v]) => [k, typeof v === 'number' ? String(Math.round(v)) : v]))
    const latest = {
      version: q.version,
      status: q.approvalStatus ?? 'draft',
      amountMinor: String(Math.round(q.amountIdr)),
      decidedBy: seededUser(q.approvedBy, `quotation ${q.id} approver`),
      decisionNote: q.approvalNote ?? null,
      content
    }
    // The fixture keeps only the previous amount of a revised quotation: earlier versions are rebuilt as superseded.
    const earlier = Array.from({ length: q.version - 1 }, (_, i) => ({
      version: i + 1,
      status: 'superseded',
      amountMinor: String(Math.round(i === q.version - 2 && q.supersededAmountIdr ? q.supersededAmountIdr : q.amountIdr)),
      decidedBy: null,
      decisionNote: null,
      content
    }))
    return { id: q.id, leadId: q.leadId, createdOn: dateOnly(q.createdAt)!, sentToClientOn: dateOnly(q.sentToClientAt), versions: [...earlier, latest] }
  }),
  // S6b: every sales order — B2C standalone (no project) and Group Trip participant bookings.
  salesOrders: [...SALES_ORDERS].sort(byId).map(o => ({
    id: o.id,
    projectId: o.projectId ?? null,
    partyId: o.customerId,
    priceMinor: String(Math.round(o.priceIdr)),
    travelerCount: o.travelerCount,
    status: o.status,
    destination: o.destination,
    travelStartDate: dateOnly(o.travelStartDate),
    travelEndDate: dateOnly(o.travelEndDate),
    note: o.note ?? null,
    createdOn: dateOnly(o.createdAt),
    leadId: LEADS.find(l => l.salesOrderId === o.id)?.id ?? null
  }))
}

// S4b: attempt log of the orchestration fixtures, for bookings that are in the seed.
const seededBookings = new Set(seed.bookingRefs.map(b => `${b.bookingType}:${b.bookingId}`))
seed.bookingAttempts = BOOKING_ORCHESTRATION_RECORDS.flatMap(r => r.attemptLog.map(a => ({
  id: a.id, bookingType: r.bookingType, bookingId: r.bookingId, outcome: a.outcome, note: a.note ?? null, attemptedAt: a.at
}))).filter((a) => {
  if (seededBookings.has(`${a.bookingType}:${a.bookingId}`)) { return true }
  warnings.push(`attempt ${a.id}: booking ${a.bookingType} ${a.bookingId} is not seeded — skipped`)
  return false
})

const out = resolve(import.meta.dir, '../src/db/seeds/demo-core.json')
writeFileSync(out, JSON.stringify(seed, null, 2) + '\n')
console.log(`Wrote ${out}`)
console.log(
  `parties=${seed.parties.length} vendors=${seed.vendors.length} users=${seed.users.length} projects=${seed.projects.length} ` +
  `services=${seed.projectServices.length} bookingRefs=${seed.bookingRefs.length} serviceOrders=${seed.serviceOrders.length} salesOrders=${seed.salesOrders.length}`
)
for (const w of warnings) console.warn(`warning: ${w}`)
