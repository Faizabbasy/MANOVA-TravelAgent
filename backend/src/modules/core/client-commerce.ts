import type { Db, Queryable } from '../../db/client'
import { errors } from '../../http/errors'
import { getInvoice } from '../finance/receivables'

/**
 * Client portal commercial reads (S12a-2): the quotations sent to the client, its reservations and its invoices. Every
 * DTO here is built from a whitelist — never by deleting fields from an internal DTO — so a column added later cannot
 * reach a client by accident. Reservations carry no money (the user's decision, ADR-007); prices reach the client only
 * through sent quotations and invoices.
 */

const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const day = (v: unknown) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10))

/* ---------- reservations ---------- */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const arr = (v: unknown): Json[] => (Array.isArray(v) ? v.map(obj) : [])
const text = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v))
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const pick = (o: Json, keys: string[]) => Object.fromEntries(keys.map(k => [k, text(o[k])]))
/** The option the client actually got (the selected one, else the first) — only its descriptive fields. */
const chosen = (d: Json) => { const options = arr(d.options); return options.find(o => o.isSelected === true) ?? options[0] ?? {} }

/** Same buckets as the frontend's `bookingStatusBucket` (data/index.ts). */
const CANCELLED: Record<string, string[]> = { flight: ['cancelled', 'refunded'], hotel: ['cancelled', 'no-show'], transport: ['cancelled', 'no-show'], mice: ['cancelled'] }
const COMPLETED: Record<string, string[]> = { flight: ['issued', 'reissued'], hotel: ['completed'], transport: ['completed'], mice: ['completed'] }
const CONFIRMED: Record<string, string[]> = {
  flight: ['confirmed', 'issued', 'reissued'], hotel: ['confirmed', 'amended', 'completed'], transport: ['assigned', 'confirmed', 'completed'], mice: ['confirmed', 'in-progress', 'completed']
}
export function clientStatusOf(type: string, status: string): string {
  if (CANCELLED[type]?.includes(status)) return 'Dibatalkan'
  if (COMPLETED[type]?.includes(status)) return 'Selesai'
  if (CONFIRMED[type]?.includes(status)) return 'Dikonfirmasi'
  return 'Diproses'
}

/** Whitelisted travel details per booking type — never prices, vendors, staff or internal notes. */
function clientDetails(type: string, d: Json) {
  const travelerIds = (Array.isArray(d.travelerIds) ? d.travelerIds : []).map(String)
  if (type === 'flight') {
    const o = chosen(d)
    return {
      airline: text(o.airline), cabinClass: text(o.cabinClass), ticketingDeadline: text(d.ticketingDeadline), travelerIds,
      segments: arr(d.segments).map(s => pick(s, ['origin', 'destination', 'departureAt', 'arrivalAt', 'flightNumber']))
    }
  }
  if (type === 'hotel') {
    const o = chosen(d)
    return {
      propertyName: text(o.propertyName), roomType: text(o.roomType), mealPlan: text(o.mealPlan), travelerIds,
      checkInDate: text(d.checkInDate), checkOutDate: text(d.checkOutDate), roomsBlocked: num(d.roomsBlocked),
      voucherIssuedAt: text(d.voucherIssuedAt), cancellationDeadline: text(d.cancellationDeadline)
    }
  }
  if (type === 'transport') {
    const o = chosen(d)
    return {
      vehicleType: text(o.vehicleType), capacity: num(o.capacity), transferType: text(d.transferType), travelerIds,
      assignedVehiclePlateNumber: text(d.assignedVehiclePlateNumber), driverName: text(d.driverName), driverPhone: text(d.driverPhone),
      legs: arr(d.legs).map(l => pick(l, ['label', 'pickupLocation', 'dropoffLocation', 'scheduledAt']))
    }
  }
  return {
    venueName: text(d.venueName), venueAddress: text(d.venueAddress), clientApprovalStatus: text(d.clientApprovalStatus),
    sessions: arr(d.sessions).map(s => ({ ...pick(s, ['roomName', 'sessionTitle', 'startAt', 'endAt']), capacity: num(s.capacity) })),
    participantCategories: arr(d.participantCategories).map(c => ({ category: text(c.category), expectedCount: num(c.expectedCount) })),
    deliverables: arr(d.deliverables).map(x => ({ label: text(x.label), isDelivered: x.isDelivered === true }))
  }
}

function labelOf(type: string, details: ReturnType<typeof clientDetails>, id: string): string {
  const d = details as Json
  if (type === 'flight') {
    const first = arr(d.segments)[0]
    return text(d.airline) ?? (first ? `${first.origin} → ${first.destination}` : id)
  }
  if (type === 'hotel') return d.propertyName ? `${d.propertyName}${d.roomType ? ` — ${d.roomType}` : ''}` : id
  if (type === 'transport') return [text(d.vehicleType), text(d.assignedVehiclePlateNumber)].filter(Boolean).join(' — ') || id
  return text(d.venueName) ?? id
}

export async function listClientReservations(db: Queryable, partyId: string) {
  const rows = await db.query<Record<string, unknown>>(
    `select b.booking_type, b.booking_id, b.project_id, p.name as project_name, b.status, b.reference, b.departure_date, b.details,
            s.booking_reference as service_reference
       from booking_refs b join projects p on p.id = b.project_id
       left join project_services s on s.id = b.service_id
      where p.party_id = $1
      order by b.departure_date nulls last, b.booking_type, b.booking_id`, [partyId])
  return rows.map((r) => {
    const type = r.booking_type as string
    const details = clientDetails(type, obj(r.details))
    const d = details as Json
    const firstStart = type === 'flight' ? arr(d.segments)[0]?.departureAt : type === 'hotel' ? d.checkInDate
      : type === 'transport' ? arr(d.legs)[0]?.scheduledAt : arr(d.sessions)[0]?.startAt
    return {
      type,
      id: r.booking_id as string,
      projectId: r.project_id as string,
      projectName: r.project_name as string,
      status: r.status as string,
      clientStatus: clientStatusOf(type, r.status as string),
      reference: text(r.reference) ?? (type === 'mice' ? text(r.service_reference) : null),
      label: labelOf(type, details, r.booking_id as string),
      startDate: text(firstStart) ?? day(r.departure_date),
      deadlineDate: type === 'flight' ? text(d.ticketingDeadline) : type === 'hotel' ? text(d.cancellationDeadline) : null,
      details
    }
  })
}

/* ---------- invoices ---------- */

type FullInvoice = Awaited<ReturnType<typeof getInvoice>>

/** The billed customer's view of an invoice: amounts, dates, lines, its payments and credit notes — no internal forecast, note, bank account or transaction. */
function clientInvoice(i: FullInvoice) {
  return {
    id: i.id as string,
    number: (i.number ?? null) as string | null,
    project: i.project as { id: string; name: string },
    invoiceType: i.invoiceType as string,
    status: i.status as string,
    settlement: i.settlement,
    overdue: i.overdue,
    daysOverdue: i.daysOverdue,
    currency: i.currency as string,
    totalMinor: String(i.totalMinor),
    paidMinor: String(i.paidMinor),
    creditedMinor: String(i.creditedMinor),
    outstandingMinor: String(i.outstandingMinor),
    issueDate: day(i.issueDate),
    dueDate: day(i.dueDate),
    isDisputed: i.isDisputed as boolean,
    disputeReason: str(i.disputeReason),
    voidReason: str(i.voidReason),
    billingSnapshot: (i.billingSnapshot ?? null) as unknown,
    lines: i.lines.map(l => ({ position: Number(l.position), description: String(l.description), amountMinor: String(l.amountMinor) })),
    payments: i.payments.filter(p => !p.reversed).map(p => ({ amountMinor: String(p.amountMinor), effectiveDate: day(p.effectiveDate), reference: str(p.reference) })),
    // Only notes that reduce the bill: a refund-liability note does not change what the client owes.
    creditNotes: i.creditNotes.filter(n => n.effect === 'reduce_receivable').map(n => ({ id: n.id as string, amountMinor: String(n.amountMinor), reason: str(n.reason), status: n.status as string, issuedAt: n.createdAt }))
  }
}

/** Invoices billed to the party (`customer_invoices.party_id` — a Group Trip participant's bill is its own), issued or void. */
async function clientInvoiceIds(db: Db, partyId: string, id?: string): Promise<string[]> {
  const rows = await db.query<{ id: string }>(
    `select id from customer_invoices where party_id = $1 and status in ('issued', 'void') and ($2::text is null or id = $2)
      order by coalesce(issue_date, created_at::date) desc, id desc`, [partyId, id ?? null])
  return rows.map(r => r.id)
}

export async function listClientInvoices(db: Db, partyId: string) {
  const invoices = await Promise.all((await clientInvoiceIds(db, partyId)).map(async id => clientInvoice(await getInvoice(db, id))))
  const issued = invoices.filter(i => i.status === 'issued')
  const sum = (key: 'totalMinor' | 'paidMinor' | 'outstandingMinor') => issued.reduce((acc, i) => acc + BigInt(i[key]), 0n).toString()
  const open = issued.filter(i => BigInt(i.outstandingMinor) > 0n && i.dueDate).map(i => i.dueDate!).sort()
  return {
    invoices,
    summary: {
      invoicedMinor: sum('totalMinor'),
      paidMinor: sum('paidMinor'),
      outstandingMinor: sum('outstandingMinor'),
      overdueCount: String(issued.filter(i => i.overdue).length),
      nextDueDate: open[0] ?? null
    }
  }
}

export async function getClientInvoice(db: Db, partyId: string, id: string) {
  const [found] = await clientInvoiceIds(db, partyId, id)
  if (!found) throw errors.notFound('Invoice')
  return clientInvoice(await getInvoice(db, found))
}

/* ---------- quotations ---------- */

/**
 * Only quotations sent to the client (approved, then sent; a revision not yet re-sent clears `sent_to_client_on`). The
 * previous amount is the last version the client was actually sent (`quotation.sent` audit), never an internal draft.
 */
export async function listClientQuotations(db: Queryable, partyId: string) {
  const rows = await db.query<Record<string, unknown>>(
    `select q.id, q.current_version, q.created_on, q.sent_to_client_on, q.client_response, q.client_response_note, q.client_response_version, q.client_responded_at,
            v.amount_minor, v.discount_minor, v.tax_minor, v.currency, v.payment_terms, v.valid_until, v.terms_and_conditions,
            v.inclusions, v.exclusions, v.cancellation_policy, v.proposed_itinerary_note, v.service_breakdown,
            (select pv.amount_minor from quotation_versions pv where pv.quotation_id = q.id and pv.version = (
              select max((a.after->>'version')::int) from audit_events a
               where a.action = 'quotation.sent' and a.entity_type = 'quotation' and a.entity_id = q.id
                 and (a.after->>'version')::int < q.current_version)) as previous_amount_minor,
            l.id as lead_id, l.title, l.company_name, l.name, l.destination, l.travel_start_date, l.travel_end_date, l.traveler_estimate, l.service_scope,
            coalesce(hu.name, ou.name) as prepared_by_name,
            (select p.id from projects p where p.lead_id = l.id) as project_id
       from quotations q
       join quotation_versions v on v.quotation_id = q.id and v.version = q.current_version
       join leads l on l.id = q.lead_id
       left join users hu on hu.id = l.handed_over_to
       left join users ou on ou.id = l.owner_user_id
      where l.party_id = $1 and q.sent_to_client_on is not null
      order by q.sent_to_client_on desc, q.id`, [partyId])
  return rows.map(r => ({
    id: r.id as string,
    version: Number(r.current_version),
    createdOn: day(r.created_on)!,
    sentToClientOn: day(r.sent_to_client_on)!,
    accepted: r.project_id !== null,
    // S12b-2: the client's own answer to this version (none for an older version's answer).
    clientResponse: r.client_response && Number(r.client_response_version) === Number(r.current_version)
      ? { response: r.client_response as string, note: str(r.client_response_note), version: Number(r.client_response_version), respondedAt: (r.client_responded_at as Date).toISOString() }
      : null,
    projectId: str(r.project_id),
    currency: r.currency as string,
    amountMinor: String(r.amount_minor),
    discountMinor: str(r.discount_minor),
    taxMinor: str(r.tax_minor),
    previousAmountMinor: str(r.previous_amount_minor),
    serviceBreakdown: ((r.service_breakdown ?? []) as { service: string; description?: string; amountMinor: string }[])
      .map(line => ({ service: line.service, description: line.description ?? null, amountMinor: String(line.amountMinor) })),
    paymentTerms: str(r.payment_terms),
    validUntil: day(r.valid_until),
    termsAndConditions: str(r.terms_and_conditions),
    inclusions: str(r.inclusions),
    exclusions: str(r.exclusions),
    cancellationPolicy: str(r.cancellation_policy),
    proposedItineraryNote: str(r.proposed_itinerary_note),
    preparedByName: str(r.prepared_by_name),
    lead: {
      id: r.lead_id as string,
      title: str(r.title),
      companyName: str(r.company_name),
      name: r.name as string,
      destination: str(r.destination),
      travelStartDate: day(r.travel_start_date),
      travelEndDate: day(r.travel_end_date),
      travelerEstimate: r.traveler_estimate === null ? null : Number(r.traveler_estimate),
      serviceScope: (r.service_scope ?? []) as string[]
    }
  }))
}
