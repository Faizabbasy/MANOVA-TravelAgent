# Mockup Implementation State — MANOVA

Dokumen kondisi implementasi **terkini** (bukan log kronologis — lihat `docs/mockup-section-progress.md` untuk histori, dan `docs/mockup-progress.md` untuk narasi lengkap Prompt 0–5). Wajib dibaca di awal setiap section baru sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian B, dan diperbarui di akhir setiap section sesuai bagian F.

Ditulis berdasarkan pemeriksaan langsung terhadap codebase (`git log`, `git status`, isi file `app/**`) dan hasil validasi yang benar-benar dijalankan ulang pada tanggal update di bawah — bukan disalin buta dari narasi lama.

---

## 1. Current Phase dan Current Section

- **Current phase:** Foundation + Dashboard + CRM Party + Opportunity/Quotation + Opportunity Won to Project + Project Core + Traveler and Participant + Itinerary and Operations + Vendor Management + Project Changes selesai. Modul Finance/Reports/Administration (Section 15 ke atas) **belum** dieksekusi.
- **Current section:** Tidak ada section aktif — sistem menunggu perintah user untuk memulai Section 15 (Project Finance).
- **Last completed section:** **Section 14 — Project Changes** (`prompts/16-PROMPT-14-PROJECT-CHANGES.md`), status **COMPLETED**. Detail lengkap: `docs/mockup-section-reports/section-14-project-changes.md`.
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

**Catatan commit:** Section 08 dan 09 sudah ter-commit (`495b6d9 "Create opportunity-won-to-project"`); Section 10 ter-commit (`2650015 "SECTION10-Project-Core"`); Section 11 ter-commit (`14b6106 "SECTION13-Traveler-Participant"`); Section 12 ter-commit (`57899a4 "SECTION12-ITINERARY-OPERATIONS"`); Section 13 ter-commit (`19f21b9 "SECTION15-VENDOR-MANAGEMENT"`). Section 14 belum ter-commit pada saat dokumen ini ditulis.

## 2. Route Inventory (Kondisi Aktual)

Tidak ada route baru Section 14. Baris yang statusnya berubah:

| Route | Catatan Section 14 |
|---|---|
| `/projects/[id]` | **Tab Activity & Changes selesai** — change list/detail (category/reason/requester/before-after/impact), status dan approval mock (Setujui/Tolak), change timeline kronologis, attention indicator. Tab Finance **tidak diubah**, tetap baseline Foundation, menyusul Section 15. Overview/Travelers/Itinerary & Services/Vendors (Section 10/11/12/13) **tidak disentuh kodenya**. |

## 3. Component Shared dan Domain yang Sudah Tersedia

Tidak ada shared component **file** baru Section 14. `AttentionIndicator` (Section 05) direuse untuk badge "Menunggu Approval" per Change entry.

## 4. Types, Constants, Fixtures, Mock State, dan Role Behavior yang Aktif

**Baru Section 14:** `ChangeCategory`, `ChangeApprovalStatus` di `app/types/activity.ts`; `ActivityEntry` +7 field opsional (`category`/`reason`/`requestedBy`/`beforeValue`/`afterValue`/`impactNote`/`approvalStatus`/`approvedBy`). `app/constants/status.ts` +`CHANGE_CATEGORIES`, `+CHANGE_APPROVAL_STATUSES`. `app/data/index.ts` +3 mutator (`createChangeEntry`, `approveChangeEntry`, `rejectChangeEntry`). Fixture: 4 entri `CHG-*` existing (PRJ-102 ×3, PRJ-103 ×1) diperkaya field baru (bukan record baru); `CHG-1023` (PRJ-102) jadi skenario approval hidup (`approvalStatus: 'pending'`, selaras `reviewed: false` yang sudah ada).

**Role behavior:** `canView('project')` tetap gerbang halaman (tidak berubah). **Baru:** `canLogChange` (PM/Operations/Ticketing/Accommodation/Transportation/MICE/Super Admin) untuk dialog "Catat Perubahan"; `canApproveChanges` (`canApprove('project')` generik — Management/Super Admin, sesuai Route Matrix bagian 5.1 "Approve") untuk Setujui/Tolak.

## 5. Area Hasil Section Lama yang Harus Dilindungi

- Seluruh shared component, fixture, type, constant — jangan diubah shape-nya tanpa cross-section impact check.
- `app/pages/projects/[id]/index.vue` — shell 8-tab, struktur tab/single-route LOCKED (D-026/D-027) — **tidak diubah** Section 14, hanya isi tab Activity & Changes yang ditambah. Overview/Travelers/Itinerary & Services/Vendors (Section 10/11/12/13) **tidak disentuh kodenya**.
- `ActivityEntry`/`ChangeCategory`/`ChangeApprovalStatus` — gunakan mutator existing di `app/data/index.ts`, jangan buat entitas Change paralel (LOCKED IA bagian 4).
- **`reviewed` (Section 06, LOCKED, dipakai `hasUnreviewedChange`) dan `approvalStatus` (Section 14) adalah dua flag terpisah** — jangan disatukan maknanya tanpa memperbarui `app/utils/attention.ts` sekaligus dan mencatatnya sebagai cross-section impact.
- **Keputusan didokumentasikan (bukan gap tersembunyi):** tidak ada route/halaman detail terpisah per Change (inline, konsisten single-route); CRUD hapus Change tidak diimplementasikan.

## 6. Known Issues dan Validation Status

Divalidasi ulang langsung pada tanggal update dokumen ini:

| Cek | Hasil | Catatan |
|---|---|---|
| `npx nuxi prepare` | **Sukses** | |
| `npm run build` | **Sukses (exit 0)** | |
| Smoke test konten (curl + grep, bukan hanya status code) | **Benar** untuk `/projects/PRJ-102?tab=activity-changes` (2 Disetujui, 1 Menunggu Approval dengan tombol Setujui/Tolak, before/after "Deluxe"→"Suite", requester "Maya Putri" tampil) dan `/projects/PRJ-103?tab=activity-changes` (1 Disetujui, "20 pax"→"25 pax") | Kategori (Itinerary/Service/Traveler) dan status approval diverifikasi presisi terhadap fixture, bukan diasumsikan |
| Regresi tab lain Project Detail (Overview, Travelers, Itinerary & Services, Vendors) dan Dashboard | **Tidak berubah**, konten identik dengan sebelum Section 14 | Dikonfirmasi lewat curl dengan query param `?tab=overview`, `?tab=travelers`, `?tab=itinerary-services`, `?tab=vendors`, dan `/` |
| `npx vitest run` | **"No test files found", exit code 1** | Pre-existing |
| `npx nuxi typecheck` | **Gagal — `vue-tsc` tidak terpasang** | Q8 belum diselesaikan |
| Lint | **Tidak tersedia** | Q8 belum diselesaikan |
| Verifikasi interaktif (klik Setujui/Tolak/Catat Perubahan, ganti role) | **Tidak dilakukan** | Tidak ada tool browser headless; logic diverifikasi lewat code review, pola identik CRUD Section 07/09/11/12/13 yang sudah teruji |

**Known issues terbuka:**
- **Q8 — Tooling lint/typecheck/test.** Tetap `NEEDS_VALIDATION`. **Sepuluh section berturut-turut** (06–14) berjalan tanpa validasi otomatis penuh.
- Tidak ada detail-route terpisah per Change (keputusan didokumentasikan, bagian 5) — bukan bug.
- Verifikasi interaktif tidak dilakukan langsung (keterbatasan tooling).
- Q7, Q9, Q10, Q11 — tidak berubah.

## 7. Next Recommended Section

Section 15 — Project Finance (`prompts/17-PROMPT-15-PROJECT-FINANCE.md`). **Rekomendasi sangat kuat:** selesaikan Q8 sebelum Section 15 — sepuluh section berturut-turut telah berjalan tanpa validasi otomatis. Tidak dieksekusi otomatis — menunggu perintah user.

## 8. Last Updated

- **Date:** 2026-07-30
- **Updater:** Section 14 (Project Changes) execution, berdasarkan pemeriksaan langsung codebase, build/smoke-test yang benar-benar dijalankan ulang.
