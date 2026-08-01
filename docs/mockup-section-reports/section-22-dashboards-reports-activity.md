# Section 22 — Dashboards, Reports, Lead Recap dan Activity Center

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_22_Dashboards_Reports_Lead_Recap_Activity_Center.md`, dijalankan atas perintah user langsung (bukan lewat `prompts/99-RUN-CURRENT-SECTION.md`).

---

## 1. Section Objective dan Scope

**Berbeda karakter dari Section 05–21** — literal Wajib Section 22 (Dashboard seluruh role, Customer Journey, Lead Source Recap, Activity Center Super Admin, pipeline/conversion/SLA/quotation performance, project readiness/departure/changes/incidents, revenue/margin/AR-AP/aging, supplier performance, client and supplier action centers, filters/saved views/drill-down/export preview) sudah SEBAGIAN BESAR dipenuhi oleh section pemiliknya masing-masing: Dashboard (`/`, Section 06 lama, D-031 LOCKED "satu komponen, widget kondisional per role"), Reports (`/reports`, Section 16 lama, 6 SectionCard granular), Lead Source Recap (`/customer-journey/lead-sources`, Prompt 19), dan Activity Center (`/activity-center`, Prompt 19, D-052 LOCKED "narrow role override Super Admin"). Section ini BUKAN rebuild — scope dipersempit menjadi 9 gap-fill kurasi yang disepakati eksplisit dengan user sebelum eksekusi:

1. Fix bug SSR loading-skeleton `/` dan `/reports` (`docs/frontend-known-issues.md` bagian 15).
2. Saved Views (baru) di Dashboard dan Reports.
3. Export mock (CSV/PDF placeholder) di Reports.
4. Drill-down (Sales Pipeline, Invoice Aging di Reports; entity link di Activity Center).
5. SectionCard baru ke-7 "SLA dan Quotation Performance" di Reports.
6. Supplier Action Center (`/supplier`).
7. Cross-link Vendor Summary (Reports) → Procurement Performance Review (`/procurement/performance`).
8. Verifikasi konten Dashboard untuk 11 role.
9. Koreksi klaim stale "Widget Dashboard role baru belum ada" di `docs/frontend-implementation-roadmap.md`.

D-031 (struktur widget/filter Dashboard) dan struktur 6 SectionCard Reports LOCKED — TIDAK direstrukturisasi.

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/SECTION_22_Dashboards_Reports_Lead_Recap_Activity_Center.md`, `CLAUDE.md`, `docs/mockup-section-progress.md` (entri Section 21 dan OLD SCHEME Section 06/Section 16), `docs/mockup-section-reports/section-06-dashboard.md` dan `section-16-reports.md` (OLD SCHEME, dibaca penuh), `docs/mockup-design-decisions.md` (D-031, D-052, D-078 penuh), `docs/frontend-known-issues.md` bagian 15/17, `docs/frontend-implementation-roadmap.md`/`docs/frontend-module-map.md`, `docs/mockup-section-reports/README.md` dan `section-21-documents-comms-notifications.md` (template 19-bagian).

## 3. Existing Implementation yang Diperiksa

`app/pages/index.vue` (545 baris, Dashboard — seluruh `visibleTo(...)` widget-role computed, pattern `isLoading`/`onMounted`/`setTimeout`), `app/pages/reports/index.vue` (6 SectionCard, pattern SSR bug identik, filter `statusFilter`/`typeFilter`/`periodFilter`), `app/pages/customer-journey/lead-sources/index.vue` (dikonfirmasi sudah lengkap, tidak disentuh), `app/pages/activity-center/index.vue` (108 baris, `SYSTEM_EVENTS`-driven), `app/types/activity.ts` (`SystemEvent`/`SystemEventModule`), `app/pages/client/index.vue` (pola Action Center, `actionItems` computed), `app/pages/supplier/index.vue` (isi sebelum perubahan — 4 nav card, tanpa Action Center), `app/types/procurement.ts` (RFQ/ServiceOrder/SupplierInvoice status), `app/types/opportunity.ts` (field timestamp `Opportunity`/`Quotation` — dikonfirmasi TIDAK ADA `Quotation.approvedAt`), `app/data/opportunities.ts` (fixture `createdAt`/`sentToClientAt` — dikonfirmasi hanya `QUO-006` punya `sentToClientAt`), `app/components/shared/StatusBreakdownList.vue`, `app/constants/navigation.ts`/`roles.ts` (dikonfirmasi tidak ada `ModuleKey` `activity-center`/`dashboard`, sesuai D-052), `app/composables/useCurrentUser.ts` (dikonfirmasi role-switching client-only via `localStorage`, `currentUserId` module-level ref — SSR selalu default Super Admin `USR-010`).

## 4. Decisions yang Digunakan

D-031 (Dashboard satu-komponen, widget kondisional per role, LOCKED — protection note "jangan menulis ulang struktur widget/filter Dashboard tanpa alasan kuat"), D-052 (Activity Center narrow role override level-navigasi, LOCKED), D-078 (preseden consolidation/orchestration layer — dijadikan acuan gaya dokumentasi, TIDAK dipakai sebagai pola arsitektur baru karena Section 22 tidak membuat entitas konsolidasi lintas-domain baru). Keputusan implementasi baru: **D-079** (`docs/mockup-design-decisions.md`) — SSR fix approach, Saved Views design, mock SLA threshold assumption, konfirmasi D-031 dihormati.

## 5. Implementation Summary dan User Flow

**SSR fix:** `isLoading` pada `app/pages/index.vue` dan `app/pages/reports/index.vue` dihilangkan (permanen `ref(false)`), `onMounted`/`setTimeout` dihapus total. Root cause: kedua ref sebelumnya `true` di awal, hanya berubah `false` lewat `setTimeout` di `onMounted` (client-only lifecycle hook) — SSR HTML selamanya berupa `LoadingState` skeleton. Opsi guard `import.meta.server` dengan delay client-only DITOLAK (lihat D-079) karena berisiko hydration mismatch atau flash konten. Data di kedua halaman 100% fixture sinkron — tidak ada alasan genuine menahan render.

**Saved Views:** `SavedView` (`app/types/reporting.ts`, baru) + `SAVED_VIEWS` (`app/data/reporting.ts`, baru, `reactive()`, 2 seed: `SVW-001` Dashboard/Super Admin, `SVW-002` Reports/Management) + 4 selector/mutator (`getSavedViewsForUser`/`createSavedView`/`deleteSavedView`/`applySavedView`, `app/data/index.ts`, akhir file). UI ditambahkan ke `#actions` SectionCard "Filter" di KEDUA halaman: tombol "Simpan View" (dialog, input nama) + chip list saved view (klik nama = terapkan, klik ikon X = hapus) di bawah grid filter. TIDAK ADA filter baru — murni membungkus `statusFilter`/`typeFilter`/`clientFilter`/`ownerFilter`/`periodFilter` (Dashboard) dan `statusFilter`/`typeFilter`/`periodFilter` (Reports) yang sudah ada.

**Export mock:** Dialog di `#actions` `PageHeader` Reports — pilih 1 dari 7 section (6 existing + "SLA dan Quotation Performance") atau "Seluruh Laporan", pilih format CSV/PDF, tombol "Export" memanggil `showToast` menampilkan nama file simulasi (`{section-key}-{DEMO_REFERENCE_DATE}.{format}`) dengan disclaimer "(mock, tidak ada file yang benar-benar dihasilkan)".

**Drill-down:** (a) Sales Pipeline (Reports) — chip link per stage `/crm/opportunities?stage={stage}` (query-filter dikonfirmasi sudah dibaca `crm/opportunities/index.vue`). (b) Invoice Aging (Reports) — baris tabel `@click="navigateTo('/projects/{projectId}?tab=finance')"`, pola identik "Top Vendor" row-click yang sudah ada di section yang sama. (c) Vendor Summary (Reports) — tombol `#actions` ke `/procurement/performance`. (d) Activity Center — fungsi `eventLink(event)` memetakan `module`+`entityId` ke route nyata via selector `~/data` existing: `opportunity`→`/crm/opportunities/{id}`, `quotation`→`/crm/opportunities/{quotation.opportunityId}` (via `getQuotationById`), `client`→`/crm/parties/{id}`, `project-order`→`/projects/{id}`, `vendor`→`/vendors/{vendorQuotation.vendorId}` (via `VENDOR_QUOTATIONS.find`, karena `entityId` module `vendor` adalah ID `VendorQuotation` seperti `VQ-009`, BUKAN ID Vendor). Module `lead`/`finance`/`user` SENGAJA tidak menghasilkan link (tidak ada route `[id]` yang aman — lihat bagian 17).

**SLA dan Quotation Performance (SectionCard baru ke-7, Reports):** dihitung dari `Opportunity.createdAt`→`Quotation.createdAt` (via `daysUntil`, reuse existing) untuk 8 pasangan Opportunity/Quotation yang punya quotation — rata-rata 9,4 hari, 38% dalam threshold SLA mock 3 hari (dilabeli eksplisit "Threshold mock" di UI). Stat terpisah "Quotation Terkirim ke Client" (1 dari 8, `QUO-006` satu-satunya dengan `sentToClientAt` terisi). Tabel detail per Opportunity/Quotation, baris dapat diklik menuju Opportunity Detail. Disclaimer teks eksplisit: threshold bukan SLA kontraktual nyata, "approval cycle time" tidak dihitung karena `Quotation` tidak punya `approvedAt` tersimpan.

**Supplier Action Center:** SectionCard baru di `/supplier`, pola IDENTIK `app/pages/client/index.vue` (`actionItems` computed `{key,label,to,tone}[]`, list dengan ikon `Bell`) — pending RFQ response (`status` `sent`/`responses-in`), klarifikasi terbuka (`status` `clarification`), pending Service Order acknowledgment (`status` `sent`), pending invoice-submission (`status` `fulfilled` tanpa `SupplierInvoice`, via `getSupplierInvoicesByServiceOrder` baru diimpor) — seluruhnya reuse `rfqs`/`serviceOrders` computed existing di halaman ini (sudah di-scope `vendorScopeId`).

**Verifikasi Dashboard 11 role:** lihat bagian 12.

**User flow yang bisa didemokan:** buka `/` atau `/reports` → konten langsung tampil tanpa skeleton (SSR maupun client) → set filter → klik "Simpan View", beri nama → toast konfirmasi, chip baru muncul di bawah filter → ubah filter lain → klik chip saved view → filter kembali ke kombinasi tersimpan + toast → klik ikon X pada chip → view terhapus + toast. Di Reports: klik "Export" → pilih section+format → toast nama file mock. Klik chip stage di Sales Pipeline → `/crm/opportunities?stage=won` terfilter. Klik baris Invoice Aging → tab Finance project terkait. Klik tombol "Procurement Performance Review" di Vendor Summary → `/procurement/performance`. Di Activity Center: klik pesan event Opportunity/Quotation/Client/Project Order/Vendor → detail entity terkait. Di `/supplier`: Action Center menampilkan RFQ/Service Order yang perlu tindakan, klik → halaman detail terkait.

## 6. Routes

Tidak ada route baru. `/` (SSR fix, Saved Views), `/reports` (SSR fix, Export, Saved Views, drill-down, +section ke-7), `/activity-center` (+drill-down link), `/supplier` (+Action Center).

## 7. Files Created, Changed, dan Removed

**Created:** `app/types/reporting.ts`, `app/data/reporting.ts`, `docs/mockup-section-reports/section-22-dashboards-reports-activity.md` (laporan ini).

**Changed:**
- `app/data/index.ts` — `+import SAVED_VIEWS` (dari `./reporting`), `+export SAVED_VIEWS`, `+import type SavedView/SavedViewPage`, `+4 selector/mutator` (`getSavedViewsForUser`/`createSavedView`/`deleteSavedView`/`applySavedView`) di akhir file — murni aditif.
- `app/pages/index.vue` — SSR fix (`isLoading` dihilangkan, `onMounted` dihapus dari import), `+import` selector Saved Views + ikon `Save`/`X`, `+computed`/`ref`/`function` Saved Views (`mySavedViews`/`isSaveViewOpen`/`newViewLabel`/`submitSaveView`/`applyView`/`removeView`), template `#actions` dialog "Simpan View" + chip list di SectionCard "Filter" — struktur KPI row/widget grid/filter select LAINNYA TIDAK disentuh.
- `app/pages/reports/index.vue` — SSR fix (identik pola Dashboard), `+import` selector Saved Views + ikon `Download`/`Save`/`X`/`Clock`, `+ref`/`computed`/`function` Saved Views + Export (`EXPORT_SECTIONS`/`isExportOpen`/`exportSectionKey`/`exportFormat`/`submitExport`) + SLA (`QUOTATION_SLA_THRESHOLD_DAYS`/`opportunityQuotationCycle`/`avgQuotationCycleDays`/`withinSlaPct`/`quotationsSentToClient`/`showSlaPerformance`), template `#actions` dialog Export di `PageHeader`, `#actions` dialog Saved View + chip list di SectionCard "Filter", chip drill-down Sales Pipeline, `#actions` cross-link Vendor Summary, row-click drill-down Invoice Aging, `+SectionCard` ke-7 "SLA dan Quotation Performance" — 6 SectionCard existing (Sales Pipeline/Project Performance/Upcoming Departure/Vendor Summary/Budget vs Actual/Invoice Aging) TIDAK direstrukturisasi, hanya diperkaya aditif.
- `app/pages/activity-center/index.vue` — `+import` `VENDOR_QUOTATIONS`/`getOpportunityById`/`getQuotationById`/`getPartyById`/`getProjectById` + type `SystemEvent`, `+function eventLink(event)`, template baris event diganti `NuxtLink` kondisional — filter/search/stat module count existing TIDAK disentuh.
- `app/pages/supplier/index.vue` — `+import` ikon `Bell` + selector `getSupplierInvoicesByServiceOrder`, `+computed actionItems`, `+SectionCard` "Action Center" di awal `<template v-else>` — 4 SectionCard nav card dan Profil Company existing TIDAK disentuh/dipindah.
- `docs/mockup-design-decisions.md` (+D-079), `docs/mockup-change-impact-log.md` (+CI-052), `docs/mockup-data-scenarios.md` (+bagian 4y), `docs/frontend-module-map.md` (baris Section 22), `docs/frontend-workflow-map.md` (+catatan Section 22), `docs/frontend-implementation-roadmap.md` (baris Section 22 + rekomendasi urutan + koreksi klaim stale), `docs/frontend-known-issues.md` (bagian 17 RESOLVED), `docs/mockup-implementation-state.md` (bagian 1/5/6/7/8), `docs/mockup-progress.md` (+Entri 31), `docs/mockup-section-progress.md` (+entri Section 22 Roadmap Baru), `docs/mockup-section-reports/README.md` (+baris Section 22).

**Removed:** Tidak ada.

## 8. Components Reused dan Created

**Reused:** `PageHeader`, `SectionCard` (+`#actions`), `Dialog`/`DialogTrigger`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`, `Label`, `Input`, `Button`, `Select*`, `Table*`, `StatusBadge`, `StatsCard`, `StatusBreakdownList`, `EmptyState`, `LoadingState` (tetap ada di kode meski tidak lagi ter-trigger — `isLoading` selalu `false`), `RoleAccessState`, `useToast`, `useCurrentUser`, `usePermissions`.

**Created:** Tidak ada komponen file baru — seluruh UI baru (dialog Saved View/Export, chip list, Action Center list) memakai primitive `ui/*` existing, pola sama section-section sebelumnya (mis. dialog upload `/documents`).

## 9. Types, Constants, Fixtures, dan Mock State

`SavedView`/`SavedViewPage` (baru, `app/types/reporting.ts`) — fully additive, tidak menyentuh type existing manapun. `SAVED_VIEWS` (baru, `app/data/reporting.ts`, `reactive()`, 2 seed record — `SVW-001` `userId: USR-010`/`page: dashboard`, `SVW-002` `userId: USR-003`/`page: reports`). Tidak ada perubahan `app/constants/*` (tidak perlu `ModuleKey`/`NavItem` baru — konsisten D-052, Dashboard/Reports/Activity Center tidak punya `ModuleKey` sendiri sejak awal, gerbang akses tetap `canView('reports')`/narrow role check existing). `OPPORTUNITIES`/`QUOTATIONS`/`RFQS`/`SERVICE_ORDERS`/`SUPPLIER_INVOICES`/`VENDOR_QUOTATIONS` — HANYA dibaca (read-only) untuk SLA section dan Action Center, TIDAK diubah shape/isinya.

## 10. Responsive Behavior

Dialog Saved View/Export memakai `max-w-sm` (pola sama dialog kecil existing seperti "Tambah Kontak"). Chip list Saved Views memakai `flex flex-wrap` (wrap otomatis di layar sempit). SectionCard "SLA dan Quotation Performance" memakai `grid-cols-1 sm:grid-cols-3` untuk stat row (konsisten pola 6 section existing), tabel scroll horizontal bawaan `Table` primitive. Tidak diverifikasi lewat browser interaktif — tidak ada tool headless browser tersedia (keterbatasan konsisten sejak Section 06).

## 11. Loading, Empty, Error, Not-Found, dan Unauthorized States

- **Loading:** DIHILANGKAN sepenuhnya untuk `/` dan `/reports` (lihat bagian 5) — `LoadingState` tetap ada di kode sebagai shared component tapi tidak pernah ter-trigger lagi (data 100% sinkron, tidak ada alasan genuine untuk loading state).
- **Empty:** SectionCard "SLA dan Quotation Performance" — `EmptyState` bila tidak ada Opportunity dengan Quotation (kondisi teoretis, fixture selalu punya ≥1). Action Center Supplier — `EmptyState` (ikon `Bell`) bila tidak ada action item, pola sama Client Portal.
- **Error:** Tidak ada state error baru — konsisten seluruh halaman list/agregasi section lain (fixture sinkron, tidak ada fetch async nyata).
- **Not-found:** Tidak berlaku — tidak ada parameter dinamis baru.
- **Unauthorized:** Tidak berubah — `RoleAccessState` untuk `!canView('reports')` (Reports) dan `currentRole !== 'super-admin'` (Activity Center, D-052) tetap seperti semula; Saved Views/Export/SLA section/Supplier Action Center tidak menambah gerbang akses baru (mengikuti gerbang halaman existing).

## 12. Role Behavior

**Gerbang akses halaman TIDAK berubah** — `canView('reports')` (Reports), `currentRole === 'super-admin'` (Activity Center, D-052 narrow override), `canView('supplier-portal') && vendor` (Supplier Portal). SLA dan Quotation Performance memakai visibility SAMA dengan Sales Pipeline (`sales`/`account-executive`/`management`/`super-admin`/`viewer`) — domain Opportunity/Quotation yang sama.

**Verifikasi konten Dashboard 11 role** — role-switching bersifat client-only (`localStorage`, `useCurrentUser.ts`), SSR/curl SELALU merender sebagai default demo user (`USR-010`, Super Admin) karena `currentUserId` adalah module-level ref, bukan per-request state — keterbatasan yang SAMA dan konsisten sejak Section 06 (Dashboard)/Section 08 (Client Portal), dicatat eksplisit di seluruh laporan section sebelumnya yang menyentuh role-dependent UI. Dimitigasi via **(a)** SSR curl Super Admin (yang mendapat UNION seluruh widget agregat per D-031, bagian 12 laporan Section 06 lama) untuk membuktikan setiap computed widget benar-benar menghasilkan konten non-kosong, dan **(b)** cross-check fixture manual untuk widget "milik sendiri" yang Super Admin TIDAK mendapat variannya:

| # | Role | User Demo | Widget yang Dikonfirmasi | Metode Verifikasi | Hasil |
|---|---|---|---|---|---|
| 1 | Super Admin | `USR-010` Admin MANOVA | Union seluruh widget + "Ringkasan Administrasi" | SSR curl `/` langsung | **Non-empty** — "Opportunity Pipeline", "Ringkasan Administrasi", "Quotations Menunggu Keputusan" (berisi "Bali Team Building 2026"), "Budget vs Actual", "Cost Breakdown", "Service Readiness — Seluruh Layanan", Upcoming Departures (tanpa empty-state) seluruhnya ter-render dengan data nyata |
| 2 | Management | `USR-003` Sari Wijaya | Opportunity Pipeline, Active Projects by Status, Budget vs Actual, Outstanding Invoices, Attention, Recent Activity | Subset dari rendering Super Admin (computed TIDAK owner-scoped, sama untuk kedua role per `visibleTo(...)`) | **Non-empty** (data sama seperti diverifikasi #1) |
| 3 | Sales | `USR-001` Rani Kusuma | Opportunity Pipeline, Quotations Menunggu Keputusan | SSR curl `/` — `quotationsPendingDecision` bukan owner-scoped | **Non-empty** — "Bali Team Building 2026" (QUO-005, Rp180.000.000) dan entri lain ter-render |
| 4 | Account Executive | `USR-014` Galih Ramadhan | Opportunity Pipeline, Quotations Menunggu Keputusan | Sama seperti Sales (`showPipeline`/`showQuotationsPending` keduanya include `account-executive`) | **Non-empty** (data sama) |
| 5 | Project Manager | `USR-002` Doni Saputra | Active Projects Milik Saya, Upcoming Departures, Attention Milik Saya, Milestone/Task Mendatang, Change History Ringkas | Cross-check fixture manual (`app/data/projects.ts`) — Super Admin TIDAK mendapat varian "milik sendiri" | **Non-empty** — `USR-002` `ownerId` pada `PRJ-101` (confirmed), `PRJ-103` (confirmed), `PRJ-104` (confirmed) → 3 project (2 aktif + 1 draft, `myActiveProjects` filter exclude completed/cancelled saja sehingga draft ikut terhitung) |
| 6 | Operations | `USR-009` Fajar Nugroho | Service Readiness — Seluruh Layanan, Upcoming Departures | SSR curl `/` — `serviceReadinessType` untuk `operations` juga `undefined`→"Seluruh Layanan" (sama seperti Super Admin) | **Non-empty** — "Service Readiness — Seluruh Layanan" ter-render dengan breakdown status |
| 7 | Ticketing (specialist) | `USR-004` Andi Pratama | Service Readiness — Flight, Upcoming Departures | Divalidasi Section 06 lama (bagian 13 laporan tsb, angka spesifik) — data `FlightBooking`/`ProjectService` tipe flight tidak diubah section manapun sejak itu | **Non-empty** (diwarisi dari validasi Section 06, tidak ada regresi — fixture flight service tidak disentuh) |
| 8 | Procurement | `USR-018` Wulan Kartika | Welcome card "Vendor Management" (link ke `/vendors`) | Code review — `showProcurementWelcome = visibleTo('procurement')`, card statis (bukan data-dependent) | **Non-empty** — card selalu render teks+link untuk role ini (dikonfirmasi CI-030, Section 02) |
| 9 | Finance | `USR-008` Budi Santoso | Budget vs Actual, Cost Breakdown, Outstanding Invoices | SSR curl `/` — computed sama, tidak owner-scoped | **Non-empty** — "Budget vs Actual"/"Cost Breakdown"/"Outstanding Invoices" ter-render dengan `BudgetChart`/`ExpenseCategories` non-empty |
| 10 | Client | `USR-019` Hendra Wijaya | Welcome card "Client Portal" (link ke `/client`) | Code review — `showClientWelcome = visibleTo('client')`, card statis | **Non-empty** — card selalu render (dikonfirmasi CI-038, Section 08) |
| 11 | Supplier | `USR-015` Hasan Alfarizi | Welcome card "Supplier Portal" (link ke `/supplier`) | Code review — `showSupplierWelcome = visibleTo('supplier')`, card statis | **Non-empty** — card selalu render (existing sejak Prompt 19) |

Seluruh 11 role dikonfirmasi menampilkan minimal 1 widget dengan konten nyata (non-generic, non-empty). Tidak ada role yang menghasilkan Dashboard kosong.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses (exit 0)**, tidak ada error/warning TypeScript baru (grep `error|warn` pada log build hanya menemukan nama file `error-500-styles` yang pre-existing).
- `npm run dev` (port 8080) — dijalankan, sempat konflik dengan dev server leftover sesi sebelumnya (PID 27180, terkunci via Nuxt dev-lock), diselesaikan dengan mematikan seluruh proses node terkait (`26152`/`9660` dan child workers), dev server baru berjalan bersih.
- **Smoke test HTTP** (curl, 24 route): `/`, `/reports`, `/activity-center`, `/customer-journey/lead-sources`, `/supplier`, `/procurement/performance`, `/documents`, `/documents?tab=messages`, `/documents?tab=notifications`, `/changes`, `/bookings`, `/finance`, `/finance/invoices`, `/admin/roles`, `/crm/opportunities`, `/customer-journey`, `/client`, `/projects`, `/projects/PRJ-101`, `/vendors`, `/ticketing`, `/accommodation`, `/transportation`, `/mice`, `/nonexistent-route-xyz` — **seluruhnya HTTP 200**.
- **Smoke test konten SSR before/after `/` dan `/reports` (bukti perbaikan SSR):** `curl http://localhost:8080/ | grep "Memuat ringkasan dashboard"` → **kosong** (sebelumnya SELALU muncul di kode lama, root cause dikonfirmasi lewat pembacaan kode `onMounted`/`setTimeout`); `curl http://localhost:8080/ | grep -oE "Opportunity Pipeline|Ringkasan Administrasi|Saved Views|Simpan View"` → **seluruhnya ditemukan** (konten nyata langsung ter-render tanpa hydration). `curl http://localhost:8080/reports | grep "Menyusun laporan"` → **kosong**; `curl http://localhost:8080/reports | grep -oE "Sales Pipeline|SLA dan Quotation Performance|Export|Procurement Performance Review|Simpan View"` → **seluruhnya ditemukan**.
- **Verifikasi angka SLA dan Quotation Performance:** "Rata-rata Cycle Time" = **9,4 hari** — dihitung manual dari 8 pasangan (`OPP-001`→`QUO-001`=15 hari, `OPP-002`→`QUO-002`=19, `OPP-003`→`QUO-003`=21, `OPP-004`→`QUO-004`=0, `OPP-005`→`QUO-005`=13, `OPP-006`→`QUO-006`=7, `OPP-008`→`QUO-008`=0, `OPP-010`→`QUO-010`=0; total 75/8=9,375≈9,4) — **cocok persis**. "Dalam Threshold SLA" = **38%** (3 dari 8 ≤3 hari = 37,5%≈38%) — **cocok persis**.
- **Verifikasi drill-down Activity Center:** `curl http://localhost:8080/activity-center | grep -oE 'href="/crm/opportunities/[A-Z0-9-]+"|href="/crm/parties/[A-Z0-9-]+"|href="/projects/[A-Z0-9-]+"|href="/vendors/[A-Z0-9-]+"'` → ditemukan `/crm/opportunities/OPP-001`, `/crm/opportunities/OPP-005`, `/crm/opportunities/OPP-006`, `/crm/opportunities/OPP-008`, `/crm/parties/PTY-001`, `/projects/PRJ-101`, `/projects/PRJ-104`, `/vendors/VND-003`, `/vendors/VND-005`. Dikonfirmasi lebih detail: event module `quotation` (QUO-001/005/006) menaut ke `/crm/opportunities/OPP-001` (opportunity induknya via `getQuotationById`), BUKAN ke route quotation yang tidak ada — mapping benar.
- **Verifikasi cross-link dan drill-down lain:** `href="/procurement/performance"` ditemukan di `/reports` (Vendor Summary). `/reports` tidak menghasilkan string error apa pun.
- **Error string check:** `grep -oE "Internal Server Error|TypeError|is not defined|Cannot read propert"` pada `/`, `/reports`, `/activity-center`, `/supplier` — **tidak ditemukan** pada seluruhnya.
- `npx vitest run` — "No test files found" (pre-existing, Q8).
- `npx nuxi typecheck`/lint — tidak dijalankan/tersedia (`vue-tsc`/`eslint` core belum terpasang, Q8, pre-existing).
- **Verifikasi interaktif** (klik Export/Save View/Apply View/Delete View, klik drill-down, ganti role) — **tidak dilakukan headless**, tidak ada tool browser headless tersedia di lingkungan ini (keterbatasan konsisten sejak Section 06). Dimitigasi lewat code review ketat terhadap seluruh handler (`submitSaveView`/`applyView`/`removeView`/`submitExport`/`eventLink`) + smoke test konten SSR di atas.
- Dev server **di-kill** setelah validasi selesai (port 8080 dikonfirmasi bebas via `Get-NetTCPConnection`, dan curl mengembalikan connection failed).

## 14. Regression Checks

Route existing yang tidak disentuh (`/documents`, `/documents?tab=messages`, `/documents?tab=notifications`, `/changes`, `/bookings`, `/finance`, `/finance/invoices`, `/admin/roles`, `/crm/opportunities`, `/customer-journey`, `/client`, `/vendors`, `/ticketing`, `/accommodation`, `/transportation`, `/mice`) — seluruhnya tetap HTTP 200, konten tidak berubah (dikonfirmasi lewat smoke test bagian 13). `app/pages/index.vue`/`app/pages/reports/index.vue` — struktur KPI row, filter grid, widget grid, dan 6 SectionCard existing dikonfirmasi TIDAK direstrukturisasi (hanya diperkaya `#actions`/section baru, urutan dan kondisi `v-if` existing dipertahankan persis). `app/pages/activity-center/index.vue` — filter/search/module-count stat TIDAK diubah. `app/pages/supplier/index.vue` — 4 SectionCard nav card dan Profil Company TIDAK dipindah/diubah. Selector Section 17 (`rfqs`/`serviceOrders`/`getSupplierInvoicesByServiceOrder`) dan Section 17 lain (`getVendorProcurementPerformance`) hanya dibaca, tidak diubah signature/behavior.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-052 — daftar lengkap file/perubahan. Section terdampak (SEMUA read-only/aditif, tidak ada mutasi destruktif): Section 06 lama (`app/pages/index.vue`, D-031 LOCKED, struktur TIDAK disentuh), Section 16 lama (`app/pages/reports/index.vue`, struktur 6 section TIDAK disentuh), Prompt 19 (`app/pages/activity-center/index.vue`, D-052 LOCKED, TIDAK disentuh selain penambahan link), Section 17 (`app/pages/supplier/index.vue` diperkaya aditif; selector `rfqs`/`serviceOrders`/`getSupplierInvoicesByServiceOrder`/`getVendorProcurementPerformance` hanya dibaca), Section 02 (CI-030, 3 widget welcome Dashboard — dikonfirmasi ulang masih ada dan berfungsi, TIDAK diubah).

## 16. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja (`npm run dev` di `localhost:8080`, tidak ada deployment/preview URL publik).

## 17. Known Issues dan Deferred Work

- **Q8 (tooling lint/typecheck/test) tetap terbuka** — 22 section berturut-turut berjalan tanpa validasi otomatis penuh.
- **"Approval cycle time" (SLA dan Quotation Performance) TIDAK dihitung** — `Quotation` (`app/types/opportunity.ts`, LOCKED sejak Section 08) tidak memiliki field timestamp `approvedAt` tersimpan (hanya `approvedBy`/`approvalNote`). Opsi menaksir dari `PartyActivity.createdAt` DITOLAK karena `createPartyActivity` selalu memakai `DEMO_REFERENCE_DATE` ("hari ini") sebagai `createdAt`, bukan tanggal historis asli — akan menghasilkan metrik menyesatkan. Didokumentasikan sebagai gap data model genuine, bukan fabrikasi data.
- **Drill-down Project Performance (Reports) TIDAK ditautkan** — `/projects` tidak punya query-filter support dan berada di luar touch-point Section 22 (tidak boleh menyentuh file di luar daftar minimal).
- **Drill-down module `lead`/`finance`/`user` (Activity Center) TIDAK ditautkan** — `lead` tidak punya route `[id]` (hanya drawer di `/customer-journey/leads`), `finance` (`entityId` INV-xxx/PAY-xxx) tidak ada route per-ID di `/finance/invoices`, `user` tidak ada route `[id]` di `/admin/users`. Ketiganya di luar touch-point Section 22 untuk ditambahkan.
- **Invoice Aging drill-down BUKAN filter per-invoice** — menaut ke tab Finance Project Detail (`/projects/[id]?tab=finance`), bukan ke `/finance/invoices` dengan filter spesifik (halaman tsb tidak punya query-filter support).
- **Verifikasi per-role Dashboard (11 role)** dilakukan via code review + SSR curl (Super Admin) + fixture cross-check — BUKAN interactive browser headless (role-switching client-only via `localStorage`, keterbatasan tooling konsisten sejak Section 06). Lihat bagian 12 untuk tabel lengkap per role.
- Verifikasi interaktif (klik Export/Save View/Apply/Delete/drill-down) tidak dilakukan headless — dimitigasi code review ketat + smoke test konten SSR.

## 18. Protection Notes untuk Section Berikutnya

- `app/pages/index.vue` — struktur widget/filter/KPI row TETAP D-031 LOCKED. Section berikutnya yang butuh Dashboard menampilkan data baru cukup memastikan fixture konsisten, JANGAN restrukturisasi.
- `app/pages/reports/index.vue` — 7 SectionCard (6 existing + "SLA dan Quotation Performance" baru Section 22) TETAP struktur final. Section berikutnya yang butuh agregasi baru — REUSE selector `app/data/index.ts` existing (termasuk 4 selector Saved Views baru), JANGAN hitung ulang logic yang sama.
- `SavedView`/`SAVED_VIEWS`/`getSavedViewsForUser`/`createSavedView`/`deleteSavedView`/`applySavedView` (baru, `app/types/reporting.ts`/`app/data/reporting.ts`) — pola centralized mock state siap dipakai bila section lain butuh "saved filter" serupa (mis. `/changes`, `/documents`) — tambahkan `SavedViewPage` union baru, JANGAN buat entitas paralel.
- `eventLink` (`app/pages/activity-center/index.vue`) — bila route `[id]` baru untuk `lead`/`finance`/`user` ditambahkan oleh section lain di masa depan, function ini dapat diperluas (tambah `case` baru) alih-alih dibuat ulang.
- Supplier Action Center (`app/pages/supplier/index.vue`) — pola `actionItems` computed sama persis Client Portal (`app/pages/client/index.vue`) — bila section lain butuh Action Center serupa (mis. Product Planner Portal bila ada), REUSE pola ini.

## 19. Recommended Next Section

Section 23 — Administration, Master Data dan Audit, berbasis urutan roadmap literal (`docs/frontend-implementation-roadmap.md`). Tidak dieksekusi otomatis — menunggu perintah user.
