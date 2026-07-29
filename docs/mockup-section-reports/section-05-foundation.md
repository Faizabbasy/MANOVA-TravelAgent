# Section 05 — Foundation

**Status:** COMPLETED (foundation coding pertama; modul bisnis penuh belum dikerjakan, sesuai batasan tahap ini secara eksplisit)

Laporan ini ditulis retroaktif saat penyiapan dokumentasi continuity (2026-07-29), berdasarkan `docs/mockup-progress.md` Entri 6 (narasi asli Prompt 5) yang **diverifikasi ulang langsung terhadap codebase** (isi file, `git log`/`git show --stat`, dan re-run validasi) — bukan disalin tanpa pengecekan.

---

## 1. Section Objective dan Scope

Membersihkan template Nuxt 4 existing secara aman dan menyiapkan foundation MANOVA: app shell, navigation, route foundation, shared types, constants, dummy data foundation, role mock, dan reusable component baseline — **bukan** membangun seluruh modul bisnis (CRM, Opportunity, Operations, Vendor, Finance) secara penuh.

## 2. Source Documents yang Dibaca

`docs/mockup-scope.md`, `docs/mockup-information-architecture.md`, `docs/mockup-data-scenarios.md`, `docs/mockup-design-decisions.md`, `docs/mockup-open-questions.md`, `docs/mockup-progress.md`, `docs/template-reuse-mapping.md`, `docs/route-and-role-matrix.md`, `docs/template-audit.md` — sesuai daftar wajib prompt Section 05 (`prompts/07-.PROMPT 5 — BERSIHKAN TEMPLATE DAN SIAPKAN FOUNDATION.md` bagian A).

## 3. Existing Implementation yang Diperiksa

Codebase Nuxt 4/Vue 3/TypeScript/Tailwind/shadcn-nuxt/Reka UI/Chart.js hasil audit Section 01: 15 primitive `ui/*`, layout `dashboard.vue`/`AppSidebar.vue`/`TopHeader.vue`, halaman `projects/index.vue` dan `projects/[id]/index.vue` (arsitektur tab 6-tab lama), `pages/expenses.vue` (bug `handleDelete`), `pages/tasks.vue`, `pages/projects/create.vue` (wizard 3-langkah), `pages/projects/[id]/edit.vue`, sidebar lama (13 item, 9 dead link), `dashboard/AIAssistant.vue`, `app/utils/cn.ts` (duplikat `app/lib/utils.ts`), `.gradient-primary` CSS utility.

## 4. Decisions yang Digunakan

D-001 (Party tunggal), D-002 (Opportunity Won → Project otomatis), D-003 (11 role dipakai demo), D-018 (wizard create direpurpose), D-019 (Tasks bukan top-level), D-020 (Operations/Traveler jadi tab), D-021 (dead link dipetakan/dieksklusi), D-022 (Settings minimal via popover), D-023 (AIAssistant.vue dihapus di tahap ini), D-024 (model Party), D-026/D-027 (8-tab, single-route), D-028 (Project Status), D-029 (Service Status), D-030 (Role & Access Matrix), D-031 (Dashboard role behavior), D-034 (Nuxt dipertahankan), D-035 (design system direuse), D-036 (kebijakan penambahan package — konservatif, tidak instal `eslint`/`vue-tsc` pada tahap ini), D-040 (threshold attention default). Klarifikasi implementasi baru dicatat sebagai D-041–D-045.

## 5. Implementation Summary dan User Flow

App identity direbrand ke MANOVA (title, sidebar/login logo placeholder, header). Navigation dibangun ulang dari satu source of truth (`app/constants/navigation.ts` — `NAV_ITEMS`) mengikuti IA, dengan role-visibility mock, nested menu, label "Segera" untuk halaman `comingSoon`. Type foundation, status/role constants, dummy data terpusat, formatter Rupiah/tanggal, helper attention, current user & role mock + permission helper dibangun. Shared UI foundation (11 komponen) dan primitive `ui/tabs` dibangun. Route foundation aktif untuk seluruh IA — sebagian shell nyata berbasis fixture (Dashboard, CRM overview + Opportunities list, Projects list, Project Detail 8-tab shell, Vendors list, Finance overview, Administration overview, Settings dengan role switcher), sebagian `ModulePlaceholder` berlabel ("Segera Hadir": Prospects, Clients, Quotations, Invoices, Payments, Reports, Master Data, Users, Roles, Audit Trail).

**User flow yang bisa didemokan pada tahap ini:** login mock → Dashboard (widget berubah sesuai role yang dipilih di Settings) → buka CRM Opportunities atau Projects list (data dari fixture) → buka Project Detail (`PRJ-101`/`PRJ-102`/`PRJ-103`, tab-tab terlihat namun sebagian besar isinya masih placeholder) → kembali. Alur bisnis penuh (CRM → Opportunity → Won → Project → Operations → Finance) **belum** bisa didemokan end-to-end — menyusul Section 06 ke atas.

## 6. Routes

Lihat `docs/mockup-implementation-state.md` bagian 2 untuk tabel klasifikasi lengkap (aktif-nyata / placeholder / lama-tidak-ditautkan / excluded). Ringkasan: 11 route aktif dengan shell/data nyata, 10 route placeholder berlabel, 4 route lama tidak ditautkan (menunggu adaptasi section domain), beberapa route lama dieksklusi total (dicatat di `docs/route-and-role-matrix.md` bagian 1.8).

## 7. Files Created, Changed, dan Removed

**Created:**
- Types (8): `app/types/common.ts`, `user.ts`, `party.ts`, `opportunity.ts`, `project.ts`, `vendor.ts`, `finance.ts`, `activity.ts`.
- Constants (3): `app/constants/status.ts`, `roles.ts`, `navigation.ts`.
- Data (8 + barrel): `app/data/users.ts`, `parties.ts`, `opportunities.ts`, `vendors.ts`, `projects.ts`, `finance.ts`, `activity.ts`, `index.ts`.
- Utils: `app/utils/format.ts`, `app/utils/attention.ts`.
- Composables: `app/composables/useCurrentUser.ts`, `app/composables/usePermissions.ts`.
- Shared components (11): `app/components/shared/PageHeader.vue`, `Breadcrumb.vue`, `StatusBadge.vue`, `EmptyState.vue`, `LoadingState.vue`, `ErrorState.vue`, `AttentionIndicator.vue`, `SectionCard.vue`, `DetailMetadataList.vue`, `ModulePlaceholder.vue`, `RoleAccessState.vue`.
- UI primitive baru: `app/components/ui/tabs/Tabs.vue`, `TabsList.vue`, `TabsTrigger.vue`, `TabsContent.vue`, `index.ts`.
- Routes baru: `app/pages/crm/index.vue`, `prospects.vue`, `clients.vue`, `opportunities.vue`, `quotations.vue`; `app/pages/vendors/index.vue`; `app/pages/finance/index.vue`, `invoices.vue`, `payments.vue`; `app/pages/reports/index.vue`; `app/pages/admin/index.vue`, `master-data.vue`, `users.vue`, `roles.vue`, `audit-trail.vue`; `app/pages/settings.vue`.

**Changed:** `nuxt.config.ts` (app identity, `components` dir baru), `app/components/layout/AppSidebar.vue` (navigasi `NAV_ITEMS`, role-visibility, logo placeholder), `app/components/layout/TopHeader.vue` (title dinamis dihapus, badge role, hapus tombol dekoratif palsu), `app/pages/index.vue` (dashboard ditulis ulang total), `app/pages/login.vue` (rebrand), `app/pages/projects/index.vue` (list ditulis ulang memakai fixture), `app/pages/projects/[id]/index.vue` (shell ditulis ulang total — 1828 baris net removal per `git show --stat`), `assets/css/tailwind.css` (hapus `.gradient-primary`).

**Removed:** `app/utils/cn.ts` (duplikat persis `app/lib/utils.ts`; dependency check `grep` seluruh `app/` mengonfirmasi tidak ada pemakai), `app/components/dashboard/AIAssistant.vue` (sesuai D-023; dependency check mengonfirmasi hanya `pages/index.vue` lama yang memakainya, dan halaman itu sudah ditulis ulang total).

**Sengaja TIDAK dihapus** (kategori reuse masih `ADAPT`/`REUSE_COMPONENTS`, bukan `REMOVE_AFTER_VALIDATION`): `dashboard/BudgetChart.vue`, `ExpenseCategories.vue`, `ProjectsTable.vue`, `RecentActivity.vue`, `TasksOverview.vue`, `TeamMetrics.vue`, `pages/tasks.vue`, `pages/expenses.vue`, `pages/projects/create.vue`, `pages/projects/[id]/edit.vue`, `public/logo.svg`, `public/daffascript.svg`.

**Verifikasi commit:** seluruh perubahan di atas dikonfirmasi tercatat dalam commit `e8637af — "Cleaned template and prepare foundation"` (77 file berubah, +2440/−2125 baris), sudah berada di `HEAD` branch `master`, working tree bersih untuk `app/**` dan `docs/**` pada saat laporan ini ditulis.

## 8. Components Reused dan Created

**Reused apa adanya:** 15 primitive `ui/*` (Table, Badge, Card, Button, Input, Popover, Tooltip, Avatar, Separator, Dialog, Sheet, Select, Checkbox, Label, Progress), `dashboard/StatsCard.vue` (Dashboard, CRM overview, Finance overview), pola layout `dashboard.vue`/`AppSidebar.vue`/`TopHeader.vue`, `useSidebar.ts`, `useIsMobile.ts`.

**Created:** 11 shared component + 4 file primitive `ui/tabs` (rincian bagian 7).

## 9. Types, Constants, Fixtures, dan Mock State

Lihat `docs/mockup-implementation-state.md` bagian 4 untuk rincian lengkap. Ringkasan fixture: 11 user (1 per role, default demo Super Admin `USR-010`), 4 Party (`PTY-001`–`PTY-004`), 3 Project (`PRJ-101` Manila flight-only, `PRJ-102` Abu Dhabi flight+hotel dengan service `changed`/`cancelled`, `PRJ-103` Palu flight+hotel+transportation+MICE dengan traveler group dan `specialRequest`), 5 Vendor, plus Invoice/Payment/Task/Document/Activity terkait — seluruhnya konsisten dengan `docs/mockup-data-scenarios.md`.

## 10. Responsive Behavior

Tidak diverifikasi ulang secara visual pada saat penyusunan laporan retroaktif ini (di luar scope tugas dokumentasi continuity — tidak ada perubahan kode dilakukan). Klaim asli Prompt 5: layout desktop dan mobile diperiksa untuk seluruh route foundation; tidak ada temuan spesifik yang dicatat sebagai regresi.

## 11. Loading, Empty, Error, Not-Found, dan Unauthorized States

- **Loading:** Dashboard mensimulasikan loading state (data terisi setelah hydration client), dikonfirmasi lewat smoke test SSR asli (loading-state tampil benar sebelum hydration).
- **Not-found:** Project Detail (`/projects/[id]`) menampilkan not-found state untuk ID tidak dikenal — dikonfirmasi via smoke test `/projects/PRJ-999` (HTTP 200, halaman not-found tampil, bukan error).
- **Empty/Error:** Komponen `EmptyState.vue`/`ErrorState.vue` tersedia sebagai shared component, dipakai di beberapa halaman shell; cakupan penuh di seluruh halaman baru penuh sepenuhnya menyusul section domain masing-masing.
- **Unauthorized:** `RoleAccessState.vue` tersedia sebagai shared component untuk halaman yang role-nya `NONE`; penerapan menyeluruh menyusul section domain.

## 12. Role Behavior

`useCurrentUser()` menyediakan current-user mock reaktif (default Super Admin, dapat diganti di `/settings` via demo role switcher, persist ke `localStorage`). `usePermissions()` menyediakan helper akses berbasis `ROLE_MODULE_ACCESS` (`app/constants/roles.ts`, 11 role x 6 modul x 5 level). Navigasi sidebar sudah role-aware (item dengan `moduleKey` disembunyikan bila akses role `NONE`). Role-gating granular per halaman/aksi (di luar visibilitas navigasi) belum diterapkan menyeluruh — akan dibangun bersamaan dengan tiap section domain.

## 13. Validation Commands dan Hasilnya

**Hasil asli (dicatat di `docs/mockup-progress.md` Entri 6):**
- `pnpm exec nuxt prepare` — sukses.
- `pnpm run build` — sukses (exit 0), dijalankan 3x.
- Lint — tidak dapat dijalankan (tidak ada script `lint`, `eslint` inti belum terpasang).
- Typecheck — tidak dapat dijalankan (`nuxi typecheck` butuh `vue-tsc`, belum terpasang).
- Test — `pnpm exec vitest run` → "No test files found", exit code 1 (pre-existing, 0 test file sejak awal template).
- Smoke test manual — 11 route di-curl setelah build+preview, seluruhnya HTTP 200, tanpa stack trace di HTML.

**Re-verifikasi saat penyusunan laporan ini (2026-07-29):**
- `npm run build` — **sukses (exit 0)**, dijalankan ulang dari working tree saat ini.
- `npx vitest run` — **"No test files found", exit code 1** (konsisten, bukan regresi baru).
- `npx nuxi typecheck` — **gagal, `vue-tsc` tidak terpasang** (konsisten).
- `npx eslint` — **tidak tersedia secara lokal** (npx menawarkan instalasi sementara `eslint@10.8.0`; tidak ada di `node_modules`, tidak ada script `lint` di `package.json`) — konsisten dengan temuan asli.

Tidak ada perbedaan antara hasil asli dan hasil re-verifikasi — kondisi foundation stabil sejak commit `e8637af`.

## 14. Regression Checks

Tidak berlaku dalam pengertian "section sebelumnya" karena Section 05 adalah section kode pertama di bawah protokol ini. Regression check yang relevan (build tetap sukses, smoke test 11 route tetap HTTP 200) sudah dijalankan ulang pada bagian 13 di atas.

## 15. Cross-Section Impact

Satu entri tercatat: **CI-001** (`docs/mockup-change-impact-log.md`) — eksekusi keputusan D-023 (removal `AIAssistant.vue`) yang diputuskan di Section 03, dieksekusi di Section 05.

## 16. Review URLs

Tidak tersedia — proyek berjalan di lingkungan pengembangan lokal (`localhost:8080` via `npm run dev`), tidak ada deployment/preview URL publik pada tahap ini.

## 17. Known Issues dan Deferred Work

- **Q8 (blocking sebelum Section 06):** Tooling lint/typecheck/test belum lengkap — `eslint` core dan `vue-tsc` belum terpasang, tidak ada script `lint`/`typecheck` di `package.json`. Keputusan D-036 diterapkan konservatif (tidak instal package baru tanpa perintah eksplisit).
- Bug `handleDelete` di `app/pages/expenses.vue` — belum diperbaiki (route belum ditautkan navigasi, tapi wajib diperbaiki sebelum diadaptasi di Section 15 Project Finance).
- 6 komponen dashboard lama (`BudgetChart`, `ExpenseCategories`, `ProjectsTable`, `RecentActivity`, `TasksOverview`, `TeamMetrics`) tidak lagi dirender di manapun saat ini — dicadangkan, bukan dihapus, untuk section domain terkait.
- 4 route lama (`expenses`, `tasks`, `projects/create`, `projects/[id]/edit`) ada di disk tapi tidak ditautkan navigasi — menunggu adaptasi.

## 18. Protection Notes untuk Section Berikutnya

- Jangan mengubah struktur 8-tab atau single-route Project Detail (`app/pages/projects/[id]/index.vue`) — hanya isi tab yang ditambah per section domain (D-026/D-027, LOCKED).
- Jangan membuat sumber navigasi paralel — tambah/ubah item lewat `app/constants/navigation.ts` (`NAV_ITEMS`) saja.
- Jangan membuat fixture/data source paralel — perluas `app/data/*.ts` existing dan tetap konsisten dengan ID (`PRJ-101/102/103`, `PTY-001`–`004`, dst.) dan skenario di `docs/mockup-data-scenarios.md`.
- Jangan membuat mekanisme role-check kedua — perluas `usePermissions`/`ROLE_MODULE_ACCESS` existing.
- Jangan menghapus 6 dashboard component lama tanpa dependency check ulang — statusnya masih dicadangkan untuk reuse, bukan dead code.
- Selesaikan Q8 (tooling lint/typecheck) sebelum menganggap kualitas kode section-section berikutnya tervalidasi otomatis.

## 19. Recommended Next Section

Section 06 — Dashboard (`prompts/08-PROMPT-6-DASHBOARD.md`), dengan rekomendasi eksplisit untuk menyelesaikan Q8 (tooling lint/typecheck) terlebih dahulu atau di awal section tersebut. Tidak dieksekusi otomatis — menunggu perintah user.
