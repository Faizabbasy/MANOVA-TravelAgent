import { describe, expect, it } from 'vitest'
import { CANCELLATION_RECORDS, CHANGE_REQUESTS, INCIDENTS } from './change-incident'
import {
  approveChangeRequestOnServer, cancellationFromServer, changeRequestFromServer, incidentFromServer, mergeServerChanges
} from './changes-sync'
import type { BookingCancellationDto, ChangeRequestDto, IncidentDto } from '~/types/api'

const cr = (over: Partial<ChangeRequestDto> = {}): ChangeRequestDto => ({
  id: 'CR-002',
  projectId: 'PRJ-102',
  source: 'client',
  requestedBy: 'USR-002',
  submittedAt: '2026-07-10T02:00:00.000Z',
  affectedEntities: [{ entityType: 'project', entityId: 'PRJ-102' }],
  beforeSummary: 'Deluxe',
  afterSummary: 'Suite',
  operationalImpact: null,
  commercialImpactMinor: '25000000',
  financialImpactNote: null,
  timelineImpactNote: null,
  status: 'under-review',
  decidedBy: null,
  decidedAt: null,
  rejectionReason: null,
  implementedAt: null,
  activityId: 'CHG-1023',
  ...over
})
const inc = (over: Partial<IncidentDto> = {}): IncidentDto => ({
  id: 'INC-003',
  projectId: 'PRJ-103',
  bookingType: null,
  bookingId: null,
  title: 'Hujan',
  description: 'Hujan deras',
  severity: 'medium',
  ownerId: 'USR-002',
  status: 'open',
  escalatedTo: null,
  communicationLog: [],
  resolutionNote: null,
  resolvedAt: null,
  createdAt: '2026-07-20T02:00:00.000Z',
  ...over
})
const cnx = (over: Partial<BookingCancellationDto> = {}): BookingCancellationDto => ({
  id: 'CNX-004',
  projectId: 'PRJ-204',
  bookingType: 'transport',
  bookingId: 'TRN-2041',
  outcome: 'no-show',
  reason: 'Tidak datang',
  penaltyMinor: '750000',
  refundEligible: false,
  cancelledBy: 'USR-002',
  cancelledOn: '2026-10-11',
  ...over
})

describe('changes-sync', () => {
  it('maps server change requests, incidents and cancellations to the local shapes', () => {
    expect(changeRequestFromServer(cr({ decidedBy: 'USR-003', decidedAt: '2026-07-12T02:00:00.000Z' }))).toMatchObject({
      commercialImpactIdr: 25000000, approvedBy: 'USR-003', approvedAt: '2026-07-12T02:00:00.000Z', activityEntryId: 'CHG-1023'
    })
    expect(incidentFromServer(inc()).bookingType).toBeUndefined()
    expect(cancellationFromServer(cnx())).toMatchObject({ penaltyIdr: 750000, cancelledAt: '2026-10-11', bookingType: 'transport', outcome: 'no-show' })
  })

  it('merge keeps identity, drops server-gone rows, and keeps client-portal requests written locally (CR-L)', () => {
    const before = CHANGE_REQUESTS.find(x => x.id === 'CR-002')!
    CHANGE_REQUESTS.push({ ...before, id: 'CR-L001' })
    mergeServerChanges([cr({ afterSummary: 'Suite Server' })], [inc()], [cnx()])
    expect(CHANGE_REQUESTS.map(x => x.id).sort()).toEqual(['CR-002', 'CR-L001'])
    expect(CHANGE_REQUESTS.find(x => x.id === 'CR-002')).toBe(before)
    expect(before.afterSummary).toBe('Suite Server')
    expect(INCIDENTS.map(x => x.id)).toEqual(['INC-003'])
    expect(CANCELLATION_RECORDS.map(x => x.id)).toEqual(['CNX-004'])
  })

  it('a refused approval leaves the local request untouched', async () => {
    mergeServerChanges([cr()], [], [])
    const api = { core: { approveChangeRequest: () => Promise.reject(new Error('422')) } } as never
    await expect(approveChangeRequestOnServer(api, 'CR-002')).rejects.toThrow()
    expect(CHANGE_REQUESTS.find(x => x.id === 'CR-002')!.status).toBe('under-review')
  })
})
