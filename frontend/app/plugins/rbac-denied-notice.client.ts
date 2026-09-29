import { findNavItemForPath } from '~/constants/navigation'

/**
 * Toast "Akses ditolak" untuk penolakan yang terjadi saat SSR (`middleware/rbac.global.ts` mengalihkan ke
 * `/?ditolak=<path>`). Query hanya dipercaya bila path-nya memang menu terdaftar DAN memang tidak boleh
 * dibuka user ini — tautan buatan tidak bisa memunculkan pesan palsu. Query lalu dibersihkan dari URL.
 *
 * `onNuxtReady` (bukan `app:mounted`): toast baru boleh muncul setelah hydration selesai, kalau tidak
 * ToastContainer ikut mismatch dengan HTML server.
 */
export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    const route = useRoute()
    const denied = route.query.ditolak
    if (typeof denied !== 'string') { return }

    const navItem = findNavItemForPath(denied)
    const { canViewMenu } = usePermissions()
    if (navItem?.moduleKey && !canViewMenu(navItem.key, navItem.moduleKey)) {
      const { showToast } = useToast()
      showToast('Akses ditolak', `Anda tidak memiliki akses ke "${navItem.label}".`, 'error')
    }

    const query = { ...route.query }
    delete query.ditolak
    useRouter().replace({ query })
  })
})
