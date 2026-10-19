import { FEEDBACK_RECORDS } from './feedback'
import { SUPPORT_TICKETS, SUPPORT_TICKET_REPLIES } from './support-tickets'
import type { Feedback } from '~/types/feedback'
import type { SupportTicket, SupportTicketReply } from '~/types/support'
import type { FeedbackDto, FeedbackInput, SupportTicketDto, SupportTicketInput, SupportTicketReplyDto } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { isApiError } from '~/lib/api/errors'

/**
 * Support tickets and trip feedback from the server (S12c-2). The client portal loads its own party's tickets (without
 * internal notes) and feedback; every write goes to /client/* first and only the server's answer changes the lists.
 * Staff screens load their own data (inbox, CRM feedback panel) and use the mappers below.
 */

type CoreApi = Pick<ManovaApi, 'core'>
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

export const replyFromServer = (d: SupportTicketReplyDto): SupportTicketReply => clean({
  id: d.id,
  ticketId: d.ticketId,
  authorId: d.authorId ?? '',
  message: d.message,
  createdAt: d.createdAt,
  attachmentName: opt(d.attachmentName),
  authorName: opt(d.authorName),
  fromClient: d.fromClient,
  internal: d.internal
})

export const ticketFromServer = (d: SupportTicketDto): SupportTicket => clean({
  id: d.id,
  clientPartyId: d.partyId,
  projectId: opt(d.projectId),
  projectName: opt(d.projectName),
  category: d.category,
  priority: d.priority,
  status: d.status,
  subject: d.subject,
  description: d.description,
  createdAt: d.createdAt,
  createdBy: d.createdBy,
  assignedTo: opt(d.assignedTo),
  assignedToName: opt(d.assignedToName),
  attachmentName: opt(d.attachmentName),
  resolutionNote: opt(d.resolutionNote),
  resolvedAt: opt(d.resolvedAt),
  resolutionRating: opt(d.resolutionRating),
  ratingNote: opt(d.ratingNote),
  reopenCount: d.reopenCount,
  closedAt: opt(d.closedAt)
})

const SCORE_FIELDS = ['overallExperience', 'recommendationScore', 'salesResponsiveness', 'proposalQuality', 'itineraryQuality', 'hotelRating', 'transportationRating',
  'tourLeaderRating', 'operationSupportRating', 'reservationHandlingRating', 'communicationRating', 'issueResolutionRating', 'valueForMoneyRating'] as const

export const feedbackFromServer = (d: FeedbackDto): Feedback => clean({
  id: d.id,
  projectId: d.projectId,
  projectName: d.projectName,
  clientPartyId: d.partyId,
  status: d.status,
  ...Object.fromEntries(SCORE_FIELDS.map(field => [field, opt(d[field])])),
  comment: opt(d.comment),
  improvementSuggestion: opt(d.improvementSuggestion),
  testimonialConsent: d.testimonialConsent,
  submittedBy: opt(d.submittedBy),
  createdAt: d.createdAt,
  submittedAt: opt(d.submittedAt),
  acknowledgedAt: opt(d.acknowledgedAt),
  acknowledgedBy: opt(d.acknowledgedBy),
  followUpNote: opt(d.followUpNote),
  closedAt: opt(d.closedAt)
}) as Feedback

const upsert = <T extends { id: string }>(list: T[], row: T): T => {
  const i = list.findIndex(x => x.id === row.id)
  if (i === -1) { list.push(row) } else { list.splice(i, 1, row) }
  return list[i === -1 ? list.length - 1 : i]!
}

/** One server ticket into the local lists (its replies replace the ticket's local replies). */
export function upsertServerTicket (d: SupportTicketDto): SupportTicket {
  const ticket = upsert(SUPPORT_TICKETS, ticketFromServer(d))
  for (let i = SUPPORT_TICKET_REPLIES.length - 1; i >= 0; i--) {
    if (SUPPORT_TICKET_REPLIES[i]!.ticketId === d.id) { SUPPORT_TICKET_REPLIES.splice(i, 1) }
  }
  SUPPORT_TICKET_REPLIES.push(...d.replies.map(replyFromServer))
  return ticket
}

export const upsertServerFeedback = (d: FeedbackDto): Feedback => upsert(FEEDBACK_RECORDS, feedbackFromServer(d))

/** The client party's tickets (with replies) and feedback become the server's; other parties' stay as they are. */
export function mergeClientSupport (partyId: string, tickets: SupportTicketDto[], feedback: FeedbackDto[]): void {
  const old = new Set(SUPPORT_TICKETS.filter(t => t.clientPartyId === partyId).map(t => t.id))
  for (let i = SUPPORT_TICKETS.length - 1; i >= 0; i--) {
    if (old.has(SUPPORT_TICKETS[i]!.id)) { SUPPORT_TICKETS.splice(i, 1) }
  }
  for (let i = SUPPORT_TICKET_REPLIES.length - 1; i >= 0; i--) {
    if (old.has(SUPPORT_TICKET_REPLIES[i]!.ticketId)) { SUPPORT_TICKET_REPLIES.splice(i, 1) }
  }
  for (const t of tickets) { upsertServerTicket(t) }
  for (let i = FEEDBACK_RECORDS.length - 1; i >= 0; i--) {
    if (FEEDBACK_RECORDS[i]!.clientPartyId === partyId) { FEEDBACK_RECORDS.splice(i, 1) }
  }
  FEEDBACK_RECORDS.push(...feedback.map(feedbackFromServer))
}

/* ---------- client writes ---------- */

export const clientCreateTicket = async (api: CoreApi, input: SupportTicketInput) => upsertServerTicket((await api.core.clientCreateSupportTicket(input)).data)
export const clientReplyTicket = async (api: CoreApi, id: string, message: string, attachmentName?: string) =>
  upsertServerTicket((await api.core.clientReplySupportTicket(id, { message, ...(attachmentName ? { attachmentName } : {}) })).data)
export const clientConfirmTicket = async (api: CoreApi, id: string) => upsertServerTicket((await api.core.clientConfirmSupportTicket(id)).data)
export const clientReopenTicket = async (api: CoreApi, id: string, reason: string) => upsertServerTicket((await api.core.clientReopenSupportTicket(id, reason)).data)
export const clientRateTicket = async (api: CoreApi, id: string, rating: number, note?: string) =>
  upsertServerTicket((await api.core.clientRateSupportTicket(id, { rating, ...(note ? { note } : {}) })).data)
export const clientSaveFeedback = async (api: CoreApi, projectId: string, input: FeedbackInput) => upsertServerFeedback((await api.core.clientSaveFeedback(projectId, input)).data)
export const clientSubmitFeedback = async (api: CoreApi, projectId: string) => upsertServerFeedback((await api.core.clientSubmitFeedback(projectId)).data)

/* ---------- loading (client) ---------- */

export async function loadClientSupport (api: CoreApi, partyId: string): Promise<void> {
  const [tickets, feedback] = await Promise.all([api.core.listClientSupportTickets(), api.core.listClientFeedback()])
  mergeClientSupport(partyId, tickets.data, feedback.data)
}

export interface ClientSupportSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads the client portal's support tickets and trip feedback once per signed-in client. */
export function useClientSupportSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<ClientSupportSyncState>('manova-client-support-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const user = currentUser.value
    if (user.role !== 'client' || !user.clientPartyId) { return }
    if (!force && state.value.userId === user.id && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId: user.id, message: null }
    try {
      await session.ensure()
      await loadClientSupport(api, user.clientPartyId)
      state.value = { status: 'ready', userId: user.id, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId: user.id, message: isApiError(error) ? error.message : 'Tiket support & feedback belum bisa dimuat.' }
    }
  }

  return { state, load }
}
