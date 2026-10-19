import type { FeedbackStatus } from '~/types/feedback'
import type { SupportTicketStatus } from '~/types/support'

/** S12c-2: what staff may do with a ticket or a feedback in each status — mirrors the server's transitions. */
const OPEN: SupportTicketStatus[] = ['open', 'assigned', 'in-progress', 'waiting-for-client', 'reopened']
const MOVABLE: ('in-progress' | 'waiting-for-client')[] = ['in-progress', 'waiting-for-client']

export const isOpenTicket = (status: SupportTicketStatus) => OPEN.includes(status)

export function ticketActions (status: SupportTicketStatus) {
  const open = isOpenTicket(status)
  return {
    assign: open,
    moveTo: open ? MOVABLE.filter(to => to !== status) : [],
    resolve: open,
    close: status === 'resolved',
    reply: status !== 'closed',
    internalNote: true
  }
}

export function feedbackActions (status: FeedbackStatus) {
  return {
    acknowledge: status === 'submitted',
    followUp: status === 'submitted' || status === 'acknowledged',
    close: status === 'submitted' || status === 'acknowledged' || status === 'follow-up-required'
  }
}

export function inboxSummary (tickets: { status: SupportTicketStatus; assignedTo?: string }[], userId: string) {
  const open = tickets.filter(t => isOpenTicket(t.status))
  return {
    open: open.length,
    unassigned: open.filter(t => !t.assignedTo).length,
    mine: open.filter(t => t.assignedTo === userId).length,
    resolved: tickets.filter(t => t.status === 'resolved').length
  }
}

/** The client portal page a support-ticket notification opens. */
export const clientSupportRoute = (entityType?: string, entityId?: string) =>
  (entityType === 'support-ticket' && entityId ? `/client/support/${entityId}` : undefined)
