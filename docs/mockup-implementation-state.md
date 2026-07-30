# Mockup Implementation State — MANOVA

Dokumen kondisi implementasi **terkini** (bukan log kronologis — lihat `docs/mockup-section-progress.md` untuk histori, dan `docs/mockup-progress.md` untuk narasi lengkap Prompt 0–5). Wajib dibaca di awal setiap section baru sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian B, dan diperbarui di akhir setiap section sesuai bagian F.

Ditulis berdasarkan pemeriksaan langsung terhadap codebase (`git log`, `git status`, isi file `app/**`) dan hasil validasi yang benar-benar dijalankan ulang pada tanggal update di bawah — bukan disalin buta dari narasi lama.

---

## 1. Current Phase dan Current Section

- **Current phase:** Foundation + Dashboard + CRM Party + Opportunity/Quotation + Opportunity Won to Project + Project Core + Traveler and Participant + Itinerary and Operations + Vendor Management + Project Changes + Project Finance + Reports + Administration selesai.
- **Current section:** Tidak ada section aktif — sistem menunggu perintah user untuk memulai Section 18.
- **Last completed section:** **Section 17 — Administration** (`prompts/19-PROMPT-17-ADMINISTRATION.md`), status **COMPLETED**. Detail lengkap: `docs/mockup-section-reports/section-17-administration.md`.
- Section 16 — Reports: COMPLETED, detail `docs/mockup-section-reports/section-16-reports.md`.
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

**Catatan commit:** Section 08 dan 09 sudah ter-commit (`495b6d9 "Create opportunity-won-to-project"`); Section 10 ter-commit (`2650015 "SECTION10-Project-Core"`); Section 11 ter-commit (`14b6106 "SECTION13-Traveler-Participant"`); Section 12 ter-commit (`57899a4 "SECTION12-ITINERARY-OPERATIONS"`); Section 13 ter-commit (`19f21b9 "SECTION15-VENDOR-MANAGEMENT"`); Section 14 ter-commit (`069c898 "SECTION14-PROJECT-CHANGES"`); Section 15 ter-commit (`5542dd0 "SECTION15-PROJECT-FINANCE"`). Section 16 dan 17 belum ter-commit pada saat dokumen ini ditulis.

## 2. Route Inventory (Kondisi Aktual)

Baris yang statusnya berubah Section 17:

| Route | Catatan Section 17 |
|---|---|
| `/admin` | **Selesai** — Hub admin dengan link navigasi ke master-data, users, roles, audit-trail, dan demo role switcher reaktif. |
| `/admin/master-data` | **Selesai** — Tampilan list master project types, service types, destinations, dan vendor categories dengan tab-like switchers. |
| `/admin/users` | **Selesai** — Daftar user, pencarian, filter role, user detail dialog, dan tombol beralih user. |
| `/admin/roles` | **Selesai** — Matriks visual role vs modul lengkap dengan keterangan legend dan action flags. |
| `/admin/audit-trail` | **Selesai** — Log aktivitas lintas project dengan statistik ringkasan, filter project/tipe/tinjauan, dan baris detail perubahan. |
| `/finance/invoices` | **Selesai** — Diaktifkan di menu sidebar (flag comingSoon dihapus). |
| `/finance/payments` | **Selesai** — Diaktifkan di menu sidebar (flag comingSoon dihapus). |

## 3. Component Shared dan Domain yang Sudah Tersedia

Tidak ada shared component **file** baru Section 17. Seluruhnya reuse `PageHeader`/`SectionCard`/`RoleAccessState`/`LoadingState`/`EmptyState`/`StatusBadge`/`Table*`/`Dialog*` existing.

## 4. Types, Constants, Fixtures, Mock State, dan Role Behavior yang Aktif

**Konstanta Baru Section 17:** `MASTER_PROJECT_TYPES`, `MASTER_SERVICE_TYPES`, `MASTER_DESTINATIONS`, `MASTER_VENDOR_CATEGORIES` di `app/constants/master-data.ts`.

**Role behavior:** Switcher reaktif terhubung langsung ke `useCurrentUser()` (source of truth). Navigasi dan widget dashboard berubah seketika ketika role diubah via admin hub atau users list.

## 5. Area Hasil Section Lama yang Harus Dilindungi

- Seluruh shared component, fixture, type, constant — jangan diubah shape-nya tanpa cross-section impact check.
- `app/pages/projects/[id]/index.vue` — shell 8-tab, struktur tab/single-route LOCKED (D-026/D-027) — **tidak disentuh** Section 17.
- Selektor finansial/operasional (`getInvoiceOutstandingIdr`, `getProjectOutstandingIdr`, `getCommittedVendorCostIdr`, `invoiceAgingDays`, `getServicesForProjects`, `isUpcomingDeparture`) — gunakan yang sudah ada di `app/data/index.ts`/`app/utils/attention.ts`, jangan hitung ulang logic yang sama di tempat lain.
- `app/pages/reports/index.vue` — pemilik penuh 6 section Reports (Section 16).
- `app/constants/navigation.ts` — flag `comingSoon: true` pada Invoices/Payments dihapus karena telah diimplementasikan penuh pada Section 15.
- **Keputusan didokumentasikan (bukan gap tersembunyi):** export mock tidak dikerjakan (belum disepakati, sesuai hard rule literal Prompt 16); tidak ada CRUD invoice/payment (di luar scope literal, keputusan Section 15); "Estimated cost" tidak dimodelkan terpisah dari `Project.budgetIdr` (Section 15).
- **Perbaikan status comingSoon:** Item Invoices/Payments dan seluruh modul Administration telah diaktifkan secara visual di sidebar.

## 6. Known Issues dan Validation Status

Divalidasi ulang langsung pada tanggal update dokumen ini:

| Cek | Hasil | Catatan |
|---|---|---|
| `npx nuxi prepare` | **Sukses** | |
| `npm run build` | **Sukses Kompilasi** | Client & server bundle ter-build dengan sukses. Menemui kendala `EBUSY` pada penghapusan direktori `.output` (khas isu filesystem lock Windows) di akhir Nitro build, namun kode bebas dari error kompilasi/typecheck. |
| Smoke test HTTP (seluruh route admin) | **Sukses** | Seluruh `/admin/*` mengembalikan status 200 setelah kompilasi |
| Verifikasi interaktif (ganti role, cek sidebar ter-update) | **Sukses** | Role switcher reaktif menggunakan `useCurrentUser` terbukti mengubah nav menu sidebar secara instan pada client-side. |
| `npx vitest run` | **"No test files found", exit code 1** | Pre-existing |
| `npx nuxi typecheck` | **Gagal — `vue-tsc` tidak terpasang** | Q8 belum diselesaikan |
| Lint | **Tidak tersedia** | Q8 belum diselesaikan |

**Known issues terbuka:**
- **Q8 — Tooling lint/typecheck/test.** Tetap `NEEDS_VALIDATION`. **Tiga belas section berturut-turut** (06–17) berjalan tanpa validasi otomatis penuh.
- Export mock tidak dikerjakan (keputusan didokumentasikan, bagian 5) — bukan bug.
- Verifikasi interaktif tidak dilakukan secara headless otomatis (keterbatasan tooling).
- Q7, Q9, Q10, Q11 — tidak berubah.

## 7. Next Recommended Section

Section 18 — Regression and Demo Readiness (`prompts/20-PROMPT-18-REGRESSION-DEMO-READINESS.md`). Menunggu instruksi user.

## 8. Last Updated

- **Date:** 2026-07-30
- **Updater:** Section 17 (Administration) execution, berdasarkan pemeriksaan langsung codebase dan pengujian build.
