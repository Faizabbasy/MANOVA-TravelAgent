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
import { MICE_EVENTS } from '../../frontend/app/data/mice'
import { PARTIES } from '../../frontend/app/data/parties'
import { SERVICE_ORDERS } from '../../frontend/app/data/procurement'
import { PROJECT_SERVICES, PROJECTS } from '../../frontend/app/data/projects'
import { SALES_ORDERS } from '../../frontend/app/data/sales-orders'
import { FLIGHT_BOOKINGS } from '../../frontend/app/data/ticketing'
import { TRANSPORT_BOOKINGS } from '../../frontend/app/data/transportation'
import { USERS } from '../../frontend/app/data/users'
import { VENDORS } from '../../frontend/app/data/vendors'
import type { DemoCoreSeed } from '../src/db/seed-demo'

const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id)
const dateOnly = (value?: string) => (value ? value.slice(0, 10) : null)
const warnings: string[] = []

const services = [...PROJECT_SERVICES].sort(byId).map(s => ({
  id: s.id,
  projectId: s.projectId,
  serviceType: s.type,
  vendorId: s.vendorId ?? null
}))
const serviceProject = new Map(services.map(s => [s.id, s.projectId]))

/** Earliest calendar date among local (Asia/Jakarta) datetime strings like '2026-08-20T08:00'. */
const earliestDate = (values: (string | undefined)[]) => values.filter((v): v is string => !!v).map(v => v.slice(0, 10)).sort()[0] ?? null
/** Whole rupiah as a minor-unit string, or null when the booking has no price yet. */
const minor = (idr: number | undefined) => (idr === undefined ? null : String(Math.round(idr)))

function bookingRef(
  bookingType: DemoCoreSeed['bookingRefs'][number]['bookingType'],
  b: { id: string; projectId: string; serviceId?: string },
  commercial: { sellAmountMinor: string | null; departureDate: string | null }
) {
  let serviceId = b.serviceId ?? null
  if (serviceId && serviceProject.get(serviceId) !== b.projectId) {
    warnings.push(`${b.id}: service ${serviceId} belongs to ${serviceProject.get(serviceId) ?? 'no project'}, not ${b.projectId}; link dropped`)
    serviceId = null
  }
  return { bookingType, bookingId: b.id, projectId: b.projectId, serviceId, ...commercial }
}

/** MICE price lives on BOQ lines; same rule as getMiceBoqTotals (sum of line sell prices). */
function miceSell (event: { boqItems: { sellPriceIdr?: number }[] }) {
  const priced = event.boqItems.filter(item => item.sellPriceIdr !== undefined)
  return priced.length ? String(priced.reduce((sum, item) => sum + Math.round(item.sellPriceIdr ?? 0), 0)) : null
}

const seed: DemoCoreSeed = {
  source: 'frontend/app/data/{users,parties,vendors,projects,ticketing,accommodation,transportation,mice,procurement,sales-orders}.ts',
  parties: [...PARTIES].sort(byId).map(p => ({
    id: p.id,
    name: p.name,
    lifecycleStatus: p.lifecycleStatus,
    partyType: p.partyType ?? null,
    preferredCurrency: p.preferredCurrency ?? null
  })),
  vendors: [...VENDORS].sort(byId).map(v => ({
    id: v.id,
    name: v.name,
    serviceType: v.serviceType,
    status: v.status ?? 'active'
  })),
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
    contractValueMinor: minor(p.quotationAmountIdr)
  })),
  projectServices: services,
  bookingRefs: [
    ...FLIGHT_BOOKINGS.map(b => bookingRef('flight', b, { sellAmountMinor: minor(b.sellPriceIdr), departureDate: earliestDate(b.segments.map(s => s.departureAt)) })),
    ...HOTEL_BOOKINGS.map(b => bookingRef('hotel', b, { sellAmountMinor: minor(b.sellPriceIdr), departureDate: earliestDate([b.checkInDate]) })),
    ...TRANSPORT_BOOKINGS.map(b => bookingRef('transport', b, { sellAmountMinor: minor(b.sellPriceIdr), departureDate: earliestDate(b.legs.map(l => l.scheduledAt)) })),
    ...MICE_EVENTS.map(b => bookingRef('mice', b, { sellAmountMinor: miceSell(b), departureDate: earliestDate(b.sessions.map(s => s.startAt)) }))
  ].sort((a, b) => a.bookingType.localeCompare(b.bookingType) || a.bookingId.localeCompare(b.bookingId)),
  serviceOrders: [...SERVICE_ORDERS].sort(byId).map(so => {
    const projectId = so.projectId ?? null
    let serviceId = so.serviceId ?? null
    if (serviceId && serviceProject.get(serviceId) !== projectId) {
      warnings.push(`${so.id}: service ${serviceId} is not part of ${projectId ?? 'no project'}; link dropped`)
      serviceId = null
    }
    return { id: so.id, vendorId: so.vendorId, projectId, serviceId }
  }),
  /** Group Trip participant bookings only (standalone B2C orders have no project). */
  salesOrders: [...SALES_ORDERS].filter(o => o.projectId).sort(byId).map(o => ({
    id: o.id,
    projectId: o.projectId!,
    partyId: o.customerId,
    priceMinor: String(Math.round(o.priceIdr)),
    travelerCount: o.travelerCount
  }))
}

const out = resolve(import.meta.dir, '../src/db/seeds/demo-core.json')
writeFileSync(out, JSON.stringify(seed, null, 2) + '\n')
console.log(`Wrote ${out}`)
console.log(
  `parties=${seed.parties.length} vendors=${seed.vendors.length} users=${seed.users.length} projects=${seed.projects.length} ` +
  `services=${seed.projectServices.length} bookingRefs=${seed.bookingRefs.length} serviceOrders=${seed.serviceOrders.length} salesOrders=${seed.salesOrders.length}`
)
for (const w of warnings) console.warn(`warning: ${w}`)
