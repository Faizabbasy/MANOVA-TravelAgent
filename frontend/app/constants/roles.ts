import { computed } from 'vue'
import type { StatusOption } from '~/types/common'
import type { ModuleKey, PermissionLevel, RoleId } from '~/types/user'
import { MODULE_KEYS } from '~/constants/modules'
import { ROLE_DEFINITIONS, getModuleLevel, getSortedRoles } from '~/data/rbac'

/**
 * Proxy tipis di atas RBAC reaktif (`app/data/rbac.ts`) — role & permission TIDAK lagi didefinisikan di
 * sini sejak Revisi 9-Modul. File ini dipertahankan supaya importer lama tidak perlu diubah serentak.
 *
 * Keduanya `computed`, jadi UI ikut ter-update begitu admin mengubah role dari Admin > Roles. Di dalam
 * `<script setup>` gunakan `.value`; di template Vue meng-unwrap otomatis.
 */

/** Daftar role untuk badge, filter, dan role switcher. Urut sesuai `RoleDefinition.order`. */
export const ROLES = computed<StatusOption<RoleId>[]>(() =>
  getSortedRoles().map(role => ({ value: role.id, label: role.label, tone: role.tone, order: role.order }))
)

/**
 * Bentuk matriks lama (role → modul → level), direkonstruksi dari baris grant. Disediakan hanya untuk
 * kompatibilitas; kode baru sebaiknya memakai `getModuleLevel()` / `usePermissions()` langsung karena
 * keduanya sudah menangani alias modul lama dan bypass Super Admin.
 */
export const ROLE_MODULE_ACCESS = computed<Record<RoleId, Record<ModuleKey, PermissionLevel>>>(() => {
  const matrix: Record<RoleId, Record<ModuleKey, PermissionLevel>> = {}
  for (const role of ROLE_DEFINITIONS) {
    const row: Record<ModuleKey, PermissionLevel> = {}
    for (const moduleKey of MODULE_KEYS) {
      row[moduleKey] = getModuleLevel(role.id, moduleKey)
    }
    matrix[role.id] = row
  }
  return matrix
})

/** Role yang boleh melihat breakdown finansial penuh (Budget/Actual/Margin). */
export const FULL_FINANCIAL_VISIBILITY_ROLES = computed<RoleId[]>(() =>
  ROLE_DEFINITIONS.filter(role => role.canViewFullFinancials).map(role => role.id)
)
