import type { ID } from './common'

export type RoleId =
  | 'super-admin'
  | 'management'
  | 'account-executive'
  | 'sales'
  | 'project-manager'
  | 'operations'
  | 'ticketing'
  | 'accommodation'
  | 'transportation'
  | 'mice'
  | 'finance'
  | 'viewer'
  | 'supplier'

export type PermissionLevel = 'NONE' | 'VIEW' | 'MANAGE' | 'APPROVE' | 'ADMIN'

/** `supplier-portal` (Prompt 19 — Change Request) — modul terpisah dari `vendor` (direktori vendor internal); menggerbangi `/supplier/*`, hanya role `supplier` yang punya akses. */
export type ModuleKey =
  | 'crm'
  | 'project'
  | 'vendor'
  | 'finance'
  | 'reports'
  | 'administration'
  | 'supplier-portal'

export interface User {
  id: ID
  name: string
  email: string
  role: RoleId
  /** Vendor isolation (Prompt 19) — hanya terisi untuk role `supplier`; menentukan satu-satunya `Vendor` company yang boleh dilihat user ini. */
  vendorId?: ID
}
