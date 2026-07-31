# Section Reports — MANOVA

Folder ini berisi laporan detail per section implementasi, sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian A ("Laporan per section") dan G ("Format laporan akhir section").

## Konvensi Penamaan

`section-XX-<nama-domain>.md`, dengan `XX` = **Section ID** dua digit yang tercantum di baris pertama masing-masing file prompt eksekusi (`prompts/08-...md` sampai `prompts/20-...md`), bukan nomor urut file di folder `prompts/`. Section ID mengikuti nomor "Prompt N" pada dokumentasi lama (mis. Prompt 5 = Section 05, Prompt 6 = Section 06, dst.).

## Mengapa Section 00–04 Tidak Punya File Laporan Terpisah

Section 00–04 (Konteks Bisnis, Audit Template, Gap Analysis, Information Architecture, Dokumentasi) adalah tahap dokumentasi/desain murni yang dikerjakan **sebelum** protokol ini diformalkan sebagai kewajiban per-section. Narasi lengkapnya sudah didokumentasikan penuh di `docs/mockup-progress.md` (Entri 1–5) dan dokumen domain terkait (`docs/mockup-scope.md`, `docs/mockup-information-architecture.md`, `docs/route-and-role-matrix.md`, `docs/mockup-design-decisions.md`, dll.). Membuat file `section-00-...md` s/d `section-04-...md` yang isinya mengulang dokumen-dokumen tersebut akan menduplikasi informasi tanpa menambah fakta baru — bertentangan dengan prinsip "hapus duplikasi hanya bila maknanya benar-benar sama" yang sudah diterapkan sejak Prompt 4.

Ringkasan Section 00–04 dalam skema field standar protokol ini tetap tersedia di `docs/mockup-section-progress.md`.

**Section 05 (Foundation) adalah section pertama yang mendapat file laporan khusus** karena merupakan section pertama yang mengubah kode aplikasi, sesuai instruksi eksplisit user saat menyiapkan dokumentasi continuity ini.

## Daftar Laporan

| Section ID | Nama | File | Status |
|---|---|---|---|
| 05 | Foundation | [`section-05-foundation.md`](./section-05-foundation.md) | COMPLETED |
| 06 | Dashboard | [`section-06-dashboard.md`](./section-06-dashboard.md) | COMPLETED |
| 07 | CRM Party | [`section-07-crm-party.md`](./section-07-crm-party.md) | COMPLETED |
| 08 | Opportunity and Quotation | [`section-08-opportunity-quotation.md`](./section-08-opportunity-quotation.md) | COMPLETED |
| 09 | Opportunity Won to Project | [`section-09-opportunity-won-to-project.md`](./section-09-opportunity-won-to-project.md) | COMPLETED |
| 10 | Project Core | [`section-10-project-core.md`](./section-10-project-core.md) | COMPLETED |
| 11 | Traveler and Participant | [`section-11-traveler-participant.md`](./section-11-traveler-participant.md) | COMPLETED |
| 12 | Itinerary and Operations | [`section-12-itinerary-operations.md`](./section-12-itinerary-operations.md) | COMPLETED |
| 13 | Vendor Management | [`section-13-vendor-management.md`](./section-13-vendor-management.md) | COMPLETED |
| 14 | Project Changes | [`section-14-project-changes.md`](./section-14-project-changes.md) | COMPLETED |
| 15 | Project Finance | [`section-15-project-finance.md`](./section-15-project-finance.md) | COMPLETED |
| 16 | Reports | [`section-16-reports.md`](./section-16-reports.md) | COMPLETED |
| 17 | Administration | [`section-17-administration.md`](./section-17-administration.md) | COMPLETED |
| 18 | Regression and Demo Readiness | [`section-18-regression-demo-readiness.md`](./section-18-regression-demo-readiness.md) | COMPLETED |

Baris "Belum dibuat" akan diisi tautan begitu section terkait benar-benar dieksekusi dan laporannya dibuat — jangan menandai sebagai tersedia sebelum file-nya benar-benar ada di folder ini.

## Change Requests (di luar 18 section baku)

Perubahan yang terjadi **setelah** seluruh 18 section COMPLETED memakai skema `change-<nama-singkat>.md` (bukan `section-XX`, karena bukan bagian phasing baku Prompt 0–18):

| Tanggal | Nama | File | Status |
|---|---|---|---|
| 2026-07-30 | Prompt 19 — Customer Journey, Account Executive, Supplier, Commercial Approval | [`change-customer-journey-ae-supplier.md`](./change-customer-journey-ae-supplier.md) | COMPLETED |
| 2026-07-31 | Prompt 20 — Sales Qualification to Account Executive Opportunity Flow | [`change-sales-qualification-ae-opportunity.md`](./change-sales-qualification-ae-opportunity.md) | COMPLETED |

## Roadmap Section 00–24 (skema baru, berdampingan dengan skema di atas)

Sejak 2026-08-01, `prompts/01-PROTOKOL-WAJIB.md` versi "FRONTEND-ONLY CONTINUATION" memperkenalkan roadmap Section 00–24 baru (D-057, `docs/mockup-design-decisions.md` Kelompok K) — **bukan pengganti** skema Prompt 0–20 di atas, melainkan lapisan lanjutan. Laporannya memakai skema nama yang sama `section-NN-<slug>.md` tapi merujuk section yang berbeda (mis. `section-00-current-progress-reconciliation.md` di sini BUKAN Section 00–04 dokumentasi murni skema lama). Pembaca harus memeriksa tanggal dan judul untuk membedakan.

| Section | Nama | File | Status |
|---|---|---|---|
| 00 | Current Progress Reconciliation | [`section-00-current-progress-reconciliation.md`](./section-00-current-progress-reconciliation.md) | COMPLETED |
| 01 | Frontend Foundation dan State Governance | [`section-01-frontend-foundation-state-governance.md`](./section-01-frontend-foundation-state-governance.md) | COMPLETED |
| 02 | Role, Access dan Navigation | [`section-02-role-access-navigation.md`](./section-02-role-access-navigation.md) | COMPLETED |
| 03 | Public Lead Intake | [`section-03-public-lead-intake.md`](./section-03-public-lead-intake.md) | COMPLETED |
| 04 | Sales Leads dan Qualification | [`section-04-sales-leads-qualification.md`](./section-04-sales-leads-qualification.md) | COMPLETED |
| 05 | Account Executive Opportunity dan Quotation | [`section-05-ae-opportunity-quotation.md`](./section-05-ae-opportunity-quotation.md) | COMPLETED |
| 06 | Management Approval, Won dan Client Activation | [`section-06-management-approval-won.md`](./section-06-management-approval-won.md) | COMPLETED |
| 07 | Customer Journey | [`section-07-customer-journey.md`](./section-07-customer-journey.md) | COMPLETED |
| 08 | Client Portal | [`section-08-client-portal.md`](./section-08-client-portal.md) | COMPLETED |
| 09 | Project Order dan Handover | [`section-09-project-order-handover.md`](./section-09-project-order-handover.md) | COMPLETED |
| 10 | Product Planning dan Costing | [`section-10-product-planning-costing.md`](./section-10-product-planning-costing.md) | COMPLETED |
| 11 | Traveler dan Travel Documents | [`section-11-traveler-documents.md`](./section-11-traveler-documents.md) | COMPLETED |
| 12 | Itinerary, Operations, Tasks dan Readiness | [`section-12-itinerary-operations-readiness.md`](./section-12-itinerary-operations-readiness.md) | COMPLETED |
| 13 | Ticketing | [`section-13-ticketing.md`](./section-13-ticketing.md) | COMPLETED |
| 14 | Accommodation | [`section-14-accommodation.md`](./section-14-accommodation.md) | COMPLETED |
| 15 | Transportation | [`section-15-transportation.md`](./section-15-transportation.md) | COMPLETED |
| 16 | MICE dan Event | [`section-16-mice.md`](./section-16-mice.md) | COMPLETED |
| 17 | Supplier dan Procurement | [`section-17-supplier-procurement.md`](./section-17-supplier-procurement.md) | COMPLETED |

**Catatan disambiguasi (D-057):** `section-17-supplier-procurement.md` (baris di atas, roadmap Section 00–24 baru) TIDAK BOLEH tertukar dengan `section-17-administration.md` (skema lama Prompt 0–20, tabel "Daftar Laporan" di atas — topik Administration, COMPLETED sejak sebelumnya) — keduanya sengaja bernomor sama ("17") karena berasal dari dua skema penomoran berbeda yang berdampingan (lihat bagian "Roadmap Section 00–24" di atas), BUKAN duplikat/konflik.

## Isi Minimum Setiap Laporan

Sesuai protokol bagian A: section objective dan scope, source documents yang dibaca, existing implementation yang diperiksa, decisions yang digunakan, implementation summary dan user flow, routes, files created/changed/removed, components reused/created, types/constants/fixtures/mock state, responsive behavior, states (loading/empty/error/not-found/unauthorized), role behavior, validation commands dan hasilnya, regression checks, cross-section impact, review URLs, known issues dan deferred work, protection notes untuk section berikutnya, recommended next section.
