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
 * `bookings` (Section 18, D-075) — menggerbangi `/bookings/*` (Booking Orchestration/Timeline konsolidasi lintas Flight/Hotel/Transport/MICE, D-070/D-071/D-072/D-073 — BUKAN `ServiceOrder` Procurement Section 17, lihat `docs/frontend-known-issues.md` bagian 13 disambiguasi). `operations` `MANAGE` (acceptance literal "satu sumber kebenaran seluruh service"), `project-manager`/`management`/`finance`/`viewer` `VIEW`, role lain (termasuk `ticketing`/`accommodation`/`transportation`/`mice` — tetap mengelola modul masing-masing langsung, bukan lewat konsolidasi ini) `NONE`.
 * `changes` (Section 19, D-076) — menggerbangi `/changes/*` (`ChangeRequest`/`CancellationRecord`/`RefundRequest`/`Incident` — exception management lintas Flight/Hotel/Transport/MICE, fully additive di atas Section 13-18). `operations`/`project-manager` `MANAGE` (pemilik operasional exception harian), `management`/`finance`/`viewer` `VIEW` (Management tetap approver komersial lewat `canApprove('project')` existing, pola sama Section 14 lama), role lain `NONE` — Client/Supplier mengakses versi sanitized lewat `client-portal`/`supplier-portal` masing-masing, bukan modul ini.
 * `documents` (Section 21, D-078) — menggerbangi `/documents/*` (Document center konsolidasi/Communication/Notification center, fully additive di atas `ProjectDocument`/`VendorDocument`). `management`/`project-manager`/`operations` `MANAGE` (pemilik pengelolaan dokumen/komunikasi operasional harian), mayoritas role internal lain `VIEW` (kolaborasi lintas modul), `client`/`supplier` `NONE` di modul top-level ini — mereka tetap mendapat scoped view lewat `client-portal`/`supplier-portal` masing-masing (dokumen/pesan client/supplier-facing existing, TIDAK lewat modul ini).
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
  | 'bookings'
  | 'changes'
  | 'documents'

/** Access review / suspend state (Section 23 — Administration, Master Data dan Audit, D-080). */
export type UserStatus = 'active' | 'suspended'

export interface User {
  id: ID
  name: string
  email: string
  role: RoleId
  status: UserStatus
  /** WAJIB diisi saat `status` berpindah ke `suspended` — pola alasan-wajib yang sama dengan seluruh transisi destruktif lain di codebase ini. Dikosongkan kembali oleh `reactivateUser`. */
  suspendedReason?: string
  suspendedAt?: string
  /** Vendor isolation (Prompt 19) — hanya terisi untuk role `supplier`; menentukan satu-satunya `Vendor` company yang boleh dilihat user ini. */
  vendorId?: ID
  /** Client isolation (Section 02) — hanya terisi untuk role `client`; menentukan satu-satunya `Party` (company) yang boleh dilihat user ini di `/client/*`. */
  clientPartyId?: ID
}
