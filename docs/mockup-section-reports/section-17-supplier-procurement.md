# Section Report — Section 17: Supplier dan Procurement

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_17_Supplier_Procurement.md`. Section kedelapan belas roadmap Section 00–24 baru, dijalankan setelah Section 16 (MICE dan Event, COMPLETED).

---

## 1. Section Objective dan Scope

"Lengkapi Procurement dan Supplier Portal." Wajib: Supplier companies, contacts, categories, documents, status. Catalog/services/rates. RFQ, supplier response, comparison, clarification, selection. Service Order, amendment, acknowledgment, fulfillment. Supplier dashboard dan portal. Supplier quotation, documents, fulfillment updates, invoice submission preview. PT ABC dan PT EFG memiliki produk berbeda. Supplier isolation berdasarkan company. Procurement performance review. Acceptance: Procurement dan Supplier dapat menjalankan sourcing sampai fulfillment handoff.

## 2. Source Documents yang Dibaca

`prompts/SECTION_17_Supplier_Procurement.md`, `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `CLAUDE.md`, `docs/mockup-implementation-state.md`, `docs/mockup-section-progress.md` (Section 13-16), `docs/mockup-change-impact-log.md` (khususnya CI-046), `docs/mockup-design-decisions.md` (D-070 s/d D-073 dibaca penuh sebagai preseden arsitektur), `docs/frontend-known-issues.md` bagian 12, `docs/mockup-open-questions.md` Q12/Q13, `docs/frontend-implementation-roadmap.md`, `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/mockup-section-reports/README.md`, `docs/mockup-section-reports/section-16-mice.md` (template struktur laporan dan level detail), source code aktual (`app/types/vendor.ts`, `app/data/vendors.ts`, `app/pages/vendors/index.vue`, `app/pages/vendors/[id]/index.vue`, `app/pages/supplier/index.vue`, `app/pages/supplier/products/index.vue`, `app/pages/supplier/orders/index.vue`, `app/constants/roles.ts`, `app/constants/navigation.ts`, `app/constants/status.ts`, `app/types/user.ts`, `app/data/index.ts`, `app/types/mice.ts`/`app/data/mice.ts`/`app/pages/mice/**` dan `app/types/transportation.ts` sebagai template struktural, `app/data/users.ts`, `app/pages/projects/[id]/index.vue`, `app/pages/admin/roles.vue`), `git status`.

## 3. Existing Implementation yang Diperiksa

`git status` menunjukkan Section 06–16 masih uncommitted (belum di-commit user, dicatat apa adanya, tidak diganggu). `docs/frontend-known-issues.md` bagian 12 dan `docs/frontend-implementation-roadmap.md` baris 24 menandai section ini `PARTIAL` — role `procurement` dan `vendor: MANAGE` sudah ada sejak Section 02, hanya `submitVendorQuotation`/`acceptVendorQuotation`/`rejectVendorQuotation` (submit-accept-reject sederhana, Section 13 lama) yang tersedia.

Audit langsung kode mengonfirmasi: `Vendor` (`app/types/vendor.ts`) hanya `id`/`name`/`serviceType`/`contactName`/`contactPhone` (5 field) — tidak ada `category`/`status`/`documents`. Vendor Detail 5 tab (Overview/Services/Quotations/Products/Contacts) — tidak ada tab Documents. `/supplier` (Supplier Portal) punya 2 halaman self-service (`products`, `orders`) — read-only, tidak ada RFQ Inbox/Service Order Inbox/Invoice Submission. `VENDORS` (`app/data/vendors.ts`) memuat 7 vendor termasuk `VND-006` (PT ABC, hotel) dan `VND-007` (PT EFG, mice) — keduanya sudah punya katalog `VendorProduct` berbeda sejak Prompt 19 (`VPR-001`/`002` hotel untuk PT ABC, `VPR-003`/`004` mice untuk PT EFG), memenuhi literal "PT ABC dan PT EFG memiliki produk berbeda" sejak sebelum section ini — tinggal dipakai ulang, bukan diulang.

## 4. Decisions yang Digunakan

D-074 (`docs/mockup-design-decisions.md`, baru) — tiga area terpisah (`/vendors` master data diperluas aditif, `/supplier` self-service diperluas, `/procurement` modul top-level baru MENDAMPINGI keduanya); `RFQ`/`ServiceOrder`/`SupplierInvoice` entitas baru mereuse `Vendor.id`; `VendorQuotation` submit-accept-reject (Section 13 lama) TIDAK diubah — jalur RFQ formal adalah TAMBAHAN, bukan pengganti; pola arsitektur mengikuti preseden D-070/D-071/D-072/D-073 secara eksplisit; cost isolation konsisten (`netCostIdr` tidak pernah tampil di Supplier Portal); Procurement Performance Review sebagai derivasi murni.

## 5. Implementation Summary

**Supplier companies, contacts, categories, documents, status** — `Vendor` (`app/types/vendor.ts`) diperluas aditif: `category?: string`, `status?: VendorStatus` (`active`/`inactive`/`pending`, default `active`), `documents?: VendorDocument[]`. Tab "Documents" baru di Vendor Detail (5→6 tab). Dialog "Edit Kategori/Status" di header Vendor Detail. `VendorContact` (Section 13 lama) tidak disentuh — "contacts" sudah terpenuhi sebelumnya.

**Catalog/services/rates** — DIREUSE penuh dari `VendorProduct`/`getVendorProducts` (Prompt 19), tidak diduplikasi.

**RFQ, supplier response, comparison, clarification, selection** — `RFQ` (`app/types/procurement.ts`) lifecycle 7-status literal (`draft`→`sent`→`responses-in`→`comparison`⇄`clarification`→`selected`→`closed`). `sendRfqToVendors` (draft→sent, membuat `RFQInvitation` per vendor). `submitRfqResponse` (Supplier Portal, per-line-item pricing, transisi otomatis sent→responses-in). `getRfqResponses` (comparison table, diurutkan harga terendah). `RFQClarificationMessage` dua-arah (`from: 'procurement' | 'supplier'`), pesan procurement memajukan status ke `clarification`. `selectRfqVendor` (formal Select action — response terpilih `selected`, response lain `rejected`, `RFQ.selectedVendorId` terisi, status → `selected`, dicatat sebagai `ActivityEntry` bila `projectId` ada).

**Service Order, amendment, acknowledgment, fulfillment** — `ServiceOrder` lifecycle 6-status (`draft`→`sent`→`acknowledged`⇄`amended`→`fulfilled`/`cancelled`, `amended` BUKAN terminal — pola sama `HotelBookingStatus.amended`, D-071). Handoff RFQ→Service Order via tombol "Buat Service Order" di RFQ detail (status `selected`/`closed`, line items+harga di-seed dari RFQ/response pemenang). `acknowledgeServiceOrder`/`markFulfilled` (Supplier Portal, self-service). `ServiceOrderAmendment` append-only riwayat perubahan. Fulfillment status timeline (derivasi visual 4-tahap) di Service Order detail internal.

**Supplier dashboard dan portal** — `/supplier` mendapat 2 stat card baru (RFQ Perlu Respons, Service Order Aktif) dan 2 link card baru (RFQ Inbox, Service Orders).

**Supplier quotation, documents, fulfillment updates, invoice submission preview** — `/supplier/rfq/[id]` (form respons harga per-line-item, resubmit sampai diputuskan, clarification thread reply). `/supplier/service-orders/[id]` (Acknowledge, Tandai Fulfilled, form Invoice Submission — `submitSupplierInvoice`, HANYA untuk Service Order `fulfilled` milik vendor yang sama, resolusi Q12). `SupplierInvoice` — preview/mock murni, TIDAK ADA payment gateway/processing nyata (larangan protokol eksplisit), status `submitted`→`under-review`→`approved`/`rejected` via `reviewSupplierInvoice` (internal, `/procurement/service-orders/[id]`).

**PT ABC dan PT EFG memiliki produk berbeda** — melanjutkan `VENDOR_PRODUCTS` (Prompt 19), dipakai luas di fixture RFQ (RFQ-002 mengundang keduanya untuk kebutuhan berbeda, RFQ-003 clarification thread aktif dengan PT ABC).

**Supplier isolation berdasarkan company** — `/supplier/rfq`, `/supplier/rfq/[id]`, `/supplier/service-orders`, `/supplier/service-orders/[id]` seluruhnya di-scope `vendorScopeId` (pola sama existing `/supplier/products`/`/supplier/orders`), plus guard eksplisit di `submitSupplierInvoice` (`so.vendorId !== input.vendorId` ditolak) dan halaman detail (`isInvited`/`isOwn` computed menolak akses bila bukan milik vendor).

**Procurement performance review** — `/procurement/performance`, `getVendorProcurementPerformance` (DERIVASI murni dari `RFQ`/`RFQInvitation`/`RFQResponse`/`ServiceOrder` existing, bukan field tersimpan, pola sama `getCostSheetBreakdown`/`getMiceBoqTotals`) — win rate, rata-rata waktu respons (hari), on-time fulfillment % (rasio Service Order `fulfilled`/total), quotation history per vendor.

**Modul `/procurement`** — dashboard (`/procurement`, 2 tab RFQ/Service Orders + 4 stat card + dialog Create RFQ), RFQ detail (`/procurement/rfq/[id]`, line items, invited vendors, comparison table, clarification thread, Select action, handoff Service Order), Service Order detail (`/procurement/service-orders/[id]`, line items, fulfillment timeline, amendment history, invoice review), Performance Review (`/procurement/performance`) — MENDAMPINGI ringkasan baru di sub-section Itinerary & Services Project Detail.

## 6. Routes

8 route baru: `/procurement` (dashboard), `/procurement/rfq/[id]` (detail), `/procurement/service-orders/[id]` (detail), `/procurement/performance`, `/supplier/rfq` (list), `/supplier/rfq/[id]` (detail+respons+clarification), `/supplier/service-orders` (list), `/supplier/service-orders/[id]` (detail+acknowledge+fulfillment+invoice). Tidak ada route existing yang di-rename/dihapus. `/vendors`, `/vendors/[id]`, `/supplier`, `/projects/[id]` diperkaya pada route yang sama.

## 7. Files Created, Changed, dan Removed

**Created:**
- `app/types/procurement.ts`
- `app/data/procurement.ts`
- `app/pages/procurement/index.vue`
- `app/pages/procurement/rfq/[id]/index.vue`
- `app/pages/procurement/service-orders/[id]/index.vue`
- `app/pages/procurement/performance/index.vue`
- `app/pages/supplier/rfq/index.vue`
- `app/pages/supplier/rfq/[id]/index.vue`
- `app/pages/supplier/service-orders/index.vue`
- `app/pages/supplier/service-orders/[id]/index.vue`
- `docs/mockup-section-reports/section-17-supplier-procurement.md` (laporan ini)

**Changed:**
- `app/types/vendor.ts` (+`category`/`status`/`documents` pada `Vendor`, +`VendorStatus`, +`VendorDocument`, `VendorDetailTab` +`documents`)
- `app/data/vendors.ts` (+`VENDOR_DOCUMENTS`, backfill `category`/`status` 7 vendor existing)
- `app/pages/vendors/index.vue` (+kolom Kategori/Status, +field kategori form Tambah Vendor)
- `app/pages/vendors/[id]/index.vue` (+tab Documents, +dialog Edit Kategori/Status)
- `app/pages/supplier/index.vue` (+2 stat card, +2 link card RFQ Inbox/Service Orders)
- `app/pages/supplier/products/index.vue` — TIDAK diubah (regresi, dikonfirmasi tetap HTTP 200)
- `app/pages/supplier/orders/index.vue` — TIDAK diubah (regresi, dikonfirmasi tetap HTTP 200)
- `app/types/user.ts` (`ModuleKey` +`procurement`)
- `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` +kolom `procurement` seluruh 16 role)
- `app/constants/navigation.ts` (+menu "Procurement" 3-child, +icon `ClipboardList`, +2 child Supplier Portal "RFQ Inbox"/"Service Orders")
- `app/constants/status.ts` (+`VENDOR_STATUSES`, `+RFQ_STATUSES`, `+SERVICE_ORDER_STATUSES`, `+SUPPLIER_INVOICE_STATUSES`)
- `app/data/index.ts` (+`getVendorDocuments`, `+updateVendor`, `+createVendorDocument`, +seluruh selector/mutator RFQ [`getRfqById`/`getRfqsByProject`/`getRfqInvitations`/`getRfqResponses`/`getRfqResponseByVendor`/`getRfqClarifications`/`getRfqsForVendor`/`createRfq`/`updateRfq`/`sendRfqToVendors`/`submitRfqResponse`/`getRfqStatusTransitions`/`moveRfqStatus`/`addRfqClarificationMessage`/`selectRfqVendor`/`closeRfq`], +seluruh selector/mutator Service Order [`getServiceOrderById`/`getServiceOrdersByProject`/`getServiceOrdersByVendor`/`getServiceOrdersByRfq`/`getServiceOrderAmendments`/`createServiceOrder`/`updateServiceOrder`/`getServiceOrderStatusTransitions`/`updateServiceOrderStatus`/`amendServiceOrder`], +seluruh selector/mutator Supplier Invoice [`getSupplierInvoicesByServiceOrder`/`getSupplierInvoicesByVendor`/`submitSupplierInvoice`/`reviewSupplierInvoice`], `+getVendorProcurementPerformance`, `+getVendorsWithProcurementActivity`)
- `app/pages/projects/[id]/index.vue` (+SectionCard "Procurement — RFQ dan Service Order" di sub-section Itinerary & Services, +computed `projectServiceOrders`/`projectRfqs`)
- `app/pages/admin/roles.vue` (+1 baris `modules`, +update teks `ROLE_NOTES['procurement']`)
- `docs/mockup-design-decisions.md` (+D-074)
- `docs/mockup-change-impact-log.md` (+CI-047)
- `docs/mockup-data-scenarios.md` (+bagian 4t, +checklist ID)
- `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md` (bagian 12/13)
- `docs/mockup-open-questions.md` (Q12 RESOLVED)
- `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 26), `docs/mockup-section-progress.md`
- `docs/mockup-section-reports/README.md`

**Removed:** Tidak ada.

## 8. Components Reused/Created

Reused sepenuhnya: `PageHeader`, `SectionCard`, `DetailMetadataList`, `StatusBadge`, `EmptyState`, `RoleAccessState`, `Table*`, `Dialog*`/`DialogScrollContent`, `Checkbox`, `useToast`, `Tabs*`, `StatsCard`. Tidak ada shared component baru — pola halaman mengikuti persis `/ticketing`/`/accommodation`/`/transportation`/`/mice` (list+detail, dialog array-editor/form) dan `/supplier/products`/`/supplier/orders` (self-service ter-scope vendor). Fulfillment status timeline (Service Order detail) dibangun dari markup Tailwind sederhana (badge inline dalam `<ol>`) — bukan komponen baru, sesuai kebutuhan literal yang tidak membutuhkan interaksi apa pun (murni presentasi derivasi).

## 9. Types/Constants/Fixtures/Mock State

`+RFQ`/`RFQLineItem`/`RFQStatus`/`RFQInvitation`/`RFQInvitationStatus`/`RFQResponse`/`RFQResponseLineItem`/`RFQResponseStatus`/`RFQClarificationMessage`/`ServiceOrder`/`ServiceOrderLineItem`/`ServiceOrderStatus`/`ServiceOrderAmendment`/`SupplierInvoice`/`SupplierInvoiceStatus` (entitas dan type baru, `app/types/procurement.ts`). `Vendor` +`category`/`status`/`documents` (aditif), `+VendorStatus`/`VendorDocument` (`app/types/vendor.ts`). `ModuleKey` +`procurement`.

Fixture: 4 `RFQ` merentang seluruh status literal (`RFQ-001` draft, `RFQ-002` responses-in dengan 2 respons VND-004/VND-007, `RFQ-003` clarification dengan thread aktif VND-002/VND-006, `RFQ-004` closed dengan vendor terpilih VND-003). 2 `ServiceOrder` ("one plain, one amended" — `SO-001` fulfilled hasil RFQ-004, `SO-002` amended engagement langsung VND-006). 1 `ServiceOrderAmendment` (`SOA-001`). 4 `SupplierInvoice` merentang seluruh status literal (`SINV-001` approved, `SINV-002` under-review, `SINV-003` rejected, `SINV-004` submitted). 5 `VendorDocument` termasuk kontrak+sertifikasi PT ABC dan kontrak PT EFG. Seluruh `vendorId` mereuse `VENDORS` existing — lihat `docs/mockup-data-scenarios.md` bagian 4t untuk narasi lengkap.

## 10. Responsive Behavior

Tidak ada pola baru — seluruh halaman memakai `Table`/`Dialog`/`SectionCard`/`Tabs` existing yang sudah responsive (grid `sm:grid-cols-*` untuk stat card/financial summary, `DialogScrollContent` untuk dialog Create RFQ yang cukup panjang di layar kecil, `overflow-x-auto` untuk tabel comparison RFQ).

## 11. States (Loading/Empty/Error/Unauthorized/Not-Found)

- `RoleAccessState` untuk `!canView('procurement')` (internal) dan `!canView('supplier-portal') || !vendorScopeId`/`!isInvited`/`!isOwn` (Supplier Portal, isolasi).
- Not-found: "RFQ tidak ditemukan"/"Service Order tidak ditemukan" (pola identik section lain) untuk ID yang tidak ada, berlaku di halaman internal MAUPUN Supplier Portal (dengan pesan berbeda — "tidak ada atau company Anda belum diundang"/"bukan milik company Anda" untuk memperjelas isolasi, bukan sekadar ID salah).
- Empty state per SectionCard: "Belum ada line item"/"RFQ belum dikirim ke vendor manapun"/"Belum ada respons vendor"/"Belum ada pesan klarifikasi"/"Belum ada amendment tercatat"/"Belum ada invoice diajukan" — masing-masing area punya empty state sendiri.
- Locked/guard state: RFQ `closed` menolak respons baru (`canRespond` computed di Supplier Portal, pesan "RFQ ini sudah ditutup"); response yang sudah diputuskan (`selected`/`rejected`) juga tidak bisa diedit lagi (pesan "Penawaran Anda sudah diputuskan"); Service Order `fulfilled`/`cancelled` menolak edit lebih lanjut (`updateServiceOrder` guard); Invoice hanya bisa diajukan saat Service Order `fulfilled` (pesan eksplisit bila belum).
- Validation: dialog Cancel Service Order/Reject Invoice/Reject Client Approval mewajibkan alasan/catatan (`disabled` pada tombol konfirmasi sampai field terisi).

## 12. Role Behavior

`canManageProcurement` = `canManage('procurement')` (RANK-based standar) — hanya `procurement` (`MANAGE`) dan `super-admin` (`ADMIN`) yang mencapai rank tulis di `/procurement/*`, pola sama section 13-16 (D-070/D-071/D-072/D-073). `canViewProcurementFinancials` = `canManageProcurement || canViewFinancials` (gabungan existing `FULL_FINANCIAL_VISIBILITY_ROLES` DENGAN `procurement`). Role lain internal (Management/Finance/PM/Operations/Viewer): `VIEW`. Role lain (Sales/AE/Product Planner/Ticketing/Accommodation/Transportation/MICE/Client): `NONE`. `Supplier` — `NONE` pada `procurement` (modul internal), akses lewat `supplier-portal` (`MANAGE`) yang sudah ter-scope `vendorScopeId`.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses** (2x run, termasuk setelah perbaikan default clarification thread).
- `npx nuxi typecheck` — gagal, `vue-tsc` belum terpasang (Q8, pre-existing gap, 17 section berturut-turut).
- `npm run lint` — tidak tersedia (Q8, pre-existing).
- `npx vitest run` — "No test files found" (pre-existing).
- **Smoke test HTTP** — `/procurement`, `/procurement/rfq/RFQ-001`/`002`/`003`/`004`, `/procurement/rfq/RFQ-999` (not-found), `/procurement/service-orders/SO-001`/`002`, `/procurement/service-orders/SO-999` (not-found), `/procurement/performance`, `/vendors`, `/vendors/VND-006`/`007`/`999` (not-found), `/supplier`, `/supplier/products`, `/supplier/orders`, `/supplier/rfq`, `/supplier/rfq/RFQ-002`, `/supplier/service-orders`, `/supplier/service-orders/SO-001`, plus regresi `/admin/roles`, `/projects/PRJ-101`/`102`/`103`, `/accommodation`, `/transportation`, `/mice`, `/ticketing`, `/` — **seluruhnya HTTP 200**.
- **Smoke test konten** (curl+grep):
  - `/procurement/rfq/RFQ-004` menampilkan "Trans Wahana Logistik" pada tabel comparison (vendor terpilih).
  - `/procurement/service-orders/SO-001` menampilkan status "Fulfilled".
  - `/procurement/rfq/RFQ-999`/`/procurement/service-orders/SO-999` menampilkan "RFQ tidak ditemukan"/"Service Order tidak ditemukan".
  - `/procurement` menampilkan stat card "RFQ Aktif"/"Service Order Fulfilled".
  - `/procurement/performance` menampilkan baris "PT ABC"/"Trans Wahana Logistik" dan kolom "Win Rate".
  - `/vendors` menampilkan kolom "Kategori" dan nilai "Hotel Budget".
  - `/vendors/VND-006?tab=documents` menampilkan "Kontrak Kerjasama PT ABC 2026.pdf" dan "Sertifikat Standar Layanan PT ABC.pdf"; `/vendors/VND-007?tab=documents` menampilkan "Kontrak Kerjasama PT EFG 2026.pdf".
  - `/procurement/rfq/RFQ-002` menampilkan "Cendana MICE Organizer"/"PT EFG" dan status "Respons Masuk".
  - `/procurement/rfq/RFQ-003` — **ditemukan default clarification thread menampilkan vendor pertama diundang (VND-002), bukan VND-006 yang punya thread aktif** — diperbaiki (lihat bagian 16) agar default memilih vendor dengan thread aktif; setelah perbaikan, dikonfirmasi menampilkan kedua pesan ("Mohon konfirmasi kebijakan pembatalan..."/"Pembatalan H-3 dikenakan...").
  - `/supplier/rfq` menampilkan "RFQ Inbox"; `/supplier/service-orders` menampilkan "Service Order Inbox".
  - `/admin/roles` menampilkan kolom "Procurement" dan deskripsi "RFQ/Service Order/Supplier Invoice lifecycle (Section 17)".
  - `/projects/PRJ-103?tab=itinerary-services` menampilkan blok "Procurement — RFQ dan Service Order" dengan "RFQ Transportasi Bandara — Grup VIP Tambahan".
  - Regresi `/vendors/VND-002` (vendor existing tanpa dokumen tetap render normal), `/supplier/products`, `/supplier/orders`, `/admin/roles`, `/accommodation`, `/transportation`, `/mice`, `/ticketing` dikonfirmasi tidak berubah konten existing-nya.
- **Verifikasi interaktif** (klik Send RFQ, Select vendor, Acknowledge/Tandai Fulfilled Service Order, submit/review Invoice, kirim pesan klarifikasi) **tidak dilakukan headless** — keterbatasan tooling konsisten sejak Section 06. Dimitigasi lewat code review ketat terhadap seluruh guard (`sendRfqToVendors`/`submitRfqResponse`/`selectRfqVendor`/`updateServiceOrderStatus`/`amendServiceOrder`/`submitSupplierInvoice`/`reviewSupplierInvoice` seluruhnya menolak transisi tidak valid/tanpa alasan-wajib) dan smoke test SSR konten yang membuktikan lifecycle, isolasi vendor, dan sanitasi cost bekerja benar.

## 14. Regression

`app/pages/projects/[id]/index.vue` (dimiliki Section 12 lama/Foundation — hanya blok "Procurement — RFQ dan Service Order" ditambahkan SETELAH loop tipe layanan existing dan SEBELUM "Operational Tasks", tabel `ProjectService` generik dan tab lain TIDAK disentuh, dikonfirmasi via smoke test `?tab=overview`/`?tab=travelers`/`?tab=finance` tidak berubah). `app/pages/vendors/index.vue`/`app/pages/vendors/[id]/index.vue` (dimiliki Section 13 lama — kolom/tab lama TIDAK dihapus, hanya ditambah). `app/pages/supplier/index.vue` (Prompt 19 — 2 stat card lama diganti nama tapi TIDAK dihapus fungsinya, 2 link card lama tetap ada, hanya ditambah 2 baru). `app/pages/admin/roles.vue` (dimiliki Section 17 lama/Section 02 — hanya 1 baris array + 1 teks catatan ditambahkan). `app/constants/roles.ts` (`ROLE_MODULE_ACCESS` — seluruh 16 baris ditambah 1 properti `procurement`, nilai existing untuk 13 modul lain di setiap baris TIDAK diubah). `VendorContact`/`VendorQuotation`/`VendorActivity`/`VendorProduct` (Section 13 lama/Prompt 19) TIDAK diubah shape maupun isinya sama sekali — `submitVendorQuotation`/`acceptVendorQuotation`/`rejectVendorQuotation` (`app/data/index.ts`) TIDAK disentuh signature/perilakunya.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-047 — ekstensi aditif ke Vendor Directory (Section 13 lama), Supplier Portal (Prompt 19), Project Detail (Section 12 lama/Foundation), Matrix Role dan `ModuleKey`/`NAV_ITEMS`/`ROLE_MODULE_ACCESS` (Section 02/17 lama) — seluruhnya aditif, regression-tested. Ditemukan (bukan diperbaiki retroaktif, dicatat transparan): `docs/mockup-implementation-state.md` bagian 2/4 (narasi "2x") tidak diperbarui sejak Section 09 oleh Section 10-16 — di luar scope literal Section 17 untuk memperbaiki 7 section mundur, tapi dicatat eksplisit di dokumen tsb (bagian 6) agar tidak dianggap gap tersembunyi Section 17.

## 16. Known Issues dan Deferred Work

- Q8 (tooling lint/typecheck/test) tetap terbuka — 17 section berturut-turut.
- Q12 (self-service invoice submission dari Supplier Portal) **RESOLVED** — lihat `docs/mockup-open-questions.md`.
- **Bug ditemukan dan diperbaiki dalam section yang sama** (bukan dibiarkan): default vendor terpilih pada Clarification Thread RFQ detail (`/procurement/rfq/[id]`) awalnya selalu memilih vendor PERTAMA yang diundang (`invitations.value[0]`), bukan vendor yang benar-benar punya thread aktif — pada RFQ-003 ini membuat 2 pesan klarifikasi existing (dengan PT ABC) tidak terlihat tanpa interaksi manual pilih dropdown. Diperbaiki: `activeClarificationVendorId` kini memprioritaskan vendor dengan pesan klarifikasi ada, baru fallback ke `selectedVendorId`/vendor pertama. Diverifikasi ulang via curl+grep sebelum dan sesudah perbaikan (rebuild kedua sukses).
- "On-time %" Procurement Performance Review disederhanakan sebagai rasio Service Order `fulfilled` terhadap total (tidak ada field due-date terpisah pada `ServiceOrder` untuk dibandingkan dengan `fulfilledAt` aktual) — dicatat sebagai keputusan D-074, bukan gap tersembunyi/fabrikasi mesin bisnis (D-006).
- Ditemukan `docs/mockup-implementation-state.md` bagian 2/4 tidak diperbarui sejak Section 09 (lihat bagian 15 di atas) — dicatat transparan, tidak diperbaiki retroaktif (di luar scope literal Section 17).
- Verifikasi interaktif tidak dilakukan headless (keterbatasan tooling, konsisten sejak Section 06).
- Fixture: 4 RFQ tidak mencakup status `comparison` murni (RFQ-003 langsung `clarification`) — tetap fully reachable lewat UI transisi manual (`getRfqStatusTransitions`), murni keterbatasan jumlah baris demo.

## 17. Protection Notes untuk Section Berikutnya

`RFQ`/`ServiceOrder`/`SupplierInvoice` (D-074) — entitas BARU mereuse `Vendor.id`, jangan digabung/direstrukturisasi; `VendorQuotation` (Section 13 lama) TIDAK BOLEH diubah/dihapus/digantikan — dua jalur sourcing berbeda kebutuhan, tetap dipertahankan berdampingan selamanya kecuali ada keputusan baru eksplisit. `ServiceOrder` yang `fulfilled`/`cancelled` bersifat terminal — `updateServiceOrder` sudah menolak edit lebih lanjut, jangan dilonggarkan tanpa keputusan baru. `netCostIdr` TIDAK BOLEH tampil di `/supplier/service-orders/[id]` atau halaman client-facing manapun — computed halaman tsb sengaja tidak pernah membaca field itu. `SupplierInvoice` TETAP preview/mock murni — JANGAN tambahkan payment gateway/processing nyata apa pun (larangan protokol eksplisit, bukan sekadar rekomendasi). `ServiceOrder` (Procurement, Section 17) JANGAN disamakan dengan "Service Order konsolidasi lintas jenis layanan" yang dimaksud Section 18 (`docs/frontend-known-issues.md` bagian 13) — nama mirip, konsep berbeda; Section 18 harus eksplisit menyatakan mana yang dimaksud. `RFQ-004` sengaja TIDAK menautkan `serviceId` ke `SVC-1034` (tetap milik skenario comparison VQ-009/VQ-010 Section 13 lama) — JANGAN mengubah `VQ-009`/`VQ-010`/`SVC-1034` untuk "menyelesaikan" demo ini, keduanya sengaja tetap `pending-confirmation` sebagai live demo Section 13. **Dengan Section 17 selesai, preseden arsitektur D-070/D-071/D-072/D-073/D-074 (modul top-level baru mendampingi struktur existing, reuse data existing, sanitasi cost konsisten) TETAP berlaku sebagai acuan** untuk kebutuhan serupa di section berikutnya — JANGAN memindahkan konten `/vendors`/`/supplier` existing ke `/procurement` (D-020 tetap LOCKED untuk pola tab-vs-modul, keputusan section ini murni aditif).

## 18. Review URLs

Tidak ada deployment publik. Untuk review lokal: `npm run dev`, buka `http://localhost:8080/procurement` untuk dashboard RFQ+Service Order. Buka `http://localhost:8080/procurement/rfq/RFQ-003` untuk melihat comparison table dan clarification thread aktif dengan PT ABC. Buka `http://localhost:8080/procurement/rfq/RFQ-004` untuk melihat RFQ closed dengan vendor terpilih dan link Service Order hasil handoff. Buka `http://localhost:8080/procurement/service-orders/SO-002` untuk melihat Service Order amended dengan riwayat amendment dan invoice reject/resubmit. Buka `http://localhost:8080/procurement/performance` untuk Procurement Performance Review. Buka `http://localhost:8080/vendors/VND-006?tab=documents` untuk tab Documents Vendor Detail. Buka `http://localhost:8080/supplier/rfq` dan `http://localhost:8080/supplier/service-orders` untuk Supplier Portal (perlu role `supplier` aktif via role switcher untuk melihat data ter-scope). Buka `http://localhost:8080/projects/PRJ-103?tab=itinerary-services` untuk titik kolaborasi ringkasan Procurement di Project Detail.

## 19. Recommended Next Section

**Section 18 — Booking dan Service Orders** (halaman konsolidasi tampilan booking lintas Section 13-16 — Flight/Hotel/Transport/MICE dalam satu tampilan, BERBEDA dari `ServiceOrder` Procurement Section 17, lihat `docs/frontend-known-issues.md` bagian 13 catatan disambiguasi — status NOT_STARTED), berbasis dependency (`docs/frontend-implementation-roadmap.md`), menunggu perintah eksplisit user. Section ini TIDAK dilanjutkan otomatis ke Section 18 — berhenti sesuai instruksi protokol.
