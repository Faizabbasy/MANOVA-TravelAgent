# Mockup Implementation State — MANOVA

Dokumen kondisi implementasi **terkini** (bukan log kronologis — lihat `docs/mockup-section-progress.md` untuk histori, dan `docs/mockup-progress.md` untuk narasi lengkap Prompt 0–5). Wajib dibaca di awal setiap section baru sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian B, dan diperbarui di akhir setiap section sesuai bagian F.

Ditulis berdasarkan pemeriksaan langsung terhadap codebase (`git log`, `git status`, isi file `app/**`) dan hasil validasi yang benar-benar dijalankan ulang pada tanggal update di bawah — bukan disalin buta dari narasi lama.

---

## 1. Current Phase dan Current Section

- **Current phase:** Foundation + Dashboard + CRM Party + Opportunity/Quotation + Opportunity Won to Project + Project Core + Traveler and Participant + Itinerary and Operations + Vendor Management + Project Changes + Project Finance selesai. Modul Reports/Administration (Section 16 ke atas) **belum** dieksekusi.
- **Current section:** Tidak ada section aktif — sistem menunggu perintah user untuk memulai Section 16 (Reports).
- **Last completed section:** **Section 15 — Project Finance** (`prompts/17-PROMPT-15-PROJECT-FINANCE.md`), status **COMPLETED**. Detail lengkap: `docs/mockup-section-reports/section-15-project-finance.md`.
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

**Catatan commit:** Section 08 dan 09 sudah ter-commit (`495b6d9 "Create opportunity-won-to-project"`); Section 10 ter-commit (`2650015 "SECTION10-Project-Core"`); Section 11 ter-commit (`14b6106 "SECTION13-Traveler-Participant"`); Section 12 ter-commit (`57899a4 "SECTION12-ITINERARY-OPERATIONS"`); Section 13 ter-commit (`19f21b9 "SECTION15-VENDOR-MANAGEMENT"`); Section 14 ter-commit (`069c898 "SECTION14-PROJECT-CHANGES"`). Section 15 belum ter-commit pada saat dokumen ini ditulis.

## 2. Route Inventory (Kondisi Aktual)

Baris yang statusnya berubah Section 15:

| Route | Catatan Section 15 |
|---|---|
| `/finance/invoices` | **Selesai** — dari `ModulePlaceholder` menjadi list penuh (filter status/search, aging, dialog detail + payment history) |
| `/finance/payments` | **Selesai** — dari `ModulePlaceholder` menjadi list penuh (search, invoice+project) |
| `/projects/[id]` | **Tab Finance selesai** — Budget/Actual/Variance/Quotation/Committed Vendor Cost/Margin, invoice+aging, payment history, **visibilitas berbasis role** (Tier 0 Sales/Ops/subdomain vs Tier 1 PM/Finance/Management/SuperAdmin/Viewer, Margin dikecualikan PM). Overview/Travelers/Itinerary & Services/Vendors/Activity & Changes (Section 10/11/12/13/14) **tidak disentuh kodenya**. |

## 3. Component Shared dan Domain yang Sudah Tersedia

Tidak ada shared component **file** baru Section 15. Seluruhnya reuse `StatsCard`/`Table*`/`Dialog*`/`DetailMetadataList` existing.

## 4. Types, Constants, Fixtures, Mock State, dan Role Behavior yang Aktif

**Tidak ada perubahan type/constant/fixture Section 15** — `Invoice`/`Payment` (Foundation) dan `VENDOR_QUOTATIONS` (Section 13) dipakai apa adanya (read-only). `app/utils/attention.ts` +`invoiceAgingDays` (selektor turunan). `app/data/index.ts` +3 selektor turunan (`getInvoiceOutstandingIdr`, `getProjectOutstandingIdr`, `getCommittedVendorCostIdr`).

**Role behavior:** **Baru** `canViewMargin` (satu baris turunan: `canViewFinancials && currentRole !== 'project-manager'`) — **tidak ada constant role baru**, `canView('finance')`/`canViewFinancials`/`canManage('finance')` existing (`usePermissions()`, Foundation) sudah persis presisi untuk seluruh tier visibilitas yang dibutuhkan (dikonfirmasi: `ROLE_MODULE_ACCESS.finance` VIEW+ persis = Super Admin/Management/Finance/PM/Viewer, NONE persis = Sales/Operations/Ticketing/Accommodation/Transportation/MICE).

## 5. Area Hasil Section Lama yang Harus Dilindungi

- Seluruh shared component, fixture, type, constant — jangan diubah shape-nya tanpa cross-section impact check.
- `app/pages/projects/[id]/index.vue` — shell 8-tab, struktur tab/single-route LOCKED (D-026/D-027) — **tidak diubah** Section 15, hanya isi tab Finance yang direstrukturisasi. Overview/Travelers/Itinerary & Services/Vendors/Activity & Changes (Section 10/11/12/13/14) **tidak disentuh kodenya**.
- Selektor finansial (`getInvoiceOutstandingIdr`, `getProjectOutstandingIdr`, `getCommittedVendorCostIdr`, `invoiceAgingDays`) — gunakan yang sudah ada di `app/data/index.ts`/`app/utils/attention.ts`, jangan hitung ulang logic yang sama di tempat lain (mis. Section 16 Reports).
- **Keputusan didokumentasikan (bukan gap tersembunyi):** tidak ada CRUD invoice/payment (di luar scope literal); "Estimated cost" tidak dimodelkan terpisah dari `Project.budgetIdr` (sudah merepresentasikan konsep yang sama).

## 6. Known Issues dan Validation Status

Divalidasi ulang langsung pada tanggal update dokumen ini:

| Cek | Hasil | Catatan |
|---|---|---|
| `npx nuxi prepare` | **Sukses** | |
| `npm run build` | **Sukses (exit 0)** | |
| Smoke test konten (curl + grep, bukan hanya status code) | **Benar** — aging invoice presisi (28 & 9 hari overdue, cocok `daysUntil` manual); Margin/Variance/Committed Vendor Cost/Outstanding PRJ-101/102/103 seluruhnya cocok persis `docs/mockup-data-scenarios.md` bagian 1.3/2.3/3.3 (mis. PRJ-102 Variance **-Rp 25.000.000**, Margin Rp 10.000.000, Outstanding Rp 95.000.000) | Nilai turunan diverifikasi presisi terhadap dokumen yang sudah ada sejak Prompt 4, bukan diasumsikan |
| Regresi tab lain Project Detail (Overview, Vendors, Activity & Changes) dan Dashboard/Finance overview | **Tidak berubah**, konten identik dengan sebelum Section 15 | Dikonfirmasi lewat curl dengan query param `?tab=overview`, `?tab=vendors`, `?tab=activity-changes`, dan `/`, `/finance` |
| `npx vitest run` | **"No test files found", exit code 1** | Pre-existing |
| `npx nuxi typecheck` | **Gagal — `vue-tsc` tidak terpasang** | Q8 belum diselesaikan |
| Lint | **Tidak tersedia** | Q8 belum diselesaikan |
| Verifikasi interaktif (ganti role, cek tier visibilitas berubah live) | **Tidak dilakukan** | Tidak ada tool browser headless; role tersimpan di `localStorage` klien, tidak dapat disimulasikan lewat curl SSR; logic diverifikasi lewat code review |

**Known issues terbuka:**
- **Q8 — Tooling lint/typecheck/test.** Tetap `NEEDS_VALIDATION`. **Sebelas section berturut-turut** (06–15) berjalan tanpa validasi otomatis penuh.
- Tidak ada CRUD invoice/payment (keputusan didokumentasikan, bagian 5) — bukan bug.
- Verifikasi interaktif tidak dilakukan langsung (keterbatasan tooling).
- Q7, Q9, Q10, Q11 — tidak berubah.

## 7. Next Recommended Section

Section 16 — Reports (`prompts/18-PROMPT-16-REPORTS.md`). **Rekomendasi sangat kuat:** selesaikan Q8 sebelum Section 16 — sebelas section berturut-turut telah berjalan tanpa validasi otomatis. Tidak dieksekusi otomatis — menunggu perintah user.

## 8. Last Updated

- **Date:** 2026-07-30
- **Updater:** Section 15 (Project Finance) execution, berdasarkan pemeriksaan langsung codebase, build/smoke-test yang benar-benar dijalankan ulang.
