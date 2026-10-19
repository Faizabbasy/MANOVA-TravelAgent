import { describe, expect, it } from 'vitest'
import { FEEDBACK_RECORDS } from './feedback'
import { SUPPORT_TICKETS, SUPPORT_TICKET_REPLIES } from './support-tickets'
import { feedbackFromServer, mergeClientSupport, ticketFromServer } from './support-sync'
import type { FeedbackDto, SupportTicketDto } from '~/types/api'

const PARTY = 'PTY-005'
const ticket = (over: Partial<SupportTicketDto> = {}): SupportTicketDto => ({
  id: 'TCK-900',
  partyId: PARTY,
  partyName: 'PT Java Bhakti',
  projectId: 'PRJ-201',
  projectName: 'Korea Trip',
  category: 'operational',
  priority: 'high',
  status: 'in-progress',
  subject: 'Bus terlambat',
  description: 'Bus hari kedua',
  attachmentName: null,
  createdBy: 'USR-021',
  createdByName: 'Dimas',
  assignedTo: 'USR-002',
  assignedToName: 'Doni',
  resolutionNote: null,
  resolvedBy: null,
  resolvedAt: null,
  resolutionRating: null,
  ratingNote: null,
  reopenCount: 0,
  closedAt: null,
  createdAt: '2026-10-19T01:00:00.000Z',
  updatedAt: '2026-10-19T02:00:00.000Z',
  replies: [{ id: 'TCKR-900', ticketId: 'TCK-900', authorId: null, authorName: 'Doni', fromClient: false, message: 'Kami cek', attachmentName: null, createdAt: '2026-10-19T02:00:00.000Z' }],
  ...over
})
const feedback = (over: Partial<FeedbackDto> = {}): FeedbackDto => ({
  id: 'FBK-900',
  projectId: 'PRJ-203',
  projectName: 'Bali',
  partyId: PARTY,
  partyName: 'PT Java Bhakti',
  status: 'submitted',
  overallExperience: 5,
  recommendationScore: 9,
  salesResponsiveness: null,
  proposalQuality: null,
  itineraryQuality: null,
  hotelRating: 4,
  transportationRating: null,
  tourLeaderRating: null,
  operationSupportRating: null,
  reservationHandlingRating: null,
  communicationRating: null,
  issueResolutionRating: null,
  valueForMoneyRating: null,
  comment: 'Bagus',
  improvementSuggestion: null,
  testimonialConsent: true,
  submittedBy: 'USR-021',
  submittedByName: 'Dimas',
  submittedAt: '2026-10-19T03:00:00.000Z',
  acknowledgedBy: null,
  acknowledgedAt: null,
  followUpNote: null,
  closedAt: null,
  createdAt: '2026-10-19T03:00:00.000Z',
  ...over
})

describe('support & feedback sync (S12c-2)', () => {
  it('maps a server ticket to the local shape (party, handler name, reopen count)', () => {
    expect(ticketFromServer(ticket())).toMatchObject({ id: 'TCK-900', clientPartyId: PARTY, projectId: 'PRJ-201', status: 'in-progress', assignedTo: 'USR-002', assignedToName: 'Doni', reopenCount: 0 })
  })
  it('maps feedback scores, dropping empty ones', () => {
    const f = feedbackFromServer(feedback())
    expect(f).toMatchObject({ id: 'FBK-900', clientPartyId: PARTY, status: 'submitted', overallExperience: 5, recommendationScore: 9, hotelRating: 4, testimonialConsent: true })
    expect(f).not.toHaveProperty('proposalQuality')
  })
  it('the client party’s tickets, replies and feedback become the server’s; other parties keep theirs', () => {
    const otherTickets = SUPPORT_TICKETS.filter(t => t.clientPartyId !== PARTY).map(t => t.id)
    mergeClientSupport(PARTY, [ticket()], [feedback()])
    expect(SUPPORT_TICKETS.filter(t => t.clientPartyId === PARTY).map(t => t.id)).toEqual(['TCK-900'])
    expect(SUPPORT_TICKETS.filter(t => t.clientPartyId !== PARTY).map(t => t.id)).toEqual(otherTickets)
    expect(SUPPORT_TICKET_REPLIES.filter(r => r.ticketId === 'TCK-900').map(r => r.id)).toEqual(['TCKR-900'])
    expect(FEEDBACK_RECORDS.filter(f => f.clientPartyId === PARTY).map(f => f.id)).toEqual(['FBK-900'])
  })
})
