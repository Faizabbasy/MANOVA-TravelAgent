import type { ModuleKey, PermissionLevel, RoleId } from '~/types/user'
import type { StatusOption } from '~/types/common'

/** Seluruh role demo (Prompt 0-E / D-003) — dipakai lintas navigation, dashboard, dan role switcher. */
export const ROLES: StatusOption<RoleId>[] = [
  { value: 'super-admin', label: 'Super Admin', tone: 'destructive', order: 1 },
  { value: 'management', label: 'Management', tone: 'purple', order: 2 },
  { value: 'sales', label: 'Sales', tone: 'primary', order: 3 },
  { value: 'project-manager', label: 'Project Manager', tone: 'info', order: 4 },
  { value: 'operations', label: 'Operations', tone: 'info', order: 5 },
  { value: 'ticketing', label: 'Ticketing', tone: 'info', order: 6 },
  { value: 'accommodation', label: 'Accommodation', tone: 'info', order: 7 },
  { value: 'transportation', label: 'Transportation', tone: 'info', order: 8 },
  { value: 'mice', label: 'MICE', tone: 'info', order: 9 },
  { value: 'finance', label: 'Finance', tone: 'success', order: 10 },
  { value: 'viewer', label: 'Viewer / Auditor', tone: 'neutral', order: 11 },
]

/**
 * Role & Access Matrix — sumber tunggal, mengikuti docs/route-and-role-matrix.md bagian 5.
 * Granularity modul (bukan field-level), sesuai D-030.
 */
export const ROLE_MODULE_ACCESS: Record<RoleId, Record<ModuleKey, PermissionLevel>> = {
  'super-admin': { crm: 'ADMIN', project: 'ADMIN', vendor: 'ADMIN', finance: 'ADMIN', reports: 'ADMIN', administration: 'ADMIN' },
  management: { crm: 'APPROVE', project: 'APPROVE', vendor: 'VIEW', finance: 'VIEW', reports: 'VIEW', administration: 'VIEW' },
  sales: { crm: 'MANAGE', project: 'VIEW', vendor: 'NONE', finance: 'NONE', reports: 'VIEW', administration: 'NONE' },
  'project-manager': { crm: 'VIEW', project: 'MANAGE', vendor: 'VIEW', finance: 'VIEW', reports: 'VIEW', administration: 'NONE' },
  operations: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE' },
  ticketing: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE' },
  accommodation: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE' },
  transportation: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE' },
  mice: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE' },
  finance: { crm: 'VIEW', project: 'VIEW', vendor: 'VIEW', finance: 'MANAGE', reports: 'VIEW', administration: 'NONE' },
  viewer: { crm: 'VIEW', project: 'VIEW', vendor: 'VIEW', finance: 'VIEW', reports: 'VIEW', administration: 'VIEW' },
}

/** Role yang dapat melihat breakdown finansial penuh (Budget/Actual/Margin) — docs/route-and-role-matrix.md bagian 5.1. */
export const FULL_FINANCIAL_VISIBILITY_ROLES: RoleId[] = [
  'super-admin', 'management', 'finance', 'project-manager', 'viewer',
]
