/**
 * Server-side RBAC — the security boundary (ADR-003). The frontend copy (frontend/app/data/rbac.ts) only
 * decides what to show; every API read and write is checked against THIS table.
 *
 * Three active roles (Penyederhanaan 3-Role, 29 Sep 2026 — ADR-006):
 *  - super-admin: everything, including Finance
 *  - admin:       every module except Finance (former management / sales / operations)
 *  - finance:     the Finance module, plus read access to other modules as context
 * `client` and `vendor` stay defined (row scope is kept and tested) but are `active: false`: their users
 * cannot sign in until PORTAL_LOGIN is enabled.
 *
 * Module levels and pre-existing capabilities mirror the frontend seed exactly. `finance.*` capabilities
 * from docs/manova-finance-implementation/09 are server-only for now; the UI reads them from GET /auth/me.
 * The matrix is code-reviewed and versioned with the code until a roles table is justified.
 */

export const ROLE_IDS = ['super-admin', 'admin', 'finance', 'client', 'vendor'] as const
export type RoleId = (typeof ROLE_IDS)[number]

export const MODULE_KEYS = [
  'sales', 'finance-acc', 'crm', 'vendor-partner', 'operations', 'hr', 'inventory', 'marketing', 'bi',
  'administration', 'documents', 'client-portal', 'vendor-portal'
] as const
export type ModuleKey = (typeof MODULE_KEYS)[number]

export const PERMISSION_LEVELS = ['NONE', 'VIEW', 'MANAGE', 'APPROVE', 'ADMIN'] as const
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number]
const RANK: Record<PermissionLevel, number> = { NONE: 0, VIEW: 1, MANAGE: 2, APPROVE: 3, ADMIN: 4 }

export interface RoleDefinition {
  id: RoleId
  label: string
  kind: 'internal' | 'portal'
  isSuperAdmin: boolean
  /** Inactive roles cannot sign in (portals are switched off for now). */
  active: boolean
  /** Budget, actual cost, margin and vendor net cost. */
  canViewFullFinancials: boolean
  scopeField?: 'partyId' | 'vendorId'
}

export const ROLE_DEFINITIONS: Record<RoleId, RoleDefinition> = {
  'super-admin': { id: 'super-admin', label: 'Super Admin', kind: 'internal', isSuperAdmin: true, active: true, canViewFullFinancials: true },
  admin: { id: 'admin', label: 'Admin', kind: 'internal', isSuperAdmin: false, active: true, canViewFullFinancials: true },
  finance: { id: 'finance', label: 'Finance', kind: 'internal', isSuperAdmin: false, active: true, canViewFullFinancials: true },
  client: { id: 'client', label: 'Client', kind: 'portal', isSuperAdmin: false, active: false, canViewFullFinancials: false, scopeField: 'partyId' },
  vendor: { id: 'vendor', label: 'Vendor', kind: 'portal', isSuperAdmin: false, active: false, canViewFullFinancials: false, scopeField: 'vendorId' }
}

const MODULE_LEVELS: Record<Exclude<RoleId, 'super-admin'>, Partial<Record<ModuleKey, PermissionLevel>>> = {
  // Highest level any merged role held, and deliberately no finance-acc.
  admin: {
    sales: 'APPROVE', crm: 'APPROVE', operations: 'APPROVE',
    'vendor-partner': 'MANAGE', inventory: 'MANAGE', marketing: 'MANAGE',
    hr: 'MANAGE', bi: 'MANAGE', administration: 'MANAGE', documents: 'MANAGE'
  },
  finance: {
    sales: 'VIEW', 'finance-acc': 'MANAGE', crm: 'VIEW', 'vendor-partner': 'VIEW', operations: 'VIEW',
    hr: 'VIEW', inventory: 'VIEW', marketing: 'VIEW', bi: 'VIEW', documents: 'VIEW'
  },
  client: { 'client-portal': 'MANAGE' },
  vendor: { 'vendor-portal': 'MANAGE' }
}

type GrantedTo = Exclude<RoleId, 'super-admin'>[]

/** super-admin is never listed: it passes every check through `isSuperAdmin`, as in the frontend. */
const CAPABILITY_GRANTS = {
  // Existing (frontend/app/data/rbac.ts SEED_CAPABILITIES)
  'project-order.accept-handover': ['admin'],
  'project-order.manage-operations': ['admin'],
  'project-order.manage-travelers': ['admin'],
  'project-order.log-change': ['admin'],
  'project-order.advance-step': ['admin'],
  'project-order.close': ['admin'],
  'project-order.view-margin': ['admin', 'finance'],
  /** ADR-007 #3: payment status without amounts (DP diterima / Lunas / Terlambat) on project, booking, vendor, customer. */
  'project-order.view-payment-status': ['admin', 'finance'],
  /** Phase 5: cancel a booking/project and open its refund case (operations and Finance). Amounts stay Finance-only. */
  'project-order.request-cancellation': ['admin', 'finance'],
  'project-order.manage-service.flight': ['admin'],
  'project-order.manage-service.hotel': ['admin'],
  'project-order.manage-service.transportation': ['admin'],
  'project-order.manage-service.mice': ['admin'],
  'project-order.manage-service.additional': ['admin'],
  'sales.manage-lead': ['admin'],
  'sales.manage-lead-pipeline': ['admin'],
  'sales.mark-won': ['admin'],
  'sales.approve-quotation': ['admin'],
  'crm.manage-party': ['admin'],
  'crm.manage-follow-up': ['admin'],
  'finance.record-payment': ['finance'],
  'finance.manage-opex': ['finance'],
  'finance.close-period': ['finance'],
  'hr.manage-employee': ['admin'],
  'hr.manage-payroll': ['admin'],
  'hr.manage-performance': ['admin'],
  'inventory.manage-asset': ['admin'],
  // Users and roles stay super-admin only: whoever manages roles could grant themselves Finance.
  'admin.manage-users': [],
  'admin.manage-roles': [],
  'admin.manage-master-data': ['admin'],
  'admin.view-activity-center': ['admin'],

  // Finance capability matrix (docs/manova-finance-implementation/09-RBAC-AUDIT-VALIDATION.md)
  'finance.view-cash': ['finance'],
  'finance.view-cash-flow': ['finance'],
  'finance.manage-bank-accounts': ['finance'],
  /** Checker for opening balances: deliberately NOT the finance maker role — super-admin only. */
  'finance.approve-opening-balance': [],
  'finance.post-cash': ['finance'],
  'finance.manage-receivables': ['finance'],
  'finance.manage-payables': ['finance'],
  'finance.approve-refund': ['finance'],
  'finance.settle-refund': ['finance'],
  'finance.manage-policy': ['finance'],
  'finance.view-project-finance': ['finance']
} satisfies Record<string, GrantedTo>

export type CapabilityKey = keyof typeof CAPABILITY_GRANTS
export const CAPABILITY_KEYS = Object.keys(CAPABILITY_GRANTS) as CapabilityKey[]

/** The authenticated caller, as resolved from the server session. Never built from request input. */
export interface Actor {
  userId: string
  name: string
  email: string
  role: RoleId
  /** Set only for role `client`. */
  partyId: string | null
  /** Set only for role `vendor`. */
  vendorId: string | null
  sessionId: string
}

export function isRoleId(value: string): value is RoleId {
  return (ROLE_IDS as readonly string[]).includes(value)
}

/** Whether users of this role may hold a session. Portal roles only when PORTAL_LOGIN is enabled. */
export function canRoleSignIn(role: RoleId, portalLogin: boolean): boolean {
  const definition = ROLE_DEFINITIONS[role]
  return definition.active || (definition.kind === 'portal' && portalLogin)
}

export function moduleLevel(role: RoleId, module: ModuleKey): PermissionLevel {
  if (ROLE_DEFINITIONS[role].isSuperAdmin) return 'ADMIN'
  return MODULE_LEVELS[role as Exclude<RoleId, 'super-admin'>][module] ?? 'NONE'
}

export function hasModuleLevel(role: RoleId, module: ModuleKey, required: PermissionLevel): boolean {
  return RANK[moduleLevel(role, module)] >= RANK[required]
}

export function hasCapability(role: RoleId, capability: CapabilityKey): boolean {
  if (ROLE_DEFINITIONS[role].isSuperAdmin) return true
  return (CAPABILITY_GRANTS[capability] as readonly RoleId[]).includes(role)
}

export function permissionsOf(role: RoleId): { modules: Record<ModuleKey, PermissionLevel>; capabilities: CapabilityKey[] } {
  return {
    modules: Object.fromEntries(MODULE_KEYS.map(m => [m, moduleLevel(role, m)])) as Record<ModuleKey, PermissionLevel>,
    capabilities: CAPABILITY_KEYS.filter(c => hasCapability(role, c))
  }
}
