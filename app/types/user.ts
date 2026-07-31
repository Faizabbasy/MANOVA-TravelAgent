import type { ID } from './common'

/** `product-planner`/`procurement`/`client` (Section 02 — Role, Access dan Navigation) — role final roadmap Section 00–24, lihat `prompts/01-PROTOKOL-WAJIB.md`. */
export type RoleId =
  | 'super-admin'
  | 'management'
  | 'account-executive'
  | 'sales'
  | 'product-planner'
  | 'project-manager'
  | 'operations'
  | 'ticketing'
  | 'accommodation'
  | 'transportation'
  | 'mice'
  | 'procurement'
  | 'finance'
  | 'viewer'
  | 'client'
  | 'supplier'

export type PermissionLevel = 'NONE' | 'VIEW' | 'MANAGE' | 'APPROVE' | 'ADMIN'

/**
 * `supplier-portal` (Prompt 19 — Change Request) — modul terpisah dari `vendor` (direktori vendor internal); menggerbangi `/supplier/*`, hanya role `supplier` yang punya akses.
 * `client-portal` (Section 02) — modul terpisah, pola sama seperti `supplier-portal`; menggerbangi `/client/*`, hanya role `client` yang punya akses (isolasi per company, D-050: Client = `Party`).
 */
export type ModuleKey =
  | 'crm'
  | 'project'
  | 'vendor'
  | 'finance'
  | 'reports'
  | 'administration'
  | 'supplier-portal'
  | 'client-portal'

export interface User {
  id: ID
  name: string
  email: string
  role: RoleId
  /** Vendor isolation (Prompt 19) — hanya terisi untuk role `supplier`; menentukan satu-satunya `Vendor` company yang boleh dilihat user ini. */
  vendorId?: ID
  /** Client isolation (Section 02) — hanya terisi untuk role `client`; menentukan satu-satunya `Party` (company) yang boleh dilihat user ini di `/client/*`. */
  clientPartyId?: ID
}
