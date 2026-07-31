import { ROLE_MODULE_ACCESS, FULL_FINANCIAL_VISIBILITY_ROLES } from '~/constants/roles'
import type { ModuleKey, PermissionLevel } from '~/types/user'

const RANK: Record<PermissionLevel, number> = { NONE: 0, VIEW: 1, MANAGE: 2, APPROVE: 3, ADMIN: 4 }

/**
 * Helper `canView`/`canManage` terpusat (Prompt 5-I) — jangan sebar logic permission ke banyak komponen.
 * Mengikuti Role & Access Matrix docs/route-and-role-matrix.md bagian 5.
 */
export function usePermissions() {
  const { currentRole, currentUser } = useCurrentUser()

  function accessLevel(moduleKey: ModuleKey): PermissionLevel {
    return ROLE_MODULE_ACCESS[currentRole.value][moduleKey]
  }

  function canView(moduleKey: ModuleKey): boolean {
    return RANK[accessLevel(moduleKey)] >= RANK.VIEW
  }

  function canManage(moduleKey: ModuleKey): boolean {
    return RANK[accessLevel(moduleKey)] >= RANK.MANAGE
  }

  function canApprove(moduleKey: ModuleKey): boolean {
    return RANK[accessLevel(moduleKey)] >= RANK.APPROVE
  }

  const canViewFinancials = computed(() => FULL_FINANCIAL_VISIBILITY_ROLES.includes(currentRole.value))

  /** Vendor isolation (Prompt 19) — `vendorId` milik user login bila role `supplier`, else `undefined`. Dipakai `/supplier/*` untuk membatasi seluruh query ke satu vendor company saja. */
  const vendorScopeId = computed(() => (currentRole.value === 'supplier' ? currentUser.value.vendorId : undefined))

  return { accessLevel, canView, canManage, canApprove, canViewFinancials, vendorScopeId }
}
