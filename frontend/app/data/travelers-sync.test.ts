import { describe, expect, it } from 'vitest'
import { ROOM_ASSIGNMENTS, TRAVELERS, TRAVELER_GROUPS } from './projects'
import { deleteTravelerOnServer, importTravelersOnServer, mergeServerTravelers, reloadTravelersAfterOrderChange, travelerFromServer } from './travelers-sync'
import type { TravelerDto } from '~/types/api'

const dto = (over: Partial<TravelerDto> = {}): TravelerDto => ({
  id: 'TRV-1011',
  projectId: 'PRJ-101',
  groupId: null,
  partyId: null,
  leadId: null,
  salesOrderId: null,
  name: 'Hendra Wijaya',
  passportNumber: 'B1234561',
  passportExpiryDate: '2029-04-10',
  idNumber: null,
  visaNumber: null,
  visaExpiryDate: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  specialRequest: null,
  dietaryRestrictions: null,
  accessibilityNeeds: null,
  companionOfTravelerId: null,
  documentsVerifiedOn: '2026-07-15',
  documentsVerifiedBy: 'USR-002',
  isVip: false,
  cancelled: false,
  cancelReason: null,
  replacedByTravelerId: null,
  replacesTravelerId: null,
  ...over
})

describe('travelers-sync', () => {
  it('maps the server traveler to the local shape', () => {
    expect(travelerFromServer(dto())).toMatchObject({ id: 'TRV-1011', projectId: 'PRJ-101', passportNumber: 'B1234561', documentsVerifiedAt: '2026-07-15', documentsVerifiedBy: 'USR-002' })
    expect(travelerFromServer(dto()).groupId).toBeUndefined()
  })

  it('merge replaces travelers, groups and rooms in place', () => {
    const before = TRAVELERS.find(x => x.id === 'TRV-1011')!
    mergeServerTravelers([dto({ name: 'Nama Baru' })], [{ id: 'GRP-001', projectId: 'PRJ-103', name: 'Management', paxCount: 10, roomingNote: null }], [])
    expect(TRAVELERS).toHaveLength(1)
    expect(TRAVELERS[0]).toBe(before)
    expect(TRAVELERS[0]!.name).toBe('Nama Baru')
    expect(TRAVELER_GROUPS.map(g => g.id)).toEqual(['GRP-001'])
    expect(ROOM_ASSIGNMENTS).toHaveLength(0)
  })

  it('delete removes the traveler locally after the server answered; import adds the created rows', async () => {
    mergeServerTravelers([dto()], [], [{ id: 'ROOM-001', projectId: 'PRJ-101', groupId: 'GRP-001', roomLabel: 'Twin', roomType: 'twin', travelerIds: ['TRV-1011'] }])
    const api = {
      core: {
        deleteTraveler: () => Promise.resolve({ data: { id: 'TRV-1011', deleted: true } }),
        importTravelers: () => Promise.resolve({ data: { created: [dto({ id: 'TRV-2000', name: 'Impor' })], rejected: [{ index: 1, errors: ['Nama kosong'] }] } })
      }
    } as never
    await deleteTravelerOnServer(api, 'TRV-1011')
    expect(TRAVELERS.some(x => x.id === 'TRV-1011')).toBe(false)
    expect(ROOM_ASSIGNMENTS[0]!.travelerIds).toEqual([])
    const res = await importTravelersOnServer(api, 'PRJ-101', [{ name: 'Impor' }, { name: '' }])
    expect(res.created.map(x => x.id)).toEqual(['TRV-2000'])
    expect(res.rejected).toHaveLength(1)
    expect(TRAVELERS.some(x => x.id === 'TRV-2000')).toBe(true)
  })
})

describe('travelers follow their sales order', () => {
  it('a cancelled Group Trip order reloads its project participants; other changes do not', async () => {
    mergeServerTravelers([dto({ id: 'TRV-2051', projectId: 'PRJ-205', salesOrderId: 'SLO-006' })], [], [])
    const calls: string[] = []
    const api = {
      core: {
        listTravelers: (q: { projectId: string }) => { calls.push(q.projectId); return Promise.resolve({ data: [dto({ id: 'TRV-2051', projectId: 'PRJ-205', salesOrderId: 'SLO-006', cancelled: true, cancelReason: 'Order dibatalkan' })] }) },
        listRoomAssignments: () => Promise.resolve({ data: [] })
      }
    } as never
    await reloadTravelersAfterOrderChange(api, { status: 'paid', projectId: 'PRJ-205' })
    await reloadTravelersAfterOrderChange(api, { status: 'cancelled', projectId: undefined })
    expect(calls).toEqual([])
    await reloadTravelersAfterOrderChange(api, { status: 'cancelled', projectId: 'PRJ-205' })
    expect(calls).toEqual(['PRJ-205'])
    expect(TRAVELERS.find(x => x.id === 'TRV-2051')!.cancelled).toBe(true)
  })
})
