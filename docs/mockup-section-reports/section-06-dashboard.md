# Section 06 — Dashboard

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/08-PROMPT-6-DASHBOARD.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user.

---

## 1. Section Objective dan Scope

Menyelesaikan dashboard frontend mockup MANOVA (`/`) berbasis fixture terpusat dan role-aware — final, bukan lagi shell. Scope eksplisit: Opportunity pipeline, Active projects, Upcoming departures, Attention items, Budget versus actual, Outstanding invoices, Recent activities, filter (periode/owner/client/tipe project/status), widget kondisional untuk Management/Sales/PM/Operations/Finance/Viewer, state loading/empty/error/unauthorized, responsive desktop/mobile.

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/08-PROMPT-6-DASHBOARD.md`, `docs/mockup-implementation-state.md`, `docs/mockup-section-progress.md`, `docs/mockup-change-impact-log.md`, `docs/mockup-section-reports/section-05-foundation.md`, `docs/route-and-role-matrix.md` (bagian 0, 5, 6), `docs/mockup-data-scenarios.md`, `docs/mockup-progress.md` (Entri 6).

## 3. Existing Implementation yang Diperiksa

`app/pages/index.vue` (dashboard shell Section 05), `app/components/dashboard/{StatsCard,BudgetChart,ExpenseCategories,RecentActivity}.vue`, `app/components/shared/*` (11 komponen), `app/composables/{useCurrentUser,usePermissions}.ts`, `app/data/*.ts` (seluruh fixture), `app/types/*.ts`, `app/constants/{status,roles,navigation}.ts`, `app/utils/{format,attention}.ts`, `app/components/ui/select/*` (belum ada consumer sebelumnya), `app/middleware/auth.ts`. Git log dan `git status` diperiksa — working tree bersih untuk `app/**`/`docs/**` sebelum mulai (hanya perubahan `prompts/` dari sesi sebelumnya).

## 4. Decisions yang Digunakan

D-031 (Dashboard role behavior: satu dashboard, widget kondisional per role — LOCKED), D-030 (Role & Access Matrix), D-028 (Project Status), D-040 (threshold attention default), D-037 (formatter terpusat), D-026/D-027 (Project Detail 8-tab/single-route — tidak disentuh section ini).

## 5. Implementation Summary dan User Flow

Dashboard (`/`) kini menampilkan:
1. **KPI row** (6 stat card, kondisional per role): Active Projects, Open Opportunities, Upcoming Departures, Project Perlu Perhatian, Outstanding Invoices, Total User Demo (Super Admin saja).
2. **Filter bar** (status, tipe project, client, owner, periode keberangkatan) — berlaku ke seluruh widget berbasis Project; disembunyikan untuk Sales (widgetnya murni domain Opportunity); filter Owner disembunyikan untuk Project Manager (widgetnya sudah otomatis di-scope ke project miliknya).
3. **Grid widget**, tampil sesuai role (rincian bagian 12).

**User flow:** login mock (role apa saja) → Dashboard menampilkan KPI + widget sesuai role → ubah filter (mis. status=Confirmed, periode=30 hari) → seluruh widget berbasis project ikut menyempit → ganti role lewat `/settings` → widget dan filter yang tersedia berubah total sesuai role baru.

## 6. Routes

`/` — tidak ada route baru dibuat, hanya `/` yang diselesaikan (final).

## 7. Files Created, Changed, dan Removed

**Created:** `app/components/shared/StatusBreakdownList.vue` (breakdown-by-status generik: props `items: {key,label,tone,count,secondaryLabel?}[]`, dipakai 3 widget — Opportunity Pipeline, Active Projects by Status, Service Readiness — berpotensi dipakai lagi Section 16 Reports).

**Changed:**
- `app/pages/index.vue` — rewrite total.
- `app/components/dashboard/BudgetChart.vue` — dari line chart bulanan fiktif (USD, hardcoded) menjadi bar chart Budget vs Actual per project (IDR), props `labels/budgetIdr/actualIdr`, debug `console.log` lama dihapus.
- `app/components/dashboard/ExpenseCategories.vue` — dari doughnut department fiktif (USD) menjadi cost breakdown per project (IDR), props `items`, debug `console.log` lama dihapus.
- `app/components/dashboard/RecentActivity.vue` — dari daftar user/avatar fiktif (Unsplash) menjadi daftar activity project nyata, props `items`.
- `app/utils/attention.ts` — `+UPCOMING_TASK_WINDOW_DAYS` (14 hari), `+isTaskUpcoming()`.
- `app/data/index.ts` — `+getProjectsByOwner`, `+getServicesForProjects`, `+getUpcomingTasks`, `+getRecentChanges`.
- `app/data/opportunities.ts` — `+OPP-005/006/007`, `+QUO-005/006` (lihat CI-002).
- `app/data/activity.ts` — `+TSK-1023`, `+TSK-1035` (lihat CI-002).

**Removed:** Tidak ada.

## 8. Components Reused dan Created

**Reused:** `StatsCard.vue` (apa adanya), `SectionCard`, `EmptyState`, `LoadingState`, `StatusBadge`, `AttentionIndicator`, `DetailMetadataList`, `PageHeader` (seluruhnya dari shared foundation Section 05), 15 primitive `ui/*` termasuk **`ui/select` — pemakaian nyata pertama** di codebase (filter bar).

**Adapted (reuse dengan perubahan signifikan):** `BudgetChart.vue`, `ExpenseCategories.vue`, `RecentActivity.vue` (lihat bagian 7).

**Created:** `StatusBreakdownList.vue`.

## 9. Types, Constants, Fixtures, dan Mock State

Tidak ada perubahan `app/types/*` atau `app/constants/*`. Fixture `OPPORTUNITIES`/`QUOTATIONS`/`TASKS` diperluas (lihat bagian 7 dan CI-002) — murni penambahan record baru mengikuti shape/pola ID existing, tidak ada record lama yang diubah/dihapus. Selector baru (`app/data/index.ts`) murni tambahan.

## 10. Responsive Behavior

Grid widget memakai `grid-cols-1` (mobile) → `lg:grid-cols-2` (desktop), konsisten dengan pola Section 05. Filter bar memakai `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`. KPI row `grid-cols-1 sm:grid-cols-2 lg:grid-cols-6`. Tidak diverifikasi lewat browser interaktif (lihat bagian 13/17) — hanya lewat class Tailwind responsif yang konsisten dengan pola existing yang sudah diverifikasi Section 05.

## 11. Loading, Empty, Error, Not-Found, dan Unauthorized States

- **Loading:** dipertahankan dari Section 05 (`LoadingState`, simulasi 400ms, SSR menampilkan skeleton sebelum hydration — dikonfirmasi lewat curl, lihat bagian 13).
- **Empty:** setiap widget baru punya `EmptyState` dengan pesan spesifik (mis. "Tidak ada opportunity dalam pipeline", "Tidak ada project sesuai filter") — termasuk kondisi kosong akibat filter yang terlalu sempit, bukan hanya kondisi data kosong secara global.
- **Error:** **tidak ada state error tersimulasi baru.** Dashboard adalah mock frontend murni tanpa sumber data async yang bisa gagal (fixture selalu tersedia secara sinkron); `ErrorState.vue` (Section 05) tetap tersedia sebagai shared component tapi tidak ada trigger kegagalan nyata untuk diwujudkan di halaman ini — konsisten dengan pendekatan Section 05 (dicatat sebagai keterbatasan mock, bukan gap yang disembunyikan).
- **Unauthorized:** Dashboard dapat diakses oleh seluruh role (by design, D-031) — visibilitas diatur per-widget lewat `v-if`, bukan per-halaman lewat state "unauthorized" eksplisit. Ini konsisten dengan prinsip "satu dashboard, bukan dashboard terpisah per role" — widget yang tidak berhak dilihat tidak dirender sama sekali (bukan dirender lalu diblokir).

## 12. Role Behavior (Pemetaan Final ke `docs/route-and-role-matrix.md` Bagian 6)

| Role | Widget yang diimplementasikan |
|---|---|
| Management | Opportunity Pipeline, Active Projects by Status, Budget vs Actual, Outstanding Invoices, Project Perlu Perhatian, Recent Activity |
| Sales | Opportunity Pipeline, Quotations Menunggu Keputusan |
| Project Manager | Active Projects Milik Saya, Upcoming Departures, Attention — Project Milik Saya, Milestone/Task Mendatang, Change History Ringkas |
| Operations | Service Readiness — Seluruh Layanan, Upcoming Departures |
| Ticketing | Service Readiness — Flight, Upcoming Departures |
| Accommodation | Service Readiness — Hotel, Upcoming Departures |
| Transportation | Service Readiness — Transportation, Upcoming Departures |
| MICE | Service Readiness — MICE, Upcoming Departures |
| Finance | Budget vs Actual, Cost Breakdown, Outstanding Invoices |
| Super Admin | Union seluruh widget agregat di atas (bukan varian "milik sendiri") + Ringkasan Administrasi |
| Viewer / Auditor | Identik dengan Management (read-only — halaman ini memang tidak memiliki aksi tulis apa pun) |

**Interpretasi yang didokumentasikan (bukan penyimpangan diam-diam dari LOCKED D-031):**
- "Lead & opportunity count" (Sales) — "Lead" belum dimodelkan sebagai entitas terpisah; diimplementasikan sebagai hitungan Opportunity stage terbuka.
- "Follow-up/activity mendatang milik sendiri" (Sales) — **tidak diimplementasikan.** `ActivityEntry` fixture hanya terikat ke `Project`, belum ada Activity level-Party/Opportunity untuk opportunity yang belum jadi Project. Menyusul Section 07/08.
- "Cost breakdown" (Finance) — per-project (dari `actualCostIdr`), bukan per jenis layanan (belum ada field cost per service type di fixture).
- Super Admin tidak mendapat varian "milik sendiri" (Active Projects Milik Saya, dst.) karena konsep "pemilik" tidak relevan untuk role admin — mendapat varian agregat yang setara.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — sukses.
- `npm run build` — **sukses (exit 0)**, dijalankan 2x (sebelum dan sesudah membersihkan 1 unused import).
- `npx vitest run` — "No test files found", exit code 1 (pre-existing, bukan regresi).
- `npx nuxi typecheck` — gagal, `vue-tsc` tidak terpasang (Q8, pre-existing, tidak diselesaikan section ini — lihat bagian 17).
- Lint — tidak tersedia (Q8, pre-existing).
- Smoke test manual: build di-preview (`node .output/server/index.mjs`), curl 9 route (`/`, `/settings`, `/login`, `/projects`, `/projects/PRJ-101`, `/crm`, `/vendors`, `/finance`, `/admin`) → **seluruhnya HTTP 200**, tidak ada string error/exception di HTML.
- Verifikasi konten: `grep` string spesifik widget baru ("Opportunity Pipeline", "Total Budget vs Actual") pada `.output/server/chunks/build/pages-*.mjs` → **ditemukan**, mengonfirmasi seluruh SFC baru/diadaptasi berhasil di-compile Vue/Vite tanpa error template maupun script.
- **Interactive/hydrated browser verification — tidak dilakukan.** Tidak ada tool browser headless (mis. Playwright/Puppeteer/screenshot) tersedia di lingkungan eksekusi ini. Verifikasi post-hydration (tampilan widget setelah client JS jalan, interaksi filter, perpindahan role) **tidak dapat dikonfirmasi visual** — hanya diverifikasi lewat compile success + code review manual terhadap kontrak props/computed. Ini keterbatasan lingkungan, bukan langkah yang dilewatkan sengaja.

## 14. Regression Checks

Route lain (`/settings`, `/login`, `/projects`, `/projects/[id]`, `/crm`, `/vendors`, `/finance`, `/admin`) tetap HTTP 200 setelah perubahan — tidak ada regresi navigasi. `useCurrentUser`/`usePermissions` tidak diubah sehingga role switcher di `/settings` tetap berfungsi seperti Section 05. Fixture yang diperluas (bagian 7) diverifikasi tidak mengubah record existing (append-only).

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-002 (perluasan fixture Opportunity/Quotation/Task) dan CI-003 (adaptasi 3 komponen dashboard + rewrite halaman Dashboard, keduanya milik Section 05).

## 16. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja (`npm run dev` di `localhost:8080` sesuai `nuxt.config.ts`), tidak ada deployment/preview URL publik.

## 17. Known Issues dan Deferred Work

- **Q8 (tooling lint/typecheck/test) masih terbuka.** Section 05 merekomendasikan penyelesaian sebelum Section 06 dimulai; user secara eksplisit memerintahkan Section 06 dikerjakan langsung (`prompts/99-RUN-CURRENT-SECTION.md`) tanpa menyelesaikan Q8 lebih dulu. Instruksi user diikuti (instruksi eksplisit mengesampingkan rekomendasi), dicatat agar tidak hilang dari radar — makin mendesak diselesaikan sebelum Section 07.
- Interactive/hydrated browser verification tidak dilakukan (bagian 13) — keterbatasan tooling lingkungan, bukan langkah yang sengaja dilewati.
- "Follow-up/activity mendatang milik sendiri" (Sales) belum diimplementasikan — deferred ke Section 07/08 (butuh model Activity level-Party/Opportunity).
- "Cost breakdown" Finance per-project, bukan per jenis layanan — dapat diperhalus di Section 15 (Project Finance) bila granularity itu terbukti dibutuhkan.
- `/crm/opportunities` (Section 05) belum memiliki UI khusus untuk memfilter/menampilkan 3 opportunity pipeline baru secara maksimal (menampilkan apa adanya dari fixture, tanpa grouping visual) — akan disempurnakan di Section 08 (Opportunity dan Quotation).
- Filter bar (`ui/select`) adalah komponen ad hoc di dalam halaman Dashboard, bukan shared component — dipertimbangkan untuk diekstrak jadi shared `FilterBar` bila Section 10 (Project Core) butuh pola filter yang serupa.

## 18. Protection Notes untuk Section Berikutnya

- Jangan menulis ulang struktur widget/filter Dashboard tanpa alasan kuat — sudah final untuk Section 06. Section yang membutuhkan Dashboard menampilkan data baru (mis. Party/Opportunity real setelah CRM dibangun) cukup **memastikan fixture konsisten**, bukan mengubah struktur halaman.
- `OPP-005`–`007`, `QUO-005`–`006`, `TSK-1023`, `TSK-1035` — Section 07 (CRM Party)/Section 08 (Opportunity dan Quotation)/Section 14 (Project Changes) harus **mewarisi dan memperluas** baris ini, bukan menduplikasi dengan ID baru untuk konsep yang sama.
- `StatusBreakdownList.vue` — reuse untuk breakdown by-status/stage berikutnya (kandidat kuat untuk Section 16 Reports — Sales Pipeline), jangan bikin komponen breakdown baru yang serupa.
- `BudgetChart.vue`/`ExpenseCategories.vue`/`RecentActivity.vue` kini punya kontrak props (lihat bagian 7) — section lain yang ingin memakainya ulang (mis. Section 15 Project Finance untuk grafik per-project) harus memakai kontrak yang sama, bukan menulis ulang.
- Selesaikan Q8 sebelum Section 07 — sudah dua section berjalan tanpa lint/typecheck otomatis.

## 19. Recommended Next Section

Section 07 — CRM Party (`prompts/09-PROMPT-7-CRM-PARTY.md`), dengan rekomendasi eksplisit menyelesaikan Q8 terlebih dahulu. Tidak dieksekusi otomatis — menunggu perintah user.
