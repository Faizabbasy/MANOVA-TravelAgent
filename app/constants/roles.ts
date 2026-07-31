import type { ModuleKey, PermissionLevel, RoleId } from '~/types/user'
import type { StatusOption } from '~/types/common'

/** Seluruh role demo (Prompt 0-E / D-003) — dipakai lintas navigation, dashboard, dan role switcher. */
/** `account-executive` dan `supplier` ditambahkan Prompt 19 (Change Request) — lihat D-046, `docs/mockup-design-decisions.md`. */
/** `product-planner`, `procurement`, `client` ditambahkan Section 02 (roadmap Section 00–24 baru) — role final sesuai `prompts/01-PROTOKOL-WAJIB.md`. */
export const ROLES: StatusOption<RoleId>[] = [
  { value: 'super-admin', label: 'Super Admin', tone: 'destructive', order: 1 },
  { value: 'management', label: 'Management', tone: 'purple', order: 2 },
  { value: 'account-executive', label: 'Account Executive', tone: 'primary', order: 3 },
  { value: 'sales', label: 'Sales', tone: 'primary', order: 4 },
  { value: 'product-planner', label: 'Product Planner / Travel Consultant', tone: 'primary', order: 5 },
  { value: 'project-manager', label: 'Project Manager', tone: 'info', order: 6 },
  { value: 'operations', label: 'Operations', tone: 'info', order: 7 },
  { value: 'ticketing', label: 'Ticketing', tone: 'info', order: 8 },
  { value: 'accommodation', label: 'Accommodation', tone: 'info', order: 9 },
  { value: 'transportation', label: 'Transportation', tone: 'info', order: 10 },
  { value: 'mice', label: 'MICE', tone: 'info', order: 11 },
  { value: 'procurement', label: 'Procurement / Vendor Management', tone: 'warning', order: 12 },
  { value: 'finance', label: 'Finance', tone: 'success', order: 13 },
  { value: 'viewer', label: 'Viewer / Auditor', tone: 'neutral', order: 14 },
  { value: 'client', label: 'Client', tone: 'warning', order: 15 },
  { value: 'supplier', label: 'Supplier', tone: 'warning', order: 16 },
]

/**
 * Role & Access Matrix — sumber tunggal, mengikuti docs/route-and-role-matrix.md bagian 5.
 * Granularity modul (bukan field-level), sesuai D-030.
 */
/**
 * `supplier-portal` (kolom Prompt 19) — modul terpisah dari `vendor` (direktori internal); hanya
 * `supplier` yang `MANAGE` (kelola katalog/quotation milik sendiri), `super-admin` `ADMIN` (oversight),
 * seluruh role internal lain `NONE` (mereka pakai modul `vendor`, bukan `supplier-portal`).
 * `client-portal` (kolom baru Section 02) — pola identik `supplier-portal`: hanya `client` yang `MANAGE`
 * (portal milik company sendiri, diisolasi lebih lanjut per `clientPartyId`), `super-admin` `ADMIN`
 * (oversight, tetap tidak bocor data company manapun karena `clientScopeId` kosong untuk role selain
 * `client`), seluruh role internal lain `NONE`.
 */
export const ROLE_MODULE_ACCESS: Record<RoleId, Record<ModuleKey, PermissionLevel>> = {
  'super-admin': { crm: 'ADMIN', project: 'ADMIN', vendor: 'ADMIN', finance: 'ADMIN', reports: 'ADMIN', administration: 'ADMIN', 'supplier-portal': 'ADMIN', 'client-portal': 'ADMIN' },
  management: { crm: 'APPROVE', project: 'APPROVE', vendor: 'VIEW', finance: 'VIEW', reports: 'VIEW', administration: 'VIEW', 'supplier-portal': 'NONE', 'client-portal': 'NONE' },
  /** Account Executive (Prompt 19) — mengambil alih pengelolaan Opportunity/Quotation dari Sales (lihat D-046); rank sama seperti Sales lama (`MANAGE` hingga Won-Requested, gerbang halus via narrow-role-exception di halaman, bukan constant baru). */
  'account-executive': { crm: 'MANAGE', project: 'VIEW', vendor: 'NONE', finance: 'NONE', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE' },
  /** Sales (dipersempit Prompt 19) — kini scoped ke Lead (modul `crm` tetap dipakai karena Lead adalah pre-Party/Opportunity record dalam domain CRM yang sama, granularity tetap modul bukan field sesuai D-030); TIDAK lagi dapat mengelola Opportunity/Quotation (gate dipindah ke `account-executive`, lihat Opportunity Detail). */
  sales: { crm: 'MANAGE', project: 'VIEW', vendor: 'NONE', finance: 'NONE', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE' },
  /** Product Planner / Travel Consultant (baru, Section 02) — belum ada modul dedicated (Section 10 — Product Planning dan Costing), diberi akses baca ke Opportunity/Project/Vendor rate sebagai referensi costing agar tidak buntu di navigasi sebelum Section 10 dikerjakan. */
  'product-planner': { crm: 'VIEW', project: 'VIEW', vendor: 'VIEW', finance: 'NONE', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE' },
  'project-manager': { crm: 'VIEW', project: 'MANAGE', vendor: 'VIEW', finance: 'VIEW', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE' },
  operations: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE' },
  ticketing: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE' },
  accommodation: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE' },
  transportation: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE' },
  mice: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE' },
  /** Procurement / Vendor Management (baru, Section 02) — pemilik modul `vendor` sesungguhnya (RFQ/sourcing/vendor directory, Section 17), diberi `MANAGE` (satu-satunya role non-Super-Admin dengan `vendor` di atas `VIEW` — sebelum ini hanya Super Admin yang bisa Tambah Vendor di `/vendors`). */
  procurement: { crm: 'NONE', project: 'VIEW', vendor: 'MANAGE', finance: 'NONE', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE' },
  finance: { crm: 'VIEW', project: 'VIEW', vendor: 'VIEW', finance: 'MANAGE', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE' },
  viewer: { crm: 'VIEW', project: 'VIEW', vendor: 'VIEW', finance: 'VIEW', reports: 'VIEW', administration: 'VIEW', 'supplier-portal': 'NONE', 'client-portal': 'NONE' },
  /** Client (baru, Section 02) — External Partner, tidak punya akses modul internal apa pun (Prompt 0-H/Protokol: "Jangan menampilkan internal cost/margin kepada Client"); seluruh visibilitas dibatasi ke `client-portal`, diisolasi per `clientPartyId` (`usePermissions().clientScopeId`, pola identik `vendorScopeId`). Shell minimal (`/client`) dibangun Section 02; fitur penuh (quotation confirm, document, dst.) menjadi tanggung jawab Section 08. */
  client: { crm: 'NONE', project: 'NONE', vendor: 'NONE', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'MANAGE' },
  /** Supplier (Prompt 19) — External Partner, tidak punya akses modul internal apa pun; seluruh visibilitas dibatasi ke `supplier-portal` dan diisolasi lebih lanjut per `vendorId` (`usePermissions`/halaman `/supplier/*`), BUKAN lewat `vendor` module (yang tetap "internal directory, lihat semua vendor"). */
  supplier: { crm: 'NONE', project: 'NONE', vendor: 'NONE', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'MANAGE', 'client-portal': 'NONE' },
}

/** Role yang dapat melihat breakdown finansial penuh (Budget/Actual/Margin) — docs/route-and-role-matrix.md bagian 5.1. */
export const FULL_FINANCIAL_VISIBILITY_ROLES: RoleId[] = [
  'super-admin', 'management', 'finance', 'project-manager', 'viewer',
]
