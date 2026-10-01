import type { NavItem } from '~/constants/navigation'

interface VisibilityGates {
  isRole: (...roleIds: string[]) => boolean
  canViewMenu: (menuKey: string, moduleKey?: string) => boolean
}

/**
 * Sama persis dengan gerbang visibilitas menu di `AppSidebar.vue`: override `item.roles` (deprecated
 * tapi masih dipakai Vendor/Client Portal) menang, kalau tidak ada jatuh ke `canViewMenu()` per
 * `moduleKey`. Diekstrak supaya `MobileMoreSheet.vue` tidak diam-diam menyimpang dari gerbang RBAC
 * yang sama.
 */
export function isNavItemVisible (item: NavItem, gates: VisibilityGates): boolean {
  if (item.roles) { return gates.isRole(...item.roles) }
  if (!item.moduleKey) { return true }
  return gates.canViewMenu(item.key, item.moduleKey)
}

/** Daftar `NAV_ITEMS` yang lolos gerbang RBAC untuk role saat ini, grup kosong (semua anak tercabut) ikut disaring. */
export function getVisibleNavItems (items: NavItem[], gates: VisibilityGates): NavItem[] {
  return items
    .filter(item => isNavItemVisible(item, gates))
    .map(item => ({ ...item, children: item.children?.filter(child => isNavItemVisible(child, gates)) }))
    .filter(item => !item.children || item.children.length > 0)
}
