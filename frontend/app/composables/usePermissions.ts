import { computed } from 'vue'
import type { ModuleKey, PermissionLevel, RoleId } from '~/types/user'
import {
  RANK,
  getMenuLevel,
  getModuleLevel,
  getRoleDefinition,
  hasCapability,
  resolveRoleId
} from '~/data/rbac'

/**
 * Helper permission terpusat — jangan sebar logic permission ke banyak komponen.
 *
 * Sejak Revisi 9-Modul sumbernya adalah RBAC reaktif (`app/data/rbac.ts`), bukan lagi matriks
 * compile-time. Signature `accessLevel`/`canView`/`canManage`/`canApprove`/`canViewFinancials`/
 * `vendorScopeId`/`clientScopeId` SENGAJA dipertahankan persis seperti sebelumnya sehingga ~108
 * call-site yang ada tidak perlu diubah — module key lama otomatis diterjemahkan lewat
 * `LEGACY_MODULE_ALIAS` (`app/constants/modules.ts`).
 *
 * Tambahan baru:
 *   - `menuLevel(menuKey, moduleKey?)` — grant per entri menu (Admin > Roles > Menus).
 *   - `can(capabilityKey)` — action flag bernama, pengganti perbandingan role literal.
 *   - `isRole(...)` — perbandingan role yang sadar alias role lama.
 */
export function usePermissions () {
  const { currentRole, currentUser } = useCurrentUser()

  const roleId = computed<RoleId>(() => resolveRoleId(currentRole.value))
  const roleDefinition = computed(() => getRoleDefinition(roleId.value))

  function accessLevel (moduleKey: ModuleKey): PermissionLevel {
    return getModuleLevel(roleId.value, moduleKey)
  }

  function canView (moduleKey: ModuleKey): boolean {
    return RANK[accessLevel(moduleKey)] >= RANK.VIEW
  }

  function canManage (moduleKey: ModuleKey): boolean {
    return RANK[accessLevel(moduleKey)] >= RANK.MANAGE
  }

  function canApprove (moduleKey: ModuleKey): boolean {
    return RANK[accessLevel(moduleKey)] >= RANK.APPROVE
  }

  /** Level efektif satu entri navigasi — override menu menang, kalau tidak ada mewarisi modulnya. */
  function menuLevel (menuKey: string, moduleKey?: ModuleKey): PermissionLevel {
    return getMenuLevel(roleId.value, menuKey, moduleKey)
  }

  function canViewMenu (menuKey: string, moduleKey?: ModuleKey): boolean {
    return RANK[menuLevel(menuKey, moduleKey)] >= RANK.VIEW
  }

  /** Action flag granular (`app/constants/capabilities.ts`). Super Admin selalu `true`. */
  function can (capabilityKey: string): boolean {
    return hasCapability(roleId.value, capabilityKey)
  }

  /** Perbandingan role yang aman terhadap role id lama (mis. `'project-manager'` → `'operations'`). */
  function isRole (...roleIds: RoleId[]): boolean {
    return roleIds.some(candidate => resolveRoleId(candidate) === roleId.value)
  }

  const canViewFinancials = computed(() => roleDefinition.value?.canViewFullFinancials ?? false)

  /** Isolasi vendor — `vendorId` milik user login bila role-nya ber-`scopeField: 'vendorId'`. */
  const vendorScopeId = computed(() => (roleDefinition.value?.scopeField === 'vendorId' ? currentUser.value.vendorId : undefined))

  /** Isolasi client — pola identik `vendorScopeId`, membatasi `/client/*` ke satu `Party`. */
  const clientScopeId = computed(() => (roleDefinition.value?.scopeField === 'clientPartyId' ? currentUser.value.clientPartyId : undefined))

  return {
    roleId,
    roleDefinition,
    accessLevel,
    canView,
    canManage,
    canApprove,
    menuLevel,
    canViewMenu,
    can,
    isRole,
    canViewFinancials,
    vendorScopeId,
    clientScopeId
  }
}
