import { findNavItemForPath } from '~/constants/navigation'

/**
 * Gerbang akses level-route (Revisi 9-Modul).
 *
 * Tanpa ini, menyembunyikan menu di sidebar hanya kosmetik — URL yang diketik langsung tetap tembus dan
 * halaman tetap ter-render. Middleware ini memetakan path ke `NavItem` terdekat lalu menolak bila level
 * efektif menu tsb di bawah `VIEW`.
 *
 * Guard `RoleAccessState` di dalam masing-masing halaman TIDAK dihapus — keduanya berlapis: middleware
 * mencegah navigasi, guard halaman menangani rute yang belum terdaftar di navigasi.
 *
 * Client-only: role bersumber dari `localStorage` (`manovaCurrentUserId`), sehingga di server selalu
 * ter-hidrasi sebagai user default. Menjalankannya saat SSR akan menghasilkan redirect yang tidak konsisten
 * dengan kondisi sebenarnya di browser.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) { return }

  const navItem = findNavItemForPath(to.path)
  /** Rute di luar navigasi (mis. `/settings`, `/login`, halaman preview) diserahkan ke guard halaman. */
  if (!navItem?.moduleKey) { return }

  const { canViewMenu } = usePermissions()
  if (canViewMenu(navItem.key, navItem.moduleKey)) { return }

  const { showToast } = useToast()
  showToast('Akses ditolak', `Anda tidak memiliki akses ke "${navItem.label}".`, 'error')
  return navigateTo('/')
})
