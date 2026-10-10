import { LEADS, LEAD_ACTIVITIES } from './leads'
import { QUOTATIONS } from './quotations'
import { loadNewProjectMilestones, registerNewServerProject } from './projects-sync'
import { refreshProjectActivities } from './activity-sync'
import { upsertServerParty } from './parties-sync'
import { upsertServerSalesOrder } from './sales-orders-sync'
import { applyLeadWon, markCostSheetApplied, prepareCostSheetQuotation } from './index'
import type { Lead, LeadActivity } from '~/types/lead'
import type { Quotation, QuotationServiceItem } from '~/types/quotation'
import type { Project, ServiceTypeKey } from '~/types/project'
import type { SalesOrder } from '~/types/sales-order'
import type { LeadDto, LeadWriteInput, QuotationContentInput, SalesQuotationDto } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { newIdempotencyKey } from '~/lib/api/client'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `LEADS`, `LEAD_ACTIVITIES`, `QUOTATIONS` (S6a). The server owns leads, their activities, client quotations
 * (one row per version) and Won. Writes go to the server first; its answer replaces the local object in place.
 * B2C sales orders stay local until S6b: a lead's local `salesOrderId`/`projectId` survives a merge when the server has none.
 */

type SalesApi = Pick<ManovaApi, 'core' | 'sales'>
const idr = (minor: string | null | undefined) => (minor === null || minor === undefined ? undefined : Number(minor))
const minor = (value: number | undefined | null) => (value === undefined || value === null ? null : String(Math.round(value)))
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)

export function activityFromServer (a: LeadDto['activities'][number]): LeadActivity {
  const out: LeadActivity = { id: a.id, leadId: a.leadId, type: a.type, message: a.message, ownerId: a.ownerUserId, createdAt: a.activityDate }
  if (a.dueOn) { out.dueAt = a.dueOn }
  return out
}

export function leadFromServer (d: LeadDto, local?: Lead): Lead {
  const b2c = d.b2c as Partial<Lead> & { projectId?: string; salesOrderId?: string }
  return {
    id: d.id,
    name: d.name,
    companyName: opt(d.companyName),
    title: opt(d.title),
    source: d.source as Lead['source'],
    stage: d.stage,
    ownerId: d.ownerUserId,
    handedOverTo: opt(d.handedOverTo),
    phone: opt(d.phone),
    email: opt(d.email),
    qualificationNotes: opt(d.qualificationNotes),
    expectedCloseDate: opt(d.expectedCloseDate),
    createdAt: d.createdOn,
    lastUpdatedAt: d.lastUpdatedOn,
    archived: d.archived,
    partyId: opt(d.partyId),
    qualifiedAt: opt(d.qualifiedOn),
    quotationId: opt(d.quotationId),
    projectId: d.wonProjectId ?? b2c.projectId ?? local?.projectId,
    salesOrderId: b2c.salesOrderId ?? local?.salesOrderId,
    serviceCategory: opt(d.serviceCategory) as Lead['serviceCategory'],
    destination: opt(d.destination),
    travelStartDate: opt(d.travelStartDate),
    travelEndDate: opt(d.travelEndDate),
    travelerEstimate: opt(d.travelerEstimate),
    serviceScope: d.serviceScope as ServiceTypeKey[],
    requirementSummary: opt(d.requirementSummary),
    budgetRange: opt(d.budgetRange),
    dateFlexible: opt(d.dateFlexible),
    decisionMaker: opt(d.decisionMaker),
    urgency: opt(d.urgency),
    specialRequestNote: opt(d.specialRequestNote),
    groupTripProjectId: b2c.groupTripProjectId,
    b2cAdultCount: b2c.b2cAdultCount,
    b2cChildCount: b2c.b2cChildCount,
    b2cInfantCount: b2c.b2cInfantCount,
    b2cPriceAcceptance: b2c.b2cPriceAcceptance,
    b2cBookingReadiness: b2c.b2cBookingReadiness,
    b2cQualificationResult: b2c.b2cQualificationResult,
    b2cNextFollowUpDate: b2c.b2cNextFollowUpDate
  }
}

export function quotationFromServer (d: SalesQuotationDto, wonLeadIds: Set<string>): Quotation {
  const previous = d.versions.find(v => v.version === d.currentVersion - 1)
  return {
    id: d.id,
    leadId: d.leadId,
    amountIdr: Number(d.amountMinor),
    createdAt: d.versions.find(v => v.version === d.currentVersion)?.createdOn ?? d.createdOn,
    accepted: wonLeadIds.has(d.leadId),
    version: d.currentVersion,
    supersededAmountIdr: idr(previous?.amountMinor),
    approvalStatus: d.status === 'superseded' ? 'draft' : d.status,
    approvedBy: opt(d.decidedBy),
    approvalNote: opt(d.decisionNote),
    discountIdr: idr(d.discountMinor),
    estimatedCostIdr: idr(d.estimatedCostMinor),
    estimatedMarginIdr: idr(d.estimatedMarginMinor),
    paymentTerms: opt(d.paymentTerms),
    serviceBreakdown: d.serviceBreakdown.map(s => ({ service: s.service as ServiceTypeKey, ...(s.description ? { description: s.description } : {}), amountIdr: Number(s.amountMinor) })),
    taxIdr: idr(d.taxMinor),
    markupIdr: idr(d.markupMinor),
    currency: d.currency,
    validUntil: opt(d.validUntil),
    termsAndConditions: opt(d.termsAndConditions),
    inclusions: opt(d.inclusions),
    exclusions: opt(d.exclusions),
    sentToClientAt: opt(d.sentToClientOn),
    cancellationPolicy: opt(d.cancellationPolicy),
    proposedItineraryNote: opt(d.proposedItineraryNote),
    costSheetId: opt(d.costSheetId),
    versions: d.versions.map(v => ({
      version: v.version,
      status: v.status,
      amountIdr: Number(v.amountMinor),
      createdAt: v.createdOn,
      submittedBy: opt(v.submittedBy),
      decidedBy: opt(v.decidedBy),
      decisionNote: opt(v.decisionNote)
    }))
  }
}

/** Local → server content (form patches use the frontend `…Idr` fields). */
export function quotationInputFromLocal (patch: Partial<Quotation>): QuotationContentInput {
  const out: QuotationContentInput = {}
  if (patch.amountIdr !== undefined) { out.amountMinor = minor(patch.amountIdr)! }
  if ('discountIdr' in patch) { out.discountMinor = minor(patch.discountIdr) }
  if ('taxIdr' in patch) { out.taxMinor = minor(patch.taxIdr) }
  if ('markupIdr' in patch) { out.markupMinor = minor(patch.markupIdr) }
  if ('estimatedCostIdr' in patch) { out.estimatedCostMinor = minor(patch.estimatedCostIdr) }
  if ('estimatedMarginIdr' in patch) { out.estimatedMarginMinor = minor(patch.estimatedMarginIdr) }
  for (const k of ['currency', 'paymentTerms', 'validUntil', 'termsAndConditions', 'inclusions', 'exclusions', 'cancellationPolicy', 'proposedItineraryNote', 'costSheetId'] as const) {
    if (k in patch) { out[k] = patch[k] || null }
  }
  if (patch.serviceBreakdown) {
    out.serviceBreakdown = patch.serviceBreakdown.map((s: QuotationServiceItem) => ({ service: s.service, ...(s.description ? { description: s.description } : {}), amountMinor: minor(s.amountIdr)! }))
  }
  return out
}

/** B2B leads that became a project: their quotation counts as accepted (B2C group-trip projects do not). */
const wonLeads = () => new Set(LEADS.filter(l => l.projectId && l.serviceCategory !== 'individual-travel').map(l => l.id))

export function upsertServerLead (d: LeadDto): Lead {
  const local = LEADS.find(l => l.id === d.id)
  const value = leadFromServer(d, local)
  for (let i = LEAD_ACTIVITIES.length - 1; i >= 0; i--) {
    if (LEAD_ACTIVITIES[i]!.leadId === d.id) { LEAD_ACTIVITIES.splice(i, 1) }
  }
  LEAD_ACTIVITIES.push(...d.activities.map(activityFromServer))
  if (!local) {
    LEADS.push(value)
    return LEADS[LEADS.length - 1]!
  }
  Object.assign(local, value)
  return local
}

export function upsertServerQuotation (d: SalesQuotationDto): Quotation {
  const value = quotationFromServer(d, wonLeads())
  const local = QUOTATIONS.find(q => q.id === d.id)
  const lead = LEADS.find(l => l.id === d.leadId)
  if (lead) { lead.quotationId = d.id }
  if (!local) {
    QUOTATIONS.push(value)
    return QUOTATIONS[QUOTATIONS.length - 1]!
  }
  Object.assign(local, value)
  return local
}

export function mergeServerLeads (leads: LeadDto[], quotations: SalesQuotationDto[]): void {
  const keep = new Set(leads.map(l => l.id))
  for (let i = LEADS.length - 1; i >= 0; i--) {
    if (!keep.has(LEADS[i]!.id)) { LEADS.splice(i, 1) }
  }
  LEAD_ACTIVITIES.splice(0, LEAD_ACTIVITIES.length)
  for (const l of leads) { upsertServerLead(l) }
  const keepQ = new Set(quotations.map(q => q.id))
  for (let i = QUOTATIONS.length - 1; i >= 0; i--) {
    if (!keepQ.has(QUOTATIONS[i]!.id)) { QUOTATIONS.splice(i, 1) }
  }
  for (const q of quotations) { upsertServerQuotation(q) }
}

export async function loadServerLeads (api: SalesApi): Promise<void> {
  const [leads, quotations] = await Promise.all([api.sales.listLeads(), api.sales.listQuotations()])
  mergeServerLeads(leads.data, quotations.data)
}

async function reloadParty (api: SalesApi, partyId: string | undefined) {
  if (!partyId) { return }
  try {
    upsertServerParty((await api.core.getParty(partyId)).data)
  } catch {
    // The next customer sync brings it.
  }
}

export async function createLeadOnServer (api: SalesApi, input: LeadWriteInput & { name: string; source: string }, key: string = newIdempotencyKey()): Promise<Lead> {
  return upsertServerLead((await api.sales.createLead(input, key)).data)
}
export async function patchLeadOnServer (api: SalesApi, id: string, patch: LeadWriteInput): Promise<Lead> {
  return upsertServerLead((await api.sales.updateLead(id, patch)).data)
}
export async function archiveLeadOnServer (api: SalesApi, id: string, reason?: string): Promise<Lead> {
  return upsertServerLead((await api.sales.archiveLead(id, reason)).data)
}
export async function reopenLeadOnServer (api: SalesApi, id: string): Promise<Lead> {
  return upsertServerLead((await api.sales.reopenLead(id)).data)
}
export async function unqualifyLeadOnServer (api: SalesApi, id: string, reason: string): Promise<Lead> {
  return upsertServerLead((await api.sales.unqualifyLead(id, reason)).data)
}
/** The duplicate is archived and both leads get a note: the target is reloaded too. */
export async function mergeLeadOnServer (api: SalesApi, id: string, intoId: string): Promise<Lead> {
  const dup = upsertServerLead((await api.sales.mergeLead(id, intoId)).data)
  upsertServerLead((await api.sales.getLead(intoId)).data)
  return dup
}
export async function addLeadActivityOnServer (api: SalesApi, id: string, input: { type: LeadActivity['type']; message: string; dueOn?: string }): Promise<Lead> {
  return upsertServerLead((await api.sales.addLeadActivity(id, input)).data)
}
export async function completeLeadActivityOnServer (api: SalesApi, id: string, activityId: string): Promise<Lead> {
  return upsertServerLead((await api.sales.completeLeadActivity(id, activityId)).data)
}
/** Qualify: the server checks the form fields and links (or creates) the customer; that customer is reloaded. */
export async function qualifyLeadOnServer (api: SalesApi, id: string, customerKind: 'company' | 'individual'): Promise<Lead> {
  const lead = upsertServerLead((await api.sales.qualifyLead(id, { customerKind })).data)
  await reloadParty(api, lead.partyId)
  return lead
}

/** B2C qualify (S6b): the server qualifies the lead, links the customer and creates the standalone order in one go. */
export async function qualifyB2cLeadOnServer (api: SalesApi, id: string, priceIdr: number, travelerCount?: number): Promise<{ lead: Lead; order?: SalesOrder }> {
  const lead = upsertServerLead((await api.sales.qualifyLead(id, { customerKind: 'individual', priceMinor: String(Math.round(priceIdr)), ...(travelerCount ? { travelerCount } : {}) })).data)
  await reloadParty(api, lead.partyId)
  const order = lead.salesOrderId ? upsertServerSalesOrder((await api.sales.getSalesOrder(lead.salesOrderId)).data) : undefined
  return { lead, order }
}

export interface GroupTripQualifyLocalInput {
  projectId: string
  adultCount: number
  childCount: number
  infantCount: number
  priceIdr: number
  priceAcceptance: string
  bookingReadiness: string
}

/** Group Trip qualify (S6b): the server checks the seats (locked per project) — qualified with an order, or waitlist. */
export async function qualifyGroupTripOnServer (api: SalesApi, id: string, input: GroupTripQualifyLocalInput): Promise<{ outcome: 'qualified' | 'waitlist'; lead: Lead; order?: SalesOrder }> {
  const { priceIdr, ...rest } = input
  const res = (await api.sales.qualifyGroupTrip(id, { ...rest, priceMinor: String(Math.round(priceIdr)) })).data
  const lead = upsertServerLead(res.lead)
  const order = res.salesOrder ? upsertServerSalesOrder(res.salesOrder) : undefined
  if (order) { await reloadParty(api, lead.partyId) }
  return { outcome: res.outcome, lead, order }
}

export async function createQuotationOnServer (api: SalesApi, leadId: string, input: Partial<Quotation> & { amountIdr: number }, key: string = newIdempotencyKey()): Promise<Quotation> {
  const body = quotationInputFromLocal(input) as QuotationContentInput & { amountMinor: string }
  return upsertServerQuotation((await api.sales.createQuotation(leadId, body, key)).data)
}
export async function updateQuotationOnServer (api: SalesApi, id: string, patch: Partial<Quotation>): Promise<Quotation> {
  return upsertServerQuotation((await api.sales.updateQuotation(id, quotationInputFromLocal(patch))).data)
}
/** "Revisi": a draft latest version is edited in place; a submitted or decided one gets a new draft version. */
export async function reviseQuotationOnServer (api: SalesApi, id: string, patch: Partial<Quotation> = {}): Promise<Quotation> {
  const current = QUOTATIONS.find(q => q.id === id)
  const input = quotationInputFromLocal(patch)
  const res = !current?.approvalStatus || current.approvalStatus === 'draft'
    ? await api.sales.updateQuotation(id, input)
    : await api.sales.reviseQuotation(id, input)
  return upsertServerQuotation(res.data)
}
export async function submitQuotationOnServer (api: SalesApi, id: string): Promise<Quotation> {
  return upsertServerQuotation((await api.sales.submitQuotation(id)).data)
}
export async function withdrawQuotationOnServer (api: SalesApi, id: string): Promise<Quotation> {
  return upsertServerQuotation((await api.sales.withdrawQuotation(id)).data)
}
export async function approveQuotationOnServer (api: SalesApi, id: string, note?: string): Promise<Quotation> {
  return upsertServerQuotation((await api.sales.approveQuotation(id, note)).data)
}
export async function rejectQuotationOnServer (api: SalesApi, id: string, note: string): Promise<Quotation> {
  return upsertServerQuotation((await api.sales.rejectQuotation(id, note)).data)
}
/** Send: the server records the date; the client portal login stays local (portal hidden, ADR-006). */
export async function sendQuotationOnServer (api: SalesApi, id: string, actorId: string, ensureLocalClientLogin: (leadId: string, actorId: string) => unknown = () => undefined): Promise<Quotation> {
  const q = upsertServerQuotation((await api.sales.sendQuotation(id)).data)
  ensureLocalClientLogin(q.leadId, actorId)
  return q
}
/**
 * Apply a cost sheet (cost sheets stay local): its figures go to the server quotation — created, edited while draft,
 * or revised into a new draft — and only then is the cost sheet locked. Undefined when it cannot be applied.
 */
export async function applyCostSheetOnServer (api: SalesApi, costSheetId: string, actorId: string): Promise<Quotation | undefined> {
  const prepared = prepareCostSheetQuotation(costSheetId)
  if (!prepared) { return undefined }
  const quotation = prepared.existing
    ? await reviseQuotationOnServer(api, prepared.existing.id, prepared.content)
    : await createQuotationOnServer(api, prepared.leadId, prepared.content)
  markCostSheetApplied(costSheetId, quotation.id, actorId)
  return quotation
}

/** Mark as Won: the server creates (or returns) the project; the local activity entry and client login follow. */
export async function markLeadWonOnServer (api: SalesApi, leadId: string, approverId: string, key: string = newIdempotencyKey()): Promise<Project> {
  const res = (await api.sales.markLeadWon(leadId, key)).data
  const project = registerNewServerProject(res.project)
  upsertServerLead(res.lead)
  applyLeadWon(leadId, project, approverId)
  const q = QUOTATIONS.find(x => x.leadId === leadId)
  if (q) { q.accepted = true }
  await reloadParty(api, project.partyId)
  await loadNewProjectMilestones(api, project.id)
  await refreshProjectActivities(api, project.id) // S7d: the server logged where the project came from
  return project
}

export interface LeadsSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads leads and quotations once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useLeadsSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<LeadsSyncState>('manova-leads-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerLeads(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Lead & quotation belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
