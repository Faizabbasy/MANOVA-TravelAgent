import { describe, expect, it } from 'vitest'
import { CLIENT_APPROVALS } from './client-approvals'
import { TRAVEL_REQUESTS, TRAVEL_REQUEST_ACTIVITIES } from './travel-requests'
import { approvalFromServer, clientDecideApprovalOnServer, clientSubmitTravelRequestOnServer, mergeClientRequests, travelRequestFromServer } from './client-requests-sync'
import type { ManovaApi } from '~/lib/api/endpoints'
import type { ClientApprovalDto, TravelRequestDto } from '~/types/api'

const PARTY = 'PTY-005'
const ok = <T>(data: T) => Promise.resolve({ data })
const apiWith = (core: Record<string, unknown>) => ({ core } as unknown as Pick<ManovaApi, 'core'>)

const request = (over: Partial<TravelRequestDto> = {}): TravelRequestDto => ({
  id: 'TRQ-900',
  partyId: PARTY,
  partyName: 'PT Java Bhakti',
  requestName: 'Outing Bali',
  contactPersonId: null,
  tripType: null,
  purpose: 'Gathering',
  destination: 'Bali',
  travelStartDate: '2026-12-01',
  travelEndDate: null,
  dateFlexible: false,
  estimatedParticipants: 30,
  estimatedBudgetIdr: null,
  currency: 'IDR',
  serviceScope: ['hotel'],
  flightRequirement: null,
  hotelRequirement: { starRating: '4' },
  transportationRequirement: null,
  miceRequirement: null,
  additionalServicesNote: null,
  status: 'need-clarification',
  reviewerUserId: null,
  reviewerName: 'Doni',
  clarificationNote: 'Berapa kamar?',
  leadId: null,
  cancelReason: null,
  closeReason: null,
  createdBy: 'USR-021',
  submittedAt: '2026-10-19T01:00:00.000Z',
  createdAt: '2026-10-19T00:00:00.000Z',
  updatedAt: '2026-10-19T02:00:00.000Z',
  activities: [{ id: 'TRQA-900', actorId: null, actorName: 'Doni', fromClient: false, message: 'Butuh klarifikasi: Berapa kamar?', createdAt: '2026-10-19T02:00:00.000Z' }],
  ...over
})
const approval = (over: Partial<ClientApprovalDto> = {}): ClientApprovalDto => ({
  id: 'CAP-900',
  projectId: 'PRJ-201',
  projectName: 'Korea',
  partyId: PARTY,
  entityType: 'rooming-list',
  title: 'Rooming list final',
  description: null,
  amountIdr: null,
  status: 'pending',
  requestedBy: null,
  requestedByName: 'Doni',
  requestedAt: '2026-10-19T00:00:00.000Z',
  expiresOn: '2026-10-30',
  decidedBy: null,
  decidedByName: null,
  decidedAt: null,
  decisionComment: null,
  reason: null,
  ...over
})

describe('client travel requests & approvals sync (S12c-3)', () => {
  it('maps a server travel request (nulls dropped, clarification kept)', () => {
    const r = travelRequestFromServer(request())
    expect(r).toMatchObject({ id: 'TRQ-900', clientPartyId: PARTY, status: 'need-clarification', clarificationNote: 'Berapa kamar?', hotelRequirement: { starRating: '4' }, reviewerName: 'Doni' })
    expect(r).not.toHaveProperty('travelEndDate')
    expect(r).not.toHaveProperty('flightRequirement')
  })

  it('maps an approval (decision from the status, expiry date)', () => {
    expect(approvalFromServer(approval({ status: 'revision-requested', reason: 'Mahal', decidedAt: '2026-10-20T00:00:00.000Z' })))
      .toMatchObject({ id: 'CAP-900', clientPartyId: PARTY, title: 'Rooming list final', status: 'revision-requested', decision: 'request-revision', reason: 'Mahal', expiresAt: '2026-10-30' })
  })

  it('the party’s requests, activities and approvals become the server’s', () => {
    mergeClientRequests(PARTY, [request()], [approval()])
    expect(TRAVEL_REQUESTS.filter(r => r.clientPartyId === PARTY).map(r => r.id)).toEqual(['TRQ-900'])
    expect(TRAVEL_REQUEST_ACTIVITIES.filter(a => a.travelRequestId === 'TRQ-900').map(a => a.actorName)).toEqual(['Doni'])
    expect(CLIENT_APPROVALS.filter(a => a.clientPartyId === PARTY).map(a => a.id)).toEqual(['CAP-900'])
  })

  it('writes change the lists only with the server’s answer', async () => {
    mergeClientRequests(PARTY, [request({ status: 'draft' })], [approval()])
    await expect(clientSubmitTravelRequestOnServer(apiWith({ clientSubmitTravelRequest: () => Promise.reject(new Error('400')) }), 'TRQ-900')).rejects.toThrow()
    expect(TRAVEL_REQUESTS.find(r => r.id === 'TRQ-900')?.status).toBe('draft')
    await clientSubmitTravelRequestOnServer(apiWith({ clientSubmitTravelRequest: () => ok(request({ status: 'submitted' })) }), 'TRQ-900')
    expect(TRAVEL_REQUESTS.find(r => r.id === 'TRQ-900')?.status).toBe('submitted')
    await clientDecideApprovalOnServer(apiWith({ clientDecideApproval: () => ok(approval({ status: 'approved', decisionComment: 'OK' })) }), 'CAP-900', 'approve', { comment: 'OK' })
    expect(CLIENT_APPROVALS.find(a => a.id === 'CAP-900')).toMatchObject({ status: 'approved', decision: 'approve', comment: 'OK' })
  })
})
