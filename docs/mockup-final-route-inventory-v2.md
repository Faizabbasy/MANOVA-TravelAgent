# Mockup Final Route Inventory v2 — MANOVA (Roadmap Section 00–24, FINAL)

Dibuat oleh **Section 24 — Full Regression dan Final Implementation Guide** (2026-08-01). Ini adalah inventory route **definitif dan final** untuk seluruh 25-tahap roadmap (Section 00–24) — menggantikan `docs/mockup-final-route-inventory.md` (Section 18 lama, sudah ditandai `SUPERSEDED` di Phase 1 Section 24, hanya mencakup 28 route dari fase Prompt 0–20) sebagai referensi route yang dipakai. Dokumen lama TETAP ADA (append-only, tidak dihapus) untuk jejak historis.

Sumber: `Glob app/pages/**/*.vue` (**82 file page**, dikonfirmasi langsung terhadap codebase per 2026-08-01) + `app/constants/navigation.ts` (`NAV_ITEMS`, sidebar) + audit route Phase 1 Section 24 (**89/89 URL variant checks pass** — jumlah ini lebih besar dari 82 karena mencakup beberapa ID dinamis berbeda per halaman `[id]` dan probe not-found `/nonexistent-route-xyz`/`/projects/PRJ-999` dll., bukan 89 file terpisah).

Status yang dipakai: `ACTIVE` (ditautkan di nav, fungsional penuh), `ACTIVE_UNLINKED` (fungsional, sengaja tidak di nav — legacy/locked), `LOCKED_STUB` (ada tapi sengaja shell/placeholder, didokumentasikan sebagai batasan disengaja bukan gap), `PUBLIC` (tanpa auth/layout dashboard).

---

## 1. Dashboard dan Umum

| Route | File | Status | Role Akses | Catatan |
|---|---|---|---|---|
| `/` | `index.vue` | ACTIVE | Seluruh role (widget kondisional) | Dashboard satu-komponen, D-031 LOCKED. |
| `/login` | `login.vue` | ACTIVE | Publik | Link discoverability ke `/lead-intake` (CI-032). |
| `/settings` | `settings.vue` | ACTIVE | Seluruh role login | Role switcher demo, tombol Reset Demo Data. |
| `/lead-intake` | `lead-intake/index.vue` | PUBLIC | Tanpa auth, `layout: false` | 4 kategori, consent, duplicate suggestion non-blocking (D-060). |
| `/[...slug]` | `[...slug].vue` | ACTIVE | Publik | Catch-all 404, wajib tetap terakhir di routing. |

## 2. Customer Journey

| Route | File | Status | Role Akses |
|---|---|---|---|
| `/customer-journey` | `customer-journey/index.vue` | ACTIVE | `crm` VIEW+ |
| `/customer-journey/leads` | `customer-journey/leads/index.vue` | ACTIVE | `crm` VIEW+ (Sales dibatasi ke sini saja) |
| `/customer-journey/customers` | `customer-journey/customers/index.vue` | ACTIVE | narrow-role (bukan Sales) |
| `/customer-journey/customers/[id]` | `customer-journey/customers/[id]/index.vue` | ACTIVE | narrow-role |
| `/customer-journey/project-orders` | `customer-journey/project-orders/index.vue` | ACTIVE | narrow-role |
| `/customer-journey/project-orders/[id]` | `customer-journey/project-orders/[id]/index.vue` | ACTIVE | narrow-role |
| `/customer-journey/lead-sources` | `customer-journey/lead-sources/index.vue` | ACTIVE | narrow-role |

## 3. CRM

| Route | File | Status | Role Akses |
|---|---|---|---|
| `/crm` | `crm/index.vue` | ACTIVE | `crm` VIEW+ |
| `/crm/prospects` | `crm/prospects.vue` | ACTIVE | `crm` VIEW+ |
| `/crm/clients` | `crm/clients.vue` | ACTIVE | `crm` VIEW+ |
| `/crm/parties/[id]` | `crm/parties/[id]/index.vue` | ACTIVE | `crm` VIEW+ |
| `/crm/opportunities` | `crm/opportunities/index.vue` | ACTIVE | `crm` VIEW+ |
| `/crm/opportunities/[id]` | `crm/opportunities/[id]/index.vue` | ACTIVE | `crm` VIEW+ (mutasi: AE/Management) |
| `/crm/opportunities/[id]/quotation-preview` | `crm/opportunities/[id]/quotation-preview.vue` | ACTIVE | `crm` VIEW+, `layout: false` (print) |
| `/crm/quotations` | `crm/quotations.vue` | ACTIVE | `crm` VIEW+ (approve: Management) |

## 4. Product Planning

| Route | File | Status | Role Akses |
|---|---|---|---|
| `/product-planning` | `product-planning/index.vue` | ACTIVE | `product-planning` VIEW+ |
| `/product-planning/[id]` | `product-planning/[id]/index.vue` | ACTIVE | `product-planning` VIEW+ |
| `/product-planning/cost-sheets` | `product-planning/cost-sheets/index.vue` | ACTIVE | `product-planning` VIEW+ |
| `/product-planning/cost-sheets/[id]` | `product-planning/cost-sheets/[id]/index.vue` | ACTIVE | `product-planning` VIEW+ |

## 5. Projects

| Route | File | Status | Role Akses |
|---|---|---|---|
| `/projects` | `projects/index.vue` | ACTIVE | `project` VIEW+ |
| `/projects/create` | `projects/create.vue` | ACTIVE_UNLINKED | Legacy wizard, repurposed (D-018) — Won→Project otomatis adalah jalur utama |
| `/projects/[id]` | `projects/[id]/index.vue` | ACTIVE | `project` VIEW+ (8-tab shell LOCKED D-026/D-027, +SectionCard "Project Closure" baru Section 24) |
| `/projects/[id]/edit` | `projects/[id]/edit.vue` | LOCKED_STUB | Template stub sejak Section 05, sengaja belum dibangun |
| `/projects/[id]/manifest-preview` | `projects/[id]/manifest-preview.vue` | ACTIVE | `project` VIEW+, print preview |
| `/projects/[id]/run-sheet-preview` | `projects/[id]/run-sheet-preview.vue` | ACTIVE | `project` VIEW+, print preview |

## 6. Ticketing / Accommodation / Transportation / MICE

| Route | File | Status | Role Akses |
|---|---|---|---|
| `/ticketing` | `ticketing/index.vue` | ACTIVE | `ticketing` MANAGE (owner) |
| `/ticketing/[id]` | `ticketing/[id]/index.vue` | ACTIVE | `ticketing` MANAGE |
| `/ticketing/[id]/eticket-preview` | `ticketing/[id]/eticket-preview.vue` | ACTIVE | print preview, cost disanitasi |
| `/accommodation` | `accommodation/index.vue` | ACTIVE | `accommodation` MANAGE (owner) |
| `/accommodation/[id]` | `accommodation/[id]/index.vue` | ACTIVE | `accommodation` MANAGE |
| `/accommodation/[id]/voucher-preview` | `accommodation/[id]/voucher-preview.vue` | ACTIVE | print preview, cost disanitasi |
| `/transportation` | `transportation/index.vue` | ACTIVE | `transportation` MANAGE (owner) |
| `/transportation/[id]` | `transportation/[id]/index.vue` | ACTIVE | `transportation` MANAGE |
| `/transportation/[id]/service-order-preview` | `transportation/[id]/service-order-preview.vue` | ACTIVE | print preview client-facing |
| `/transportation/[id]/driver-sheet-preview` | `transportation/[id]/driver-sheet-preview.vue` | ACTIVE | print preview internal, tanpa harga sama sekali |
| `/mice` | `mice/index.vue` | ACTIVE | `mice` MANAGE (owner) |
| `/mice/[id]` | `mice/[id]/index.vue` | ACTIVE | `mice` MANAGE |
| `/mice/[id]/rundown-preview` | `mice/[id]/rundown-preview.vue` | ACTIVE | print preview client-facing |
| `/mice/[id]/boq-preview` | `mice/[id]/boq-preview.vue` | ACTIVE | print preview client-facing, sanitized |

## 7. Vendors dan Procurement

| Route | File | Status | Role Akses |
|---|---|---|---|
| `/vendors` | `vendors/index.vue` | ACTIVE | `vendor` VIEW+ |
| `/vendors/[id]` | `vendors/[id]/index.vue` | ACTIVE | `vendor` VIEW+ |
| `/procurement` | `procurement/index.vue` | ACTIVE | `procurement` MANAGE (owner) |
| `/procurement/rfq/[id]` | `procurement/rfq/[id]/index.vue` | ACTIVE | `procurement` MANAGE |
| `/procurement/service-orders/[id]` | `procurement/service-orders/[id]/index.vue` | ACTIVE | `procurement` MANAGE |
| `/procurement/performance` | `procurement/performance/index.vue` | ACTIVE | `procurement` VIEW+ |

## 8. Booking Orchestration dan Changes

| Route | File | Status | Role Akses |
|---|---|---|---|
| `/bookings` | `bookings/index.vue` | ACTIVE | `bookings` VIEW+ (manage: Operations) |
| `/bookings/exceptions` | `bookings/exceptions/index.vue` | ACTIVE | `bookings` VIEW+ |
| `/changes` | `changes/index.vue` | ACTIVE | `changes` VIEW+ (manage: Operations/PM) |
| `/changes/[id]` | `changes/[id]/index.vue` | ACTIVE | `changes` VIEW+ |
| `/changes/cancellations/[id]` | `changes/cancellations/[id]/index.vue` | ACTIVE | `changes` VIEW+ |
| `/changes/refunds/[id]` | `changes/refunds/[id]/index.vue` | ACTIVE | `changes` VIEW+ |
| `/changes/incidents/[id]` | `changes/incidents/[id]/index.vue` | ACTIVE | `changes` VIEW+ |

## 9. Documents dan Finance

| Route | File | Status | Role Akses |
|---|---|---|---|
| `/documents` | `documents/index.vue` | ACTIVE | `documents` VIEW+ (3 tab query-param) |
| `/finance` | `finance/index.vue` | ACTIVE | `finance` VIEW+ |
| `/finance/invoices` | `finance/invoices.vue` | ACTIVE | `finance` VIEW+ |
| `/finance/payments` | `finance/payments.vue` | ACTIVE | `finance` VIEW+ |
| `/finance/notes` | `finance/notes.vue` | ACTIVE | `finance` VIEW+ |
| `/finance/reconciliation` | `finance/reconciliation.vue` | ACTIVE | `finance` VIEW+ |

## 10. Reports dan Activity Center

| Route | File | Status | Role Akses |
|---|---|---|---|
| `/reports` | `reports/index.vue` | ACTIVE | `reports` VIEW+ |
| `/activity-center` | `activity-center/index.vue` | ACTIVE | `super-admin` saja (narrow `roles` override) |

## 11. Administration

| Route | File | Status | Role Akses |
|---|---|---|---|
| `/admin` | `admin/index.vue` | ACTIVE | `administration` VIEW+ |
| `/admin/master-data` | `admin/master-data.vue` | ACTIVE | `administration` VIEW+ (edit: MANAGE/ADMIN) |
| `/admin/users` | `admin/users.vue` | ACTIVE | `administration` VIEW+ |
| `/admin/roles` | `admin/roles.vue` | ACTIVE | `administration` VIEW+, read-only Matrix, LOCKED |
| `/admin/audit-trail` | `admin/audit-trail.vue` | ACTIVE | `administration` VIEW+ |
| `/admin/organization` | `admin/organization.vue` | ACTIVE | `administration` VIEW+ |

## 12. External Portals

| Route | File | Status | Role Akses |
|---|---|---|---|
| `/supplier` | `supplier/index.vue` | ACTIVE | `supplier-portal` MANAGE (`supplier` role, isolasi `vendorId`) |
| `/supplier/products` | `supplier/products/index.vue` | ACTIVE | `supplier` |
| `/supplier/orders` | `supplier/orders/index.vue` | ACTIVE | `supplier` |
| `/supplier/rfq` | `supplier/rfq/index.vue` | ACTIVE | `supplier` |
| `/supplier/rfq/[id]` | `supplier/rfq/[id]/index.vue` | ACTIVE | `supplier` |
| `/supplier/service-orders` | `supplier/service-orders/index.vue` | ACTIVE | `supplier` |
| `/supplier/service-orders/[id]` | `supplier/service-orders/[id]/index.vue` | ACTIVE | `supplier` |
| `/client` | `client/index.vue` | ACTIVE | `client-portal` MANAGE (`client` role, isolasi `clientPartyId`) |
| `/client/opportunities/[id]` | `client/opportunities/[id]/index.vue` | ACTIVE | `client` |
| `/client/project-orders/[id]` | `client/project-orders/[id]/index.vue` | ACTIVE | `client` (6 tab) |

## 13. Legacy/Locked — Sengaja Tidak Ditautkan Navigasi

| Route | File | Status | Catatan |
|---|---|---|---|
| `/expenses` | `expenses.vue` | ACTIVE_UNLINKED | Pre-existing template lama, sengaja tidak di-nav sejak Foundation. `handleDelete` bug (temuan Audit Prompt 1) — dikonfirmasi FIXED CI-019, tetap tidak ditautkan (di luar scope IA MANOVA). |
| `/tasks` | `tasks.vue` | ACTIVE_UNLINKED | Melebur ke tab "Tasks" Project Detail (D-019) — top-level route dipertahankan tapi sengaja tidak di-nav. |

---

## 14. Ringkasan Angka Final

- **82 file page** (`app/pages/**/*.vue`, dikonfirmasi Glob 2026-08-01).
- **89 URL variant** diverifikasi HTTP 200/konten benar oleh Phase 1 Section 24 (termasuk beberapa ID dinamis berbeda per template `[id]` + probe not-found).
- **2 route legacy sengaja tidak di-nav** (`/expenses`, `/tasks`) — bukan gap, keputusan IA (D-019/D-021).
- **1 route LOCKED stub** (`/projects/[id]/edit`) — sengaja belum dibangun sejak Section 05, bukan regresi.
- **1 route publik tanpa layout dashboard** (`/lead-intake`, D-060).
- **17 kelompok nav top-level** (`NAV_ITEMS`, `app/constants/navigation.ts`) mencakup seluruh route `ACTIVE` di atas kecuali kelompok "Legacy/Locked" dan `/[...slug]`.

Dokumen ini adalah versi FINAL — tidak ada route baru direncanakan setelah Section 24 (roadmap 25-tahap selesai).
