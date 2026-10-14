import type { Queryable } from '../../db/client'

/**
 * Client portal commercial reads (S12a-2): the quotations sent to the client, its reservations and its invoices. Every
 * DTO here is built from a whitelist — never by deleting fields from an internal DTO — so a column added later cannot
 * reach a client by accident. Reservations carry no money (the user's decision, ADR-007); prices reach the client only
 * through sent quotations and invoices.
 */

const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const day = (v: unknown) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10))

/* ---------- quotations ---------- */

/** Only quotations sent to the client (approved, then sent; a revision not yet re-sent clears `sent_to_client_on`). */
export async function listClientQuotations(db: Queryable, partyId: string) {
  const rows = await db.query<Record<string, unknown>>(
    `select q.id, q.current_version, q.created_on, q.sent_to_client_on,
            v.amount_minor, v.discount_minor, v.tax_minor, v.currency, v.payment_terms, v.valid_until, v.terms_and_conditions,
            v.inclusions, v.exclusions, v.cancellation_policy, v.proposed_itinerary_note, v.service_breakdown,
            (select pv.amount_minor from quotation_versions pv where pv.quotation_id = q.id and pv.version = q.current_version - 1) as previous_amount_minor,
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
