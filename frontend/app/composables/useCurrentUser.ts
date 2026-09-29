import { USERS, getUserById } from '~/data'
import { isRoleSelectable } from '~/data/rbac'
import type { RoleId } from '~/types/user'

/** Dulu satu-satunya penyimpanan; kini hanya dibaca sekali untuk memigrasikan browser lama. */
const LEGACY_STORAGE_KEY = 'manovaCurrentUserId'
const COOKIE_KEY = 'manova_current_user'
const DEFAULT_USER_ID = 'USR-010' // Super Admin — default demo user agar seluruh nav terlihat penuh

let legacyMigrated = false

/** User yang boleh jadi sesi aktif: ada, dan role-nya tidak `hidden` (portal client/vendor dinonaktifkan). */
function isSelectableUser (userId: string | null | undefined): userId is string {
  if (!userId) { return false }
  const user = getUserById(userId)
  return !!user && isRoleSelectable(user.role)
}

/**
 * Current user & role mock (Prompt 5-I), diisi saat login satu-klik (`pages/login.vue`) dan dari role
 * switcher di Settings. Batas keamanan sesungguhnya ada di API server.
 *
 * Disimpan di cookie (bukan hanya `localStorage`) supaya server bisa merender user yang sama dengan
 * browser. Dulu server selalu merender Super Admin lalu browser menukarnya, sehingga muncul hydration
 * mismatch; di production mismatch class tidak dikoreksi, jadi badge/nama user lain bisa tampil salah.
 */
export function useCurrentUser () {
  const cookie = useCookie<string | null>(COOKIE_KEY, { sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30, default: () => null })
  const currentUserId = useState<string>('manova-current-user', () => (isSelectableUser(cookie.value) ? cookie.value : DEFAULT_USER_ID))

  if (import.meta.client && !legacyMigrated) {
    legacyMigrated = true
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!cookie.value && isSelectableUser(legacy)) {
      currentUserId.value = legacy
      cookie.value = legacy
    }
  }

  const currentUser = computed(() => getUserById(currentUserId.value) ?? USERS[0])
  const currentRole = computed<RoleId>(() => currentUser.value.role)
  /** Untuk role switcher: hanya user dengan role aktif. */
  const switchableUsers = computed(() => USERS.filter(user => isRoleSelectable(user.role)))

  function setCurrentUser (userId: string) {
    if (!isSelectableUser(userId)) { return }
    currentUserId.value = userId
    cookie.value = userId
    if (import.meta.client) {
      localStorage.setItem(LEGACY_STORAGE_KEY, userId)
    }
  }

  return {
    users: USERS,
    switchableUsers,
    currentUser,
    currentRole,
    setCurrentUser
  }
}
