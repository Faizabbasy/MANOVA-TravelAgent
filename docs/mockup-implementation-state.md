# Mockup Implementation State — MANOVA

Dokumen kondisi implementasi **terkini** (bukan log kronologis — lihat `docs/mockup-section-progress.md` untuk histori, dan `docs/mockup-progress.md` untuk narasi lengkap Prompt 0–5). Wajib dibaca di awal setiap section baru sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian B, dan diperbarui di akhir setiap section sesuai bagian F.

Ditulis berdasarkan pemeriksaan langsung terhadap codebase (`git log`, `git status`, isi file `app/**`) dan hasil validasi yang benar-benar dijalankan ulang pada tanggal update di bawah — bukan disalin buta dari narasi lama.

---

## 1. Current Phase dan Current Section

- **Current phase:** Foundation + Dashboard + CRM Party + Opportunity/Quotation + Opportunity Won to Project + Project Core + Traveler and Participant + Itinerary and Operations + Vendor Management + Project Changes + Project Finance + Reports selesai. Modul Administration (Section 17 ke atas) **belum** dieksekusi.
- **Current section:** Tidak ada section aktif — sistem menunggu perintah user untuk memulai Section 17 (Administration).
- **Last completed section:** **Section 16 — Reports** (`prompts/18-PROMPT-16-REPORTS.md`), status **COMPLETED**. Detail lengkap: `docs/mockup-section-reports/section-16-reports.md`.
- Section 15 — Project Finance: COMPLETED, detail `docs/mockup-section-reports/section-15-project-finance.md`.
- Section 14 — Project Changes: COMPLETED, detail `docs/mockup-section-reports/section-14-project-changes.md`.
- Section 13 — Vendor Management: COMPLETED, detail `docs/mockup-section-reports/section-13-vendor-management.md`.
- Section 12 — Itinerary and Operations: COMPLETED, detail `docs/mockup-section-reports/section-12-itinerary-operations.md`.
- Section 11 — Traveler and Participant: COMPLETED, detail `docs/mockup-section-reports/section-11-traveler-participant.md`.
- Section 10 — Project Core: COMPLETED, detail `docs/mockup-section-reports/section-10-project-core.md`.
- Section 09 — Opportunity Won to Project: COMPLETED, detail `docs/mockup-section-reports/section-09-opportunity-won-to-project.md`.
- Section 08 — Opportunity dan Quotation: COMPLETED, detail `docs/mockup-section-reports/section-08-opportunity-quotation.md`.
- Section 07 — CRM Party: COMPLETED, detail `docs/mockup-section-reports/section-07-crm-party.md`.
- Section 06 — Dashboard: COMPLETED, detail `docs/mockup-section-reports/section-06-dashboard.md`.
- Section 05 — Foundation: COMPLETED, detail `docs/mockup-section-reports/section-05-foundation.md`.
- Section 00–04: dokumentasi murni, COMPLETED, narasi `docs/mockup-progress.md` Entri 1–5.

**Catatan commit:** Section 08 dan 09 sudah ter-commit (`495b6d9 "Create opportunity-won-to-project"`); Section 10 ter-commit (`2650015 "SECTION10-Project-Core"`); Section 11 ter-commit (`14b6106 "SECTION13-Traveler-Participant"`); Section 12 ter-commit (`57899a4 "SECTION12-ITINERARY-OPERATIONS"`); Section 13 ter-commit (`19f21b9 "SECTION15-VENDOR-MANAGEMENT"`); Section 14 ter-commit (`069c898 "SECTION14-PROJECT-CHANGES"`); Section 15 ter-commit (`5542dd0 "SECTION15-PROJECT-FINANCE"`). Section 16 belum ter-commit pada saat dokumen ini ditulis.

## 2. Route Inventory (Kondisi Aktual)

Baris yang statusnya berubah Section 16:

| Route | Catatan Section 16 |
|---|---|
| `/reports` | **Selesai** — dari `ModulePlaceholder` menjadi 6 section laporan agregasi (Sales Pipeline, Project Performance, Upcoming Departure dan Service Readiness, Vendor Summary, Budget vs Actual dan Margin, Invoice Aging dan Outstanding), filter status/tipe/periode project, visibilitas per role. Badge "Segera" di sidebar dihapus (`app/constants/navigation.ts`). |

## 3. Component Shared dan Domain yang Sudah Tersedia

Tidak ada shared component **file** baru Section 16. Seluruhnya reuse `PageHeader`/`SectionCard`/`RoleAccessState`/`LoadingState`/`EmptyState`/`StatusBreakdownList`/`StatsCard`/`BudgetChart`/`Table*`/`Select*` existing.

## 4. Types, Constants, Fixtures, Mock State, dan Role Behavior yang Aktif

**Tidak ada perubahan type/constant/fixture Section 16** — murni agregasi read-only di atas `PROJECTS`/`OPPORTUNITIES`/`QUOTATIONS`/`VENDOR_QUOTATIONS`/`INVOICES` dan selektor `app/data/index.ts` existing (`getProjectServices`, `getServicesForProjects`, `getVendorById`, `getCommittedVendorCostIdr`, `getInvoiceOutstandingIdr`, `getProjectById`) serta `app/utils/attention.ts` (`isUpcomingDeparture`, `invoiceAgingDays`).

**Role behavior:** Tidak ada permission/constant baru. Gerbang halaman tetap `canView('reports')` (`ROLE_MODULE_ACCESS.reports`, Foundation). Enam flag `visibleTo(...)` lokal di `app/pages/reports/index.vue` menggerbangi tiap section sesuai pemetaan pada `docs/route-and-role-matrix.md` bagian 1.6 (catatan implementasi Section 16) — pemetaan 2 section baru (Upcoming Departure/Service Readiness, Vendor Summary) adalah keputusan implementasi Section 16 sendiri, bukan perluasan tabel LOCKED bagian 5.

## 5. Area Hasil Section Lama yang Harus Dilindungi

- Seluruh shared component, fixture, type, constant — jangan diubah shape-nya tanpa cross-section impact check.
- `app/pages/projects/[id]/index.vue` — shell 8-tab, struktur tab/single-route LOCKED (D-026/D-027) — **tidak disentuh** Section 16.
- Selektor finansial/operasional (`getInvoiceOutstandingIdr`, `getProjectOutstandingIdr`, `getCommittedVendorCostIdr`, `invoiceAgingDays`, `getServicesForProjects`, `isUpcomingDeparture`) — gunakan yang sudah ada di `app/data/index.ts`/`app/utils/attention.ts`, jangan hitung ulang logic yang sama di tempat lain (mis. Section 17 Administration bila butuh angka serupa).
- `app/pages/reports/index.vue` — pemilik penuh 6 section Reports (Section 16). Filter lokal ke halaman ini (tidak berbagi state dengan filter Dashboard Section 06).
- **Keputusan didokumentasikan (bukan gap tersembunyi):** export mock tidak dikerjakan (belum disepakati, sesuai hard rule literal Prompt 16); tidak ada CRUD invoice/payment (di luar scope literal, keputusan Section 15); "Estimated cost" tidak dimodelkan terpisah dari `Project.budgetIdr` (Section 15).
- **Ditemukan namun sengaja tidak diperbaiki:** `app/constants/navigation.ts` — item Invoices/Payments masih bertanda `comingSoon: true` meski `COMPLETED` sejak Section 15 (kemungkinan oversight Section 15). Section 16 tidak memperbaikinya untuk menjaga scope tetap murni Reports.

## 6. Known Issues dan Validation Status

Divalidasi ulang langsung pada tanggal update dokumen ini:

| Cek | Hasil | Catatan |
|---|---|---|
| `npx nuxi prepare` | **Sukses** | |
| `npm run build` | **Sukses (exit 0, 2x run)** | Run kedua setelah fix `comingSoon` |
| Smoke test HTTP (curl, 8 route termasuk `/reports`) | **Seluruhnya HTTP 200** | |
| Verifikasi bundle server (`reports-*.mjs`) | **Benar** — 6 judul section ter-compile | SSR awal hanya skeleton loading (pola identik Dashboard Section 06), bukan regresi |
| Verifikasi angka manual (silang fixture) | **Benar** — Budget/Actual/Variance/Quotation/Margin agregat 3 project, Invoice Aging (28 & 9 hari overdue, cocok Section 15), Committed Vendor Cost Rp1.365.000.000, Sales Pipeline Win Rate 75% | Nilai turunan diverifikasi presisi, bukan diasumsikan |
| Regresi route lain (`/`, `/projects`, `/projects/PRJ-102`, `/vendors`, `/finance/invoices`, `/finance/payments`, `/crm/opportunities`) | **Tidak berubah**, tetap HTTP 200 | Hanya `app/constants/navigation.ts` (1 baris) yang disentuh di luar `app/pages/reports/index.vue` |
| `npx vitest run` | **"No test files found", exit code 1** | Pre-existing |
| `npx nuxi typecheck` | **Gagal — `vue-tsc` tidak terpasang** | Q8 belum diselesaikan |
| Lint | **Tidak tersedia** | Q8 belum diselesaikan |
| Verifikasi interaktif (ganti role, cek section muncul/hilang sesuai matrix) | **Tidak dilakukan** | Tidak ada tool browser headless; role tersimpan di `localStorage` klien, tidak dapat disimulasikan lewat curl SSR; logic diverifikasi lewat code review |

**Known issues terbuka:**
- **Q8 — Tooling lint/typecheck/test.** Tetap `NEEDS_VALIDATION`. **Dua belas section berturut-turut** (06–16) berjalan tanpa validasi otomatis penuh.
- Export mock tidak dikerjakan (keputusan didokumentasikan, bagian 5) — bukan bug.
- Pemetaan role 2 section baru Reports (Upcoming Departure/Service Readiness, Vendor Summary) belum diformalkan sebagai LOCKED — disarankan direview user.
- `app/constants/navigation.ts` item Invoices/Payments masih bertanda `comingSoon: true` (oversight Section 15, ditemukan namun di luar scope Section 16).
- Verifikasi interaktif tidak dilakukan langsung (keterbatasan tooling).
- Q7, Q9, Q10, Q11 — tidak berubah.

## 7. Next Recommended Section

Section 17 — Administration (`prompts/19-PROMPT-17-ADMINISTRATION.md`). **Rekomendasi sangat kuat:** selesaikan Q8 sebelum Section 17 — dua belas section berturut-turut telah berjalan tanpa validasi otomatis. Tidak dieksekusi otomatis — menunggu perintah user.

## 8. Last Updated

- **Date:** 2026-07-30
- **Updater:** Section 16 (Reports) execution, berdasarkan pemeriksaan langsung codebase, build/smoke-test yang benar-benar dijalankan ulang.
