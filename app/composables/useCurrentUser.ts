import { USERS, getUserById } from '~/data'
import type { RoleId } from '~/types/user'

const STORAGE_KEY = 'manovaCurrentUserId'
const DEFAULT_USER_ID = 'USR-010' // Super Admin — default demo user agar seluruh nav terlihat penuh

const currentUserId = ref(DEFAULT_USER_ID)
let hydrated = false

/**
 * Current user & role mock (Prompt 5-I). Satu source of truth reactive, tanpa authentication backend.
 * Dipakai bersama oleh navigation visibility, dashboard, dan role switcher di halaman Settings.
 */
export function useCurrentUser () {
  if (process.client && !hydrated) {
    hydrated = true
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && getUserById(stored)) {
      currentUserId.value = stored
    }
  }

  const currentUser = computed(() => getUserById(currentUserId.value) ?? USERS[0])
  const currentRole = computed<RoleId>(() => currentUser.value.role)

  function setCurrentUser (userId: string) {
    if (!getUserById(userId)) { return }
    currentUserId.value = userId
    if (process.client) {
      localStorage.setItem(STORAGE_KEY, userId)
    }
  }

  return {
    users: USERS,
    currentUser,
    currentRole,
    setCurrentUser
  }
}
