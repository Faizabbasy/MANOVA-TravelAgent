import { CANCELLATION_RECORDS, CHANGE_REQUESTS, INCIDENTS } from './change-incident'
import { refreshProjectActivities } from './activity-sync'
import type { CancellationRecord, ChangeRequest, Incident } from '~/types/change-incident'
import type { BookingCancellationDto, ChangeRequestDto, ChangeRequestImpactInput, ChangeRequestInput, IncidentDto, IncidentInput } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { newIdempotencyKey } from '~/lib/api/client'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `CHANGE_REQUESTS`, `INCIDENTS`, `CANCELLATION_RECORDS` (S8). The server owns the internal change request
 * flow, incidents, and no-show / refunded cancellations (a `cancelled` booking is a Finance refund case). Requests the
 * hidden client portal writes locally (`CR-L…`) survive a merge.
 */

type CoreApi = Pick<ManovaApi, 'core'>
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)
const isLocalRequest = (id: string) => id.startsWith('CR-L')

export function changeRequestFromServer (d: ChangeRequestDto): ChangeRequest {
  return {
    id: d.id,
    projectId: d.projectId,
    source: d.source,
    requestedBy: d.requestedBy,
    submittedAt: d.submittedAt,
    affectedEntities: d.affectedEntities.map(e => ({ ...e })),
    beforeSummary: d.beforeSummary,
    afterSummary: d.afterSummary,
    operationalImpact: opt(d.operationalImpact),
    commercialImpactIdr: d.commercialImpactMinor === null ? undefined : Number(d.commercialImpactMinor),
    financialImpactNote: opt(d.financialImpactNote),
    timelineImpactNote: opt(d.timelineImpactNote),
    status: d.status,
    approvedBy: opt(d.decidedBy),
    approvedAt: opt(d.decidedAt),
    rejectionReason: opt(d.rejectionReason),
    activityEntryId: opt(d.activityId),
    // S12b-2: the portal steps live on the server too.
    changeType: opt(d.changeType),
    cancellationFeeIdr: d.cancellationFeeMinor === null ? undefined : Number(d.cancellationFeeMinor),
    clientDecidedBy: opt(d.clientDecidedBy),
    clientDecidedAt: opt(d.clientDecidedAt),
    cancelReason: opt(d.cancelReason),
    cancelledAt: opt(d.cancelledAt)
  }
}

export function incidentFromServer (d: IncidentDto): Incident {
  return {
    id: d.id,
    projectId: d.projectId,
    bookingType: opt(d.bookingType),
    bookingId: opt(d.bookingId),
    title: d.title,
    description: d.description,
    severity: d.severity,
    ownerId: d.ownerId,
    status: d.status,
    escalatedTo: opt(d.escalatedTo),
    communicationLog: d.communicationLog.map(e => ({ ...e })),
    resolutionNote: opt(d.resolutionNote),
    resolvedAt: opt(d.resolvedAt)
  }
}

export function cancellationFromServer (d: BookingCancellationDto): CancellationRecord {
  return {
    id: d.id,
    projectId: d.projectId,
    bookingType: d.bookingType,
    bookingId: d.bookingId,
    reason: d.reason,
    penaltyIdr: d.penaltyMinor === null ? undefined : Number(d.penaltyMinor),
    cancelledAt: d.cancelledOn,
    cancelledBy: d.cancelledBy,
    refundEligible: d.refundEligible,
    outcome: d.outcome
  }
}

function upsert<T extends { id: string }> (list: T[], value: T): T {
  const local = list.find(x => x.id === value.id)
  if (!local) {
    list.push(value)
    return list[list.length - 1]!
  }
  for (const key of Object.keys(local) as (keyof T)[]) { if (!(key in value)) { delete local[key] } }
  Object.assign(local, value)
  return local
}

function replaceAll<T extends { id: string }> (list: T[], values: T[], keepLocal: (id: string) => boolean = () => false) {
  const keep = new Set(values.map(v => v.id))
  for (let i = list.length - 1; i >= 0; i--) {
    const id = list[i]!.id
    if (!keep.has(id) && !keepLocal(id)) { list.splice(i, 1) }
  }
  for (const v of values) { upsert(list, v) }
}

export const upsertServerChangeRequest = (d: ChangeRequestDto) => upsert(CHANGE_REQUESTS, changeRequestFromServer(d))
const upsertRequest = upsertServerChangeRequest
const upsertIncident = (d: IncidentDto) => upsert(INCIDENTS, incidentFromServer(d))

export function mergeServerChanges (requests: ChangeRequestDto[], incidents: IncidentDto[], cancellations: BookingCancellationDto[]): void {
  replaceAll(CHANGE_REQUESTS, requests.map(changeRequestFromServer), isLocalRequest)
  replaceAll(INCIDENTS, incidents.map(incidentFromServer))
  replaceAll(CANCELLATION_RECORDS, cancellations.map(cancellationFromServer))
}

export async function loadServerChanges (api: CoreApi): Promise<void> {
  const [requests, incidents, cancellations] = await Promise.all([api.core.listChangeRequests(), api.core.listIncidents(), api.core.listBookingCancellations()])
  mergeServerChanges(requests.data, incidents.data, cancellations.data)
}

/** A no-show / refunded booking status change recorded a cancellation on the server: pick it up. */
export async function refreshProjectCancellations (api: CoreApi, projectId: string): Promise<void> {
  try {
    for (const d of (await api.core.listBookingCancellations({ projectId })).data) { upsert(CANCELLATION_RECORDS, cancellationFromServer(d)) }
  } catch {
    // The changes sync brings it on the next load.
  }
}

/* Writes: the server answers with the new row; the project's activity log is refreshed (each step is logged there). */
async function afterRequest (api: CoreApi, d: ChangeRequestDto): Promise<ChangeRequest> {
  const request = upsertRequest(d)
  await refreshProjectActivities(api, request.projectId)
  return request
}
async function afterIncident (api: CoreApi, d: IncidentDto): Promise<Incident> {
  const incident = upsertIncident(d)
  await refreshProjectActivities(api, incident.projectId)
  return incident
}

export async function createChangeRequestOnServer (api: CoreApi, projectId: string, input: ChangeRequestInput, key: string = newIdempotencyKey()): Promise<ChangeRequest> {
  return afterRequest(api, (await api.core.createChangeRequest(projectId, input, key)).data)
}
export async function reviewChangeRequestOnServer (api: CoreApi, id: string): Promise<ChangeRequest> {
  return afterRequest(api, (await api.core.reviewChangeRequest(id)).data)
}
export async function approveChangeRequestOnServer (api: CoreApi, id: string, note?: string): Promise<ChangeRequest> {
  return afterRequest(api, (await api.core.approveChangeRequest(id, note)).data)
}
export async function rejectChangeRequestOnServer (api: CoreApi, id: string, reason: string): Promise<ChangeRequest> {
  return afterRequest(api, (await api.core.rejectChangeRequest(id, reason)).data)
}
export async function implementChangeRequestOnServer (api: CoreApi, id: string): Promise<ChangeRequest> {
  return afterRequest(api, (await api.core.implementChangeRequest(id)).data)
}

export async function createIncidentOnServer (api: CoreApi, projectId: string, input: IncidentInput, key: string = newIdempotencyKey()): Promise<Incident> {
  return afterIncident(api, (await api.core.createIncident(projectId, input, key)).data)
}
export async function changeIncidentStatusOnServer (api: CoreApi, id: string, to: string): Promise<Incident> {
  return afterIncident(api, (await api.core.changeIncidentStatus(id, to)).data)
}
export async function escalateIncidentOnServer (api: CoreApi, id: string, to: string, note?: string): Promise<Incident> {
  return afterIncident(api, (await api.core.escalateIncident(id, to, note)).data)
}
export async function addIncidentCommunicationOnServer (api: CoreApi, id: string, message: string): Promise<Incident> {
  return upsertIncident((await api.core.addIncidentCommunication(id, message)).data)
}
export async function resolveIncidentOnServer (api: CoreApi, id: string, note: string): Promise<Incident> {
  return afterIncident(api, (await api.core.resolveIncident(id, note)).data)
}

export interface ChangesSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads change requests, incidents and cancellations once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useChangesSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<ChangesSyncState>('manova-changes-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerChanges(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Change request & insiden belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}

/* ---------- S12b-2: staff send the impact to the client ---------- */

/** Which staff buttons a change request offers — the same rules the server enforces. */
export function staffChangeRequestActions (request: ChangeRequest) {
  const open = request.status === 'submitted' || request.status === 'under-review'
  const fromClient = request.source === 'client'
  const costs = (request.commercialImpactIdr ?? 0) > 0 || (request.cancellationFeeIdr ?? 0) > 0
  return {
    review: request.status === 'submitted',
    sendToClient: open && fromClient,
    // Waiting for the client: staff may record the client's approval given outside the portal (with a note).
    approve: (open && !(fromClient && costs)) || request.status === 'waiting-client-approval',
    reject: open || request.status === 'waiting-client-approval',
    implement: request.status === 'approved'
  }
}

export async function sendChangeRequestToClientOnServer (api: CoreApi, id: string, input: ChangeRequestImpactInput): Promise<ChangeRequest> {
  return afterRequest(api, (await api.core.sendChangeRequestToClient(id, input)).data)
}
