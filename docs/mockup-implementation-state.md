# Mockup Implementation State — MANOVA

Dokumen kondisi implementasi **terkini** (bukan log kronologis — lihat `docs/mockup-section-progress.md` untuk histori, dan `docs/mockup-progress.md` untuk narasi lengkap Prompt 0–5). Wajib dibaca di awal setiap section baru sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian B, dan diperbarui di akhir setiap section sesuai bagian F.

Ditulis berdasarkan pemeriksaan langsung terhadap codebase (`git log`, `git status`, isi file `app/**`) dan hasil validasi yang benar-benar dijalankan ulang pada tanggal update di bawah — bukan disalin buta dari narasi lama.

---

## 1. Current Phase dan Current Section

- **Current phase:** Foundation + Dashboard + CRM Party + Opportunity/Quotation + Opportunity Won to Project + Project Core + Traveler and Participant selesai. Modul Itinerary/Vendor/Finance/Reports/Administration (Section 12 ke atas) **belum** dieksekusi.
- **Current section:** Tidak ada section aktif — sistem menunggu perintah user untuk memulai Section 12 (Itinerary and Operations).
- **Last completed section:** **Section 11 — Traveler and Participant** (`prompts/13-PROMPT-11-TRAVELER-PARTICIPANT.md`), status **COMPLETED**. Detail lengkap: `docs/mockup-section-reports/section-11-traveler-participant.md`.
- Section 10 — Project Core: COMPLETED, detail `docs/mockup-section-reports/section-10-project-core.md`.
- Section 09 — Opportunity Won to Project: COMPLETED, detail `docs/mockup-section-reports/section-09-opportunity-won-to-project.md`.
- Section 08 — Opportunity dan Quotation: COMPLETED, detail `docs/mockup-section-reports/section-08-opportunity-quotation.md`.
- Section 07 — CRM Party: COMPLETED, detail `docs/mockup-section-reports/section-07-crm-party.md`.
- Section 06 — Dashboard: COMPLETED, detail `docs/mockup-section-reports/section-06-dashboard.md`.
- Section 05 — Foundation: COMPLETED, detail `docs/mockup-section-reports/section-05-foundation.md`.
- Section 00–04: dokumentasi murni, COMPLETED, narasi `docs/mockup-progress.md` Entri 1–5.

**Catatan commit:** Section 08 dan 09 sudah ter-commit (`495b6d9 "Create opportunity-won-to-project"`); Section 10 ter-commit (`2650015 "SECTION10-Project-Core"`). Section 11 belum ter-commit pada saat dokumen ini ditulis.

## 2. Route Inventory (Kondisi Aktual)

Tidak ada route baru Section 11. Baris yang statusnya berubah:

| Route | Catatan Section 11 |
|---|---|
| `/projects/[id]` | **Tab Travelers selesai** — list/profile, group + rooming list, passport/document metadata, emergency contact, missing document indicator, add/edit/remove/import mock, filter, role behavior. Tab lain (Itinerary & Services, Vendors, Finance, Tasks, Documents, Activity & Changes) **tidak diubah**, tetap baseline Foundation, menyusul Section 12-15. Overview (Section 10) **tidak disentuh**. |

## 3. Component Shared dan Domain yang Sudah Tersedia

Tidak ada shared component **file** baru Section 11. `Checkbox` (`ui/checkbox`, primitive existing sejak awal template) — **pemakaian nyata pertama** di halaman MANOVA manapun (filter "Hanya dokumen belum lengkap"). `Dialog`/`Table`/`useToast` (Section 07/09) direuse lagi untuk CRUD traveler.

`dashboard/ProjectsTable.vue` — tetap tidak dipakai (tidak berubah dari Section 10).

## 4. Types, Constants, Fixtures, Mock State, dan Role Behavior yang Aktif

**Baru Section 11:** `Traveler` diperluas (`passportNumber`, `passportExpiryDate`, `emergencyContactName`, `emergencyContactPhone`); `TravelerGroup` +`roomingNote`; entitas baru `RoomAssignment` (+`RoomType`) di `app/types/project.ts`. `TRAVELERS`/`TRAVELER_GROUPS` (`app/data/projects.ts`) kini `reactive()` (sebelumnya array biasa), fixture traveler diperluas 1→18 baris representatif (6 PRJ-101, 6 PRJ-102, 6 PRJ-103) + `ROOM_ASSIGNMENTS` (3 baris, PRJ-103) — **sampel representatif, bukan 1:1 dengan `travelerCount`** (didokumentasikan transparan, `docs/mockup-data-scenarios.md` bagian 4e). `app/utils/attention.ts` +`isTravelerDocumentMissing`/`PASSPORT_EXPIRY_WARNING_DAYS`. `app/constants/status.ts` +`ROOM_TYPES`. `app/data/index.ts` +7 selector/mutator (`getTravelersByGroup`, `getRoomAssignments`, `getTravelersMissingDocuments`, `createTraveler`, `updateTraveler`, `removeTraveler`, `importTravelersMock`).

**Role behavior:** `canView('project')` tetap gerbang akses halaman (tidak berubah). **Baru:** `canManageTravelers` (Project Manager, Super Admin saja) — pengecualian sempit untuk aksi tulis tab Travelers, pola identik `canManageParty` (Section 07); Management sengaja dikecualikan meski rank modul `project`-nya (`APPROVE`) generik ≥ `MANAGE`.

## 5. Area Hasil Section Lama yang Harus Dilindungi

- Seluruh shared component, fixture, type, constant — jangan diubah shape-nya tanpa cross-section impact check.
- `app/pages/projects/[id]/index.vue` — shell 8-tab, struktur tab/single-route LOCKED (D-026/D-027) — **tidak diubah** Section 11, hanya isi tab Travelers yang ditambah. Overview (Section 10) **tidak disentuh sama sekali**.
- `Traveler`/`TravelerGroup`/`RoomAssignment` — gunakan selector/mutator existing di `app/data/index.ts`, jangan buat sumber data traveler paralel.
- **Keputusan didokumentasikan (bukan gap tersembunyi):** CRUD `TravelerGroup` (buat group baru) sengaja tidak diimplementasikan — di luar scope literal Section 11 ("Add/edit/remove/import mock" merujuk ke traveler/participant, bukan group). Profil traveler tetap sampel representatif per skenario, bukan sensus penuh 1:1 dengan `project.travelerCount`.
- Tab Travelers kini sumber lengkap untuk traveler/participant/group/rooming — section berikutnya (Itinerary and Operations dst.) sebaiknya tidak menduplikasi ringkasan traveler di tab lain.

## 6. Known Issues dan Validation Status

Divalidasi ulang langsung pada tanggal update dokumen ini:

| Cek | Hasil | Catatan |
|---|---|---|
| `npx nuxi prepare` | **Sukses** | |
| `npm run build` | **Sukses (exit 0)** | |
| Smoke test konten (curl + grep, bukan hanya status code) | **Benar** untuk `/projects/PRJ-101` (normal, 6/6 dokumen lengkap), `/projects/PRJ-102` (high-change, 2/6 dokumen belum lengkap), `/projects/PRJ-103` (complex, 1/6 dokumen belum lengkap + rooming list + group filter) | Dua varian missing-document indicator diverifikasi tepat (paspor belum diisi vs paspor kurang 6 bulan berlaku saat keberangkatan). Rooming list menampilkan label kamar dan nama occupant yang benar. |
| Regresi tab lain (Overview, Itinerary & Services, Finance) via `?tab=` query | **Tidak berubah**, konten identik dengan sebelum Section 11 | Dikonfirmasi lewat curl dengan query param `?tab=overview`, `?tab=itinerary-services`, `?tab=finance` |
| `npx vitest run` | **"No test files found", exit code 1** | Pre-existing |
| `npx nuxi typecheck` | **Gagal — `vue-tsc` tidak terpasang** | Q8 belum diselesaikan |
| Lint | **Tidak tersedia** | Q8 belum diselesaikan |
| Verifikasi interaktif (klik dialog tambah/edit/hapus, toggle filter, ganti role) | **Tidak dilakukan** | Tidak ada tool browser headless; logic diverifikasi lewat code review, pola identik CRUD Section 07/09 yang sudah teruji |

**Known issues terbuka:**
- **Q8 — Tooling lint/typecheck/test.** Tetap `NEEDS_VALIDATION`. **Tujuh section berturut-turut** (06–11) berjalan tanpa validasi otomatis penuh.
- CRUD `TravelerGroup` tidak diimplementasikan (keputusan didokumentasikan, bagian 5) — bukan bug.
- `project.travelerCount` tidak disinkronkan otomatis dengan jumlah baris `Traveler` tercatat — dua konsep terpisah by design (headcount resmi vs profil tercatat bertahap).
- Verifikasi interaktif tidak dilakukan langsung (keterbatasan tooling).
- Q7, Q9, Q10, Q11 — tidak berubah.

## 7. Next Recommended Section

Section 12 — Itinerary and Operations (`prompts/14-PROMPT-12-ITINERARY-OPERATIONS.md`). **Rekomendasi sangat kuat:** selesaikan Q8 sebelum Section 12 — tujuh section berturut-turut telah berjalan tanpa validasi otomatis. Tidak dieksekusi otomatis — menunggu perintah user.

## 8. Last Updated

- **Date:** 2026-07-30
- **Updater:** Section 11 (Traveler and Participant) execution, berdasarkan pemeriksaan langsung codebase, build/smoke-test yang benar-benar dijalankan ulang.
