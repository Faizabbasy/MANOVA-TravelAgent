import { TASKS } from './activity'
import { PROJECT_MILESTONES } from './project-orders'
import { pushNotification } from './index'
import type { ProjectTask } from '~/types/activity'
import type { ProjectMilestone } from '~/types/project-order'
import type { MilestoneDto, MilestoneInput, TaskDto, TaskInput } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { newIdempotencyKey } from '~/lib/api/client'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `TASKS` and `PROJECT_MILESTONES` (S7c). The server owns project tasks and milestones; writes go to the
 * server first and its answer replaces the local object in place. Assignment notifications stay a local mock.
 */

type CoreApi = Pick<ManovaApi, 'core'>
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)

export function taskFromServer (d: TaskDto): ProjectTask {
  return {
    id: d.id,
    projectId: opt(d.projectId),
    title: d.title,
    status: d.status,
    dueAt: opt(d.dueAt),
    isMilestone: d.isMilestone,
    dependsOnTaskId: opt(d.dependsOnTaskId),
    assignedTo: opt(d.assignedTo),
    isBlocked: d.isBlocked,
    blockedReason: opt(d.blockedReason)
  }
}

export function milestoneFromServer (d: MilestoneDto): ProjectMilestone {
  return {
    id: d.id,
    projectId: d.projectId,
    stepKey: opt(d.stepKey),
    name: d.name,
    plannedDate: d.plannedDate,
    actualDate: opt(d.actualDate),
    ownerId: opt(d.ownerId),
    status: d.status,
    note: opt(d.note),
    deliverables: d.deliverables.map(x => ({ ...x })),
    budgetIdr: d.budgetMinor === null ? undefined : Number(d.budgetMinor)
  }
}

function upsert<T extends { id: string }> (list: T[], value: T): T {
  const local = list.find(x => x.id === value.id)
  if (!local) {
    list.push(value)
    return list[list.length - 1]!
  }
  Object.assign(local, value)
  return local
}

function replaceAll<T extends { id: string }> (list: T[], values: T[]) {
  const keep = new Set(values.map(v => v.id))
  for (let i = list.length - 1; i >= 0; i--) {
    if (!keep.has(list[i]!.id)) { list.splice(i, 1) }
  }
  for (const v of values) { upsert(list, v) }
}

const upsertTask = (d: TaskDto) => upsert(TASKS, taskFromServer(d))
const upsertMilestone = (d: MilestoneDto) => upsert(PROJECT_MILESTONES, milestoneFromServer(d))

export function mergeServerWorkItems (tasks: TaskDto[], milestones: MilestoneDto[]): void {
  replaceAll(TASKS, tasks.map(taskFromServer))
  replaceAll(PROJECT_MILESTONES, milestones.map(milestoneFromServer))
}

export async function loadServerWorkItems (api: CoreApi): Promise<void> {
  const [tasks, milestones] = await Promise.all([api.core.listTasks(), api.core.listMilestones()])
  mergeServerWorkItems(tasks.data, milestones.data)
}

/** Replace one project's milestones locally with the server's list (template applied, project just created). */
function setProjectMilestones (projectId: string, list: MilestoneDto[]) {
  for (let i = PROJECT_MILESTONES.length - 1; i >= 0; i--) {
    if (PROJECT_MILESTONES[i]!.projectId === projectId) { PROJECT_MILESTONES.splice(i, 1) }
  }
  for (const d of list) { upsertMilestone(d) }
}

/** A new project's default milestones are created by the server (S7c): load them after the project is created. */
export async function reloadProjectMilestones (api: CoreApi, projectId: string): Promise<void> {
  setProjectMilestones(projectId, (await api.core.listMilestones({ projectId })).data)
}

function notifyAssignee (task: ProjectTask, previousAssignee?: string) {
  if (task.assignedTo && task.assignedTo !== previousAssignee) {
    pushNotification(task.assignedTo, 'assignment', 'Anda ditugaskan pada task baru', `Task "${task.title}" ditugaskan kepada Anda.`, 'project', task.projectId)
  }
}

export async function createTaskOnServer (api: CoreApi, input: TaskInput & { title: string }, key: string = newIdempotencyKey()): Promise<ProjectTask> {
  const task = upsertTask((await api.core.createTask(input, key)).data)
  notifyAssignee(task)
  return task
}
export async function updateTaskOnServer (api: CoreApi, id: string, input: TaskInput): Promise<ProjectTask> {
  const previous = TASKS.find(x => x.id === id)?.assignedTo
  const task = upsertTask((await api.core.updateTask(id, input)).data)
  notifyAssignee(task, previous)
  return task
}
export async function blockTaskOnServer (api: CoreApi, id: string, reason: string): Promise<ProjectTask> {
  return upsertTask((await api.core.blockTask(id, reason)).data)
}
export async function unblockTaskOnServer (api: CoreApi, id: string): Promise<ProjectTask> {
  return upsertTask((await api.core.unblockTask(id)).data)
}

export async function createMilestoneOnServer (api: CoreApi, projectId: string, input: MilestoneInput & { name: string; plannedDate: string }, key: string = newIdempotencyKey()): Promise<ProjectMilestone> {
  return upsertMilestone((await api.core.createMilestone(projectId, input, key)).data)
}
export async function updateMilestoneOnServer (api: CoreApi, id: string, input: MilestoneInput): Promise<ProjectMilestone> {
  return upsertMilestone((await api.core.updateMilestone(id, input)).data)
}
export async function completeMilestoneOnServer (api: CoreApi, id: string): Promise<ProjectMilestone> {
  return upsertMilestone((await api.core.completeMilestone(id)).data)
}
export async function addDeliverableOnServer (api: CoreApi, id: string, label: string): Promise<ProjectMilestone> {
  return upsertMilestone((await api.core.addMilestoneDeliverable(id, label)).data)
}
export async function setDeliverableDoneOnServer (api: CoreApi, id: string, deliverableId: string, done: boolean): Promise<ProjectMilestone> {
  return upsertMilestone((await api.core.setMilestoneDeliverableDone(id, deliverableId, done)).data)
}
export async function removeDeliverableOnServer (api: CoreApi, id: string, deliverableId: string): Promise<ProjectMilestone> {
  return upsertMilestone((await api.core.removeMilestoneDeliverable(id, deliverableId)).data)
}
export async function replaceMilestonesOnServer (api: CoreApi, projectId: string, milestones: { name: string; plannedDate: string; stepKey?: string }[]): Promise<ProjectMilestone[]> {
  const list = (await api.core.replaceMilestones(projectId, milestones)).data
  setProjectMilestones(projectId, list)
  return PROJECT_MILESTONES.filter(x => x.projectId === projectId)
}

export interface WorkItemsSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads tasks and milestones once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useWorkItemsSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<WorkItemsSyncState>('manova-work-items-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerWorkItems(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Task & milestone belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
