import { CLIENT_APPROVALS } from './client-approvals'
import { TRAVEL_REQUESTS, TRAVEL_REQUEST_ACTIVITIES } from './travel-requests'
import type { Approval, ApprovalDecision } from '~/types/client-approval'
import type { TravelRequest, TravelRequestActivity } from '~/types/travel-request'
import type { ClientApprovalDto, TravelRequestDto, TravelRequestInput } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { isApiError } from '~/lib/api/errors'

/**
 * S12c-3: the client portal's travel requests and approvals come from the server. Every write goes to /client/* first
 * and only the server's answer changes the lists; the old mock review (instant lead + approved quotation) is gone —
 * sales reviews the request. Staff screens load their own data and reuse the mappers.
 */

type CoreApi = Pick<ManovaApi, 'core'>
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

export const travelRequestFromServer = (d: TravelRequestDto): TravelRequest => clean({
  id: d.id,
  clientPartyId: d.partyId,
  requestName: d.requestName,
  contactPersonId: opt(d.contactPersonId),
  tripType: opt(d.tripType),
  purpose: opt(d.purpose),
  destination: d.destination,
  travelStartDate: opt(d.travelStartDate),
  travelEndDate: opt(d.travelEndDate),
  dateFlexible: d.dateFlexible,
  estimatedParticipants: opt(d.estimatedParticipants),
  estimatedBudgetIdr: opt(d.estimatedBudgetIdr),
  currency: opt(d.currency),
  serviceScope: d.serviceScope,
  flightRequirement: opt(d.flightRequirement),
  hotelRequirement: opt(d.hotelRequirement),
  transportationRequirement: opt(d.transportationRequirement),
  miceRequirement: opt(d.miceRequirement),
  additionalServicesNote: opt(d.additionalServicesNote),
  status: d.status,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
  leadId: opt(d.leadId),
  clarificationNote: opt(d.clarificationNote),
  reviewerName: opt(d.reviewerName),
  cancelReason: opt(d.cancelReason),
  closeReason: opt(d.closeReason),
  submittedAt: opt(d.submittedAt)
})

const activitiesFromServer = (d: TravelRequestDto): TravelRequestActivity[] => d.activities.map(a => ({
  id: a.id, travelRequestId: d.id, type: 'note', message: a.message, ownerId: a.actorId ?? '', createdAt: a.createdAt, actorName: a.actorName, fromClient: a.fromClient
}))

const DECISION: Record<Approval['status'], ApprovalDecision | undefined> = { pending: undefined, approved: 'approve', rejected: 'reject', 'revision-requested': 'request-revision' }

export const approvalFromServer = (d: ClientApprovalDto): Approval => clean({
  id: d.id,
  projectId: d.projectId,
  clientPartyId: d.partyId,
  entityType: d.entityType,
  entityId: d.projectId,
  status: d.status,
  requestedAt: d.requestedAt,
  requestedBy: d.requestedBy ?? '',
  decision: DECISION[d.status],
  decidedBy: opt(d.decidedBy),
  decidedAt: opt(d.decidedAt),
  approvedAmountIdr: opt(d.amountIdr),
  comment: opt(d.decisionComment),
  reason: opt(d.reason),
  expiresAt: opt(d.expiresOn),
  title: d.title,
  description: opt(d.description),
  projectName: d.projectName,
  requestedByName: d.requestedByName
})

const upsert = <T extends { id: string }>(list: T[], row: T): T => {
  const i = list.findIndex(x => x.id === row.id)
  if (i === -1) { list.push(row) } else { list.splice(i, 1, row) }
  return row
}

export function upsertServerTravelRequest (d: TravelRequestDto): TravelRequest {
  const row = upsert(TRAVEL_REQUESTS, travelRequestFromServer(d))
  for (let i = TRAVEL_REQUEST_ACTIVITIES.length - 1; i >= 0; i--) {
    if (TRAVEL_REQUEST_ACTIVITIES[i]!.travelRequestId === d.id) { TRAVEL_REQUEST_ACTIVITIES.splice(i, 1) }
  }
  TRAVEL_REQUEST_ACTIVITIES.push(...activitiesFromServer(d))
  return row
}
export const upsertServerApproval = (d: ClientApprovalDto): Approval => upsert(CLIENT_APPROVALS, approvalFromServer(d))

/** The client party's travel requests (with activities) and approvals become the server's; other parties' stay. */
export function mergeClientRequests (partyId: string, requests: TravelRequestDto[], approvals: ClientApprovalDto[]): void {
  const old = new Set(TRAVEL_REQUESTS.filter(r => r.clientPartyId === partyId).map(r => r.id))
  for (let i = TRAVEL_REQUESTS.length - 1; i >= 0; i--) {
    if (old.has(TRAVEL_REQUESTS[i]!.id)) { TRAVEL_REQUESTS.splice(i, 1) }
  }
  for (let i = TRAVEL_REQUEST_ACTIVITIES.length - 1; i >= 0; i--) {
    if (old.has(TRAVEL_REQUEST_ACTIVITIES[i]!.travelRequestId)) { TRAVEL_REQUEST_ACTIVITIES.splice(i, 1) }
  }
  for (const r of requests) { upsertServerTravelRequest(r) }
  for (let i = CLIENT_APPROVALS.length - 1; i >= 0; i--) {
    if (CLIENT_APPROVALS[i]!.clientPartyId === partyId) { CLIENT_APPROVALS.splice(i, 1) }
  }
  CLIENT_APPROVALS.push(...approvals.map(approvalFromServer))
}

/* ---------- client writes ---------- */

export const clientCreateTravelRequestOnServer = async (api: CoreApi, input: TravelRequestInput) => upsertServerTravelRequest((await api.core.clientCreateTravelRequest(input)).data)
export const clientUpdateTravelRequestOnServer = async (api: CoreApi, id: string, input: TravelRequestInput) => upsertServerTravelRequest((await api.core.clientUpdateTravelRequest(id, input)).data)
export const clientDuplicateTravelRequestOnServer = async (api: CoreApi, id: string) => upsertServerTravelRequest((await api.core.clientDuplicateTravelRequest(id)).data)
export const clientCancelTravelRequestOnServer = async (api: CoreApi, id: string, reason: string) => upsertServerTravelRequest((await api.core.clientCancelTravelRequest(id, reason)).data)
export const clientSubmitTravelRequestOnServer = async (api: CoreApi, id: string) => upsertServerTravelRequest((await api.core.clientSubmitTravelRequest(id)).data)
export const clientAnswerClarificationOnServer = async (api: CoreApi, id: string, message: string) =>
  upsertServerTravelRequest((await api.core.clientAnswerTravelRequestClarification(id, message)).data)
export const clientDecideApprovalOnServer = async (api: CoreApi, id: string, decision: 'approve' | 'reject' | 'request-revision', input: { comment?: string; reason?: string }) =>
  upsertServerApproval((await api.core.clientDecideApproval(id, decision, input)).data)

/* ---------- loading (client) ---------- */

export async function loadClientRequests (api: CoreApi, partyId: string): Promise<void> {
  const [requests, approvals] = await Promise.all([api.core.listClientTravelRequests(), api.core.listClientApprovals()])
  mergeClientRequests(partyId, requests.data, approvals.data)
}

export interface ClientRequestsSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads the client portal's travel requests and approvals once per signed-in client (`load(true)` re-reads). */
export function useClientRequestsSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<ClientRequestsSyncState>('manova-client-requests-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const user = currentUser.value
    if (user.role !== 'client' || !user.clientPartyId) { return }
    if (!force && state.value.userId === user.id && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId: user.id, message: null }
    try {
      await session.ensure()
      await loadClientRequests(api, user.clientPartyId)
      state.value = { status: 'ready', userId: user.id, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId: user.id, message: isApiError(error) ? error.message : 'Travel request & approval belum bisa dimuat.' }
    }
  }

  return { state, load }
}
