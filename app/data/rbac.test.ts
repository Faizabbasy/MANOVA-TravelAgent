import { describe, it, expect, beforeEach } from 'vitest'
import {
  RANK,
  LEGACY_ROLE_ALIAS,
  ROLE_DEFINITIONS,
  ROLE_MENU_GRANTS,
  getModuleLevel,
  getMenuLevel,
  getRoleDefinition,
  resolveRoleId,
  hasCapability,
  createRole,
  updateRole,
  deleteRole,
  assignUserRole,
  countUsersByRole,
  getUsersByRole,
  setRoleModuleLevel,
  setRoleMenuGrant,
  clearRoleMenuGrant,
  setRoleCapability,
  wouldLockOutActor,
  resetRbacToDefaults
} from './rbac'
import { CAPABILITY_KEYS, isKnownCapabilityKey } from '~/constants/capabilities'
import { MODULE_KEYS, BUSINESS_MODULES, resolveModuleKey } from '~/constants/modules'
import type { PermissionLevel } from '~/types/user'

/**
 * Snapshot matriks 16-role × 17-modul SEBELUM restrukturisasi apa pun (verbatim dari `app/constants/roles.ts`
 * lama, sebelum 16 → 13 → 7 / Penyederhanaan 7-Role). Dipakai sebagai jaring pengaman migrasi lintas DUA
 * penggabungan sekaligus: setiap role lama, setelah dipetakan lewat `LEGACY_ROLE_ALIAS` (satu hop, langsung
 * ke salah satu dari 7 role final), tidak boleh KEHILANGAN akses pada modul mana pun. Kenaikan level
 * diperbolehkan (penggabungan role memang memperluas).
 */
const LEGACY_ROLE_MODULE_ACCESS: Record<string, Record<string, PermissionLevel>> = {
  'super-admin': { crm: 'ADMIN', project: 'ADMIN', vendor: 'ADMIN', finance: 'ADMIN', reports: 'ADMIN', administration: 'ADMIN', 'supplier-portal': 'ADMIN', 'client-portal': 'ADMIN', 'product-planning': 'ADMIN', ticketing: 'ADMIN', accommodation: 'ADMIN', transportation: 'ADMIN', mice: 'ADMIN', procurement: 'ADMIN', bookings: 'ADMIN', changes: 'ADMIN', documents: 'ADMIN' },
  management: { crm: 'APPROVE', project: 'APPROVE', vendor: 'VIEW', finance: 'VIEW', reports: 'VIEW', administration: 'VIEW', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'VIEW', ticketing: 'VIEW', accommodation: 'VIEW', transportation: 'VIEW', mice: 'VIEW', procurement: 'VIEW', bookings: 'VIEW', changes: 'VIEW', documents: 'MANAGE' },
  'account-executive': { crm: 'MANAGE', project: 'VIEW', vendor: 'NONE', finance: 'NONE', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'VIEW', ticketing: 'NONE', accommodation: 'NONE', transportation: 'NONE', mice: 'NONE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'VIEW' },
  sales: { crm: 'MANAGE', project: 'VIEW', vendor: 'NONE', finance: 'NONE', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'NONE', ticketing: 'NONE', accommodation: 'NONE', transportation: 'NONE', mice: 'NONE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'VIEW' },
  'product-planner': { crm: 'VIEW', project: 'VIEW', vendor: 'VIEW', finance: 'NONE', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'MANAGE', ticketing: 'NONE', accommodation: 'NONE', transportation: 'NONE', mice: 'NONE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'VIEW' },
  'project-manager': { crm: 'VIEW', project: 'MANAGE', vendor: 'VIEW', finance: 'VIEW', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'VIEW', ticketing: 'VIEW', accommodation: 'VIEW', transportation: 'VIEW', mice: 'VIEW', procurement: 'VIEW', bookings: 'VIEW', changes: 'MANAGE', documents: 'MANAGE' },
  operations: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'VIEW', ticketing: 'VIEW', accommodation: 'VIEW', transportation: 'VIEW', mice: 'VIEW', procurement: 'VIEW', bookings: 'MANAGE', changes: 'MANAGE', documents: 'MANAGE' },
  ticketing: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'NONE', ticketing: 'MANAGE', accommodation: 'NONE', transportation: 'NONE', mice: 'NONE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'VIEW' },
  accommodation: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'NONE', ticketing: 'NONE', accommodation: 'MANAGE', transportation: 'NONE', mice: 'NONE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'VIEW' },
  transportation: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'NONE', ticketing: 'NONE', accommodation: 'NONE', transportation: 'MANAGE', mice: 'NONE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'VIEW' },
  mice: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'NONE', ticketing: 'NONE', accommodation: 'NONE', transportation: 'NONE', mice: 'MANAGE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'VIEW' },
  procurement: { crm: 'NONE', project: 'VIEW', vendor: 'MANAGE', finance: 'NONE', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'NONE', ticketing: 'NONE', accommodation: 'NONE', transportation: 'NONE', mice: 'NONE', procurement: 'MANAGE', bookings: 'NONE', changes: 'NONE', documents: 'VIEW' },
  finance: { crm: 'VIEW', project: 'VIEW', vendor: 'VIEW', finance: 'MANAGE', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'VIEW', ticketing: 'VIEW', accommodation: 'VIEW', transportation: 'VIEW', mice: 'VIEW', procurement: 'VIEW', bookings: 'VIEW', changes: 'VIEW', documents: 'VIEW' },
  viewer: { crm: 'VIEW', project: 'VIEW', vendor: 'VIEW', finance: 'VIEW', reports: 'VIEW', administration: 'VIEW', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'VIEW', ticketing: 'VIEW', accommodation: 'VIEW', transportation: 'VIEW', mice: 'VIEW', procurement: 'VIEW', bookings: 'VIEW', changes: 'VIEW', documents: 'VIEW' },
  client: { crm: 'NONE', project: 'NONE', vendor: 'NONE', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'MANAGE', 'product-planning': 'NONE', ticketing: 'NONE', accommodation: 'NONE', transportation: 'NONE', mice: 'NONE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'NONE' },
  supplier: { crm: 'NONE', project: 'NONE', vendor: 'NONE', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'MANAGE', 'client-portal': 'NONE', 'product-planning': 'NONE', ticketing: 'NONE', accommodation: 'NONE', transportation: 'NONE', mice: 'NONE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'NONE' }
}

describe('RBAC dinamis', () => {
  beforeEach(() => {
    resetRbacToDefaults()
  })

  describe('Migrasi 16 → 7 role (via alias satu-hop) tidak menghilangkan akses', () => {
    it('setiap role lama, setelah dipetakan, punya level >= level lamanya di setiap modul', () => {
      const regressions: string[] = []

      for (const legacyRoleId in LEGACY_ROLE_MODULE_ACCESS) {
        const newRoleId = LEGACY_ROLE_ALIAS[legacyRoleId] ?? legacyRoleId
        const legacyRow = LEGACY_ROLE_MODULE_ACCESS[legacyRoleId]

        for (const legacyModuleKey in legacyRow) {
          const legacyLevel = legacyRow[legacyModuleKey]
          if (legacyLevel === 'NONE') { continue }

          const actual = getModuleLevel(newRoleId, legacyModuleKey)
          if (RANK[actual] < RANK[legacyLevel]) {
            regressions.push(`${legacyRoleId} → ${newRoleId}: modul "${legacyModuleKey}" (→ ${resolveModuleKey(legacyModuleKey)}) turun dari ${legacyLevel} ke ${actual}`)
          }
        }
      }

      expect(regressions).toEqual([])
    })

    it('setiap role lama teresolusi ke role baru yang benar-benar ada', () => {
      for (const legacyRoleId in LEGACY_ROLE_MODULE_ACCESS) {
        expect(getRoleDefinition(resolveRoleId(legacyRoleId)), `role lama "${legacyRoleId}" tidak punya tujuan`).toBeDefined()
      }
    })

    it('role lama yang dihapus tidak lagi terdaftar sebagai role sendiri', () => {
      for (const legacyRoleId in LEGACY_ROLE_ALIAS) {
        expect(ROLE_DEFINITIONS.some(role => role.id === legacyRoleId), `"${legacyRoleId}" seharusnya sudah dilebur`).toBe(false)
      }
    })
  })

  describe('Isolasi portal', () => {
    it('client dan vendor tidak punya akses modul internal apa pun', () => {
      for (const moduleKey of MODULE_KEYS) {
        if (moduleKey === 'client-portal') { continue }
        expect(getModuleLevel('client', moduleKey), `client bocor ke ${moduleKey}`).toBe('NONE')
      }
      for (const moduleKey of MODULE_KEYS) {
        if (moduleKey === 'vendor-portal') { continue }
        expect(getModuleLevel('vendor', moduleKey), `vendor bocor ke ${moduleKey}`).toBe('NONE')
      }
    })

    it('role supplier lama teresolusi ke vendor dan tetap memegang portalnya', () => {
      expect(resolveRoleId('supplier')).toBe('vendor')
      expect(getModuleLevel('supplier', 'supplier-portal')).toBe('MANAGE')
    })

    it('scopeField terpasang pada kedua role portal', () => {
      expect(getRoleDefinition('client')?.scopeField).toBe('clientPartyId')
      expect(getRoleDefinition('vendor')?.scopeField).toBe('vendorId')
    })
  })

  describe('Super Admin mem-bypass matriks', () => {
    it('selalu ADMIN, bahkan untuk module key yang tidak dikenal', () => {
      expect(getModuleLevel('super-admin', 'operations')).toBe('ADMIN')
      expect(getModuleLevel('super-admin', 'modul-yang-belum-ada')).toBe('ADMIN')
      expect(hasCapability('super-admin', 'capability-apa-pun')).toBe(true)
    })

    it('permission-nya tidak bisa diubah', () => {
      const result = setRoleModuleLevel('super-admin', 'administration', 'NONE')
      expect(result.success).toBe(false)
      expect(getModuleLevel('super-admin', 'administration')).toBe('ADMIN')
    })
  })

  describe('Alias module key lama', () => {
    it('module key lama teresolusi ke modul baru', () => {
      expect(resolveModuleKey('project')).toBe('operations')
      expect(resolveModuleKey('bookings')).toBe('operations')
      expect(resolveModuleKey('mice')).toBe('operations')
      expect(resolveModuleKey('procurement')).toBe('vendor-partner')
      expect(resolveModuleKey('finance')).toBe('finance-acc')
      expect(resolveModuleKey('reports')).toBe('bi')
      expect(resolveModuleKey('product-planning')).toBe('sales')
      expect(resolveModuleKey('supplier-portal')).toBe('vendor-portal')
    })

    it('module key kanonik tidak berubah', () => {
      expect(resolveModuleKey('crm')).toBe('crm')
      expect(resolveModuleKey('administration')).toBe('administration')
      expect(resolveModuleKey('client-portal')).toBe('client-portal')
      expect(resolveModuleKey('documents')).toBe('documents')
    })

    it('module key tak dikenal jatuh ke NONE, bukan melempar error', () => {
      expect(getModuleLevel('sales', 'modul-typo')).toBe('NONE')
    })
  })

  describe('Grant level-menu', () => {
    it('mewarisi level modul saat tidak ada override', () => {
      expect(getMenuLevel('sales', 'sales.leads', 'sales')).toBe(getModuleLevel('sales', 'sales'))
    })

    it('override eksplisit mengalahkan level modul, dan bisa dikembalikan', () => {
      setRoleMenuGrant('sales', 'sales.forecast', 'NONE')
      expect(getMenuLevel('sales', 'sales.forecast', 'sales')).toBe('NONE')

      clearRoleMenuGrant('sales', 'sales.forecast')
      expect(getMenuLevel('sales', 'sales.forecast', 'sales')).toBe(getModuleLevel('sales', 'sales'))
      expect(ROLE_MENU_GRANTS.some(grant => grant.roleId === 'sales' && grant.menuKey === 'sales.forecast')).toBe(false)
    })

    it('Super Admin mengabaikan override menu', () => {
      setRoleMenuGrant('super-admin', 'sales.forecast', 'NONE')
      expect(getMenuLevel('super-admin', 'sales.forecast', 'sales')).toBe('ADMIN')
    })
  })

  describe('Capability', () => {
    it('seluruh capability seed terdaftar di CAPABILITIES', () => {
      const unknown = CAPABILITY_KEYS.filter(key => !isKnownCapabilityKey(key))
      expect(unknown).toEqual([])
    })

    it('menggantikan narrow role exception lama', () => {
      expect(hasCapability('sales', 'sales.manage-lead-pipeline')).toBe(true)
      expect(hasCapability('operations', 'sales.manage-lead-pipeline')).toBe(false)
      expect(hasCapability('operations', 'project-order.manage-travelers')).toBe(true)
      expect(hasCapability('management', 'sales.approve-quotation')).toBe(true)
    })

    it('bisa dicabut dan diberikan kembali', () => {
      setRoleCapability('operations', 'project-order.close', false)
      expect(hasCapability('operations', 'project-order.close')).toBe(false)
      setRoleCapability('operations', 'project-order.close', true)
      expect(hasCapability('operations', 'project-order.close')).toBe(true)
    })
  })

  describe('Guard rail anti self-lockout', () => {
    it('menolak mencabut Administration dari role user yang sedang login', () => {
      setRoleModuleLevel('sales', 'administration', 'ADMIN')
      expect(wouldLockOutActor('sales', 'administration', 'VIEW', 'sales')).toBe(true)

      const result = setRoleModuleLevel('sales', 'administration', 'VIEW', 'sales')
      expect(result.success).toBe(false)
      expect(getModuleLevel('sales', 'administration')).toBe('ADMIN')
    })

    it('mengizinkan bila yang mengubah adalah role lain', () => {
      setRoleModuleLevel('sales', 'administration', 'ADMIN')
      const result = setRoleModuleLevel('sales', 'administration', 'VIEW', 'super-admin')
      expect(result.success).toBe(true)
      expect(getModuleLevel('sales', 'administration')).toBe('VIEW')
    })

    it('Super Admin tidak pernah dianggap terkunci', () => {
      expect(wouldLockOutActor('super-admin', 'administration', 'NONE', 'super-admin')).toBe(false)
    })
  })

  describe('CRUD role', () => {
    it('membuat role custom dan menyalin seluruh grant role sumber', () => {
      const result = createRole({ label: 'Supervisor Ops', cloneFromRoleId: 'operations' }, 'USR-010')
      expect(result.success).toBe(true)
      expect(result.roleId).toBe('supervisor-ops')

      for (const moduleKey of MODULE_KEYS) {
        expect(getModuleLevel('supervisor-ops', moduleKey)).toBe(getModuleLevel('operations', moduleKey))
      }
      expect(hasCapability('supervisor-ops', 'project-order.manage-travelers')).toBe(true)
      expect(getRoleDefinition('supervisor-ops')?.isSystem).toBe(false)
    })

    it('menolak nama role duplikat dan nama kosong', () => {
      expect(createRole({ label: 'Sales & CRM' }).success).toBe(false)
      expect(createRole({ label: '   ' }).success).toBe(false)
    })

    it('menolak menghapus role bawaan sistem', () => {
      const result = deleteRole('operations')
      expect(result.success).toBe(false)
      expect(getRoleDefinition('operations')).toBeDefined()
    })

    it('menolak menghapus role yang masih punya user', () => {
      createRole({ label: 'Role Sementara' })
      assignUserRole('USR-002', 'role-sementara')
      expect(deleteRole('role-sementara').success).toBe(false)

      assignUserRole('USR-002', 'operations')
      expect(deleteRole('role-sementara').success).toBe(true)
      expect(getRoleDefinition('role-sementara')).toBeUndefined()
    })

    it('menghapus role juga menghapus seluruh grant-nya', () => {
      createRole({ label: 'Role Bersih', cloneFromRoleId: 'finance' })
      setRoleMenuGrant('role-bersih', 'finance.opex', 'NONE')
      deleteRole('role-bersih')

      expect(getModuleLevel('role-bersih', 'finance-acc')).toBe('NONE')
      expect(ROLE_MENU_GRANTS.some(grant => grant.roleId === 'role-bersih')).toBe(false)
    })

    it('mengganti nama role tetap menolak bentrok', () => {
      createRole({ label: 'Role Rename' })
      expect(updateRole('role-rename', { label: 'Finance & ACC' }).success).toBe(false)
      expect(updateRole('role-rename', { label: 'Role Rename 2' }).success).toBe(true)
      expect(getRoleDefinition('role-rename')?.label).toBe('Role Rename 2')
    })
  })

  describe('Penugasan user ke role', () => {
    it('memindahkan user dan tercermin di hitungan role', () => {
      const before = countUsersByRole('marketing')
      expect(assignUserRole('USR-008', 'marketing').success).toBe(true)
      expect(countUsersByRole('marketing')).toBe(before + 1)
      assignUserRole('USR-008', 'finance')
    })

    it('user dengan role lama tetap terhitung pada role penggantinya', () => {
      expect(countUsersByRole('project-manager')).toBe(countUsersByRole('operations'))
    })

    it('menolak memindahkan Super Admin terakhir', () => {
      const result = assignUserRole('USR-010', 'marketing')
      expect(result.success).toBe(false)
      expect(countUsersByRole('super-admin')).toBe(1)
    })

    it('membersihkan field isolasi portal saat pindah ke role internal', () => {
      expect(assignUserRole('USR-015', 'operations').success).toBe(true)
      const user = getUsersByRole('operations').find(item => item.id === 'USR-015')
      expect(user?.vendorId).toBeUndefined()
      assignUserRole('USR-015', 'vendor')
    })
  })

  describe('resetRbacToDefaults', () => {
    it('mengembalikan role custom, grant, dan override menu ke seed', () => {
      createRole({ label: 'Role Buangan' })
      setRoleModuleLevel('sales', 'hr', 'MANAGE')
      setRoleMenuGrant('sales', 'sales.leads', 'NONE')

      resetRbacToDefaults()

      expect(getRoleDefinition('role-buangan')).toBeUndefined()
      expect(getModuleLevel('sales', 'hr')).toBe('NONE')
      expect(ROLE_MENU_GRANTS).toHaveLength(0)
      expect(ROLE_DEFINITIONS).toHaveLength(7)
    })
  })

  describe('Penyederhanaan 7-Role — setiap modul bisnis tetap punya pemilik', () => {
    it('setiap modul bisnis punya minimal satu role non-super-admin ber-level MANAGE ke atas', () => {
      // Modul sistem (administration/documents/client-portal/vendor-portal) sengaja dikecualikan —
      // administration secara desain hanya ADMIN (Super Admin) + VIEW (Management), tidak ada role bisnis
      // yang "memiliki" Administration; portal module sudah tercakup lewat role client/vendor sendiri.
      const orphaned: string[] = []
      for (const module of BUSINESS_MODULES) {
        const hasOwner = ROLE_DEFINITIONS
          .filter(role => !role.isSuperAdmin)
          .some(role => RANK[getModuleLevel(role.id, module.key)] >= RANK.MANAGE)
        if (!hasOwner) { orphaned.push(module.key) }
      }
      expect(orphaned).toEqual([])
    })

    it('role yang melebur (crm/marketing/bi/hr/vendor-partner/inventory) tidak lagi jadi role sendiri', () => {
      for (const legacyId of ['crm', 'marketing', 'bi', 'hr', 'vendor-partner', 'inventory']) {
        expect(ROLE_DEFINITIONS.some(role => role.id === legacyId)).toBe(false)
        expect(getRoleDefinition(resolveRoleId(legacyId))).toBeDefined()
      }
    })
  })
})
