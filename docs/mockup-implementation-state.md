# Mockup Implementation State — MANOVA

Dokumen kondisi implementasi **terkini** (bukan log kronologis — lihat `docs/mockup-section-progress.md` untuk histori, dan `docs/mockup-progress.md` untuk narasi lengkap Prompt 0–5). Wajib dibaca di awal setiap section baru sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian B, dan diperbarui di akhir setiap section sesuai bagian F.

Ditulis berdasarkan pemeriksaan langsung terhadap codebase (`git log`, `git status`, isi file `app/**`) dan hasil validasi yang benar-benar dijalankan ulang pada tanggal update di bawah — bukan disalin buta dari narasi lama.

---

## 1. Current Phase dan Current Section

- **Current phase:** Foundation + Dashboard + CRM Party + Opportunity/Quotation + Opportunity Won to Project + Project Core selesai. Modul Traveler/Itinerary/Vendor/Finance/Reports/Administration (Section 11 ke atas) **belum** dieksekusi.
- **Current section:** Tidak ada section aktif — sistem menunggu perintah user untuk memulai Section 11 (Traveler and Participant).
- **Last completed section:** **Section 10 — Project Core** (`prompts/12-PROMPT-10-PROJECT-CORE.md`), status **COMPLETED**. Detail lengkap: `docs/mockup-section-reports/section-10-project-core.md`.
- Section 09 — Opportunity Won to Project: COMPLETED, detail `docs/mockup-section-reports/section-09-opportunity-won-to-project.md`.
- Section 08 — Opportunity dan Quotation: COMPLETED, detail `docs/mockup-section-reports/section-08-opportunity-quotation.md`.
- Section 07 — CRM Party: COMPLETED, detail `docs/mockup-section-reports/section-07-crm-party.md`.
- Section 06 — Dashboard: COMPLETED, detail `docs/mockup-section-reports/section-06-dashboard.md`.
- Section 05 — Foundation: COMPLETED, detail `docs/mockup-section-reports/section-05-foundation.md`.
- Section 00–04: dokumentasi murni, COMPLETED, narasi `docs/mockup-progress.md` Entri 1–5.

**Catatan commit:** Section 08 dan 09 kini sudah ter-commit (`495b6d9 "Create opportunity-won-to-project"`). Section 10 belum ter-commit pada saat dokumen ini ditulis.

## 2. Route Inventory (Kondisi Aktual)

Tidak ada route baru Section 10. Baris yang statusnya berubah:

| Route | Catatan Section 10 |
|---|---|
| `/projects` | **Selesai** — filter status/tipe/client/owner, sort (tanggal/nama/budget), progress bar linear per card, tetap card-grid (bukan table — lihat bagian 5) |
| `/projects/[id]` | **Overview tab selesai** — ringkasan service/task/document/recent-activity ditambahkan. Tab lain (Itinerary & Services, Travelers, Vendors, Finance, Tasks, Documents, Activity & Changes) **tidak diubah**, tetap baseline Foundation, menyusul Section 11-15 |

## 3. Component Shared dan Domain yang Sudah Tersedia

Tidak ada shared component baru Section 10. `StatusBreakdownList` (Section 06) direuse untuk 2 ringkasan baru di Overview tab (Service Summary, Milestone/Task Summary) — pemakaian ketiga dan keempat setelah Dashboard dan `/crm/opportunities`.

`dashboard/ProjectsTable.vue` — **tetap tidak dipakai** (dicadangkan sejak Section 05, keputusan awal "disatukan dengan projects/index.vue" **tidak dijalankan** — lihat bagian 5 untuk alasan).

## 4. Types, Constants, Fixtures, Mock State, dan Role Behavior yang Aktif

Tidak ada perubahan type/constant/fixture Section 10 — murni peningkatan presentasi (filter/sort/progress/summary) di atas data yang sudah ada sejak Section 05/09. `Project.characteristic`, `Project.status`, `PROJECT_STATUSES.order` (dipakai untuk hitung progress linear) semuanya sudah ada, tidak diubah.

**Role behavior:** Tidak berubah — `canView('project')` tetap gerbang akses yang sama sejak Section 05.

## 5. Area Hasil Section Lama yang Harus Dilindungi

- Seluruh shared component, fixture, type, constant — jangan diubah shape-nya tanpa cross-section impact check.
- `app/pages/projects/[id]/index.vue` — shell 8-tab, struktur tab/single-route LOCKED (D-026/D-027) — **tidak diubah** Section 10, hanya isi tab Overview yang ditambah.
- **`approveOpportunityWon` (Section 09) tetap satu-satunya jalur pembuatan Project** — Section 10 tidak menambah jalur create-project baru, murni membaca/menampilkan `PROJECTS` yang sudah ada (termasuk hasil konversi Won bila sudah di-approve).
- **Keputusan didokumentasikan (bukan gap tersembunyi):** rencana awal `docs/route-and-role-matrix.md` bagian 0/1.3 menyebut `pages/projects/index.vue` + `dashboard/ProjectsTable.vue` "disatukan jadi satu skema". Section 10 **tidak melakukan penyatuan ini** — card-grid existing (sejak Section 05, sudah battle-tested lewat Section 06-09 tanpa masalah) sudah memenuhi seluruh item scope literal Section 10 (search/filter/sort/status/type/client/destination/date/owner/progress/attention) tanpa perlu beralih ke paradigma table. `ProjectsTable.vue` tetap dicadangkan, tidak dihapus.
- Tab Overview kini punya 5 SectionCard (Ringkasan Layanan, Service Summary, Milestone/Task Summary, Document Summary, Recent Activity) — section berikutnya yang mengisi tab lain (Travelers dst.) sebaiknya tidak menduplikasi ringkasan ini di Overview, cukup memperkaya tab masing-masing.

## 6. Known Issues dan Validation Status

Divalidasi ulang langsung pada tanggal update dokumen ini:

| Cek | Hasil | Catatan |
|---|---|---|
| `npx nuxi prepare` | **Sukses** | |
| `npm run build` | **Sukses (exit 0)** | |
| Smoke test konten (curl + grep, bukan hanya status code) | **Benar** untuk `/projects`, `/projects/PRJ-101` (normal), `/projects/PRJ-102` (high-change), `/projects/PRJ-103` (complex), `/projects/PRJ-999` (not-found) | Progress bar diverifikasi tepat: PRJ-101 (`confirmed`) = 40%, PRJ-102 (`planning`) = 20%, PRJ-103 (`in-progress`) = 60% — dihitung ulang manual dan cocok persis dengan formula linear. Service/Task Summary breakdown counts diverifikasi cocok persis dengan fixture (mis. PRJ-102: Confirmed=1/Changed=1/Cancelled=1). Document count text ("1/2/3 dokumen tersimpan") cocok. Recent Activity menampilkan pesan change yang benar. |
| Regresi tab lain (Itinerary & Services, Tasks, Finance) via `?tab=` query | **Tidak berubah**, konten identik dengan sebelum Section 10 | Dikonfirmasi lewat curl dengan query param `?tab=itinerary-services`, `?tab=tasks`, `?tab=finance` |
| `npx vitest run` | **"No test files found", exit code 1** | Pre-existing |
| `npx nuxi typecheck` | **Gagal — `vue-tsc` tidak terpasang** | Q8 belum diselesaikan |
| Lint | **Tidak tersedia** | Q8 belum diselesaikan |
| Verifikasi interaktif filter/sort (klik dropdown, lihat hasil berubah) | **Tidak dilakukan** | Tidak ada tool browser headless; logic filter/sort diverifikasi lewat code review, bukan klik nyata |

**Known issues terbuka:**
- **Q8 — Tooling lint/typecheck/test.** Tetap `NEEDS_VALIDATION`. **Enam section berturut-turut** (06–10) berjalan tanpa validasi otomatis penuh.
- `ProjectsTable.vue` tetap tidak dipakai (keputusan didokumentasikan, bagian 5) — bukan bug.
- Verifikasi interaktif filter/sort/dropdown tidak dilakukan langsung (keterbatasan tooling).
- Q7, Q9, Q10, Q11 — tidak berubah.

## 7. Next Recommended Section

Section 11 — Traveler and Participant (`prompts/13-PROMPT-11-TRAVELER-PARTICIPANT.md`). **Rekomendasi sangat kuat:** selesaikan Q8 sebelum Section 11 — enam section berturut-turut telah berjalan tanpa validasi otomatis. Tidak dieksekusi otomatis — menunggu perintah user.

## 8. Last Updated

- **Date:** 2026-07-30
- **Updater:** Section 10 (Project Core) execution, berdasarkan pemeriksaan langsung codebase, build/smoke-test yang benar-benar dijalankan ulang.
