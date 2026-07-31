# Frontend Known Issues — MANOVA (Roadmap Section 00–24)

Dibuat oleh **Section 00 — Current Progress Reconciliation** (2026-08-01). Berisi gap yang ditemukan saat mencocokkan kondisi codebase aktual (hasil Prompt 0–20, COMPLETED) terhadap roadmap Section 00–24 baru. Known issues historis Prompt 0–20 **tidak diulang di sini** — tetap di `docs/mockup-final-known-issues.md` dan `docs/mockup-implementation-state.md` bagian 6 (rujuk dokumen tsb untuk gap lama seperti Q8 tooling).

Status: `NEEDS_VALIDATION` (perlu keputusan/implementasi saat section pemilik dikerjakan), `DEFERRED` (sengaja ditunda, bukan blocker), `KNOWN_GAP` (dicatat, tidak dianggap bug — batas scope Prompt 0–20 yang belum mencakup requirement roadmap baru).

## 0. Section 01–02 — Sudah Diselesaikan (2026-08-01)

Gap foundation berikut ditemukan Section 00 dan sudah ditutup oleh Section 01 (`docs/mockup-section-reports/section-01-frontend-foundation-state-governance.md`), dicatat di sini untuk jejak, bukan lagi open:
- **State reset / seed scenario** — sebelumnya tidak ada mekanisme reset. Sekarang tersedia `app/utils/mock-reset.ts` + `app/plugins/mock-reset.client.ts` + tombol "Reset Demo Data" (`/settings`).
- **Repository/service layer** — diklarifikasi (bukan gap): `app/data/index.ts` sudah memenuhi maksud fungsionalnya (single source, tidak ada fixture terduplikasi per halaman) sejak Foundation lama. Lihat D-058 (`docs/mockup-design-decisions.md`).
- **`ErrorState.vue`/`LoadingState.vue`** — dikonfirmasi tersedia dan reusable (bukan hilang), meski belum dipakai luas — tersedia untuk section berikutnya yang butuh simulasi loading/error eksplisit.

## 1. Role dan Akses — RESOLVED Section 02 (2026-08-01)

- ~~Role `client`, `product-planner`, `procurement` belum ada~~ — **RESOLVED**, `RoleId` kini 16 nilai (D-059).
- ~~Matrix view permission belum dikonfirmasi~~ — **RESOLVED**, `/admin/roles` dikonfirmasi SUDAH berupa grid ModuleKey x Role literal (sejak Section 17 lama) — diperluas 6→8 kolom (CI-031).
- ~~Dashboard kosong untuk role baru~~ — **RESOLVED** (ditemukan+ditutup dalam Section 02 yang sama, CI-030) — 3 widget welcome baru untuk Client/Procurement/Product Planner.
- Sisa pekerjaan role baru tetap milik section pemiliknya: fitur bisnis penuh Client Portal (Section 08), RFQ/Service Order Procurement (Section 17), modul Product Planning/Costing (Section 10) — role/akses/nav/shell sudah siap sebagai fondasi.

## 2. Lead dan Qualification (Section 04)

- **Reopen lead archived** — tidak ada aksi "reopen" pada Lead yang sudah di-archive (`archiveLead` bersifat satu arah). Status: `KNOWN_GAP`.
- **Merge-duplicate suggestion** — tidak ada deteksi/penyarangan Lead duplikat. Status: `KNOWN_GAP`.

## 3. Opportunity dan Quotation (Section 05)

- **Quotation duplicate/compare** — tidak ada aksi "Duplicate Quotation" atau tampilan perbandingan sisi-berdampingan antar versi (hanya `supersededAmountIdr` — nilai tunggal versi sebelumnya). Status: `KNOWN_GAP`.
- **Send mock ke client / withdraw submission** — tidak ada aksi eksplisit "Send to Client" (di luar Client Confirmation, lihat bagian 4) maupun "Withdraw" quotation yang sudah submitted (revert manual ke draft tanpa lewat reject Management). Status: `KNOWN_GAP`.
- **PDF/print preview** — belum ada preview cetak/PDF mock untuk Quotation. Status: `KNOWN_GAP`.
- **Line item tax/fee/markup terpisah** — `Quotation.serviceBreakdown` (Prompt 20) punya service/description/amount; belum ada breakdown pajak/fee/markup terpisah dari `discountIdr`. Status: `KNOWN_GAP`.

## 4. Management Approval dan Client Activation (Section 06)

- **Approval queue agregat belum ada** — approval hanya dapat diakses per-Opportunity, tidak ada halaman "Management Approval Inbox" lintas Opportunity. Lihat Q14. Status: `NEEDS_VALIDATION`.
- **Client confirmation belum ada record/aksi eksplisit** — Mark as Won saat ini digerbangi `quotation.approvalStatus === 'approved'` + requirement lengkap, TANPA langkah "client confirmation" terpisah yang diminta Section 06/13 (Prompt 20). Lihat Q14. Status: `NEEDS_VALIDATION`.

## 5. Customer Journey (Section 07)

- **Funnel drill-down dan conversion metrics** — `/customer-journey` menampilkan ringkasan stage, belum dikonfirmasi sebagai funnel interaktif dengan drill-down per stage dan metrik konversi eksplisit (lead-to-qualified, dst.) seperti diminta Section 07. Status: `NEEDS_VALIDATION`.

## 6. Client Portal (Section 08)

- **Belum ada sama sekali** — tidak ada route `/client/*`, tidak ada role `client`, tidak ada data-scoping per Client company. Status: `NOT_STARTED` (bukan bug, di luar scope Prompt 0–20).

## 7. Project Order dan Handover (Section 09)

- **Taksonomi status baru belum diimplementasikan** — lihat Q16. `ProjectStatus` existing (LOCKED, D-028) berbeda dari daftar status Section 09. Status: `NEEDS_VALIDATION`.
- **AE-to-PM handover accept/return belum ada** — Project dibuat otomatis dengan PM default (`DEFAULT_PROJECT_OWNER_ID = 'USR-002'`), tanpa langkah PM "Accept Handover"/"Return Handover" eksplisit. Status: `KNOWN_GAP`.

## 8. Product Planning dan Costing (Section 10)

- **Belum ada sama sekali** — tidak ada entitas Product/Package catalog, tidak ada Cost Sheet terpisah dari `Quotation`. Status: `NOT_STARTED`.

## 9. Traveler dan Travel Documents (Section 11)

- **Dokumen selain paspor belum di-track** — `Traveler` punya `passportNumber`/`passportExpiryDate`; visa, tiket, dan asuransi belum ada field/UI. Status: `KNOWN_GAP`.

## 10. Itinerary, Operations, Tasks dan Readiness (Section 12)

- **Readiness checklist/matrix terpisah belum ada** — saat ini hanya missing-document indicator per traveler (`getTravelersMissingDocuments`), belum ada readiness gate agregat per project (dokumen + booking + payment). Status: `KNOWN_GAP`.
- **Departure countdown/alert eksplisit** — `isUpcomingDeparture` (util existing) dipakai untuk Attention widget, belum tentu tampil sebagai "countdown" UI khusus. Status: `NEEDS_VALIDATION`.

## 11. Ticketing / Accommodation / Transportation / MICE (Section 13–16)

- **Belum ada halaman dedicated per domain** — role `ticketing`/`accommodation`/`transportation`/`mice` saat ini hanya menggerbangi akses tab bersama "Itinerary & Services" di Project Detail (`canManageServiceType`), bukan halaman/dashboard terpisah per domain seperti diminta Section 13–16. Status: `KNOWN_GAP` — arsitektur existing (D-020, LOCKED: Operations/Traveler melebur ke tab Project Detail, bukan menu top-level) mungkin perlu ditinjau ulang secara eksplisit saat Section 13–16 dimulai (potensi konflik dengan D-020, dicatat sebagai perlu keputusan baru, bukan pelanggaran otomatis).

## 12. Supplier dan Procurement (Section 17)

- **Role Procurement belum ada** — lihat Q13; kemungkinan tumpang tindih dengan konsep `vendor` module existing, perlu keputusan eksplisit (reuse vs role baru terpisah).
- **RFQ formal/comparison/clarification/selection** — saat ini hanya `submitVendorQuotation`/`acceptVendorQuotation`/`rejectVendorQuotation` (submit-accept-reject sederhana), belum ada alur RFQ multi-tahap. Status: `KNOWN_GAP`.
- **Service Order/amendment/acknowledgment/fulfillment** — belum ada. Status: `KNOWN_GAP`.
- **Supplier invoice submission preview** — dicatat sebagai Q12 lama (`docs/mockup-open-questions.md`, deferred sejak Prompt 19), masih relevan untuk Section 17.

## 13. Booking dan Service Orders (Section 18)

- **Belum ada halaman konsolidasi** — booking flight/hotel/transport/MICE hanya terlihat sebagai baris `ProjectService` di tab "Itinerary & Services", belum ada tampilan Service Order konsolidasi lintas jenis layanan. Status: `NOT_STARTED`.

## 14. Changes, Cancellation, Refund dan Incident (Section 19)

- **Cancellation/Refund/Incident record terstruktur belum ada** — tab "Activity & Changes" existing (`ActivityEntry` + `ChangeCategory`/`ChangeApprovalStatus`) menangani "Change" generik, belum ada kategori/field khusus Cancellation (penalty), Refund (partial/full/credit status), atau Incident (severity/escalation). Status: `KNOWN_GAP`.

## 15. Project Finance (Section 20)

- **Refund/credit status mock belum ada** — Invoice/Payment/Budget vs Actual sudah ada (Section 15 lama), refund tracking belum. Status: `KNOWN_GAP`.

## 16. Documents, Communication dan Notifications (Section 21)

- **Document center konsolidasi lintas modul belum ada** — dokumen saat ini tersebar per tab ("Documents" Project Detail, "Documents" Customer Detail via `getDocumentsByParty`), belum ada satu halaman terpusat.
- **Notification center in-app belum ada** — tidak ada halaman/dropdown notifikasi terpusat.
- **Komunikasi client/supplier terstruktur belum ada** — `PartyActivity`/`LeadActivity`/`VendorActivity` mencatat activity internal, belum ada "communication log" client-facing yang eksplisit terpisah dari catatan internal.

## 17. Dashboards, Reports, Lead Recap dan Activity Center (Section 22)

- **Export mock (CSV/PDF placeholder)** — belum ada di Reports (dicatat sejak Section 16 lama, tetap belum dikerjakan).
- **Widget role baru** — begitu role Client/Product Planner/Procurement ditambahkan, Dashboard perlu widget baru agar tidak kosong (pola sama seperti Prompt 19 menambah widget AE/Supplier).

## 18. Administration, Master Data dan Audit (Section 23)

- **Master data terbatas** — `app/constants/master-data.ts` (Section 17 lama) mencakup `MASTER_PROJECT_TYPES`/`MASTER_SERVICE_TYPES`/`MASTER_DESTINATIONS`/`MASTER_VENDOR_CATEGORIES`; belum ada currencies, taxes, payment terms, cancellation rules, numbering scheme, template, readiness gates, atau assignment rules sebagai master data terkelola.
- **Historical snapshot warning** — belum ada peringatan saat master data yang sudah dipakai record lama diubah.

## 19. Tooling (Warisan Prompt 0–20, Tidak Berubah)

- **Q8 — Lint/typecheck/test** tetap `NEEDS_VALIDATION` sejak Section 06 lama (`eslint` inti dan `vue-tsc` belum terpasang). Tidak diselesaikan Section 00 (di luar scope audit-only; instalasi package baru tetap tunduk kebijakan D-036).
