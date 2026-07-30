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
| 15 | Project Finance | `section-15-project-finance.md` | Belum dibuat — section belum dieksekusi |
| 16 | Reports | `section-16-reports.md` | Belum dibuat — section belum dieksekusi |
| 17 | Administration | `section-17-administration.md` | Belum dibuat — section belum dieksekusi |
| 18 | Regression and Demo Readiness | `section-18-regression-demo-readiness.md` | Belum dibuat — section belum dieksekusi |

Baris "Belum dibuat" akan diisi tautan begitu section terkait benar-benar dieksekusi dan laporannya dibuat — jangan menandai sebagai tersedia sebelum file-nya benar-benar ada di folder ini.

## Isi Minimum Setiap Laporan

Sesuai protokol bagian A: section objective dan scope, source documents yang dibaca, existing implementation yang diperiksa, decisions yang digunakan, implementation summary dan user flow, routes, files created/changed/removed, components reused/created, types/constants/fixtures/mock state, responsive behavior, states (loading/empty/error/not-found/unauthorized), role behavior, validation commands dan hasilnya, regression checks, cross-section impact, review URLs, known issues dan deferred work, protection notes untuk section berikutnya, recommended next section.
