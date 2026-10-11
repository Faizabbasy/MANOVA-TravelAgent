import { USERS } from './users'
import { isRoleSelectable } from './rbac'
import type { RoleId, User } from '~/types/user'
import type { UserDto } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `USERS` (S10a). The server owns status and role: only the Super Admin suspends, reactivates or re-roles a
 * user (`admin.manage-users`), and a suspended user cannot sign in. Users that exist only locally (e.g. a client login
 * the hidden portal created) are left as they are.
 */

type CoreApi = Pick<ManovaApi, 'core'>
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)

export function userFromServer (d: UserDto): User {
  return {
    id: d.id,
    name: d.name,
    email: d.email,
    role: d.role as RoleId,
    status: d.status,
    suspendedReason: opt(d.suspendedReason),
    suspendedAt: opt(d.suspendedAt),
    vendorId: opt(d.vendorId),
    clientPartyId: opt(d.clientPartyId)
  }
}

function upsert (value: User): User {
  const local = USERS.find(u => u.id === value.id)
  if (!local) {
    USERS.push(value)
    return USERS[USERS.length - 1]!
  }
  Object.assign(local, value)
  return local
}

/** The role switcher may only become an active, non-portal user (a suspended one cannot sign in on the server either). */
export const canSwitchTo = (user: User | undefined): boolean => !!user && user.status !== 'suspended' && isRoleSelectable(user.role)

export function mergeServerUsers (list: UserDto[]): void {
  for (const d of list) { upsert(userFromServer(d)) }
}

export async function loadServerUsers (api: CoreApi): Promise<void> {
  mergeServerUsers((await api.core.listUsers()).data)
}

export async function suspendUserOnServer (api: CoreApi, id: string, reason: string): Promise<User> {
  return upsert(userFromServer((await api.core.suspendUser(id, reason)).data))
}
export async function reactivateUserOnServer (api: CoreApi, id: string): Promise<User> {
  return upsert(userFromServer((await api.core.reactivateUser(id)).data))
}
export async function changeUserRoleOnServer (api: CoreApi, id: string, role: string): Promise<User> {
  return upsert(userFromServer((await api.core.changeUserRole(id, role)).data))
}

export interface UsersSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads users once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useUsersSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<UsersSyncState>('manova-users-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerUsers(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Daftar user belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
