# Mockup Implementation State — MANOVA

Dokumen kondisi implementasi **terkini** (bukan log kronologis — lihat `docs/mockup-section-progress.md` untuk histori, dan `docs/mockup-progress.md` untuk narasi lengkap Prompt 0–5). Wajib dibaca di awal setiap section baru sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian B, dan diperbarui di akhir setiap section sesuai bagian F.

Ditulis berdasarkan pemeriksaan langsung terhadap codebase (`git log`, `git status`, isi file `app/**`) dan hasil validasi yang benar-benar dijalankan ulang pada tanggal update di bawah — bukan disalin buta dari narasi lama.

---

## 1. Current Phase dan Current Section

- **Current phase:** Foundation + Dashboard + CRM Party + Opportunity/Quotation + Opportunity Won to Project + Project Core + Traveler and Participant + Itinerary and Operations + Vendor Management selesai. Modul Finance/Reports/Administration (Section 14 ke atas) **belum** dieksekusi.
- **Current section:** Tidak ada section aktif — sistem menunggu perintah user untuk memulai Section 14 (Project Changes).
- **Last completed section:** **Section 13 — Vendor Management** (`prompts/15-PROMPT-13-VENDOR-MANAGEMENT.md`), status **COMPLETED**. Detail lengkap: `docs/mockup-section-reports/section-13-vendor-management.md`.
- Section 12 — Itinerary and Operations: COMPLETED, detail `docs/mockup-section-reports/section-12-itinerary-operations.md`.
- Section 11 — Traveler and Participant: COMPLETED, detail `docs/mockup-section-reports/section-11-traveler-participant.md`.
- Section 10 — Project Core: COMPLETED, detail `docs/mockup-section-reports/section-10-project-core.md`.
- Section 09 — Opportunity Won to Project: COMPLETED, detail `docs/mockup-section-reports/section-09-opportunity-won-to-project.md`.
- Section 08 — Opportunity dan Quotation: COMPLETED, detail `docs/mockup-section-reports/section-08-opportunity-quotation.md`.
- Section 07 — CRM Party: COMPLETED, detail `docs/mockup-section-reports/section-07-crm-party.md`.
- Section 06 — Dashboard: COMPLETED, detail `docs/mockup-section-reports/section-06-dashboard.md`.
- Section 05 — Foundation: COMPLETED, detail `docs/mockup-section-reports/section-05-foundation.md`.
- Section 00–04: dokumentasi murni, COMPLETED, narasi `docs/mockup-progress.md` Entri 1–5.

**Catatan commit:** Section 08 dan 09 sudah ter-commit (`495b6d9 "Create opportunity-won-to-project"`); Section 10 ter-commit (`2650015 "SECTION10-Project-Core"`); Section 11 ter-commit (`14b6106 "SECTION13-Traveler-Participant"`); Section 12 ter-commit (`57899a4 "SECTION12-ITINERARY-OPERATIONS"`). Section 13 belum ter-commit pada saat dokumen ini ditulis.

## 2. Route Inventory (Kondisi Aktual)

Baris yang statusnya berubah Section 13:

| Route | Catatan Section 13 |
|---|---|
| `/vendors` | **Selesai** — filter search/jenis layanan, dialog "Tambah Vendor" (Super Admin) |
| `/vendors/[id]` | **Baru, selesai** — Vendor Detail 4 tab (Overview/Services/Quotations/Contacts) |
| `/projects/[id]` | **Tab Vendors selesai** — vendor assignment per service, perbandingan quotation, Accept/Reject (confirmation status). Tab Finance **tidak diubah**, tetap baseline Foundation, menyusul Section 14-15. Overview/Travelers/Itinerary & Services (Section 10/11/12) **tidak disentuh kodenya**. |

## 3. Component Shared dan Domain yang Sudah Tersedia

Tidak ada shared component **file** baru Section 13. `Tabs*` (Section 05) — pemakaian keempat (Vendor Detail, setelah Party/Project/Opportunity Detail). `canManageServiceType` (Section 12) direuse langsung untuk gerbang Accept/Reject quotation.

## 4. Types, Constants, Fixtures, Mock State, dan Role Behavior yang Aktif

**Baru Section 13:** `VendorContact`, `VendorQuotationStatus`+`VendorQuotation`, `VendorActivity`, `VendorDetailTab` di `app/types/vendor.ts`. `VENDORS` (`app/data/vendors.ts`) kini `reactive()`, +`VENDOR_CONTACTS` (5, backfill), +`VENDOR_QUOTATIONS` (10, termasuk skenario comparison hidup untuk `SVC-1034`), +`VENDOR_ACTIVITIES` (5 seed). `app/constants/status.ts` +`VENDOR_QUOTATION_STATUSES`. `app/data/index.ts` +9 selector/mutator (`getVendorContacts`, `getVendorQuotations`, `getVendorActivities`, `getServicesByVendor`, `getQuotationsForService`, `createVendor`, `createVendorContact`, `submitVendorQuotation`, `acceptVendorQuotation` — reuse `updateServiceStatus` Section 12, `rejectVendorQuotation`).

**Role behavior:** `canView('vendor')`/`canManage('vendor')` generik (tidak perlu pengecualian sempit — `ROLE_MODULE_ACCESS.vendor` sudah presisi: `ADMIN` Super Admin, `VIEW` role lain). **Koreksi dokumentasi:** `docs/route-and-role-matrix.md` bagian 0/1.4 (anotasi lama "MANAGE subset" untuk Ops/Ticketing/dst. pada modul Vendor) disinkronkan dengan kode `ROLE_MODULE_ACCESS` dan bagian 5 yang sudah konsisten sejak Foundation — lihat CI-015.

## 5. Area Hasil Section Lama yang Harus Dilindungi

- Seluruh shared component, fixture, type, constant — jangan diubah shape-nya tanpa cross-section impact check.
- `app/pages/projects/[id]/index.vue` — shell 8-tab, struktur tab/single-route LOCKED (D-026/D-027) — **tidak diubah** Section 13, hanya isi tab Vendors yang ditambah. Overview/Travelers/Itinerary & Services (Section 10/11/12) **tidak disentuh kodenya**.
- `Vendor`/`VendorContact`/`VendorQuotation`/`VendorActivity` — gunakan selector/mutator existing di `app/data/index.ts`, jangan buat sumber data paralel. `acceptVendorQuotation` memanggil `updateServiceStatus` (Section 12) — jangan buat jalur mutasi status service paralel.
- **Keputusan didokumentasikan (bukan gap tersembunyi):** CRUD hapus vendor/contact/quotation tidak diimplementasikan; Vendor Detail tab Quotations read-only terhadap Accept/Reject (aksinya di tab Vendors Project Detail, menghindari duplikasi logic).
- **Koreksi dokumentasi Role Matrix Vendor sudah final** — jangan mengembalikan anotasi "MANAGE (subset)" lama tanpa mengubah kode `ROLE_MODULE_ACCESS` terlebih dahulu.

## 6. Known Issues dan Validation Status

Divalidasi ulang langsung pada tanggal update dokumen ini:

| Cek | Hasil | Catatan |
|---|---|---|
| `npx nuxi prepare` | **Sukses** | |
| `npm run build` | **Sukses (exit 0)**, chunk `/vendors/[id]` terkonfirmasi ter-generate | |
| Smoke test konten (curl + grep, bukan hanya status code) | **Benar** untuk `/vendors`, `/vendors/VND-001` (3 quotation accepted, Rp 90.000.000 cocok fixture), `/vendors/VND-999` (not-found), `/projects/PRJ-103?tab=vendors` (skenario comparison Ground Transportation Rp 45.000.000 vs Rp 52.000.000 tampil, tombol Terima/Tolak 3× sesuai 3 quotation submitted) | Readiness dan comparison diverifikasi presisi terhadap fixture, bukan diasumsikan |
| Regresi tab lain Project Detail (Overview, Travelers, Itinerary & Services) | **Tidak berubah**, konten identik dengan sebelum Section 13 | Dikonfirmasi lewat curl dengan query param `?tab=overview`, `?tab=travelers`, `?tab=itinerary-services` |
| `npx vitest run` | **"No test files found", exit code 1** | Pre-existing |
| `npx nuxi typecheck` | **Gagal — `vue-tsc` tidak terpasang** | Q8 belum diselesaikan |
| Lint | **Tidak tersedia** | Q8 belum diselesaikan |
| Verifikasi interaktif (klik Terima/Tolak, ganti role) | **Tidak dilakukan** | Tidak ada tool browser headless; logic diverifikasi lewat code review, pola identik CRUD Section 07/09/11/12 yang sudah teruji |

**Known issues terbuka:**
- **Q8 — Tooling lint/typecheck/test.** Tetap `NEEDS_VALIDATION`. **Sembilan section berturut-turut** (06–13) berjalan tanpa validasi otomatis penuh.
- CRUD hapus vendor/contact/quotation tidak diimplementasikan (keputusan didokumentasikan, bagian 5) — bukan bug.
- Verifikasi interaktif tidak dilakukan langsung (keterbatasan tooling).
- Q7, Q9, Q10, Q11 — tidak berubah.

## 7. Next Recommended Section

Section 14 — Project Changes (`prompts/16-PROMPT-14-PROJECT-CHANGES.md`). **Rekomendasi sangat kuat:** selesaikan Q8 sebelum Section 14 — sembilan section berturut-turut telah berjalan tanpa validasi otomatis. Tidak dieksekusi otomatis — menunggu perintah user.

## 8. Last Updated

- **Date:** 2026-07-30
- **Updater:** Section 13 (Vendor Management) execution, berdasarkan pemeriksaan langsung codebase, build/smoke-test yang benar-benar dijalankan ulang.
