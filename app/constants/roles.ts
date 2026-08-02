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
  { value: 'supplier', label: 'Supplier', tone: 'warning', order: 16 }
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
 * `changes` (Section 19, D-076) — `operations`/`project-manager` `MANAGE` (pemilik operasional exception
 * harian: Change Request/Cancellation/Refund/Incident), `management`/`finance`/`viewer` `VIEW` (Management
 * tetap approver komersial lewat `canApprove('project')` existing, BUKAN lewat rank modul `changes` — pola
 * sama Section 14 lama), role lain `NONE`. Client/Supplier TIDAK punya akses modul ini sama sekali — mereka
 * melihat versi sanitized lewat `client-portal`/`supplier-portal` masing-masing.
 * `documents` (Section 21, D-078) — `management`/`project-manager`/`operations` `MANAGE` (pengelolaan
 * dokumen/komunikasi operasional harian), mayoritas role internal lain `VIEW` (kolaborasi), `client`/
 * `supplier` `NONE` — mereka TIDAK mengakses modul top-level ini, dokumen/komunikasi client/supplier-facing
 * tetap lewat `client-portal`/`supplier-portal` (`getDocumentsByParty` dkk., TIDAK diperluas Section 21).
 */
export const ROLE_MODULE_ACCESS: Record<RoleId, Record<ModuleKey, PermissionLevel>> = {
  'super-admin': { crm: 'ADMIN', project: 'ADMIN', vendor: 'ADMIN', finance: 'ADMIN', reports: 'ADMIN', administration: 'ADMIN', 'supplier-portal': 'ADMIN', 'client-portal': 'ADMIN', 'product-planning': 'ADMIN', ticketing: 'ADMIN', accommodation: 'ADMIN', transportation: 'ADMIN', mice: 'ADMIN', procurement: 'ADMIN', bookings: 'ADMIN', changes: 'ADMIN', documents: 'ADMIN' },
  management: { crm: 'APPROVE', project: 'APPROVE', vendor: 'VIEW', finance: 'VIEW', reports: 'VIEW', administration: 'VIEW', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'VIEW', ticketing: 'VIEW', accommodation: 'VIEW', transportation: 'VIEW', mice: 'VIEW', procurement: 'VIEW', bookings: 'VIEW', changes: 'VIEW', documents: 'MANAGE' },
  /** Account Executive (Prompt 19) — mengambil alih pengelolaan Opportunity/Quotation dari Sales (lihat D-046); rank sama seperti Sales lama (`MANAGE` hingga Won-Requested, gerbang halus via narrow-role-exception di halaman, bukan constant baru). `product-planning` `VIEW` (Section 10) — kolaborasi dengan Product Planner (melihat Cost Sheet, bukan mengelola katalog). */
  'account-executive': { crm: 'MANAGE', project: 'VIEW', vendor: 'NONE', finance: 'NONE', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'VIEW', ticketing: 'NONE', accommodation: 'NONE', transportation: 'NONE', mice: 'NONE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'VIEW' },
  /** Sales (dipersempit Prompt 19) — kini scoped ke Lead (modul `crm` tetap dipakai karena Lead adalah pre-Party/Opportunity record dalam domain CRM yang sama, granularity tetap modul bukan field sesuai D-030); TIDAK lagi dapat mengelola Opportunity/Quotation (gate dipindah ke `account-executive`, lihat Opportunity Detail). */
  sales: { crm: 'MANAGE', project: 'VIEW', vendor: 'NONE', finance: 'NONE', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'NONE', ticketing: 'NONE', accommodation: 'NONE', transportation: 'NONE', mice: 'NONE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'VIEW' },
  /** Product Planner / Travel Consultant (Section 02) — kini pemilik modul `product-planning` (Section 10 — Product Planning dan Costing), `MANAGE` penuh atas Product Template catalog dan Cost Sheet. */
  'product-planner': { crm: 'VIEW', project: 'VIEW', vendor: 'VIEW', finance: 'NONE', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'MANAGE', ticketing: 'NONE', accommodation: 'NONE', transportation: 'NONE', mice: 'NONE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'VIEW' },
  /** `product-planning` `VIEW` (Section 10) — PM referensi costing saat menerima handover Project Order. `ticketing` `VIEW` (Section 13) — PM mengawasi lintas sub-domain operasional tapi tidak mengelola detail lifecycle flight (wewenang role `ticketing`). `procurement` `VIEW` (Section 17) — PM memantau RFQ/Service Order proyeknya, tidak mengelola sourcing. `bookings` `VIEW` (Section 18) — PM melihat timeline konsolidasi proyeknya, pengelolaan gate/aksi tetap wewenang Operations. */
  'project-manager': { crm: 'VIEW', project: 'MANAGE', vendor: 'VIEW', finance: 'VIEW', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'VIEW', ticketing: 'VIEW', accommodation: 'VIEW', transportation: 'VIEW', mice: 'VIEW', procurement: 'VIEW', bookings: 'VIEW', changes: 'MANAGE', documents: 'MANAGE' },
  /** `product-planning` `VIEW` (Section 10) — Operations termasuk kolaborator literal Wajib ("Collaboration dengan AE, Operations, Finance"). `ticketing` `VIEW` (Section 13) — awareness lintas sub-domain, bukan pengelola detail flight. `procurement` `VIEW` (Section 17) — Operations mengawasi fulfillment Service Order, tidak mengelola sourcing. `bookings` `MANAGE` (Section 18, D-075) — Operations adalah pemilik "satu sumber kebenaran seluruh service" (acceptance literal): timeline konsolidasi, exception queue, payment gate, failure/retry simulation. */
  operations: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'VIEW', ticketing: 'VIEW', accommodation: 'VIEW', transportation: 'VIEW', mice: 'VIEW', procurement: 'VIEW', bookings: 'MANAGE', changes: 'MANAGE', documents: 'MANAGE' },
  /** Ticketing (Section 13) — kini pemilik modul `ticketing` (`FlightBooking` lifecycle penuh: request/options, PNR, segments, deadline, Hold/Confirm/Issue/Reissue/Cancel/Refund, fare rules, net cost vs sell price). `bookings` `NONE` — konsolidasi lintas-domain (Section 18) adalah wewenang Operations, Ticketing tetap mengelola langsung lewat modulnya sendiri. */
  ticketing: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'NONE', ticketing: 'MANAGE', accommodation: 'NONE', transportation: 'NONE', mice: 'NONE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'VIEW' },
  /** Accommodation (Section 14) — kini pemilik modul `accommodation` (`HotelBooking` lifecycle penuh: sourcing/options, room block, check-in/out, quote/confirmation/voucher, amendment/cancellation/no-show/penalty, net cost vs sell price), pola arsitektur IDENTIK `ticketing` (D-070). `bookings` `NONE` — sama alasan seperti `ticketing`. */
  accommodation: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'NONE', ticketing: 'NONE', accommodation: 'MANAGE', transportation: 'NONE', mice: 'NONE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'VIEW' },
  /** Transportation (Section 15) — kini pemilik modul `transportation` (`TransportBooking` lifecycle penuh: options kendaraan, multi-leg dispatch, manifest/group allocation, standby/overtime/toll, quote/assignment/confirmation, service order/driver sheet, change/cancellation/incident/no-show), pola arsitektur IDENTIK `ticketing`/`accommodation` (D-070/D-071). `bookings` `NONE` — sama alasan seperti `ticketing`/`accommodation`. */
  transportation: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'NONE', ticketing: 'NONE', accommodation: 'NONE', transportation: 'MANAGE', mice: 'NONE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'VIEW' },
  /** MICE (Section 16) — kini pemilik modul `mice` (`MiceEvent` lifecycle penuh: brief/venue/sessions/participant categories/BOQ/staffing/checklist/client approval/change order/incident/deliverables), pola arsitektur IDENTIK `ticketing`/`accommodation`/`transportation` (D-070/D-071/D-072). `bookings` `NONE` — sama alasan seperti sub-domain lain. */
  mice: { crm: 'NONE', project: 'MANAGE', vendor: 'VIEW', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'NONE', ticketing: 'NONE', accommodation: 'NONE', transportation: 'NONE', mice: 'MANAGE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'VIEW' },
  /** Procurement / Vendor Management (Section 02/17) — pemilik modul `vendor` (direktori master data) DAN kini pemilik modul `procurement` (`RFQ`/`ServiceOrder`/`SupplierInvoice` lifecycle penuh — sourcing formal, comparison, clarification, selection, amendment, acknowledgment, fulfillment, Procurement Performance Review, D-074). `bookings` `NONE` — konsep berbeda (Section 18 konsolidasi booking operasional, bukan sourcing vendor). */
  procurement: { crm: 'NONE', project: 'VIEW', vendor: 'MANAGE', finance: 'NONE', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'NONE', ticketing: 'NONE', accommodation: 'NONE', transportation: 'NONE', mice: 'NONE', procurement: 'MANAGE', bookings: 'NONE', changes: 'NONE', documents: 'VIEW' },
  /** `product-planning` `VIEW` (Section 10) — Finance termasuk kolaborator literal Wajib. `ticketing` `VIEW` (Section 13) — Finance perlu melihat net cost vs sell price untuk rekonsiliasi. `procurement` `VIEW` (Section 17) — Finance meninjau Supplier Invoice/Service Order untuk rekonsiliasi pembayaran. `bookings` `VIEW` (Section 18) — Finance meninjau payment gate lintas booking, aksi "Mark Payment Cleared" tetap Operations. */
  finance: { crm: 'VIEW', project: 'VIEW', vendor: 'VIEW', finance: 'MANAGE', reports: 'VIEW', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'VIEW', ticketing: 'VIEW', accommodation: 'VIEW', transportation: 'VIEW', mice: 'VIEW', procurement: 'VIEW', bookings: 'VIEW', changes: 'VIEW', documents: 'VIEW' },
  viewer: { crm: 'VIEW', project: 'VIEW', vendor: 'VIEW', finance: 'VIEW', reports: 'VIEW', administration: 'VIEW', 'supplier-portal': 'NONE', 'client-portal': 'NONE', 'product-planning': 'VIEW', ticketing: 'VIEW', accommodation: 'VIEW', transportation: 'VIEW', mice: 'VIEW', procurement: 'VIEW', bookings: 'VIEW', changes: 'VIEW', documents: 'VIEW' },
  /** Client (baru, Section 02) — External Partner, tidak punya akses modul internal apa pun (Prompt 0-H/Protokol: "Jangan menampilkan internal cost/margin kepada Client"); seluruh visibilitas dibatasi ke `client-portal`, diisolasi per `clientPartyId` (`usePermissions().clientScopeId`, pola identik `vendorScopeId`). Shell minimal (`/client`) dibangun Section 02; fitur penuh (quotation confirm, document, dst.) menjadi tanggung jawab Section 08. `product-planning`/`ticketing`/`procurement`/`bookings` `NONE` — internal costing/lifecycle/sourcing/orchestration tidak boleh terlihat Client (Wajib literal). */
  client: { crm: 'NONE', project: 'NONE', vendor: 'NONE', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'NONE', 'client-portal': 'MANAGE', 'product-planning': 'NONE', ticketing: 'NONE', accommodation: 'NONE', transportation: 'NONE', mice: 'NONE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'NONE' },
  /** Supplier (Prompt 19) — External Partner, tidak punya akses modul internal apa pun; seluruh visibilitas dibatasi ke `supplier-portal` dan diisolasi lebih lanjut per `vendorId` (`usePermissions`/halaman `/supplier/*`), BUKAN lewat `vendor`/`procurement` module (yang tetap "internal, lihat semua vendor/RFQ"). RFQ/Service Order/Invoice milik Supplier tetap diakses lewat `supplier-portal` (`/supplier/rfq`, `/supplier/service-orders`), bukan `procurement`. `bookings` `NONE` — modul internal Operations, tidak relevan untuk Supplier. */
  supplier: { crm: 'NONE', project: 'NONE', vendor: 'NONE', finance: 'NONE', reports: 'NONE', administration: 'NONE', 'supplier-portal': 'MANAGE', 'client-portal': 'NONE', 'product-planning': 'NONE', ticketing: 'NONE', accommodation: 'NONE', transportation: 'NONE', mice: 'NONE', procurement: 'NONE', bookings: 'NONE', changes: 'NONE', documents: 'NONE' }
}

/** Role yang dapat melihat breakdown finansial penuh (Budget/Actual/Margin) — docs/route-and-role-matrix.md bagian 5.1. */
export const FULL_FINANCIAL_VISIBILITY_ROLES: RoleId[] = [
  'super-admin', 'management', 'finance', 'project-manager', 'viewer'
]
