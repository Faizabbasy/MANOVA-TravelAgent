import { describe, expect, it } from 'vitest'
import { ACTIVITIES } from './activity'
import { activityDay, activityFromServer, approveChangeOnServer, mergeServerActivities, reloadProjectActivities, settleLinkedChangeOnServer } from './activity-sync'
import { CHANGE_REQUESTS, approveChangeRequest } from './index'
import type { ProjectActivityDto } from '~/types/api'

const dto = (over: Partial<ProjectActivityDto> = {}): ProjectActivityDto => ({
  id: 'CHG-1023',
  projectId: 'PRJ-102',
  message: 'Tambah hotel',
  isChange: true,
  reviewed: false,
  createdAt: '2026-07-20T02:00:00.000Z',
  category: 'service',
  reason: 'Tambah hotel',
  requestedBy: 'USR-002',
  beforeValue: null,
  afterValue: null,
  impactNote: null,
  approvalStatus: 'pending',
  approvedBy: null,
  actorUserId: 'USR-002',
  sourceAction: 'change.logged',
  ...over
})

describe('activity-sync', () => {
  it('maps the server entry to the local shape', () => {
    const a = activityFromServer(dto())
    expect(a).toMatchObject({ id: 'CHG-1023', category: 'service', approvalStatus: 'pending', requestedBy: 'USR-002' })
    expect(a.beforeValue).toBeUndefined()
    expect(activityFromServer(dto({ approvalStatus: null, category: null })).approvalStatus).toBeUndefined()
    // S8: an entry a change request opened is decided through the request; the screen needs to know.
    expect(activityFromServer(dto({ sourceAction: 'change_request.created' })).decidedByChangeRequest).toBe(true)
    expect(activityFromServer(dto()).decidedByChangeRequest).toBeFalsy()
  })

  it('merge keeps identity, drops server-gone entries, and keeps entries written locally (ACT-L / CHG-L)', () => {
    const before = ACTIVITIES.find(x => x.id === 'CHG-1023')!
    ACTIVITIES.push({ id: 'ACT-L001', projectId: 'PRJ-102', message: 'Insiden lokal', isChange: false, reviewed: true, createdAt: '2026-07-29' })
    mergeServerActivities([dto({ message: 'Dari server' })])
    expect(ACTIVITIES.map(x => x.id).sort()).toEqual(['ACT-L001', 'CHG-1023'])
    expect(ACTIVITIES.find(x => x.id === 'CHG-1023')).toBe(before)
    expect(before.message).toBe('Dari server')
  })

  it('a rejected approval leaves the local entry untouched; a project reload adds new server entries', async () => {
    mergeServerActivities([dto()])
    const api = {
      core: {
        approveProjectChange: () => Promise.reject(new Error('422')),
        listProjectActivities: (q: { projectId: string }) => Promise.resolve({ data: [dto(), dto({ id: 'ACT-2000', projectId: q.projectId, isChange: false, reviewed: true, approvalStatus: null })] })
      }
    } as never
    await expect(approveChangeOnServer(api, 'CHG-1023')).rejects.toThrow()
    expect(ACTIVITIES.find(x => x.id === 'CHG-1023')!.approvalStatus).toBe('pending')
    await reloadProjectActivities(api, 'PRJ-102')
    expect(ACTIVITIES.some(x => x.id === 'ACT-2000')).toBe(true)
  })
})

describe('change requests linked to a server change entry (S7d review)', () => {
  it('approving a change request does not decide a server-owned entry locally; the server is asked instead', async () => {
    mergeServerActivities([dto({ id: 'CHG-1023', approvalStatus: 'pending', reviewed: false })])
    const request = CHANGE_REQUESTS.find(r => r.activityEntryId === 'CHG-1023')!
    request.status = 'under-review'
    approveChangeRequest(request.id, 'USR-001')
    expect(ACTIVITIES.find(x => x.id === 'CHG-1023')!.approvalStatus).toBe('pending')
    const calls: string[] = []
    const api = { core: { approveProjectChange: (id: string) => { calls.push(id); return Promise.resolve({ data: dto({ id, approvalStatus: 'approved', reviewed: true }) }) } } } as never
    await settleLinkedChangeOnServer(api, 'CHG-1023', 'approved')
    await settleLinkedChangeOnServer(api, 'CHG-L001', 'approved')
    expect(calls).toEqual(['CHG-1023'])
    expect(ACTIVITIES.find(x => x.id === 'CHG-1023')!.approvalStatus).toBe('approved')
  })

  it('groups server timestamps and local dates by day', () => {
    expect(activityDay('2026-10-10T03:12:45.123Z')).toBe(activityDay('2026-10-10T05:00:00.000Z'))
    expect(activityDay('2026-07-29')).toBe('2026-07-29')
  })
})
