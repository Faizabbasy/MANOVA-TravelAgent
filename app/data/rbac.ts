import { reactive } from 'vue'
import type { PermissionLevel, RoleId, ModuleKey } from '~/types/user'
import type { RoleCapabilityGrant, RoleDefinition, RoleMenuGrant, RoleModuleGrant } from '~/types/rbac'
import { MODULE_KEYS, resolveModuleKey } from '~/constants/modules'
import { serviceCapabilityKey } from '~/constants/capabilities'
import { SYSTEM_EVENTS } from './activity'
import { USERS } from './users'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'

/**
 * Sumber tunggal RBAC runtime (Revisi 9-Modul, P0/P1) — menggantikan `ROLE_MODULE_ACCESS` compile-time.
 * `app/constants/roles.ts` kini hanya proxy tipis di atas file ini agar 12+ importer lama tidak berubah.
 *
 * Seluruh array di bawah `reactive()` dan dimutasi in-place oleh mutator di bagian bawah file — pola sama
 * dengan seluruh data layer mock lain. Didaftarkan ke `app/plugins/mock-reset.client.ts` supaya tombol
 * "Reset Demo Data" benar-benar bisa memulihkan permission yang salah dikonfigurasi (tanpa backend, ini
 * satu-satunya jalur pemulihan selain `resetRbacToDefaults()`).
 */

export const RANK: Record<PermissionLevel, number> = { NONE: 0, VIEW: 1, MANAGE: 2, APPROVE: 3, ADMIN: 4 }

export const PERMISSION_LEVELS: PermissionLevel[] = ['NONE', 'VIEW', 'MANAGE', 'APPROVE', 'ADMIN']

/**
 * Peta role lama → role baru (16 → 13 → 7, Penyederhanaan 7-Role). Dipakai untuk (a) memigrasikan
 * `User.role` yang tersimpan dan (b) menerjemahkan array role literal yang masih tersisa di halaman
 * selama masa transisi. Satu hop saja (`resolveRoleId` tidak rekursif) — setiap key WAJIB menunjuk
 * langsung ke salah satu dari 7 role final, bukan ke role antara yang sudah tidak ada.
 *
 * Riwayat penggabungan:
 *  - 16 → 13 (Revisi 9-Modul): sub-domain operasional (`ticketing`/`accommodation`/`transportation`/
 *    `mice`) dan `project-manager` melebur ke `operations`; `account-executive`/`product-planner` ke
 *    `sales`; `viewer` ke `management`; `procurement` ke `vendor-partner`; `supplier` jadi `vendor`.
 *  - 13 → 7 (Penyederhanaan 7-Role): `crm`/`marketing` melebur ke `sales` ("Sales & CRM" — deal dan
 *    customer satu tangan); `bi`/`hr` ke `management`; `vendor-partner`/`inventory` ke `operations`
 *    ("Operations & Project Order" — operasional lapangan satu tangan). `super-admin`, `finance`,
 *    `client`, `vendor` tidak berubah.
 */
export const LEGACY_ROLE_ALIAS: Record<string, RoleId> = {
  'account-executive': 'sales',
  'product-planner': 'sales',
  'project-manager': 'operations',
  ticketing: 'operations',
  accommodation: 'operations',
  transportation: 'operations',
  mice: 'operations',
  procurement: 'operations',
  viewer: 'management',
  supplier: 'vendor',
  crm: 'sales',
  marketing: 'sales',
  bi: 'management',
  hr: 'management',
  'vendor-partner': 'operations',
  inventory: 'operations'
}

export const ROLE_DEFINITIONS: RoleDefinition[] = reactive([
  { id: 'super-admin', label: 'Super Admin', tone: 'destructive', order: 1, kind: 'internal', isSystem: true, isSuperAdmin: true, canViewFullFinancials: true, description: 'Akses penuh seluruh modul. Sengaja mem-bypass matriks grant sehingga tidak mungkin terkunci dari Administration.' },
  { id: 'management', label: 'Management', tone: 'purple', order: 2, kind: 'internal', isSystem: true, canViewFullFinancials: true, description: 'Approver komersial lintas modul, pemilik visibilitas penuh, plus HR dan Reporting & BI. Menggantikan role Viewer, Auditor, HR, dan BI lama.' },
  { id: 'sales', label: 'Sales & CRM', tone: 'primary', order: 3, kind: 'internal', isSystem: true, canViewFullFinancials: false, description: 'Lead, opportunity, quotation, database customer, engagement, dan marketing. Menggabungkan Account Executive, Product Planner, CRM, dan Marketing & Analysis lama — satu tangan untuk deal dan customer.' },
  { id: 'finance', label: 'Finance & ACC', tone: 'success', order: 4, kind: 'internal', isSystem: true, canViewFullFinancials: true, description: 'General ledger, AR/AP, pembayaran, opex, pajak, dan multi currency.' },
  { id: 'operations', label: 'Operations & Project Order', tone: 'info', order: 5, kind: 'internal', isSystem: true, canViewFullFinancials: true, description: 'Project order end-to-end, itinerary, booking, vendor & partner, inventory alat, dan change request. Menggabungkan Project Manager, Ticketing, Accommodation, Transportation, MICE, Vendor & Partner Management, dan Inventory lama.' },
  { id: 'client', label: 'Client', tone: 'warning', order: 6, kind: 'portal', isSystem: true, canViewFullFinancials: false, scopeField: 'clientPartyId', description: 'Portal eksternal klien. Tidak punya akses modul internal apa pun; seluruh data diisolasi per company.' },
  { id: 'vendor', label: 'Vendor', tone: 'warning', order: 7, kind: 'portal', isSystem: true, canViewFullFinancials: false, scopeField: 'vendorId', description: 'Portal eksternal vendor (dulu bernama Supplier). Seluruh data diisolasi per vendor company.' }
])

/** Snapshot definisi role seed, diambil sebelum mutasi apa pun agar `resetRbacToDefaults()` selalu benar. */
const SEED_ROLE_DEFINITIONS: RoleDefinition[] = JSON.parse(JSON.stringify(ROLE_DEFINITIONS))

/**
 * Matriks grant seed. Ditulis sebagai object ringkas lalu di-flatten menjadi baris `RoleModuleGrant` —
 * modul yang tidak disebut otomatis `NONE`, jadi menambah role baru TIDAK memaksa mengisi 13 kolom.
 *
 * Aturan yang dipegang saat menyusun (Penyederhanaan 7-Role): setiap modul bisnis tetap punya minimal
 * satu role non-super-admin ber-level `MANAGE` — role yang melebur (`crm`/`marketing` → `sales`,
 * `bi`/`hr` → `management`, `vendor-partner`/`inventory` → `operations`) mewariskan `MANAGE` modulnya
 * ke role penerus, bukan turun jadi `VIEW`. Diuji otomatis di `app/data/rbac.test.ts`.
 */
const SEED_MODULE_LEVELS: Record<RoleId, Partial<Record<ModuleKey, PermissionLevel>>> = {
  'super-admin': Object.fromEntries(MODULE_KEYS.map(key => [key, 'ADMIN' as PermissionLevel])),
  management: {
    sales: 'APPROVE', 'finance-acc': 'APPROVE', crm: 'APPROVE', operations: 'APPROVE',
    'vendor-partner': 'VIEW', inventory: 'VIEW', marketing: 'VIEW',
    hr: 'MANAGE', bi: 'MANAGE', administration: 'VIEW', documents: 'MANAGE'
  },
  sales: {
    sales: 'MANAGE', crm: 'MANAGE', marketing: 'MANAGE', 'vendor-partner': 'VIEW', operations: 'VIEW', bi: 'VIEW', documents: 'VIEW'
  },
  finance: {
    sales: 'VIEW', 'finance-acc': 'MANAGE', crm: 'VIEW', 'vendor-partner': 'VIEW', operations: 'VIEW',
    hr: 'VIEW', inventory: 'VIEW', marketing: 'VIEW', bi: 'VIEW', documents: 'VIEW'
  },
  operations: {
    sales: 'VIEW', 'finance-acc': 'VIEW', crm: 'VIEW', operations: 'MANAGE',
    'vendor-partner': 'MANAGE', inventory: 'MANAGE', bi: 'VIEW', documents: 'MANAGE'
  },
  client: { 'client-portal': 'MANAGE' },
  vendor: { 'vendor-portal': 'MANAGE' }
}

function buildSeedModuleGrants (): RoleModuleGrant[] {
  const grants: RoleModuleGrant[] = []
  for (const roleId in SEED_MODULE_LEVELS) {
    const levels = SEED_MODULE_LEVELS[roleId]
    for (const moduleKey in levels) {
      const level = levels[moduleKey]
      if (level && level !== 'NONE') { grants.push({ roleId, moduleKey, level }) }
    }
  }
  return grants
}

export const ROLE_MODULE_GRANTS: RoleModuleGrant[] = reactive(buildSeedModuleGrants())

/**
 * Kosong saat seed — seluruh role mewarisi level dari modulnya. Baris baru hanya muncul ketika admin
 * meng-override satu menu tertentu dari Admin > Roles > Menus.
 */
export const ROLE_MENU_GRANTS: RoleMenuGrant[] = reactive([])

/**
 * Capability seed — menerjemahkan narrow role exception lama (array role literal di dalam halaman) ke
 * action flag yang bisa di-assign. `super-admin` sengaja tidak didaftarkan: ia lolos lewat `isSuperAdmin`.
 */
const SEED_CAPABILITIES: Record<string, RoleId[]> = {
  'project-order.accept-handover': ['operations'],
  'project-order.manage-operations': ['operations'],
  'project-order.manage-travelers': ['operations'],
  'project-order.log-change': ['operations'],
  'project-order.advance-step': ['operations', 'management'],
  'project-order.close': ['operations', 'management'],
  'project-order.view-margin': ['management', 'finance', 'operations'],
  [serviceCapabilityKey('flight')]: ['operations'],
  [serviceCapabilityKey('hotel')]: ['operations'],
  [serviceCapabilityKey('transportation')]: ['operations'],
  [serviceCapabilityKey('mice')]: ['operations'],
  [serviceCapabilityKey('additional')]: ['operations'],
  'sales.manage-lead': ['sales'],
  'sales.manage-opportunity': ['sales'],
  'sales.mark-won': ['sales'],
  'sales.approve-quotation': ['management'],
  'crm.manage-party': ['sales'],
  'crm.manage-follow-up': ['sales'],
  'finance.record-payment': ['finance'],
  'finance.manage-opex': ['finance'],
  'finance.close-period': ['finance', 'management'],
  'hr.manage-employee': ['management'],
  'hr.manage-payroll': ['management'],
  'hr.manage-performance': ['management'],
  'inventory.manage-asset': ['operations'],
  'admin.manage-users': [],
  'admin.manage-roles': [],
  'admin.manage-master-data': [],
  'admin.view-activity-center': []
}

function buildSeedCapabilityGrants (): RoleCapabilityGrant[] {
  const grants: RoleCapabilityGrant[] = []
  for (const capabilityKey in SEED_CAPABILITIES) {
    for (const roleId of SEED_CAPABILITIES[capabilityKey]) {
      grants.push({ roleId, capabilityKey, granted: true })
    }
  }
  return grants
}

export const ROLE_CAPABILITY_GRANTS: RoleCapabilityGrant[] = reactive(buildSeedCapabilityGrants())

/* ------------------------------------------------------------------ *
 * Selector
 * ------------------------------------------------------------------ */

export function getRoleDefinition (roleId: RoleId): RoleDefinition | undefined {
  return ROLE_DEFINITIONS.find(role => role.id === roleId)
}

/** Menerjemahkan role id lama (mis. `project-manager`) ke role baru bila role tsb sudah tidak ada. */
export function resolveRoleId (roleId: RoleId): RoleId {
  if (getRoleDefinition(roleId)) { return roleId }
  return LEGACY_ROLE_ALIAS[roleId] ?? roleId
}

/**
 * Perbandingan role yang sadar alias — dipakai saat memfilter daftar user (`USERS.filter(...)`), di mana
 * `usePermissions().isRole()` tidak berlaku karena yang dibandingkan bukan role user yang sedang login.
 */
export function matchesAnyRole (roleId: RoleId, candidates: RoleId[]): boolean {
  const resolved = resolveRoleId(roleId)
  return candidates.some(candidate => resolveRoleId(candidate) === resolved)
}

/** Kebalikan `matchesAnyRole` — true bila role BUKAN salah satu kandidat (alias tetap diresolusi). */
export function excludesAllRoles (roleId: RoleId, candidates: RoleId[]): boolean {
  return !matchesAnyRole(roleId, candidates)
}

export function getRoleLabel (roleId: RoleId): string {
  return getRoleDefinition(resolveRoleId(roleId))?.label ?? roleId
}

export function getSortedRoles (): RoleDefinition[] {
  return [...ROLE_DEFINITIONS].sort((a, b) => a.order - b.order)
}

export function getModuleGrant (roleId: RoleId, moduleKey: ModuleKey): RoleModuleGrant | undefined {
  const resolvedRole = resolveRoleId(roleId)
  const resolvedModule = resolveModuleKey(moduleKey)
  return ROLE_MODULE_GRANTS.find(grant => grant.roleId === resolvedRole && grant.moduleKey === resolvedModule)
}

export function getModuleLevel (roleId: RoleId, moduleKey: ModuleKey): PermissionLevel {
  if (getRoleDefinition(resolveRoleId(roleId))?.isSuperAdmin) { return 'ADMIN' }
  return getModuleGrant(roleId, moduleKey)?.level ?? 'NONE'
}

export function getMenuGrant (roleId: RoleId, menuKey: string): RoleMenuGrant | undefined {
  const resolvedRole = resolveRoleId(roleId)
  return ROLE_MENU_GRANTS.find(grant => grant.roleId === resolvedRole && grant.menuKey === menuKey)
}

/** Level efektif satu entri menu: override eksplisit menang, kalau tidak ada mewarisi level modul. */
export function getMenuLevel (roleId: RoleId, menuKey: string, moduleKey?: ModuleKey): PermissionLevel {
  if (getRoleDefinition(resolveRoleId(roleId))?.isSuperAdmin) { return 'ADMIN' }
  const explicit = getMenuGrant(roleId, menuKey)
  if (explicit) { return explicit.level }
  return moduleKey ? getModuleLevel(roleId, moduleKey) : 'NONE'
}

export function hasCapability (roleId: RoleId, capabilityKey: string): boolean {
  if (getRoleDefinition(resolveRoleId(roleId))?.isSuperAdmin) { return true }
  const resolvedRole = resolveRoleId(roleId)
  return ROLE_CAPABILITY_GRANTS.find(grant => grant.roleId === resolvedRole && grant.capabilityKey === capabilityKey)?.granted ?? false
}

export function getRolesWithCapability (capabilityKey: string): RoleId[] {
  const granted = ROLE_CAPABILITY_GRANTS.filter(grant => grant.capabilityKey === capabilityKey && grant.granted).map(grant => grant.roleId)
  const superAdmins = ROLE_DEFINITIONS.filter(role => role.isSuperAdmin).map(role => role.id)
  return Array.from(new Set([...superAdmins, ...granted]))
}

/* ------------------------------------------------------------------ *
 * Mutator — seluruhnya mencatat SystemEvent (Audit Trail)
 * ------------------------------------------------------------------ */

function pushRbacEvent (type: string, message: string, entityId?: string, userId?: string) {
  const sequence = SYSTEM_EVENTS.length + 1
  SYSTEM_EVENTS.push({
    id: `EVT-${String(sequence).padStart(3, '0')}-RBAC`,
    module: 'administration',
    type,
    message,
    entityId,
    userId,
    createdAt: DEMO_REFERENCE_DATE
  })
}

export interface RbacMutationResult {
  success: boolean
  /** Alasan penolakan, siap ditampilkan sebagai toast. Kosong bila `success`. */
  reason?: string
  roleId?: RoleId
}

function slugifyRoleId (label: string): string {
  const base = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'role'
  if (!getRoleDefinition(base)) { return base }
  let suffix = 2
  while (getRoleDefinition(`${base}-${suffix}`)) { suffix += 1 }
  return `${base}-${suffix}`
}

export interface CreateRoleInput {
  label: string
  tone?: RoleDefinition['tone']
  kind?: RoleDefinition['kind']
  description?: string
  /** Bila diisi, seluruh grant modul/menu/capability role sumber disalin. */
  cloneFromRoleId?: RoleId
}

export function createRole (input: CreateRoleInput, actorId?: string): RbacMutationResult {
  const label = input.label?.trim()
  if (!label) { return { success: false, reason: 'Nama role wajib diisi.' } }
  if (ROLE_DEFINITIONS.some(role => role.label.toLowerCase() === label.toLowerCase())) {
    return { success: false, reason: `Role dengan nama "${label}" sudah ada.` }
  }

  const id = slugifyRoleId(label)
  const source = input.cloneFromRoleId ? getRoleDefinition(resolveRoleId(input.cloneFromRoleId)) : undefined

  ROLE_DEFINITIONS.push({
    id,
    label,
    tone: input.tone ?? source?.tone ?? 'neutral',
    order: Math.max(0, ...ROLE_DEFINITIONS.map(role => role.order)) + 1,
    kind: input.kind ?? source?.kind ?? 'internal',
    isSystem: false,
    canViewFullFinancials: source?.canViewFullFinancials ?? false,
    scopeField: source?.scopeField,
    description: input.description?.trim() || (source ? `Disalin dari ${source.label}.` : undefined),
    clonedFromRoleId: source?.id,
    createdAt: DEMO_REFERENCE_DATE,
    createdBy: actorId
  })

  if (source) {
    for (const grant of ROLE_MODULE_GRANTS.filter(item => item.roleId === source.id)) {
      ROLE_MODULE_GRANTS.push({ roleId: id, moduleKey: grant.moduleKey, level: grant.level })
    }
    for (const grant of ROLE_MENU_GRANTS.filter(item => item.roleId === source.id)) {
      ROLE_MENU_GRANTS.push({ roleId: id, menuKey: grant.menuKey, level: grant.level })
    }
    for (const grant of ROLE_CAPABILITY_GRANTS.filter(item => item.roleId === source.id)) {
      ROLE_CAPABILITY_GRANTS.push({ roleId: id, capabilityKey: grant.capabilityKey, granted: grant.granted })
    }
  }

  pushRbacEvent('role-created', source ? `Role "${label}" dibuat dengan menyalin ${source.label}.` : `Role "${label}" dibuat.`, id, actorId)
  return { success: true, roleId: id }
}

export function updateRole (roleId: RoleId, patch: Partial<Pick<RoleDefinition, 'label' | 'tone' | 'description' | 'canViewFullFinancials'>>, actorId?: string): RbacMutationResult {
  const role = getRoleDefinition(resolveRoleId(roleId))
  if (!role) { return { success: false, reason: 'Role tidak ditemukan.' } }

  if (patch.label !== undefined) {
    const label = patch.label.trim()
    if (!label) { return { success: false, reason: 'Nama role wajib diisi.' } }
    if (ROLE_DEFINITIONS.some(item => item.id !== role.id && item.label.toLowerCase() === label.toLowerCase())) {
      return { success: false, reason: `Role dengan nama "${label}" sudah ada.` }
    }
    role.label = label
  }
  if (patch.tone !== undefined) { role.tone = patch.tone }
  if (patch.description !== undefined) { role.description = patch.description }
  if (patch.canViewFullFinancials !== undefined) { role.canViewFullFinancials = patch.canViewFullFinancials }

  pushRbacEvent('role-updated', `Role "${role.label}" diperbarui.`, role.id, actorId)
  return { success: true, roleId: role.id }
}

/**
 * Guard rail anti self-lockout — dipanggil sebelum setiap perubahan yang bisa mencabut akses
 * Administration dari role user yang sedang login. Tanpa backend, lockout bersifat permanen.
 */
export function wouldLockOutActor (roleId: RoleId, moduleKey: ModuleKey, level: PermissionLevel, actorRoleId?: RoleId): boolean {
  if (!actorRoleId) { return false }
  if (resolveRoleId(roleId) !== resolveRoleId(actorRoleId)) { return false }
  if (getRoleDefinition(resolveRoleId(actorRoleId))?.isSuperAdmin) { return false }
  if (resolveModuleKey(moduleKey) !== 'administration') { return false }
  return RANK[level] < RANK.ADMIN && RANK[getModuleLevel(roleId, 'administration')] >= RANK.ADMIN
}

export function setRoleModuleLevel (roleId: RoleId, moduleKey: ModuleKey, level: PermissionLevel, actorRoleId?: RoleId, actorId?: string): RbacMutationResult {
  const role = getRoleDefinition(resolveRoleId(roleId))
  if (!role) { return { success: false, reason: 'Role tidak ditemukan.' } }
  if (role.isSuperAdmin) { return { success: false, reason: 'Permission Super Admin tidak dapat diubah — role ini sengaja dikunci sebagai jalur pemulihan.' } }
  if (wouldLockOutActor(roleId, moduleKey, level, actorRoleId)) {
    return { success: false, reason: 'Ditolak: aksi ini akan mencabut akses Administration dari role Anda sendiri dan tidak bisa dibatalkan.' }
  }

  const resolvedModule = resolveModuleKey(moduleKey)
  const index = ROLE_MODULE_GRANTS.findIndex(grant => grant.roleId === role.id && grant.moduleKey === resolvedModule)

  if (level === 'NONE') {
    if (index !== -1) { ROLE_MODULE_GRANTS.splice(index, 1) }
  } else if (index === -1) {
    ROLE_MODULE_GRANTS.push({ roleId: role.id, moduleKey: resolvedModule, level })
  } else {
    ROLE_MODULE_GRANTS[index].level = level
  }

  pushRbacEvent('role-permission-updated', `Akses modul ${resolvedModule} untuk role "${role.label}" diubah menjadi ${level}.`, role.id, actorId)
  return { success: true, roleId: role.id }
}

export function setRoleMenuGrant (roleId: RoleId, menuKey: string, level: PermissionLevel, actorId?: string): RbacMutationResult {
  const role = getRoleDefinition(resolveRoleId(roleId))
  if (!role) { return { success: false, reason: 'Role tidak ditemukan.' } }
  if (role.isSuperAdmin) { return { success: false, reason: 'Permission Super Admin tidak dapat diubah.' } }

  const index = ROLE_MENU_GRANTS.findIndex(grant => grant.roleId === role.id && grant.menuKey === menuKey)
  if (index === -1) {
    ROLE_MENU_GRANTS.push({ roleId: role.id, menuKey, level })
  } else {
    ROLE_MENU_GRANTS[index].level = level
  }

  pushRbacEvent('role-menu-updated', `Menu "${menuKey}" untuk role "${role.label}" di-override menjadi ${level}.`, role.id, actorId)
  return { success: true, roleId: role.id }
}

/** Menghapus override menu sehingga kembali mewarisi level modul. */
export function clearRoleMenuGrant (roleId: RoleId, menuKey: string, actorId?: string): RbacMutationResult {
  const role = getRoleDefinition(resolveRoleId(roleId))
  if (!role) { return { success: false, reason: 'Role tidak ditemukan.' } }

  const index = ROLE_MENU_GRANTS.findIndex(grant => grant.roleId === role.id && grant.menuKey === menuKey)
  if (index !== -1) {
    ROLE_MENU_GRANTS.splice(index, 1)
    pushRbacEvent('role-menu-reset', `Override menu "${menuKey}" untuk role "${role.label}" dihapus (kembali mengikuti modul).`, role.id, actorId)
  }
  return { success: true, roleId: role.id }
}

export function setRoleCapability (roleId: RoleId, capabilityKey: string, granted: boolean, actorId?: string): RbacMutationResult {
  const role = getRoleDefinition(resolveRoleId(roleId))
  if (!role) { return { success: false, reason: 'Role tidak ditemukan.' } }
  if (role.isSuperAdmin) { return { success: false, reason: 'Permission Super Admin tidak dapat diubah.' } }

  const index = ROLE_CAPABILITY_GRANTS.findIndex(grant => grant.roleId === role.id && grant.capabilityKey === capabilityKey)
  if (!granted) {
    if (index !== -1) { ROLE_CAPABILITY_GRANTS.splice(index, 1) }
  } else if (index === -1) {
    ROLE_CAPABILITY_GRANTS.push({ roleId: role.id, capabilityKey, granted: true })
  } else {
    ROLE_CAPABILITY_GRANTS[index].granted = true
  }

  pushRbacEvent('role-capability-updated', `Action flag "${capabilityKey}" untuk role "${role.label}" ${granted ? 'diaktifkan' : 'dinonaktifkan'}.`, role.id, actorId)
  return { success: true, roleId: role.id }
}

/* ------------------------------------------------------------------ *
 * Penugasan user ke role
 * ------------------------------------------------------------------ */

export function getUsersByRole (roleId: RoleId) {
  const resolved = resolveRoleId(roleId)
  return USERS.filter(user => resolveRoleId(user.role) === resolved)
}

export function countUsersByRole (roleId: RoleId): number {
  return getUsersByRole(roleId).length
}

export function assignUserRole (userId: string, roleId: RoleId, actorId?: string): RbacMutationResult {
  const user = USERS.find(item => item.id === userId)
  if (!user) { return { success: false, reason: 'User tidak ditemukan.' } }

  const role = getRoleDefinition(resolveRoleId(roleId))
  if (!role) { return { success: false, reason: 'Role tidak ditemukan.' } }

  /**
   * Guard rail: jangan sampai tidak ada satu pun Super Admin aktif yang tersisa — itu satu-satunya role
   * yang mustahil terkunci, jadi menghabiskannya sama saja mengunci seluruh Administration secara permanen.
   */
  const wasSuperAdmin = getRoleDefinition(resolveRoleId(user.role))?.isSuperAdmin
  if (wasSuperAdmin && !role.isSuperAdmin) {
    const remaining = USERS.filter(item => item.id !== user.id && getRoleDefinition(resolveRoleId(item.role))?.isSuperAdmin)
    if (remaining.length === 0) {
      return { success: false, reason: 'Ditolak: ini satu-satunya Super Admin yang tersisa. Tunjuk Super Admin lain lebih dulu.' }
    }
  }

  const previousLabel = getRoleLabel(user.role)
  user.role = role.id
  /** Field isolasi portal hanya relevan untuk role portal — dibersihkan saat pindah ke role internal. */
  if (role.scopeField !== 'vendorId') { user.vendorId = undefined }
  if (role.scopeField !== 'clientPartyId') { user.clientPartyId = undefined }

  pushRbacEvent('user-role-assigned', `Role ${user.name} diubah dari "${previousLabel}" menjadi "${role.label}".`, user.id, actorId)
  return { success: true, roleId: role.id }
}

export function deleteRole (roleId: RoleId, actorId?: string): RbacMutationResult {
  const role = getRoleDefinition(resolveRoleId(roleId))
  if (!role) { return { success: false, reason: 'Role tidak ditemukan.' } }
  if (role.isSystem) { return { success: false, reason: `"${role.label}" adalah role bawaan sistem dan tidak dapat dihapus. Ubah permission-nya bila perlu.` } }

  const assignedUserCount = countUsersByRole(role.id)
  if (assignedUserCount > 0) {
    return { success: false, reason: `Masih ada ${assignedUserCount} user pada role ini. Pindahkan user tersebut lebih dulu.` }
  }

  const removeAll = <T extends { roleId: RoleId }>(list: T[]) => {
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (list[index].roleId === role.id) { list.splice(index, 1) }
    }
  }
  removeAll(ROLE_MODULE_GRANTS)
  removeAll(ROLE_MENU_GRANTS)
  removeAll(ROLE_CAPABILITY_GRANTS)
  ROLE_DEFINITIONS.splice(ROLE_DEFINITIONS.findIndex(item => item.id === role.id), 1)

  pushRbacEvent('role-deleted', `Role "${role.label}" dihapus.`, role.id, actorId)
  return { success: true, roleId: role.id }
}

/**
 * Pemulihan darurat — mengembalikan seluruh konfigurasi RBAC ke seed tanpa menyentuh data lain.
 * Dipakai tombol di Settings; lebih tepat sasaran daripada "Reset Demo Data" penuh.
 */
export function resetRbacToDefaults (actorId?: string): RbacMutationResult {
  ROLE_DEFINITIONS.splice(0, ROLE_DEFINITIONS.length, ...JSON.parse(JSON.stringify(SEED_ROLE_DEFINITIONS)))
  ROLE_MODULE_GRANTS.splice(0, ROLE_MODULE_GRANTS.length, ...buildSeedModuleGrants())
  ROLE_MENU_GRANTS.splice(0, ROLE_MENU_GRANTS.length)
  ROLE_CAPABILITY_GRANTS.splice(0, ROLE_CAPABILITY_GRANTS.length, ...buildSeedCapabilityGrants())
  pushRbacEvent('rbac-reset', 'Konfigurasi role & permission dikembalikan ke default.', undefined, actorId)
  return { success: true }
}
