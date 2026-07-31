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
 * `product-planning` (Section 10) — menggerbangi `/product-planning/*` (Product/Package template catalog dan Cost Sheet); `product-planner` `MANAGE`, `account-executive`/`operations`/`finance`/`project-manager` `VIEW` (kolaborasi, lihat `docs/route-and-role-matrix.md`).
 * `ticketing` (Section 13) — menggerbangi `/ticketing/*` (`FlightBooking` lifecycle); `ticketing` `MANAGE`, `management`/`finance`/`project-manager`/`operations`/`viewer` `VIEW` (visibilitas lintas-tim), role lain `NONE`.
 * `accommodation` (Section 14) — menggerbangi `/accommodation/*` (`HotelBooking` lifecycle), pola arsitektur IDENTIK `ticketing` (D-070); `accommodation` `MANAGE`, `management`/`finance`/`project-manager`/`operations`/`viewer` `VIEW`, role lain `NONE`.
 * `transportation` (Section 15) — menggerbangi `/transportation/*` (`TransportBooking` lifecycle), pola arsitektur IDENTIK `ticketing`/`accommodation` (D-070/D-071); `transportation` `MANAGE`, `management`/`finance`/`project-manager`/`operations`/`viewer` `VIEW`, role lain `NONE`.
 * `mice` (Section 16) — menggerbangi `/mice/*` (`MiceEvent` lifecycle), pola arsitektur IDENTIK `ticketing`/`accommodation`/`transportation` (D-070/D-071/D-072); `mice` `MANAGE`, `management`/`finance`/`project-manager`/`operations`/`viewer` `VIEW`, role lain `NONE`.
 * `procurement` (Section 17) — menggerbangi `/procurement/*` (`RFQ`/`ServiceOrder`/`SupplierInvoice` lifecycle, D-074), TERPISAH dari `vendor` (direktori master data, tetap ada). `procurement` `MANAGE`, `management`/`finance`/`project-manager`/`operations`/`viewer` `VIEW`, role lain `NONE`.
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
  | 'product-planning'
  | 'ticketing'
  | 'accommodation'
  | 'transportation'
  | 'mice'
  | 'procurement'

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
