import { ApiError, isApiError } from '~/lib/api/errors'
import type { MeDto } from '~/types/api'

/**
 * The API session behind the screens that read server data (Finance first).
 *
 * The app shell still identifies the user through `useCurrentUser` (cookie), and the role switcher in
 * Settings/Admin changes only that. To keep what the user sees and what the server enforces in sync, this
 * composable checks `/auth/me` and, when the server session is missing or belongs to someone else, signs in
 * again as the current user with the one-click demo login. When that is not possible (demo login off, server
 * down) it reports why instead of showing someone else's data or a silent empty screen.
 *
 * The server stays the security boundary: `can()` here only hides buttons the API would refuse anyway.
 */

export type ServerSessionStatus = 'idle' | 'checking' | 'ready' | 'offline' | 'signed-out'

interface SessionState {
  status: ServerSessionStatus
  me: MeDto | null
  /** Why the session is not usable (offline / signed-out). */
  message: string | null
}

/** One in-flight sign-in per user id, so a role switch mid-way never returns the previous user's session. */
const inflight = new Map<string, Promise<MeDto>>()

export function sessionUnavailableError (message: string, offline: boolean): ApiError {
  return new ApiError(offline ? 0 : 401, offline ? 'NETWORK_ERROR' : 'SESSION_REQUIRED', message)
}

export function useServerSession () {
  const api = useApi()
  const { currentUser } = useCurrentUser()
  const state = useState<SessionState>('manova-server-session', () => ({ status: 'idle', me: null, message: null }))

  function isServerDown (error: unknown) {
    return isApiError(error) && (error.status === 0 || error.status >= 500 || error.code === 'UNEXPECTED_RESPONSE')
  }

  async function establish (userId: string): Promise<MeDto> {
    state.value = { ...state.value, status: 'checking' }
    let me: MeDto | null = null
    try {
      me = (await api.auth.me()).data
    } catch (error) {
      if (isServerDown(error)) {
        const message = 'Server MANOVA belum terhubung. Jalankan `npm run dev` dari folder root, lalu muat ulang halaman ini.'
        state.value = { status: 'offline', me: null, message }
        throw sessionUnavailableError(message, true)
      }
      if (!(isApiError(error) && error.isUnauthenticated)) { throw error }
    }
    if (me?.user.id === userId) {
      state.value = { status: 'ready', me, message: null }
      return me
    }
    // No session, or a session for another user (role switched in the app): sign in as the current user.
    try {
      me = (await api.auth.demoLogin(userId)).data
      state.value = { status: 'ready', me, message: null }
      return me
    } catch (error) {
      const message = isServerDown(error)
        ? 'Server MANOVA belum terhubung. Jalankan `npm run dev` dari folder root, lalu muat ulang halaman ini.'
        : isApiError(error) && error.isNotFound && error.code !== 'ROUTE_NOT_FOUND'
          ? `Akun ${currentUser.value.name} belum ada di database server. Jalankan \`npm run db:seed:demo\` lalu masuk lagi.`
          : 'Sesi server Anda sudah berakhir. Masuk lagi untuk melanjutkan.'
      state.value = { status: isServerDown(error) ? 'offline' : 'signed-out', me: null, message }
      throw sessionUnavailableError(message, isServerDown(error))
    }
  }

  /** Resolves with a server session for the current user, or throws an ApiError explaining why not. */
  function ensure (): Promise<MeDto> {
    const userId = currentUser.value.id
    if (state.value.status === 'ready' && state.value.me?.user.id === userId) { return Promise.resolve(state.value.me) }
    let pendingSession = inflight.get(userId)
    if (!pendingSession) {
      pendingSession = establish(userId).finally(() => { inflight.delete(userId) })
      inflight.set(userId, pendingSession)
    }
    return pendingSession
  }

  /** Server-computed capability (e.g. `finance.post-cash`). False until the session is ready. */
  function can (capability: string): boolean {
    return state.value.me?.permissions.capabilities.includes(capability) ?? false
  }

  return {
    state,
    me: computed(() => state.value.me),
    ensure,
    can,
    /** Forget the cached session (e.g. after a 401 mid-way); the next `ensure()` checks again. */
    reset: () => { state.value = { status: 'idle', me: null, message: null } }
  }
}
