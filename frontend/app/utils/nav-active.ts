import type { RouteLocationNormalizedLoaded } from 'vue-router'

/**
 * Bandingkan base path dulu, lalu — kalau `to` membawa `?tab=...` (pola tab-container seperti
 * `/finance/invoices?tab=...`) — cocokkan juga `route.query.tab`, supaya item ber-query tetap
 * ter-highlight dengan benar. Dipakai bersama oleh AppSidebar, MobileBottomNav, dan MobileMoreSheet
 * supaya definisi "aktif" tidak pernah menyimpang antar komponen navigasi.
 */
export function isNavPathActive (to: string, route: RouteLocationNormalizedLoaded): boolean {
  const [base, queryString] = to.split('?')
  if (route.path !== base) { return false }
  if (!queryString) { return true }
  const tab = new URLSearchParams(queryString).get('tab')
  if (tab === null) { return true }
  return route.query.tab === tab
}
