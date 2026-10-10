import { describe, expect, it } from 'vitest'
import { ACTIVITIES } from './activity'
import { activityFromServer, approveChangeOnServer, mergeServerActivities, reloadProjectActivities } from './activity-sync'
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
