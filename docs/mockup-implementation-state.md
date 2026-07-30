# Mockup Implementation State — MANOVA

Dokumen kondisi implementasi **terkini** (bukan log kronologis — lihat `docs/mockup-section-progress.md` untuk histori, dan `docs/mockup-progress.md` untuk narasi lengkap Prompt 0–5). Wajib dibaca di awal setiap section baru sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian B, dan diperbarui di akhir setiap section sesuai bagian F.

Ditulis berdasarkan pemeriksaan langsung terhadap codebase (`git log`, `git status`, isi file `app/**`) dan hasil validasi yang benar-benar dijalankan ulang pada tanggal update di bawah — bukan disalin buta dari narasi lama.

---

## 1. Current Phase dan Current Section

- **Current phase:** Foundation + Dashboard + CRM Party + Opportunity/Quotation + Opportunity Won to Project + Project Core + Traveler and Participant + Itinerary and Operations selesai. Modul Vendor/Finance/Reports/Administration (Section 13 ke atas) **belum** dieksekusi.
- **Current section:** Tidak ada section aktif — sistem menunggu perintah user untuk memulai Section 13 (Vendor Management).
- **Last completed section:** **Section 12 — Itinerary and Operations** (`prompts/14-PROMPT-12-ITINERARY-OPERATIONS.md`), status **COMPLETED**. Detail lengkap: `docs/mockup-section-reports/section-12-itinerary-operations.md`.
- Section 11 — Traveler and Participant: COMPLETED, detail `docs/mockup-section-reports/section-11-traveler-participant.md`.
- Section 10 — Project Core: COMPLETED, detail `docs/mockup-section-reports/section-10-project-core.md`.
- Section 09 — Opportunity Won to Project: COMPLETED, detail `docs/mockup-section-reports/section-09-opportunity-won-to-project.md`.
- Section 08 — Opportunity dan Quotation: COMPLETED, detail `docs/mockup-section-reports/section-08-opportunity-quotation.md`.
- Section 07 — CRM Party: COMPLETED, detail `docs/mockup-section-reports/section-07-crm-party.md`.
- Section 06 — Dashboard: COMPLETED, detail `docs/mockup-section-reports/section-06-dashboard.md`.
- Section 05 — Foundation: COMPLETED, detail `docs/mockup-section-reports/section-05-foundation.md`.
- Section 00–04: dokumentasi murni, COMPLETED, narasi `docs/mockup-progress.md` Entri 1–5.

**Catatan commit:** Section 08 dan 09 sudah ter-commit (`495b6d9 "Create opportunity-won-to-project"`); Section 10 ter-commit (`2650015 "SECTION10-Project-Core"`); Section 11 ter-commit (`14b6106 "SECTION13-Traveler-Participant"`). Section 12 belum ter-commit pada saat dokumen ini ditulis.

## 2. Route Inventory (Kondisi Aktual)

Tidak ada route baru Section 12. Baris yang statusnya berubah:

| Route | Catatan Section 12 |
|---|---|
| `/projects/[id]` | **Tab Itinerary & Services selesai** — daily itinerary, conditional section Flight/Hotel/Transportation/MICE/Additional Service, booking reference, service status+readiness (update status role-gated), operational tasks preview, change markers High-Change Project. Tab lain (Vendors, Finance, Tasks, Documents, Activity & Changes) **tidak diubah**, tetap baseline Foundation, menyusul Section 13-15. Overview (Section 10) dan Travelers (Section 11) **tidak disentuh kodenya** (Overview menampilkan angka Service Summary yang bertambah karena fixture baru — efek data, bukan perubahan kode, lihat CI-014). |

## 3. Component Shared dan Domain yang Sudah Tersedia

Tidak ada shared component **file** baru Section 12. Pola list `divide-y divide-border` (existing sejak Foundation) direuse untuk daily itinerary — tidak ada komponen kalender/timeline baru (tidak ada library kalender terpasang, D-036).

`dashboard/ProjectsTable.vue` — tetap tidak dipakai (tidak berubah).

## 4. Types, Constants, Fixtures, Mock State, dan Role Behavior yang Aktif

**Baru Section 12:** `ServiceTypeKey` +`'additional'` (tidak pernah masuk `Project.serviceScope`, murni data-driven); `ProjectService` +`bookingReference`; entitas baru `ItineraryItem` di `app/types/project.ts`. `PROJECT_SERVICES` (`app/data/projects.ts`) kini `reactive()` (sebelumnya array biasa), +`bookingReference` pada 5 baris existing, +1 baris baru `SVC-1036` (tipe `additional`, PRJ-103) — **efek samping terverifikasi:** Overview Service Summary PRJ-103 kini Confirmed=4 (sebelumnya 3), lihat CI-014. `+ITINERARY_ITEMS` (15 baris, 4/5/6 per PRJ-101/102/103). `app/constants/status.ts` +`'additional'` pada `SERVICE_TYPES`. `app/utils/format.ts` +`formatDayLabel`. `app/data/index.ts` +2 selector/mutator (`getItineraryItems`, `updateServiceStatus` — transisi ke `changed` mencatat entri `ACTIVITIES` otomatis).

**Role behavior:** `canView('project')` tetap gerbang akses halaman (tidak berubah). **Baru:** `canManageServiceType(type)` — granularity presisi sesuai Role & Access Matrix bagian 5: PM/Operations/Super Admin kelola seluruh sub-section; Ticketing/Accommodation/Transportation/MICE hanya sub-section domainnya sendiri; `additional` hanya PM/Operations/Super Admin.

## 5. Area Hasil Section Lama yang Harus Dilindungi

- Seluruh shared component, fixture, type, constant — jangan diubah shape-nya tanpa cross-section impact check.
- `app/pages/projects/[id]/index.vue` — shell 8-tab, struktur tab/single-route LOCKED (D-026/D-027) — **tidak diubah** Section 12, hanya isi tab Itinerary & Services yang ditambah. Overview (Section 10) dan Travelers (Section 11) **tidak disentuh kodenya**.
- `ProjectService`/`ItineraryItem` — gunakan selector/mutator existing di `app/data/index.ts`, jangan buat sumber data paralel.
- **Keputusan didokumentasikan (bukan gap tersembunyi):** daily itinerary read-only (tidak diminta CRUD di scope literal Section 12); CRUD `ProjectService` (tambah/hapus baris) tidak diimplementasikan (scope hanya minta update status); tipe `additional` sengaja tidak pernah masuk `Project.serviceScope` (tetap 4 kombinasi resmi Prompt 0-B).
- Tab Itinerary & Services kini sumber lengkap untuk daily itinerary/service status/booking reference — section berikutnya (Vendor Management dst.) sebaiknya tidak menduplikasi ringkasan ini di tab lain.

## 6. Known Issues dan Validation Status

Divalidasi ulang langsung pada tanggal update dokumen ini:

| Cek | Hasil | Catatan |
|---|---|---|
| `npx nuxi prepare` | **Sukses** | |
| `npm run build` | **Sukses (exit 0)** | |
| Smoke test konten (curl + grep, bukan hanya status code) | **Benar** untuk `/projects/PRJ-101` (flight only, hanya section Flight tampil), `/projects/PRJ-102` (flight+hotel, banner Penanda Perubahan tampil), `/projects/PRJ-103` (flight+hotel+transportation+mice, section Additional Service tampil, readiness fraction presisi per section) | Conditional service section diverifikasi tepat (PRJ-101 tidak menampilkan Hotel/Transportation/MICE sama sekali). Readiness PRJ-103: Flight 1/2, Hotel 1/1, Transportation 0/1, MICE 1/1, Additional 1/1 — cocok persis fixture. |
| Efek fixture ke Overview Service Summary (CI-014) | **Diverifikasi presisi** — Confirmed 3→4, Pending Confirmation tetap 2 | Dikonfirmasi lewat pemeriksaan nilai literal di HTML `?tab=overview`, bukan asumsi |
| Regresi tab lain (Overview, Travelers) via `?tab=` query | **Tidak berubah kodenya**, konten sesuai ekspektasi (Overview angka bertambah sesuai fixture, Travelers identik) | Dikonfirmasi lewat curl dengan query param `?tab=overview`, `?tab=travelers` |
| `npx vitest run` | **"No test files found", exit code 1** | Pre-existing |
| `npx nuxi typecheck` | **Gagal — `vue-tsc` tidak terpasang** | Q8 belum diselesaikan |
| Lint | **Tidak tersedia** | Q8 belum diselesaikan |
| Verifikasi interaktif (klik dropdown Update Status, ganti role) | **Tidak dilakukan** | Tidak ada tool browser headless; logic diverifikasi lewat code review, pola identik CRUD Section 07/09/11 yang sudah teruji |

**Known issues terbuka:**
- **Q8 — Tooling lint/typecheck/test.** Tetap `NEEDS_VALIDATION`. **Delapan section berturut-turut** (06–12) berjalan tanpa validasi otomatis penuh.
- Daily itinerary read-only, CRUD `ProjectService` tidak diimplementasikan (keputusan didokumentasikan, bagian 5) — bukan bug.
- Verifikasi interaktif tidak dilakukan langsung (keterbatasan tooling).
- Q7, Q9, Q10, Q11 — tidak berubah.

## 7. Next Recommended Section

Section 13 — Vendor Management (`prompts/15-PROMPT-13-VENDOR-MANAGEMENT.md`). **Rekomendasi sangat kuat:** selesaikan Q8 sebelum Section 13 — delapan section berturut-turut telah berjalan tanpa validasi otomatis. Tidak dieksekusi otomatis — menunggu perintah user.

## 8. Last Updated

- **Date:** 2026-07-30
- **Updater:** Section 12 (Itinerary and Operations) execution, berdasarkan pemeriksaan langsung codebase, build/smoke-test yang benar-benar dijalankan ulang.
