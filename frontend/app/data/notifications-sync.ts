import { NOTIFICATION_RECORDS } from './document-comms'
import type { Notification } from '~/types/document-comms'
import type { NotificationDto } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `NOTIFICATION_RECORDS` (S9b). The server creates notifications inside the action (mention, task
 * assignment, incident escalation) and returns only the signed-in user's. Notifications the hidden client portal
 * still creates locally (`NOT-L…`) survive a merge.
 */

type CoreApi = Pick<ManovaApi, 'core'>
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)
const isLocal = (id: string) => id.startsWith('NOT-L')

export function notificationFromServer (d: NotificationDto): Notification {
  return {
    id: d.id,
    userId: d.userId,
    type: d.type,
    title: d.title,
    body: d.body,
    entityType: opt(d.entityType),
    entityId: opt(d.entityId),
    createdAt: d.createdAt,
    read: d.read,
    category: opt(d.category)
  }
}

function upsert (value: Notification): Notification {
  const local = NOTIFICATION_RECORDS.find(x => x.id === value.id)
  if (!local) {
    NOTIFICATION_RECORDS.push(value)
    return NOTIFICATION_RECORDS[NOTIFICATION_RECORDS.length - 1]!
  }
  Object.assign(local, value)
  return local
}

export function mergeServerNotifications (list: NotificationDto[]): void {
  const keep = new Set(list.map(x => x.id))
  for (let i = NOTIFICATION_RECORDS.length - 1; i >= 0; i--) {
    const id = NOTIFICATION_RECORDS[i]!.id
    if (!keep.has(id) && !isLocal(id)) { NOTIFICATION_RECORDS.splice(i, 1) }
  }
  for (const d of list) { upsert(notificationFromServer(d)) }
}

export async function loadServerNotifications (api: CoreApi): Promise<void> {
  mergeServerNotifications((await api.core.listNotifications()).data)
}

export async function markNotificationReadOnServer (api: CoreApi, id: string): Promise<Notification> {
  return upsert(notificationFromServer((await api.core.markNotificationRead(id)).data))
}
export async function markAllNotificationsReadOnServer (api: CoreApi): Promise<void> {
  mergeServerNotifications((await api.core.markAllNotificationsRead()).data)
}
export async function removeNotificationOnServer (api: CoreApi, id: string): Promise<void> {
  await api.core.removeNotification(id)
  const index = NOTIFICATION_RECORDS.findIndex(x => x.id === id)
  if (index !== -1) { NOTIFICATION_RECORDS.splice(index, 1) }
}

export interface NotificationsSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads the signed-in user's notifications (dashboard layout, "Reset Demo Data", and each time the bell opens). */
export function useNotificationsSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<NotificationsSyncState>('manova-notifications-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerNotifications(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Notifikasi belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
