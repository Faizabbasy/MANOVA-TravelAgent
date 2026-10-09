import { describe, expect, it } from 'vitest'
import { TASKS } from './activity'
import { PROJECT_MILESTONES } from './project-orders'
import {
  createTaskOnServer, mergeServerWorkItems, milestoneFromServer, replaceMilestonesOnServer, taskFromServer, updateTaskOnServer
} from './work-items-sync'
import { NOTIFICATION_RECORDS as NOTIFICATIONS } from './index'
import type { MilestoneDto, TaskDto } from '~/types/api'

const task = (over: Partial<TaskDto> = {}): TaskDto => ({
  id: 'TSK-1011',
  projectId: 'PRJ-101',
  title: 'Konfirmasi manifest penumpang',
  status: 'done',
  dueAt: null,
  isMilestone: false,
  dependsOnTaskId: null,
  assignedTo: 'USR-002',
  isBlocked: false,
  blockedReason: null,
  ...over
})
const milestone = (over: Partial<MilestoneDto> = {}): MilestoneDto => ({
  id: 'PMS-101-1',
  projectId: 'PRJ-101',
  stepKey: 'drafting',
  name: 'SPK / Handover Diterima',
  plannedDate: '2026-06-10',
  actualDate: null,
  ownerId: null,
  status: 'not-started',
  note: null,
  budgetMinor: null,
  deliverables: [],
  ...over
})

describe('work-items-sync', () => {
  it('maps server tasks and milestones to the local shape', () => {
    expect(taskFromServer(task({ projectId: null, dueAt: '2026-08-01' }))).toMatchObject({ projectId: undefined, dueAt: '2026-08-01', isBlocked: false })
    expect(taskFromServer(task()).blockedReason).toBeUndefined()
    const m = milestoneFromServer(milestone({ budgetMinor: '2000000', deliverables: [{ id: 'PMD-1', label: 'SPK', done: true }] }))
    expect(m).toMatchObject({ budgetIdr: 2000000, deliverables: [{ id: 'PMD-1', label: 'SPK', done: true }] })
    expect(m.actualDate).toBeUndefined()
  })

  it('merge keeps object identity and drops items the server no longer has', () => {
    const t = TASKS.find(x => x.id === 'TSK-1011')!
    const m = PROJECT_MILESTONES.find(x => x.id === 'PMS-101-1')!
    mergeServerWorkItems([task({ title: 'Judul Server' })], [milestone({ name: 'Nama Server' })])
    expect(TASKS).toHaveLength(1)
    expect(TASKS[0]).toBe(t)
    expect(t.title).toBe('Judul Server')
    expect(PROJECT_MILESTONES).toHaveLength(1)
    expect(PROJECT_MILESTONES[0]).toBe(m)
    expect(m.name).toBe('Nama Server')
  })

  it('a created task notifies its assignee; a rejected update leaves the local task untouched', async () => {
    mergeServerWorkItems([task()], [])
    const before = NOTIFICATIONS.length
    const api = {
      core: {
        createTask: (input: { title: string }) => Promise.resolve({ data: task({ id: 'TSK-2000', title: input.title, assignedTo: 'USR-003' }) }),
        updateTask: () => Promise.reject(new Error('422'))
      }
    } as never
    await createTaskOnServer(api, { projectId: 'PRJ-101', title: 'Baru', assignedTo: 'USR-003' })
    expect(TASKS.some(x => x.id === 'TSK-2000')).toBe(true)
    expect(NOTIFICATIONS.length).toBe(before + 1)
    await expect(updateTaskOnServer(api, 'TSK-1011', { title: 'Gagal' })).rejects.toThrow()
    expect(TASKS.find(x => x.id === 'TSK-1011')!.title).toBe('Konfirmasi manifest penumpang')
  })

  it('replace swaps the milestones of that project only', async () => {
    mergeServerWorkItems([], [milestone(), milestone({ id: 'PMS-102-1', projectId: 'PRJ-102' })])
    const api = { core: { replaceMilestones: () => Promise.resolve({ data: [milestone({ id: 'PMS-900', name: 'Kickoff' })] }) } } as never
    await replaceMilestonesOnServer(api, 'PRJ-101', [{ name: 'Kickoff', plannedDate: '2026-11-01' }])
    expect(PROJECT_MILESTONES.map(x => x.id).sort()).toEqual(['PMS-102-1', 'PMS-900'])
  })
})
