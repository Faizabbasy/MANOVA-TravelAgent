import { ACTIVITIES } from './activity'
import type { ActivityEntry } from '~/types/activity'
import type { ProjectActivityDto, ProjectChangeInput } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { newIdempotencyKey } from '~/lib/api/client'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `ACTIVITIES` (S7d). The server owns the project activity log: changes logged by hand (approve/reject) and
 * the entries its own actions write (booking status, service marked changed, duplicate booking, service order status,
 * lead Won). Modules that are still local (change requests, incidents, …) keep writing `ACT-L…` / `CHG-L…` entries,
 * which a server merge leaves alone.
 */

type CoreApi = Pick<ManovaApi, 'core'>
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)
const isLocalEntry = (id: string) => /^(ACT|CHG)-L/.test(id)

export function activityFromServer (d: ProjectActivityDto): ActivityEntry {
  return {
    id: d.id,
    projectId: d.projectId,
    message: d.message,
    isChange: d.isChange,
    reviewed: d.reviewed,
    createdAt: d.createdAt,
    category: opt(d.category),
    reason: opt(d.reason),
    requestedBy: opt(d.requestedBy),
    beforeValue: opt(d.beforeValue),
    afterValue: opt(d.afterValue),
    impactNote: opt(d.impactNote),
    approvalStatus: opt(d.approvalStatus),
    approvedBy: opt(d.approvedBy)
  }
}

function upsert (d: ProjectActivityDto): ActivityEntry {
  const value = activityFromServer(d)
  const local = ACTIVITIES.find(x => x.id === value.id)
  if (!local) {
    ACTIVITIES.push(value)
    return ACTIVITIES[ACTIVITIES.length - 1]!
  }
  Object.assign(local, value)
  return local
}

export function mergeServerActivities (list: ProjectActivityDto[]): void {
  const keep = new Set(list.map(x => x.id))
  for (let i = ACTIVITIES.length - 1; i >= 0; i--) {
    const id = ACTIVITIES[i]!.id
    if (!keep.has(id) && !isLocalEntry(id)) { ACTIVITIES.splice(i, 1) }
  }
  for (const d of list) { upsert(d) }
}

export async function loadServerActivities (api: CoreApi): Promise<void> {
  mergeServerActivities((await api.core.listProjectActivities()).data)
}

/** A server action wrote to this project's log (booking status, service, service order, Won): pick the entries up. */
export async function reloadProjectActivities (api: CoreApi, projectId: string): Promise<void> {
  for (const d of (await api.core.listProjectActivities({ projectId })).data) { upsert(d) }
}

/** Same, for callers that must not fail because of the log: the next sync brings the entries. */
export async function refreshProjectActivities (api: CoreApi, projectId: string | undefined): Promise<void> {
  if (!projectId) { return }
  try {
    await reloadProjectActivities(api, projectId)
  } catch {
    // The activity sync brings them on the next load.
  }
}

export async function logChangeOnServer (api: CoreApi, projectId: string, input: ProjectChangeInput, key: string = newIdempotencyKey()): Promise<ActivityEntry> {
  return upsert((await api.core.logProjectChange(projectId, input, key)).data)
}
export async function approveChangeOnServer (api: CoreApi, id: string): Promise<ActivityEntry> {
  return upsert((await api.core.approveProjectChange(id)).data)
}
export async function rejectChangeOnServer (api: CoreApi, id: string): Promise<ActivityEntry> {
  return upsert((await api.core.rejectProjectChange(id)).data)
}
export async function reviewActivityOnServer (api: CoreApi, id: string): Promise<ActivityEntry> {
  return upsert((await api.core.reviewProjectActivity(id)).data)
}

export interface ActivitySyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads the activity log once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useActivitySync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<ActivitySyncState>('manova-activity-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerActivities(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Log aktivitas belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
