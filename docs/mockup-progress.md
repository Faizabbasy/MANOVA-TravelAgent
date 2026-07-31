# MANOVA Mockup — Progress Log

Log kronologis progres pengerjaan mockup MANOVA di atas template Nuxt 4 existing. **Append-only secara konseptual** — entri baru ditambahkan di bagian bawah, histori sebelumnya tidak dihapus. **Direstrukturisasi di Prompt 4** (Prompt 4 bagian G) ke format field standar per entri: Date · Phase · Status · Completed · Files changed · Validation · Decisions · Open issues · Next recommended prompt. Seluruh isi naratif dari versi sebelumnya dipertahankan, hanya disusun ulang ke format ini.

---

## Entri 1 — Prompt 0: Konteks Bisnis dan Aturan Kerja

- **Date:** 2026-07-29
- **Phase:** Prompt 0 — Konteks Bisnis dan Aturan Kerja
- **Status:** Selesai
- **Completed:** Membaca dan mengonfirmasi seluruh isi `prompts/PROMPT 0-KONTEKS BISNIS DAN ATURAN KERJA.md` sebagai landasan kerja (domain MANOVA, tipe project, alur bisnis, entitas, role, kebutuhan dashboard, skenario data demo, prinsip reuse, aturan teknis, dokumentasi source of truth, aturan pelaporan). Tidak ada kode yang diubah, tidak ada halaman dibuat, tidak ada package diinstal, tidak ada file dihapus (sesuai batasan tahap ini).
- **Files changed:** Tidak ada (murni pembacaan konteks).
- **Validation:** Tidak berlaku — tidak ada kode yang diubah.
- **Decisions:** 6 keputusan LOCKED dari Prompt 0 dicatat (lihat D-001 s/d D-006, `docs/mockup-design-decisions.md`, direstrukturisasi retroaktif di Prompt 4).
- **Open issues:** Tidak ada pada tahap ini.
- **Next recommended prompt:** Prompt 1 — Audit Template dan Codebase.

## Entri 2 — Prompt 1: Audit Template dan Codebase

- **Date:** 2026-07-29
- **Phase:** Prompt 1 — Audit Template dan Codebase
- **Status:** Selesai
- **Completed:** Audit read-only menyeluruh terhadap template Nuxt 4 existing: project foundation (versi, package, config), struktur codebase, UI & design system, fitur/halaman, data & state, serta kualitas codebase (build/lint/typecheck/test). Metode: audit langsung untuk config/versi/struktur + 3 sub-agent riset paralel (rute-layout-middleware, UI-design tokens, data-state-code quality), lalu verifikasi build. Tindakan yang **tidak** dilakukan sesuai batasan Prompt 1: implementasi halaman MANOVA, rename menu/route, penggantian dummy data, penghapusan fitur, instalasi library baru, perubahan design system, refactor besar.
  - **Temuan utama:** fondasi Nuxt 4/Vue 3/TypeScript/Tailwind/shadcn-nuxt/Reka UI/Chart.js layak direuse; data mock (Project/Task/Expense) tidak konsisten lintas halaman (2–3 shape berbeda per entitas, satu project "PRJ-005" orphan); bug nyata `handleDelete` tidak terdefinisi di modal detail `expenses.vue`; 9 dari 13 menu sidebar menunjuk halaman yang belum ada; tidak ada RBAC/role mock; tidak ada formatter currency/date bersama, nol format Rupiah/IDR; tidak ada tooling lint/typecheck/test yang berfungsi; **di luar kode** — folder `.git` sempat tidak ditemukan saat audit (dilaporkan terpisah ke user, di luar kendali/scope Prompt 1).
- **Files changed:** Dibuat — `docs/template-audit.md`, `docs/mockup-progress.md`.
- **Validation:** `npm run build` sukses (exit 0), dijalankan dua kali untuk konfirmasi; lint/typecheck/test tidak dapat dijalankan karena tooling belum dikonfigurasi (dicatat sebagai temuan, bukan dieksekusi paksa dengan instalasi baru).
- **Decisions:** Tidak ada keputusan baru (murni temuan audit).
- **Open issues:** Status folder `.git` (dilaporkan terpisah ke user); bug `handleDelete`; belum ada tooling lint/typecheck/test.
- **Next recommended prompt:** Prompt 2 — Gap Analysis dan Template Reuse Mapping.

## Entri 3 — Prompt 2: Gap Analysis dan Template Reuse Mapping

- **Date:** 2026-07-29
- **Phase:** Prompt 2 — Gap Analysis dan Template Reuse Mapping
- **Status:** Selesai
- **Completed:** Menyusun gap analysis dan reuse mapping murni dokumentasi (tidak ada kode diubah/dihapus/rename, tidak ada route/sidebar diubah, tidak ada package dipasang, tidak ada halaman baru dibuat). Cakupan: Mapping Matrix 9 route existing → kategori reuse dengan required adaptation/data impact/navigation impact/risk/execution phase; Component Reuse Matrix untuk 19 kebutuhan komponen MANOVA; Data Model Gap (type yang bisa digeneralisasi vs type baru total); Navigation Gap (13 menu sidebar existing, 9 dead link, dievaluasi tanpa membuat menu kosong); Fitur tidak relevan (alasan, komponen reusable, dependensi, rekomendasi tanpa eksekusi hapus); Rekomendasi phasing 11 tahap.
- **Files changed:** Dibuat — `docs/template-reuse-mapping.md`, `docs/mockup-scope.md`, `docs/mockup-design-decisions.md`, `docs/mockup-open-questions.md`. Diupdate — `docs/mockup-progress.md`.
- **Validation:** Tidak berlaku — tidak ada kode yang diubah pada tahap ini.
- **Decisions:** Keputusan LOCKED Prompt 0 dipakai sebagai constraint (Party tunggal, Opportunity Won→Project otomatis, seluruh role dipakai demo, larangan fabrikasi integrasi). Seluruh keputusan reuse/phasing baru tahap ini dicatat **PROPOSED** (kini D-007 s/d D-014, D-015 s/d D-017 DEFERRED — lihat `docs/mockup-design-decisions.md`), belum divalidasi user.
- **Open issues:** 8 pertanyaan terbuka dicatat (Q1–Q8 versi awal) — nasib wizard `/projects/create`, scope `Tasks` vs Kanban, Operations/Travelers top-level vs tab, 9 dead link sidebar, menu `Settings`, `AIAssistant.vue`, adopsi vee-validate/zod, tooling lint/typecheck/test.
- **Next recommended prompt:** Prompt 3 — Information Architecture, Route, Role, dan Workflow.

## Entri 4 — Prompt 3: Information Architecture, Route, Role, dan Workflow

- **Date:** 2026-07-29
- **Phase:** Prompt 3 — Information Architecture, Route, Role, dan Workflow
- **Status:** Selesai
- **Completed:** Finalisasi IA (bukan sekadar gap analysis) — 9 kelompok baseline dievaluasi satu per satu; Operations & Travelers diputuskan tidak jadi menu top-level (melebur jadi tab Project Detail), Vendor dipertahankan top-level; CRM disederhanakan jadi 4 sub-menu dengan Contacts/Activities sebagai tab kontekstual di Party Detail. Route inventory lengkap per kelompok menu (path/page name/parent menu/purpose/required data/main component/access role/demo inclusion/status), termasuk pemetaan eksplisit 9 dead link lama ke tujuan barunya. Project Detail dikonsolidasikan dari 6 tab existing menjadi 8 tab final dengan sub-section kondisional per service, tetap 1 route dengan state client-side. Model UI Party/Prospect/Client dirinci. Opportunity-to-Project workflow dirancang lengkap (diagram Mermaid + checklist efek Won + model role approval dua-langkah). Project Status (8 status) dan Service Status generik dirancang. Role & Access Matrix penuh 11 role x 6 modul x 5 access level. Dashboard Role Behavior (satu dashboard, widget kondisional).
- **Files changed:** Dibuat — `docs/mockup-information-architecture.md`, `docs/route-and-role-matrix.md`. Diupdate — `docs/mockup-design-decisions.md` (+14 entri LOCKED, kini D-018 s/d D-031), `docs/mockup-open-questions.md` (Q1–Q6 ditandai RESOLVED, +Q9), `docs/mockup-scope.md`, `docs/mockup-progress.md`.
- **Validation:** Tidak berlaku — tidak ada kode yang diubah, murni dokumentasi/desain.
- **Decisions:** Q1–Q6 dari Prompt 2 diresolusi tuntas dan dicatat sebagai LOCKED (kini D-018 s/d D-023); Party model (D-024), model role Won (D-025), 8-tab Project Detail (D-026), single-route tabs (D-027), Project Status (D-028), Service Status (D-029), Role Matrix (D-030), Dashboard behavior (D-031) — seluruhnya LOCKED sesuai instruksi eksplisit Prompt 3 untuk "memfinalisasikan rancangan".
- **Open issues:** Q7 (adopsi vee-validate/zod) dan Q8 (tooling lint/typecheck/test) tetap terbuka (di luar scope IA/route/role); Q9 baru (threshold numerik attention/approval, sengaja ditunda ke implementasi).
- **Next recommended prompt:** Prompt 4 — Membuat dan Memperbarui Dokumentasi.

## Entri 5 — Prompt 4: Membuat dan Memperbarui Dokumentasi

- **Date:** 2026-07-29
- **Phase:** Prompt 4 — Membuat dan Memperbarui Dokumentasi
- **Status:** Selesai
- **Completed:** Merapikan seluruh folder `docs/` menjadi source of truth sebelum coding dimulai, sesuai Prompt 4. Tidak ada kode aplikasi diubah, tidak ada halaman diimplementasikan. Pekerjaan:
  - `docs/mockup-design-decisions.md` direstrukturisasi total ke format decision-record (Decision ID/Title/Status/Context/Decision/Reason/Consequence/Affected/Date), ID lama (1–33) dipetakan 1:1 ke `D-001`–`D-033` agar referensi silang dokumen lain tetap valid; ditambahkan 7 entri baru (`D-034`–`D-040`) untuk melengkapi item wajib Prompt 4-E yang belum eksplisit: Nuxt.js dipertahankan, design system reuse, package addition policy, format Rupiah & tanggal, sentralisasi status constants, conditional modules berdasarkan service, dan threshold default attention condition.
  - `docs/mockup-scope.md` dilengkapi Product Objective, Business Context, Primary Users, B2B focus/B2C extensibility, Assumptions, Constraints, Non-Goals, Acceptance Criteria, dan Definition of Done (Prompt 4-B), plus penegasan 7 poin wajib (frontend mockup, dummy data terpusat, no fake integration, Opportunity Won→Project, Party sebagai basis Prospect/Client, seluruh role dipakai demo, template harus direuse).
  - `docs/mockup-data-scenarios.md` **dibuat baru** — 3 skenario utama (Normal: Manila/flight-only; High-Change: Abu Dhabi/flight+hotel; Complex: Palu/flight+hotel+transport+MICE) dengan ID konsisten (Party/Opportunity/Quotation/Project/Vendor/Invoice/Payment/Task/Change/Document), ditambah 1 Lost Opportunity, dan pemetaan 7 skenario tambahan (empty state, overdue invoice, lost opportunity, upcoming departure, cancelled service, pending confirmation, role-restricted finance view) ke entitas yang sudah ada (efisien, tanpa record buang-buang).
  - `docs/mockup-open-questions.md` direstrukturisasi ke format ID/Category/Impact/Recommendation/Owner/Status/Blocking, dipisah 4 kelompok (Blocking Before Foundation — kosong; Blocking Before Module Implementation — Q8; Non-Blocking — Q7; Deferred — Q9/Q10/Q11 baru, termasuk Q9 yang diresolusi via asumsi aman D-040). Q1–Q6 yang sudah resolved dari Prompt 2/3 dipindah ke bagian Arsip (tidak dihapus, tidak lagi dianggap open).
  - `docs/route-and-role-matrix.md` dan `docs/template-reuse-mapping.md` diperiksa terhadap kolom wajib Prompt 4-H/I; kolom tambahan (Module/Menu placement/Main action/Reuse source/Implementation phase/Status eksplisit untuk route-role-matrix; Existing component/Candidate removal/Dependency eksplisit untuk template-reuse-mapping) ditambahkan bila belum ada.
  - Document Consistency Check (Prompt 4-J) dijalankan lintas 9 file: nama module/route/role/status, scope tidak bertentangan, open question tidak bertentangan dengan LOCKED decision, referensi file, tidak ada TODO tanpa konteks/placeholder generik.
- **Files changed:** Diupdate — `docs/mockup-design-decisions.md`, `docs/mockup-scope.md`, `docs/mockup-open-questions.md`, `docs/route-and-role-matrix.md`, `docs/template-reuse-mapping.md`, `docs/mockup-progress.md` (direstrukturisasi + entri ini). Dibuat baru — `docs/mockup-data-scenarios.md`.
- **Validation:** Tidak berlaku untuk kode — tidak ada file aplikasi (`app/**`) yang diubah pada tahap ini; validasi yang dilakukan adalah consistency check antar-dokumen (lihat bagian Completed).
- **Decisions:** D-034 s/d D-040 ditambahkan (lihat `docs/mockup-design-decisions.md` Kelompok B & G). Tidak ada keputusan LOCKED sebelumnya yang diubah/dibatalkan — hanya dirapikan formatnya.
- **Open issues:** Q7 (non-blocking), Q8 (blocking sebelum implementasi modul, harus selesai dalam fase Foundation), Q9/Q10/Q11 (deferred) — lihat `docs/mockup-open-questions.md`. Tidak ada open question yang blocking terhadap **dimulainya** foundation coding.
- **Next recommended prompt:** Prompt 5 — Bersihkan Template dan Siapkan Foundation (menunggu perintah user, tidak dieksekusi otomatis).

## Entri 6 — Prompt 5: Bersihkan Template dan Siapkan Foundation

- **Date:** 2026-07-29
- **Phase:** Prompt 5 — Bersihkan Template dan Siapkan Foundation
- **Status:** Selesai (foundation coding pertama; modul bisnis penuh CRM/Opportunity/Operations/Vendor/Finance **belum** dikerjakan, sesuai batasan tahap ini).
- **Completed:** Coding pertama di atas seluruh dokumentasi Prompt 0–4. Ringkasan: app identity direbrand ke MANOVA (title, sidebar/login logo placeholder, header); navigation dibangun ulang dari satu source of truth (`app/constants/navigation.ts`) mengikuti `docs/mockup-information-architecture.md`, dengan role-visibility mock, nested menu, label "Segera" untuk halaman belum diimplementasikan; type foundation (`app/types/*.ts`), status/role constants (`app/constants/*.ts`), dummy data terpusat (`app/data/*.ts`, persis mengikuti `docs/mockup-data-scenarios.md` — 3 project demo PRJ-101/102/103 + 4 Party + 4 Opportunity + 5 Vendor + Invoice/Payment/Task/Document/Activity), formatter Rupiah/tanggal (`app/utils/format.ts`), helper attention (`app/utils/attention.ts`), current user & role mock (`useCurrentUser`) + permission helper (`usePermissions`) dibangun; shared UI foundation (PageHeader, Breadcrumb, StatusBadge, EmptyState, LoadingState, ErrorState, AttentionIndicator, SectionCard, DetailMetadataList, ModulePlaceholder, RoleAccessState, primitive `ui/tabs` berbasis reka-ui) dibangun; route foundation aktif untuk seluruh IA (Dashboard, CRM overview+Opportunities list nyata, Prospects/Clients/Quotations placeholder berlabel, Projects list, Project Detail shell 8-tab, Vendors list, Finance overview+Invoices/Payments placeholder, Reports placeholder, Administration overview+4 sub-halaman, Settings dengan demo role switcher); Dashboard foundation memakai fixture dengan widget kondisional per role dan simulasi loading state; Project Detail shell memakai fixture PRJ-101/102/103 sungguhan dengan not-found state dan conditional service visibility.
- **Cleanup dieksekusi (dependency-checked sebelum dihapus):**
  - `app/utils/cn.ts` dihapus — duplikat persis `app/lib/utils.ts`; dependency check (`grep` seluruh `app/`) mengonfirmasi **tidak ada satu pun file** yang mengimpor dari path ini secara eksplisit maupun via auto-import (`import { cn }` di seluruh 50+ titik pemakaian selalu eksplisit dari `~/lib/utils`).
  - `app/components/dashboard/AIAssistant.vue` dihapus — sesuai keputusan LOCKED D-023 (Prompt 3) yang secara eksplisit menyatakan "penghapusan fisik menunggu tahap cleanup (Prompt 5)"; dependency check mengonfirmasi hanya `pages/index.vue` lama yang merender komponen ini, dan halaman tsb sudah ditulis ulang total di tahap ini.
  - `.gradient-primary` CSS utility di `assets/css/tailwind.css` dihapus — dependency check (`grep` lintas `app/` dan `assets/`) mengonfirmasi nol pemakaian.
  - Sidebar `menuItems` lama (13 item flat, 9 dead link) diganti total oleh `NAV_ITEMS` baru — seluruh dead link (`Time Tracking`, `Integrations`, `Templates`) otomatis tidak lagi ada; `Files`/`Team`/`Tasks` lama dilebur sesuai D-019/D-020/D-021.
- **Cleanup yang SENGAJA tidak dieksekusi (bukan lupa):**
  - `dashboard/BudgetChart.vue`, `ExpenseCategories.vue`, `ProjectsTable.vue`, `RecentActivity.vue`, `TasksOverview.vue`, `TeamMetrics.vue` — kini tidak lagi dirender di manapun (halaman dashboard lama sudah diganti), tapi **tidak dihapus** karena kategori reuse-nya `REUSE_COMPONENTS`/`ADAPT` (bukan `REMOVE_AFTER_VALIDATION`) — dicadangkan untuk diadaptasi saat fase Finance/Project Management/Reporting, sesuai instruksi "jangan menghapus file hanya berdasarkan nama" dan "pastikan keputusan removal telah locked".
  - `pages/tasks.vue`, `pages/expenses.vue`, `pages/projects/create.vue`, `pages/projects/[id]/edit.vue` — dibiarkan ada di disk (tidak ditautkan dari navigation baru), menunggu fase Project Management/Finance/Opportunity-to-Project untuk diadaptasi/direpurpose. Route ini tetap bisa diakses langsung via URL tapi tidak lagi bagian dari IA aktif.
  - `public/logo.svg`, `public/daffascript.svg` — sudah tidak direferensikan (logo diganti icon+text placeholder), tapi file dibiarkan ada (bukan bagian scope cleanup yang diminta eksplisit).
- **Files created:** 8 folder/berkas baru — `app/types/*.ts` (7 file: common, user, party, opportunity, project, vendor, finance, activity), `app/constants/*.ts` (3 file: status, roles, navigation), `app/data/*.ts` (8 file: users, parties, opportunities, vendors, projects, finance, activity, index), `app/utils/format.ts`, `app/utils/attention.ts`, `app/composables/useCurrentUser.ts`, `app/composables/usePermissions.ts`, `app/components/shared/*.vue` (11 komponen: PageHeader, Breadcrumb, StatusBadge, EmptyState, LoadingState, ErrorState, AttentionIndicator, SectionCard, DetailMetadataList, ModulePlaceholder, RoleAccessState), `app/components/ui/tabs/*` (4 file + index), route baru — `app/pages/crm/{index,prospects,clients,opportunities,quotations}.vue`, `app/pages/vendors/index.vue`, `app/pages/finance/{index,invoices,payments}.vue`, `app/pages/reports/index.vue`, `app/pages/admin/{index,master-data,users,roles,audit-trail}.vue`, `app/pages/settings.vue`.
- **Files changed:** `nuxt.config.ts` (app identity, `components` dir baru `~/components/shared`), `app/components/layout/AppSidebar.vue` (navigasi baru berbasis `NAV_ITEMS`, role-visibility, logo placeholder), `app/components/layout/TopHeader.vue` (title dinamis dihapus demi PageHeader per-halaman, badge role, hapus tombol dekoratif "Add Widget"/"Export"/date range palsu), `app/pages/index.vue` (dashboard ditulis ulang total memakai fixture), `app/pages/login.vue` (rebrand MANOVA), `app/pages/projects/index.vue` (list ditulis ulang memakai fixture, bukan data hardcoded lama), `app/pages/projects/[id]/index.vue` (Project Detail shell ditulis ulang total — 1589 baris lama diganti shell baru berbasis fixture+tab), `assets/css/tailwind.css` (hapus `.gradient-primary`).
- **Files removed:** `app/utils/cn.ts`, `app/components/dashboard/AIAssistant.vue` (lihat alasan & dependency check di atas).
- **Existing components reused:** seluruh 15 primitive `ui/*` (Table, Badge, Card, Button, Input, Popover, Tooltip, Avatar, Separator, dll.), `dashboard/StatsCard.vue` (dipakai apa adanya di Dashboard, CRM overview, dan Finance overview), pola layout `dashboard.vue`/`AppSidebar.vue`/`TopHeader.vue` (struktur dipertahankan, isi diadaptasi), `useSidebar.ts`/`useIsMobile.ts` (dipertahankan tanpa perubahan).
- **Validation:**
  - `pnpm exec nuxt prepare` — sukses.
  - `pnpm run build` — **sukses (exit 0), dijalankan 3x setelah perubahan** ("✨ Build complete!"), seluruh route baru (crm, opportunities, vendors, finance, invoices, payments, reports, admin, master-data, users, roles, audit-trail, settings, prospects, clients, quotations, dashboard, `_id_`) terkompilasi tanpa error.
  - Lint — **tidak dapat dijalankan** (tidak ada script `lint`, `eslint` inti belum terpasang) — pre-existing gap, **tidak diinstal pada tahap ini** (lihat keterangan Q8 di `docs/mockup-open-questions.md`, kebijakan penambahan package D-036 diterapkan konservatif).
  - Typecheck — **tidak dapat dijalankan** (`nuxi typecheck` butuh `vue-tsc` yang belum terpasang) — pre-existing gap, sama seperti di atas, tidak diinstal.
  - Test — `pnpm exec vitest run` dijalankan, hasil "No test files found, exiting with code 1" — **pre-existing (0 test file sejak awal template, bukan regresi dari tahap ini)**.
  - Smoke test manual: build di-preview (`node .output/server/index.mjs`) lalu di-curl untuk 11 route (`/`, `/login`, `/projects`, `/projects/PRJ-101`, `/projects/PRJ-999`, `/crm`, `/vendors`, `/finance`, `/admin`, `/settings`, route tak dikenal) — **seluruhnya HTTP 200**, tanpa stack trace/error di HTML, not-found state Project Detail tampil benar untuk ID tak dikenal, loading-state dashboard tampil benar saat SSR (baru terisi data setelah hydration client, sesuai desain simulasi).
- **Decisions:** Tidak ada keputusan LOCKED baru yang mengubah IA/route/role (implementasi mengikuti keputusan existing apa adanya). Klarifikasi implementasi dicatat sebagai D-041–D-044 di `docs/mockup-design-decisions.md`.
- **Open issues:** Q8 (tooling lint/typecheck) **tetap belum terselesaikan** meski dicatat harus selesai "di dalam fase Foundation" — diputuskan untuk TIDAK menginstal `eslint`/`vue-tsc` pada tahap ini karena Prompt 5 sendiri tidak secara eksplisit memerintahkan instalasi package baru, dan kebijakan D-036 mengutamakan kehati-hatian; status Q8 diperbarui menjadi tetap blocking sebelum fase CRM, sekarang dengan catatan tambahan ini. Q7/Q9/Q10/Q11 tidak berubah.
- **Next recommended prompt:** Keputusan Q8 (lint/typecheck tooling) sebaiknya diselesaikan secara eksplisit (instal `eslint`+config, putuskan `vue-tsc`) sebelum atau di awal Prompt 6 (CRM), lalu lanjut ke modul CRM sesuai phasing `docs/template-reuse-mapping.md` bagian I. Menunggu perintah user — tidak dieksekusi otomatis.

## Entri 7 — Prompt 19: Change Request — Customer Journey, Account Executive, Supplier, dan Commercial Approval

- **Date:** 2026-07-30
- **Phase:** Prompt 19 (`prompts/21-PROMPT-19-CHANGES-&-UPDATE.md`) — change request di atas mockup 18-section yang sudah COMPLETED (Section 00–18, lihat `docs/mockup-section-progress.md`).
- **Status:** Selesai.
- **Completed:** Ringkasan singkat — narasi lengkap sengaja **tidak diduplikasi di sini** (konsisten prinsip "hapus duplikasi hanya bila maknanya benar-benar sama", sesuai catatan `docs/mockup-section-reports/README.md`). Detail penuh: `docs/mockup-section-reports/change-customer-journey-ae-supplier.md`. Ringkasan: 2 role baru (Account Executive, Supplier — total 13 role); entitas `Lead`/`LeadActivity` baru; Commercial Approval workflow pada Quotation (terpisah dari Won approval existing); modul baru Customer Journey (`/customer-journey/*`: Dashboard, Leads Table/Kanban/Inbox+drawer, Customers, Project Orders, Lead Source Recap — Customers/Project Orders mereuse `Party`/`Project` existing, bukan entitas paralel); Activity Center (`/activity-center`, Super Admin); Supplier Portal (`/supplier/*`, vendor-isolated) + tab "Products" baru di Vendor Detail; `Opportunity.ownerId` di-reassign dari Sales ke AE.
- **Files changed:** Lihat `docs/mockup-change-impact-log.md` (entri CI baru) dan laporan perubahan untuk daftar lengkap.
- **Validation:** `npx nuxi prepare` + `npm run build` sukses; smoke test HTTP seluruh route baru dan existing (curl); verifikasi konten (Commercial Approval badge, isolasi supplier per vendor, angka Lead Source Recap dihitung ulang manual dan cocok); `vitest`/`typecheck` tetap pre-existing gap (Q8).
- **Decisions:** D-046 s/d seterusnya dicatat di `docs/mockup-design-decisions.md` Kelompok I.
- **Open issues:** Q8 tetap terbuka. Lihat laporan perubahan bagian Known Issues untuk daftar lengkap.
- **Next recommended prompt:** Tidak ada section mockup baku selanjutnya (18 section sudah COMPLETED) — menunggu perintah user untuk perubahan/permintaan berikutnya.
