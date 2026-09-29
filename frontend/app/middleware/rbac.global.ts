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
 * Berjalan di server dan browser. User aktif ada di cookie (`useCurrentUser`), jadi SSR sudah menolak
 * sebelum halaman terlarang dirender. Dulu middleware ini client-only: server tetap merender, misalnya,
 * halaman Finance untuk Admin, lalu browser mengalihkannya di tengah hydration. Redirect SSR adalah HTTP
 * 302 dan toast tidak bisa dibuat di server, jadi path yang ditolak dibawa lewat `?ditolak=` dan toast-nya
 * ditampilkan `plugins/rbac-denied-notice.client.ts`. Batas akses sebenarnya tetap API server.
 */
export default defineNuxtRouteMiddleware((to) => {
  const navItem = findNavItemForPath(to.path)
  /** Rute di luar navigasi (mis. `/settings`, `/login`, halaman preview) diserahkan ke guard halaman. */
  if (!navItem?.moduleKey) { return }

  const { canViewMenu } = usePermissions()
  if (canViewMenu(navItem.key, navItem.moduleKey)) { return }

  if (import.meta.server) {
    return navigateTo({ path: '/', query: { ditolak: to.path } })
  }
  const { showToast } = useToast()
  showToast('Akses ditolak', `Anda tidak memiliki akses ke "${navItem.label}".`, 'error')
  return navigateTo('/')
})
