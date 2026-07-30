# Section 10 — Project Core

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/12-PROMPT-10-PROJECT-CORE.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user.

---

## 1. Section Objective dan Scope

Menyelesaikan inti modul Project: list (search/filter/sort), kolom/atribut (status, tipe, client, destinasi, tanggal perjalanan, owner, progress, attention), Project Detail header dan Overview (team, service summary, timeline/milestone summary, document summary, recent activity), conditional section berdasarkan service, tiga skenario (Normal/High-Change/Complex), dan states (loading/empty/error/not-found). **Tidak mengerjakan** detail penuh Traveler/Operations/Vendor/Finance (scope section lain), harus kompatibel dengan Section 09, dan tidak boleh merusak alur konversi Opportunity.

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/12-PROMPT-10-PROJECT-CORE.md`, `docs/mockup-implementation-state.md`, `docs/mockup-section-progress.md`, `docs/mockup-change-impact-log.md`, `docs/mockup-section-reports/section-05-foundation.md` s/d `section-09-opportunity-won-to-project.md`, `docs/route-and-role-matrix.md` (bagian 0, 1.3, 3, 5), `docs/mockup-information-architecture.md` (bagian 4).

## 3. Existing Implementation yang Diperiksa

`app/pages/projects/index.vue` dan `app/pages/projects/[id]/index.vue` (shell Foundation, seluruh 8 tab sudah punya baseline content sejak Section 05), `app/components/dashboard/ProjectsTable.vue` (tidak dipakai), `app/components/shared/StatusBreakdownList.vue` (Section 06). `git log` dikonfirmasi: commit terakhir `495b6d9 "Create opportunity-won-to-project"` membungkus Section 08+09; `git status` bersih sebelum mulai kecuali `prompts/99-RUN-CURRENT-SECTION.md`.

## 4. Decisions yang Digunakan

D-026/D-027 (8-tab, single-route, LOCKED — tidak disentuh), D-028 (Project Status, dipakai untuk hitung progress linear), D-030 (Role & Access Matrix, tidak berubah).

## 5. Implementation Summary dan User Flow

`/projects` kini punya 5 kontrol (search, status, tipe, client, owner) plus sort (tanggal/nama/budget), dan setiap card menampilkan progress bar linear (berdasarkan posisi status dalam alur utama Draft→...→Completed; On Hold/Cancelled ditampilkan sebagai teks, bukan persentase, karena bukan bagian jalur linear). Project Detail Overview tab kini punya 4 SectionCard tambahan setelah "Ringkasan Layanan" existing: Service Summary (breakdown status service), Milestone/Task Summary (breakdown status task), Document Summary (jumlah + 3 dokumen terbaru), dan Recent Activity (3 aktivitas terbaru + tombol "Lihat Semua" yang berpindah ke tab Activity & Changes).

**User flow yang bisa didemokan:** buka `/projects` → filter tipe "High-Change Project" → hanya PRJ-102 tampil dengan progress 20% → klik → Overview menampilkan Service Summary (Confirmed 1/Changed 1/Cancelled 1), Task Summary (In Progress/Overdue), Document Summary (2 dokumen), Recent Activity (3 entri perubahan) → klik "Lihat Semua" → berpindah ke tab Activity & Changes dengan seluruh riwayat.

## 6. Routes

Tidak ada route baru. `/projects` dan `/projects/[id]` (Section 05) diperkaya.

## 7. Files Created, Changed, dan Removed

**Created:** Tidak ada.

**Changed:**
- `app/pages/projects/index.vue` — `+selectedType`, `+selectedClient`, `+selectedOwner`, `+sortBy`, `+clientOptions`, `+ownerOptions`, `+getProjectProgress()`; template `+3` select filter, `+1` select sort, `+progress bar` per card.
- `app/pages/projects/[id]/index.vue` — `+serviceStatusSummary`, `+taskStatusSummary`, `+recentDocuments`, `+recentActivityPreview`, `+goToActivityTab()`; Overview tab template `+4` SectionCard baru. Tab lain **tidak diubah sama sekali** (diverifikasi via smoke test, bagian 13).

**Removed:** Tidak ada.

## 8. Components Reused dan Created

**Reused:** `StatusBreakdownList` (Section 06) — pemakaian ketiga/keempat setelah Dashboard dan `/crm/opportunities`, mengonfirmasi nilai reuse-nya. `SectionCard` (+`#actions` untuk tombol "Lihat Semua"), `EmptyState`, `StatusBadge`, `AttentionIndicator`.

**Created:** Tidak ada.

## 9. Types, Constants, Fixtures, dan Mock State

Tidak ada perubahan. Progress dihitung dari `PROJECT_STATUSES` existing (order field) via computed lokal, bukan field baru di `Project`.

## 10. Responsive Behavior

Filter row: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` (menyesuaikan 5 kontrol di layar sempit). Overview summary cards: `grid-cols-1 lg:grid-cols-2`. Tidak diverifikasi lewat browser interaktif — hanya kelas Tailwind konsisten dengan pola existing.

## 11. Loading, Empty, Error, Not-Found, dan Unauthorized States

- **Loading:** Tidak ada simulasi baru — konsisten precedent (list/detail non-Dashboard tidak memakai `LoadingState`).
- **Empty:** Setiap SectionCard baru punya empty state sendiri (`StatusBreakdownList`'s `empty-label`, atau `EmptyState` eksplisit untuk Document/Recent Activity) — diverifikasi PRJ-101 (1 dari semua) tetap menampilkan isi (bukan empty), memvalidasi ambang non-empty bekerja benar.
- **Error:** Tidak ada state error tersimulasi baru — konsisten precedent, tidak ada sumber async yang bisa gagal.
- **Not-found:** Tidak berubah dari Section 05 — diverifikasi ulang tetap benar (`PRJ-999`).
- **Unauthorized:** `RoleAccessState` untuk `!canView('project')` — tidak berubah.

## 12. Role Behavior

Tidak berubah — `canView('project')` (module-level, sejak Section 05) tetap gerbang akses satu-satunya untuk kedua halaman ini.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — sukses.
- `npm run build` — **sukses (exit 0)**.
- `npx vitest run` — "No test files found" (pre-existing).
- `npx nuxi typecheck` — gagal, `vue-tsc` tidak terpasang (Q8, pre-existing).
- Lint — tidak tersedia (Q8, pre-existing).
- **Smoke test konten mendalam** (mengikuti disiplin sejak bug routing Section 08 — verifikasi isi, bukan hanya status code):
  - Title dinamis benar untuk `PRJ-101`/`102`/`103`/`999`.
  - **Progress bar diverifikasi angka presisi**: PRJ-101 (`confirmed`, index 2/5) = **40%**; PRJ-102 (`planning`, index 1/5) = **20%**; PRJ-103 (`in-progress`, index 3/5) = **60%** — dihitung ulang manual dari formula `(index / 5) * 100` dan cocok persis dengan yang ter-render.
  - Service Summary PRJ-102 menampilkan Confirmed=1, Changed=1, Cancelled=1 — cocok persis dengan 3 baris `PROJECT_SERVICES` untuk PRJ-102 di fixture.
  - Document Summary menampilkan "1/2/3 dokumen tersimpan" untuk PRJ-101/102/103 — cocok persis jumlah `DOCUMENTS` per project.
  - Recent Activity PRJ-102 menampilkan seluruh 3 pesan perubahan (tanggal berubah, traveler bertambah, tipe kamar upgrade).
  - Filter dropdown (`Semua Tipe`/`Semua Client`/`Semua Owner`/`Urutkan`) terkonfirmasi ter-render di `/projects`.
  - **Regresi tab lain** — `?tab=itinerary-services`, `?tab=tasks`, `?tab=finance` pada PRJ-102 dikonfirmasi menampilkan konten identik dengan sebelum Section 10 (Room Block A/B, task list, invoice list) — Overview yang diperkaya tidak memengaruhi tab lain.
- **Verifikasi interaktif (klik dropdown filter, lihat hasil ter-filter/ter-sort secara nyata) tidak dilakukan** — tidak ada tool browser headless. Dimitigasi lewat code review computed `filteredProjects` (logic filter/sort straightforward, sudah dipakai pola serupa sejak Dashboard Section 06 tanpa masalah).

## 14. Regression Checks

Section 06 (Dashboard, consumer `PROJECTS` di banyak widget), Section 07-09 (Party/Opportunity yang mereferensikan Project via `partyId`/`projectId`) — tidak disentuh, tidak ada perubahan `Project` type/fixture, risiko regresi minimal. Diverifikasi `/` (Dashboard) tetap HTTP 200 sebagai spot-check.

## 15. Cross-Section Impact

**Tidak ada entri change-impact-log baru.** Section 10 menyelesaikan kepemilikan yang secara eksplisit didesain untuknya sejak awal — `docs/route-and-role-matrix.md` sudah mencatat status `/projects` dan `/projects/[id]` sebagai "foundation (shell) → phase later (isi)" sejak Section 05/06, dengan Section 10 sebagai phase yang dimaksud. Ini bukan modifikasi tak terduga atas deliverable section lain, melainkan penyelesaian rencana yang sudah ada — konsisten dengan kriteria protokol bagian C (perubahan section lama hanya perlu dicatat sebagai cross-section impact bila di luar rencana/kepemilikan asli).

## 16. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja.

## 17. Known Issues dan Deferred Work

- **Q8 (tooling lint/typecheck/test) masih terbuka** — **enam section berturut-turut** (06–10) berjalan tanpa validasi otomatis penuh.
- **Keputusan didokumentasikan:** rencana awal `docs/route-and-role-matrix.md` menyebut `pages/projects/index.vue` + `dashboard/ProjectsTable.vue` "disatukan jadi satu skema" — **tidak dijalankan**. Card-grid existing (battle-tested sejak Section 05 tanpa masalah lewat Section 06-09) sudah memenuhi seluruh item scope literal Section 10 tanpa perlu beralih paradigma ke table. `ProjectsTable.vue` tetap dicadangkan (tidak dihapus), menunggu kebutuhan konkret di section mendatang (mis. bila Reports/Administration butuh tampilan tabular).
- Verifikasi interaktif filter/sort/dropdown tidak dilakukan langsung (keterbatasan tooling lingkungan).
- Tab Itinerary & Services/Travelers/Vendors/Finance/Tasks/Documents/Activity & Changes **sengaja tidak disentuh** — tetap baseline Foundation, menunggu Section 11-15 mengisi detail penuh (sesuai hard rule "jangan mengerjakan seluruh detail traveler/operations/vendor/finance").

## 18. Protection Notes untuk Section Berikutnya

- **Overview tab kini punya 5 SectionCard tetap** (Ringkasan Layanan, Service Summary, Milestone/Task Summary, Document Summary, Recent Activity) — Section 11-15 yang mengisi tab lain (Travelers, Itinerary & Services, Vendors, Finance, Tasks, Documents, Activity & Changes) sebaiknya TIDAK menduplikasi ringkasan ini kembali di Overview; cukup memperkaya tab masing-masing, Overview akan otomatis mencerminkan data baru lewat computed yang sudah ada (`serviceStatusSummary`, `taskStatusSummary`, dst. — sudah generik terhadap jumlah data).
- Progress bar (`getProjectProgress`, `/projects/index.vue`) memakai `LINEAR_STATUSES` lokal — bila Section 11+ menambah status project baru di luar 8 yang sudah ada, perbarui konstanta ini secara eksplisit (jangan biarkan status baru diam-diam tidak terhitung).
- `ProjectsTable.vue` tetap dicadangkan — jangan dihapus tanpa dependency check ulang.

## 19. Recommended Next Section

Section 11 — Traveler and Participant (`prompts/13-PROMPT-11-TRAVELER-PARTICIPANT.md`), dengan rekomendasi sangat kuat menyelesaikan Q8 terlebih dahulu — enam section berturut-turut telah berjalan tanpa validasi otomatis penuh. Tidak dieksekusi otomatis — menunggu perintah user.
