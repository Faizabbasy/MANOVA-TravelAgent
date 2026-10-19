import type { Queryable } from '../../db/client'

/** Reads for the sales module (S6a). Leads are internal: the routes refuse portals before calling these. */

export async function wonProjectId(q: Queryable, leadId: string): Promise<string | null> {
  const [p] = await q.query<{ id: string }>('select id from projects where lead_id = $1', [leadId])
  return p?.id ?? null
}

const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null)

export async function listLeads(db: Queryable, filter: { id?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select l.id, l.name, l.company_name, l.title, l.source, l.stage, l.owner_user_id, l.handed_over_to, l.phone, l.email,
            l.qualification_notes, l.expected_close_date::text as expected_close_date, l.created_on::text as created_on,
            l.last_updated_on::text as last_updated_on, l.archived, l.archive_reason, l.party_id, l.qualified_on::text as qualified_on,
            l.unqualified_reason, l.merged_into, l.service_category, l.destination, l.travel_start_date::text as travel_start_date,
            l.travel_end_date::text as travel_end_date, l.traveler_estimate, l.service_scope, l.requirement_summary, l.budget_range,
            l.date_flexible, l.decision_maker, l.urgency, l.special_request_note, l.b2c,
            (select p.id from projects p where p.lead_id = l.id) as won_project_id,
            (select qq.id from quotations qq where qq.lead_id = l.id) as quotation_id
       from leads l where ($1::text is null or l.id = $1) order by l.id`,
    [filter.id ?? null]
  )
  const acts = await db.query<{ id: string; lead_id: string; type: string; message: string; owner_user_id: string; activity_date: string; due_on: string | null; done_on: string | null }>(
    `select id, lead_id, type, message, owner_user_id, activity_date::text as activity_date, due_on::text as due_on, done_on::text as done_on
       from lead_activities where ($1::text is null or lead_id = $1) order by activity_date, id`,
    [filter.id ?? null]
  )
  return rows.map(r => ({
    id: r.id as string,
    name: r.name as string,
    companyName: str(r.company_name),
    title: str(r.title),
    source: r.source as string,
    stage: r.stage as string,
    ownerUserId: r.owner_user_id as string,
    handedOverTo: str(r.handed_over_to),
    phone: str(r.phone),
    email: str(r.email),
    qualificationNotes: str(r.qualification_notes),
    expectedCloseDate: str(r.expected_close_date),
    createdOn: r.created_on as string,
    lastUpdatedOn: r.last_updated_on as string,
    archived: r.archived as boolean,
    archiveReason: str(r.archive_reason),
    partyId: str(r.party_id),
    qualifiedOn: str(r.qualified_on),
    unqualifiedReason: str(r.unqualified_reason),
    mergedInto: str(r.merged_into),
    serviceCategory: str(r.service_category),
    destination: str(r.destination),
    travelStartDate: str(r.travel_start_date),
    travelEndDate: str(r.travel_end_date),
    travelerEstimate: (r.traveler_estimate ?? null) as number | null,
    serviceScope: (r.service_scope ?? []) as string[],
    requirementSummary: str(r.requirement_summary),
    budgetRange: str(r.budget_range),
    dateFlexible: (r.date_flexible ?? null) as boolean | null,
    decisionMaker: str(r.decision_maker),
    urgency: str(r.urgency),
    specialRequestNote: str(r.special_request_note),
    b2c: (r.b2c ?? {}) as Record<string, unknown>,
    wonProjectId: str(r.won_project_id),
    quotationId: str(r.quotation_id),
    activities: acts.filter(a => a.lead_id === r.id).map(a => ({
      id: a.id, leadId: a.lead_id, type: a.type, message: a.message, ownerUserId: a.owner_user_id,
      activityDate: a.activity_date, dueOn: a.due_on, doneOn: a.done_on
    }))
  }))
}

export type LeadView = Awaited<ReturnType<typeof listLeads>>[number]

export async function listSalesQuotations(db: Queryable, filter: { id?: string; leadId?: string } = {}) {
  const heads = await db.query<{ id: string; lead_id: string; current_version: number; sent_to_client_on: string | null; created_on: string
    client_response: string | null; client_response_note: string | null; client_response_version: number | null; client_responded_at: Date | null }>(
    `select id, lead_id, current_version, sent_to_client_on::text as sent_to_client_on, created_on::text as created_on,
            client_response, client_response_note, client_response_version, client_responded_at from quotations
      where ($1::text is null or id = $1) and ($2::text is null or lead_id = $2) order by id`,
    [filter.id ?? null, filter.leadId ?? null]
  )
  if (!heads.length) return []
  const versions = await db.query<Record<string, unknown>>(
    `select v.*, v.valid_until::text as valid_until_text, v.created_on::text as created_on_text from quotation_versions v
      where v.quotation_id in (select jsonb_array_elements_text($1::text::jsonb)) order by v.quotation_id, v.version`,
    [JSON.stringify(heads.map(h => h.id))]
  )
  return heads.map(h => {
    const own = versions.filter(v => v.quotation_id === h.id)
    const cur = own.find(v => Number(v.version) === Number(h.current_version))!
    return {
      id: h.id,
      leadId: h.lead_id,
      currentVersion: Number(h.current_version),
      status: cur.status as string,
      sentToClientOn: h.sent_to_client_on,
      // S12b-2: the client's answer to the version it is looking at (an older version's answer is not shown).
      clientResponse: h.client_response && Number(h.client_response_version) === Number(h.current_version)
        ? { response: h.client_response, note: h.client_response_note, version: Number(h.client_response_version), respondedAt: iso(h.client_responded_at)! }
        : null,
      createdOn: h.created_on,
      amountMinor: String(cur.amount_minor),
      discountMinor: str(cur.discount_minor),
      taxMinor: str(cur.tax_minor),
      markupMinor: str(cur.markup_minor),
      estimatedCostMinor: str(cur.estimated_cost_minor),
      estimatedMarginMinor: str(cur.estimated_margin_minor),
      currency: cur.currency as string,
      paymentTerms: str(cur.payment_terms),
      validUntil: str(cur.valid_until_text),
      termsAndConditions: str(cur.terms_and_conditions),
      inclusions: str(cur.inclusions),
      exclusions: str(cur.exclusions),
      cancellationPolicy: str(cur.cancellation_policy),
      proposedItineraryNote: str(cur.proposed_itinerary_note),
      costSheetId: str(cur.cost_sheet_id),
      serviceBreakdown: cur.service_breakdown as { service: string; description?: string; amountMinor: string }[],
      submittedBy: str(cur.submitted_by),
      submittedAt: iso(cur.submitted_at),
      decidedBy: str(cur.decided_by),
      decidedAt: iso(cur.decided_at),
      decisionNote: str(cur.decision_note),
      versions: own.map(v => ({
        version: Number(v.version), status: v.status as string, amountMinor: String(v.amount_minor), createdOn: v.created_on_text as string,
        submittedBy: str(v.submitted_by), decidedBy: str(v.decided_by), decidedAt: iso(v.decided_at), decisionNote: str(v.decision_note)
      }))
    }
  })
}

export type QuotationView = Awaited<ReturnType<typeof listSalesQuotations>>[number]
