# Mockup Section Progress — MANOVA

Log **append-only** sesuai `prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md` bagian A. Entri baru ditambahkan di bagian bawah; histori lama tidak dihapus atau ditimpa.

Dokumen ini memakai skema field standar protokol (Section ID/nama, Status, Scope, Files, Routes, Components, Data/types/constants, Validation, Known issues, Cross-section impact, Next action) — berbeda dari `docs/mockup-progress.md` yang memakai skema naratif lama (Date/Phase/Completed/Decisions/dst.). Kedua dokumen mencatat fakta yang sama untuk Section 00–05; tidak ada isi yang bertentangan. Entri di bawah adalah **rekonstruksi retroaktif** ke skema baru berdasarkan `docs/mockup-progress.md` Entri 1–6 dan pemeriksaan langsung codebase, disusun saat protokol ini mulai diberlakukan secara formal (2026-07-29) — bukan ditulis real-time saat section aslinya dikerjakan.

Status yang dipakai: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `BLOCKED`, `NEEDS_REVIEW`, `DEFERRED`.

---

## Section 00 — Konteks Bisnis dan Aturan Kerja

- **Tanggal:** 2026-07-29
- **Status:** COMPLETED
- **Scope dan completed items:** Membaca dan mengonfirmasi domain MANOVA, tipe project, alur bisnis, entitas, 11 role, kebutuhan dashboard, skenario data demo, prinsip reuse, aturan teknis, source of truth dokumentasi, aturan pelaporan. Murni pembacaan konteks — tidak ada kode/halaman/package yang diubah.
- **Files created/changed/removed:** Tidak ada.
- **Routes affected:** Tidak ada.
- **Components reused/created:** Tidak ada.
- **Data/types/constants affected:** Tidak ada.
- **Validation results:** Tidak berlaku (tidak ada kode diubah).
- **Known issues:** Tidak ada pada tahap ini.
- **Cross-section impact:** Tidak ada.
- **Next action:** Lanjut ke Section 01 — Audit Template dan Codebase.

## Section 01 — Audit Template dan Codebase

- **Tanggal:** 2026-07-29
- **Status:** COMPLETED
- **Scope dan completed items:** Audit read-only menyeluruh: foundation project (versi/package/config), struktur codebase, UI & design system, fitur/halaman, data & state, kualitas codebase (build/lint/typecheck/test). Tidak ada implementasi, rename, penggantian data, penghapusan, instalasi package, atau refactor pada tahap ini.
- **Files created/changed/removed:** Dibuat — `docs/template-audit.md`, `docs/mockup-progress.md`.
- **Routes affected:** Tidak ada (audit read-only).
- **Components reused/created:** Tidak ada.
- **Data/types/constants affected:** Tidak ada.
- **Validation results:** `npm run build` sukses (exit 0, dijalankan 2x); lint/typecheck/test tidak dapat dijalankan (tooling belum dikonfigurasi — dicatat sebagai temuan).
- **Known issues:** Data mock (Project/Task/Expense) tidak konsisten lintas halaman (2–3 shape per entitas, 1 project orphan `PRJ-005`); bug nyata `handleDelete` tidak terdefinisi di `expenses.vue`; 9 dari 13 menu sidebar dead-link; tidak ada RBAC/role mock; tidak ada formatter currency/date bersama; tidak ada tooling lint/typecheck/test berfungsi.
- **Cross-section impact:** Tidak ada (temuan menjadi input Section 02).
- **Next action:** Lanjut ke Section 02 — Gap Analysis dan Template Reuse Mapping.

## Section 02 — Gap Analysis dan Template Reuse Mapping

- **Tanggal:** 2026-07-29
- **Status:** COMPLETED
- **Scope dan completed items:** Gap analysis dan reuse mapping murni dokumentasi. Mapping Matrix 9 route existing → kategori reuse; Component Reuse Matrix 19 kebutuhan komponen; Data Model Gap; Navigation Gap (13 menu, 9 dead link); fitur tidak relevan dengan rekomendasi tanpa eksekusi hapus; rekomendasi phasing 11 tahap.
- **Files created/changed/removed:** Dibuat — `docs/template-reuse-mapping.md`, `docs/mockup-scope.md`, `docs/mockup-design-decisions.md`, `docs/mockup-open-questions.md`. Diupdate — `docs/mockup-progress.md`.
- **Routes affected:** Tidak ada (tidak ada route/sidebar diubah, tidak ada halaman baru).
- **Components reused/created:** Tidak ada.
- **Data/types/constants affected:** Tidak ada.
- **Validation results:** Tidak berlaku — tidak ada kode diubah.
- **Known issues:** 8 open question awal (Q1–Q8) dicatat, belum diresolusi.
- **Cross-section impact:** Tidak ada.
- **Next action:** Lanjut ke Section 03 — Information Architecture, Route, Role, dan Workflow.

## Section 03 — Information Architecture, Route, Role, dan Workflow

- **Tanggal:** 2026-07-29
- **Status:** COMPLETED
- **Scope dan completed items:** Finalisasi IA — 9 kelompok baseline dievaluasi; Operations & Travelers melebur jadi tab Project Detail, Vendor tetap top-level; CRM disederhanakan 4 sub-menu. Route inventory lengkap per kelompok. Project Detail dikonsolidasi 6→8 tab final, single-route dengan state client-side. Model Party/Prospect/Client dirinci. Opportunity-to-Project workflow lengkap (diagram + checklist efek Won + role model dua-langkah). Project Status (8 status) dan Service Status generik dirancang. Role & Access Matrix 11 role x 6 modul x 5 level. Dashboard Role Behavior dirancang.
- **Files created/changed/removed:** Dibuat — `docs/mockup-information-architecture.md`, `docs/route-and-role-matrix.md`. Diupdate — `docs/mockup-design-decisions.md` (+14 entri LOCKED), `docs/mockup-open-questions.md` (Q1–Q6 RESOLVED, +Q9), `docs/mockup-scope.md`, `docs/mockup-progress.md`.
- **Routes affected:** Tidak ada perubahan kode — murni rancangan/desain route yang akan diimplementasikan section berikutnya.
- **Components reused/created:** Tidak ada (rancangan reuse dicatat, belum dieksekusi).
- **Data/types/constants affected:** Tidak ada.
- **Validation results:** Tidak berlaku — tidak ada kode diubah.
- **Known issues:** Q7 (vee-validate/zod) dan Q8 (tooling) tetap terbuka; Q9 baru (threshold numerik attention, sengaja ditunda).
- **Cross-section impact:** Keputusan D-018 s/d D-031 di section ini menjadi dasar LOCKED untuk seluruh section implementasi berikutnya (Section 05 ke atas) — termasuk keputusan eksplisit bahwa penghapusan fisik `AIAssistant.vue` (D-023) ditunda sampai Section 05. Lihat `docs/mockup-change-impact-log.md` entri CI-001.
- **Next action:** Lanjut ke Section 04 — Membuat dan Memperbarui Dokumentasi.

## Section 04 — Membuat dan Memperbarui Dokumentasi

- **Tanggal:** 2026-07-29
- **Status:** COMPLETED
- **Scope dan completed items:** Merapikan seluruh `docs/` menjadi source of truth sebelum coding. `mockup-design-decisions.md` direstrukturisasi total ke format decision-record (D-001–D-040). `mockup-scope.md` dilengkapi (objective, context, users, assumptions, constraints, acceptance criteria, DoD). `mockup-data-scenarios.md` dibuat baru (3 skenario: Normal/Manila, High-Change/Abu Dhabi, Complex/Palu + 1 Lost Opportunity + 7 skenario tambahan). `mockup-open-questions.md` direstrukturisasi (ID/Category/Impact/Recommendation/Owner/Status/Blocking). `route-and-role-matrix.md` dan `template-reuse-mapping.md` dilengkapi kolom wajib. Document consistency check lintas 9 file dijalankan.
- **Files created/changed/removed:** Diupdate — `mockup-design-decisions.md`, `mockup-scope.md`, `mockup-open-questions.md`, `route-and-role-matrix.md`, `template-reuse-mapping.md`, `mockup-progress.md`. Dibuat baru — `mockup-data-scenarios.md`.
- **Routes affected:** Tidak ada — tidak ada file `app/**` yang diubah pada tahap ini.
- **Components reused/created:** Tidak ada.
- **Data/types/constants affected:** Tidak ada (skenario data baru masih dokumentasi, belum jadi fixture kode).
- **Validation results:** Tidak berlaku untuk kode; consistency check antar-dokumen dijalankan dan lulus (nama module/route/role/status konsisten, tidak ada referensi file yang tidak ada).
- **Known issues:** Q7 non-blocking; Q8 blocking sebelum implementasi modul (harus selesai dalam fase Foundation); Q9/Q10/Q11 deferred.
- **Cross-section impact:** Tidak ada.
- **Next action:** Lanjut ke Section 05 — Bersihkan Template dan Siapkan Foundation (menunggu perintah user).

## Section 05 — Bersihkan Template dan Siapkan Foundation

- **Tanggal:** 2026-07-29
- **Status:** COMPLETED (foundation coding pertama; modul bisnis penuh — CRM, Opportunity, Operations, Vendor, Finance — **belum** dikerjakan, sesuai batasan tahap ini)
- **Scope dan completed items:** Coding pertama di atas seluruh dokumentasi Section 00–04. App identity rebrand ke MANOVA; navigation dibangun ulang dari satu source of truth (`NAV_ITEMS`) dengan role-visibility mock; type foundation, status/role constants, dummy data terpusat (3 project + 4 party + fixture terkait), formatter Rupiah/tanggal, helper attention, current user & role mock + permission helper; 11 shared UI component + primitive `ui/tabs`; route foundation aktif untuk seluruh IA (sebagian shell nyata dengan fixture, sebagian `ModulePlaceholder` berlabel). Detail lengkap: `docs/mockup-section-reports/section-05-foundation.md`.
- **Files created:** 8 file type (`app/types/*.ts`), 3 file constant (`app/constants/*.ts`), 8 file data + barrel (`app/data/*.ts`), `app/utils/format.ts`, `app/utils/attention.ts`, `app/composables/useCurrentUser.ts`, `app/composables/usePermissions.ts`, 11 komponen `app/components/shared/*.vue`, 4 file + index `app/components/ui/tabs/`, route baru `app/pages/crm/*`, `app/pages/vendors/index.vue`, `app/pages/finance/*`, `app/pages/reports/index.vue`, `app/pages/admin/*`, `app/pages/settings.vue`.
- **Files changed:** `nuxt.config.ts`, `app/components/layout/AppSidebar.vue`, `app/components/layout/TopHeader.vue`, `app/pages/index.vue`, `app/pages/login.vue`, `app/pages/projects/index.vue`, `app/pages/projects/[id]/index.vue`, `assets/css/tailwind.css`.
- **Files removed:** `app/utils/cn.ts` (duplikat `lib/utils.ts`, dependency-checked), `app/components/dashboard/AIAssistant.vue` (sesuai D-023, dependency-checked).
- **Routes affected:** Lihat `docs/mockup-implementation-state.md` bagian 2 untuk klasifikasi lengkap (aktif-nyata vs placeholder vs lama-tidak-ditautkan vs excluded).
- **Components reused:** 15 primitive `ui/*` lama, `dashboard/StatsCard.vue`, layout `dashboard.vue`/`AppSidebar.vue`/`TopHeader.vue` (struktur dipertahankan), `useSidebar.ts`/`useIsMobile.ts`.
- **Components created:** 11 shared component + 4 primitive `ui/tabs` (rincian di atas).
- **Data/types/constants affected:** Seluruh type/constant/fixture di atas dibuat baru pada section ini (belum ada sebelumnya).
- **Validation results:** `pnpm exec nuxt prepare` sukses; `pnpm run build` sukses (exit 0, 3x run); lint tidak dapat dijalankan (belum ada script/`eslint` core); typecheck tidak dapat dijalankan (`vue-tsc` belum terpasang); test — "No test files found" (pre-existing, bukan regresi); smoke test manual 11 route via curl — seluruhnya HTTP 200. **Divalidasi ulang saat penyusunan dokumen continuity ini (2026-07-29): build kembali sukses, hasil test/lint/typecheck konsisten dengan temuan asli.**
- **Known issues:** Q8 (tooling lint/typecheck) tetap terbuka, eksplisit blocking sebelum Section 06; bug `handleDelete` di `expenses.vue` belum diperbaiki (route belum ditautkan navigasi).
- **Cross-section impact:** Eksekusi keputusan D-023 (removal `AIAssistant.vue`, diputuskan Section 03) — lihat `docs/mockup-change-impact-log.md` entri CI-001.
- **Next action:** Selesaikan Q8 (tooling lint/typecheck) sebelum atau di awal Section 06 (Dashboard), lalu lanjut sesuai phasing `docs/template-reuse-mapping.md` bagian I. Menunggu perintah user — tidak dieksekusi otomatis.

## Section 06 — Dashboard

- **Tanggal:** 2026-07-29
- **Status:** COMPLETED
- **Scope dan completed items:** Menyelesaikan Dashboard final di `/` berbasis fixture terpusat, role-aware, sesuai `docs/route-and-role-matrix.md` bagian 6 (D-031, LOCKED). Widget diimplementasikan 1:1 per role: Management/Viewer (Opportunity Pipeline, Active Projects by Status, Budget vs Actual, Outstanding Invoices, Attention, Recent Activity), Sales (Pipeline, Quotations Menunggu Keputusan), Project Manager (Active Projects Milik Saya, Upcoming Departures, Attention Milik Saya, Milestone/Task Mendatang, Change History Ringkas), Operations/Ticketing/Accommodation/Transportation/MICE (Service Readiness ter-scope per sub-domain, Upcoming Departures), Finance (Budget vs Actual, Cost Breakdown, Outstanding), Super Admin (superset + Ringkasan Administrasi). Filter (status, tipe project, client, owner, periode keberangkatan) ditambahkan dan berlaku ke seluruh widget berbasis Project.
- **Files created:** `app/components/shared/StatusBreakdownList.vue`.
- **Files changed:** `app/pages/index.vue` (rewrite total), `app/components/dashboard/BudgetChart.vue`, `ExpenseCategories.vue`, `RecentActivity.vue` (diadaptasi dari hardcoded fake data ke fixture nyata), `app/utils/attention.ts` (+`isTaskUpcoming`, +`UPCOMING_TASK_WINDOW_DAYS`), `app/data/index.ts` (+4 selector), `app/data/opportunities.ts` (+3 Opportunity, +2 Quotation), `app/data/activity.ts` (+2 Task).
- **Files removed:** Tidak ada.
- **Routes affected:** `/` (final, sebelumnya shell Section 05).
- **Components reused:** `StatsCard.vue` (apa adanya), 15 primitive `ui/*` termasuk `ui/select` (pemakaian nyata pertama).
- **Components created:** `StatusBreakdownList.vue`.
- **Data/types/constants affected:** Fixture `OPPORTUNITIES`/`QUOTATIONS`/`TASKS` diperluas (lihat `docs/mockup-change-impact-log.md` CI-002); tidak ada perubahan `app/types/*`/`app/constants/*`.
- **Validation results:** `npx nuxi prepare` sukses; `npm run build` sukses (2x run); smoke test curl 9 route → seluruhnya HTTP 200; verifikasi tekstual bundle server mengonfirmasi widget baru ter-compile; `npx vitest run` → 0 test file (pre-existing); `npx nuxi typecheck` → gagal, `vue-tsc` tidak terpasang (Q8, pre-existing); lint tidak tersedia (Q8, pre-existing). Verifikasi browser interaktif/hydrated **tidak dilakukan** — tidak ada tool headless browser tersedia di lingkungan ini.
- **Known issues:** Q8 tetap terbuka (user memerintahkan Section 06 dikerjakan langsung tanpa menyelesaikannya lebih dulu); "Follow-up/activity mendatang milik sendiri" (Sales) belum dapat diimplementasikan (data model Activity level-Party/Opportunity belum ada); "Cost breakdown" Finance per-project bukan per jenis layanan (keterbatasan fixture).
- **Cross-section impact:** Lihat `docs/mockup-change-impact-log.md` CI-002 (perluasan fixture Section 05) dan CI-003 (adaptasi komponen dashboard dan rewrite halaman Dashboard Section 05).
- **Next action:** Section 07 — CRM Party. Rekomendasi eksplisit: selesaikan Q8 (tooling lint/typecheck) sebelum atau di awal Section 07. Menunggu perintah user — tidak dieksekusi otomatis.

## Section 07 — CRM Party

- **Tanggal:** 2026-07-29
- **Status:** COMPLETED
- **Scope dan completed items:** Party/customer list dan detail, Prospect list, Client list, Contact person, Activity history (level-Party, entitas baru `PartyActivity`), summary opportunity/project, search/filter/sort, create/edit frontend mock (Prospect, Contact, Activity — mutasi nyata via `reactive()` fixture), empty/not-found states, role behavior. Party Detail 5-tab: Overview/Contacts/Opportunities/Activities/Projects* (kondisional Client + ≥1 project). Widget Dashboard Sales "Follow-up Mendatang" (deferred Section 06) diisi.
- **Files created:** `app/pages/crm/parties/[id]/index.vue`.
- **Files changed:** `app/pages/crm/prospects.vue`, `app/pages/crm/clients.vue` (rewrite total dari `ModulePlaceholder`), `app/pages/index.vue` (+widget Follow-up Mendatang, minimal), `app/data/parties.ts` (`reactive()` + `PARTY_ACTIVITIES`), `app/data/index.ts` (+6 selector/helper), `app/types/party.ts` (+3 type), `app/constants/status.ts` (+`PARTY_ACTIVITY_TYPES`), `app/constants/navigation.ts` (`comingSoon` dihapus dari Prospects/Clients), `app/utils/attention.ts` (+2 export), `app/components/shared/SectionCard.vue` (+slot `#actions`, backward-compatible).
- **Files removed:** Tidak ada.
- **Routes affected:** `/crm/prospects` (real), `/crm/clients` (real), `/crm/parties/[id]` (baru).
- **Components reused:** `SectionCard`, `EmptyState`, `RoleAccessState`, `StatusBadge`, `DetailMetadataList`, `PageHeader`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, `Table*`, `Dialog*`, `Label`, `Input`, `Button` (Dialog dipakai nyata pertama kali di luar `expenses.vue`).
- **Components created:** Tidak ada file baru (SectionCard diperluas, bukan komponen baru).
- **Data/types/constants affected:** `Party`/`ContactPerson` tidak berubah shape; `+PartyActivity`. `PARTIES`/`CONTACTS`/`PARTY_ACTIVITIES` jadi `reactive()` — lihat CI-004.
- **Validation results:** `npx nuxi prepare` dan `npm run build` sukses; smoke test curl 9 route (termasuk `/crm/parties/PTY-999` not-found) seluruhnya HTTP 200 dengan konten nyata terkonfirmasi; `vitest`/`typecheck`/lint tetap pre-existing gap (Q8). Interactive/hydrated browser verification tidak dilakukan (keterbatasan tooling).
- **Known issues:** Q8 tetap terbuka (section ketiga berturut-turut); pagination mock sengaja tidak dibuat (volume data terlalu kecil untuk affordance nyata); `/crm/opportunities` belum di-groupby-stage (Section 08).
- **Cross-section impact:** `docs/mockup-change-impact-log.md` CI-004 (fixture Party jadi reactive + entitas baru, milik Section 05), CI-005 (widget Dashboard Follow-up Mendatang, milik Section 06), CI-006 (SectionCard `#actions` slot, milik Section 05).
- **Next action:** Section 08 — Opportunity dan Quotation. Rekomendasi kuat: selesaikan Q8 sebelum atau di awal Section 08. Menunggu perintah user — tidak dieksekusi otomatis.

## Section 08 — Opportunity dan Quotation

- **Tanggal:** 2026-07-30
- **Status:** COMPLETED
- **Scope dan completed items:** Opportunity list (`/crm/opportunities`) dengan pipeline visualization (reuse `StatusBreakdownList`), filter stage/party/search; Opportunity Detail (`/crm/opportunities/[id]`, baru) dengan stage stepper (Draft s/d WonRequested, Lost, On Hold), Owner/value/requirement/destination/travel date/traveler estimate/service scope, Quotation summary dengan create-mock (saat lanjut ke Proposal) dan revisi (version mock), Activity/follow-up (reuse `PartyActivity` Section 07 dengan `opportunityId` opsional baru). Won penuh (approve + Project) sengaja TIDAK dikerjakan (scope Section 09).
- **Files created:** `app/pages/crm/opportunities/index.vue`, `app/pages/crm/opportunities/[id]/index.vue`.
- **Files changed:** `app/types/opportunity.ts` (+7 field `Opportunity`, +2 field `Quotation`), `app/types/party.ts` (+`opportunityId?` pada `PartyActivity`), `app/data/opportunities.ts` (`reactive()`, field lengkap, QUO-005 versi 2), `app/data/parties.ts` (backfill `opportunityId`), `app/data/index.ts` (+5 selector/mutator), `app/pages/crm/parties/[id]/index.vue` (tab Opportunities kini link ke detail).
- **Files removed:** `app/pages/crm/opportunities.vue` (dipindah isinya ke `opportunities/index.vue` — lihat bug routing di bawah).
- **Routes affected:** `/crm/opportunities` (rewrite lokasi file), `/crm/opportunities/[id]` (baru).
- **Components reused:** `StatusBreakdownList`, `SectionCard` (+`#actions`), `Dialog*`, `Table*`, `StatusBadge`, `DetailMetadataList`, `PageHeader`, `EmptyState`, `RoleAccessState`.
- **Components created:** Tidak ada.
- **Data/types/constants affected:** `Opportunity`/`Quotation` diperluas (lihat bagian Files changed); `OPPORTUNITIES`/`QUOTATIONS` jadi `reactive()` (CI-007).
- **Validation results:** `nuxi prepare` + `npm run build` sukses 2x. **Bug ditemukan saat verifikasi konten** (bukan hanya status code): `/crm/opportunities/[id]` ter-resolve ke 404 catch-all karena konflik file datar `opportunities.vue` vs direktori `opportunities/[id]/`, meski build sukses dan curl awal melaporkan HTTP 200. Diperbaiki dengan memindah list page ke `opportunities/index.vue`; rebuild dan re-verifikasi konten (title dinamis, string spesifik per skenario) mengonfirmasi benar. `vitest`/`typecheck`/lint tetap pre-existing gap (Q8).
- **Known issues:** Q8 tetap terbuka (4 section berturut-turut); "Stepper adaptasi create.vue" dan "pipeline chart baru" dari rancangan awal disederhanakan (badge stepper, reuse StatusBreakdownList) — didokumentasikan, bukan penyimpangan diam-diam.
- **Cross-section impact:** `docs/mockup-change-impact-log.md` CI-007 (fixture Opportunity/Quotation jadi reactive + field baru, milik Section 05/06), CI-008 (PartyActivity `opportunityId` + backfill, milik Section 07), CI-009 (Party Detail Opportunities tab ditaut ke detail, milik Section 07).
- **Next action:** Section 09 — Opportunity Won to Project. Rekomendasi sangat kuat: selesaikan Q8 sebelum Section 09. Menunggu perintah user — tidak dieksekusi otomatis.

## Section 09 — Opportunity Won to Project

- **Tanggal:** 2026-07-30
- **Status:** COMPLETED
- **Scope dan completed items:** Permission check (`canApprove('crm')` — Management/Super Admin), confirmation dialog (Approve dan Reject), requirement validation (`getOpportunityMissingRequirements` — destinasi/tanggal/traveler/quotation), stage `WonRequested → Won`, Project otomatis dibuat (seluruh checklist LOCKED bagian 2.2: partyId+lifecycle transition, data dasar, service scope, budget/quotation reference, activity log, toast feedback, redirect ke Project Detail), duplicate prevention (guard `projectId` sudah ada), mock persistence jujur (`reactive()` array, bukan backend).
- **Files created:** `app/composables/useToast.ts`, `app/components/shared/ToastContainer.vue`.
- **Files changed:** `app/types/project.ts` (+`sourceQuotationId?`), `app/data/projects.ts` (`reactive()`), `app/data/activity.ts` (`reactive()`), `app/data/opportunities.ts` (OPP-005 → `won-requested`), `app/data/index.ts` (+`getOpportunityMissingRequirements`, `+approveOpportunityWon`, `+rejectOpportunityWon`), `app/layouts/dashboard.vue` (+`<ToastContainer />`), `app/pages/crm/opportunities/[id]/index.vue` (+Approve/Reject UI, requirement validation display).
- **Files removed:** Tidak ada.
- **Routes affected:** Tidak ada route baru — interaksi terjadi di `/crm/opportunities/[id]` (Section 08), hasil muncul di `/projects`/`/projects/[id]` (Section 05).
- **Components reused:** `Dialog*`, `Button`, `Label`, `Input`, `SectionCard`.
- **Components created:** `ToastContainer.vue` (diekstrak dari pola lokal `expenses.vue`).
- **Data/types/constants affected:** `Project.sourceQuotationId` (baru); `PROJECTS`/`ACTIVITIES` jadi `reactive()`; `OPP-005` dimajukan ke `won-requested` (seed, demonstrasi siap-pakai).
- **Validation results:** `nuxi prepare` + `npm run build` sukses. Smoke test konten (bukan hanya status code, mengikuti pelajaran Section 08) mengonfirmasi kondisi pra-aksi benar: `OPP-005` menampilkan tombol Approve/Reject untuk Super Admin, `PTY-004` masih Prospect, `/projects` masih 3 project. **Verifikasi klik-interaktif end-to-end tidak dapat dilakukan** (tidak ada tool browser headless) — dimitigasi lewat code review ketat terhadap checklist LOCKED. `vitest`/`typecheck`/lint tetap pre-existing gap (Q8).
- **Known issues:** Q8 tetap terbuka (5 section berturut-turut); verifikasi interaktif end-to-end tidak dilakukan langsung; `DEFAULT_PROJECT_OWNER_ID` (PM default) adalah keputusan sementara tanpa alur assignment manual.
- **Cross-section impact:** `docs/mockup-change-impact-log.md` CI-010 (Project/Activity fixture jadi reactive + field baru, milik Section 05), CI-011 (toast diekstrak dari `expenses.vue`, milik Section 05/pre-existing template), CI-012 (OPP-005 dimajukan ke won-requested, milik Section 08).
- **Next action:** Section 10 — Project Core. Rekomendasi sangat kuat: selesaikan Q8 sebelum Section 10. Menunggu perintah user — tidak dieksekusi otomatis.

## Section 10 — Project Core

- **Tanggal:** 2026-07-30
- **Status:** COMPLETED
- **Scope dan completed items:** Project list dengan search/filter (status, tipe, client, owner)/sort (tanggal, nama, budget); status/type/client/destination/travel date/owner/progress (bar linear berdasarkan urutan status)/attention seluruhnya tampil di card; Project Detail Overview tab diperkaya dengan Service Summary, Milestone/Task Summary, Document Summary, dan Recent Activity (reuse `StatusBreakdownList`); conditional section berdasarkan service (sudah alami dari data PROJECT_SERVICES); tiga skenario (Normal/High-Change/Complex) diverifikasi konsisten; loading/empty/not-found states dipertahankan/diperkaya.
- **Files created:** Tidak ada.
- **Files changed:** `app/pages/projects/index.vue` (filter/sort/progress ditambahkan), `app/pages/projects/[id]/index.vue` (Overview tab diperkaya, tab lain tidak diubah).
- **Files removed:** Tidak ada.
- **Routes affected:** `/projects`, `/projects/[id]` (tidak ada route baru).
- **Components reused:** `StatusBreakdownList`, `SectionCard` (+`#actions`), `EmptyState`, `StatusBadge`, `AttentionIndicator`.
- **Components created:** Tidak ada.
- **Data/types/constants affected:** Tidak ada — murni presentasi di atas data existing.
- **Validation results:** `nuxi prepare` + `npm run build` sukses. Smoke test konten (bukan hanya status code) memverifikasi progress bar (40%/20%/60% untuk PRJ-101/102/103, dihitung ulang manual dan cocok), breakdown Service/Task Summary cocok persis fixture, document count benar, regresi tab lain (`?tab=itinerary-services/tasks/finance`) tidak berubah. `vitest`/`typecheck`/lint tetap pre-existing gap (Q8). Verifikasi interaktif klik filter/dropdown tidak dilakukan (tidak ada browser headless).
- **Known issues:** Q8 tetap terbuka (6 section berturut-turut); `ProjectsTable.vue` sengaja tidak disatukan (didokumentasikan, bukan gap tersembunyi — card-grid existing sudah memenuhi seluruh scope literal).
- **Cross-section impact:** Tidak ada entri change-impact-log baru — Section 10 menyelesaikan kepemilikan yang memang didesain untuknya (Section 05 secara eksplisit men-defer isi Overview/filter list ke "phase later", bukan modifikasi tak terduga atas section lain).
- **Next action:** Section 11 — Traveler and Participant. Rekomendasi sangat kuat: selesaikan Q8 sebelum Section 11. Menunggu perintah user — tidak dieksekusi otomatis.

## Section 11 — Traveler and Participant

- **Tanggal:** 2026-07-30
- **Status:** COMPLETED
- **Scope dan completed items:** Mengisi penuh tab "Travelers" pada Project Detail (baseline Foundation sejak Section 05): traveler/participant list dan profile, group dan rooming list, passport/travel document metadata, emergency contact dan special request, missing document indicator, add/edit/remove/import mock, filter (search/group/dokumen belum lengkap), states, dan role behavior (`canManageTravelers` — PM/Super Admin). Tab lain Project Detail tidak disentuh; Overview (Section 10) tidak diubah sama sekali.
- **Files created/changed/removed:** Dibuat — `docs/mockup-section-reports/section-11-traveler-participant.md`. Diubah — `app/types/project.ts` (`Traveler`/`TravelerGroup` diperluas, `+RoomType`, `+RoomAssignment`), `app/data/projects.ts` (`TRAVELER_GROUPS`/`TRAVELERS` jadi `reactive()`, fixture diperluas 1→18 baris, `+ROOM_ASSIGNMENTS`), `app/data/index.ts` (+7 selector/mutator traveler), `app/utils/attention.ts` (+`isTravelerDocumentMissing`, `+PASSPORT_EXPIRY_WARNING_DAYS`), `app/constants/status.ts` (`+ROOM_TYPES`), `app/pages/projects/[id]/index.vue` (tab Travelers ditulis ulang total).
- **Routes affected:** Tidak ada route baru — `/projects/[id]` (tab `travelers`) diisi penuh.
- **Components reused/created:** Reused — `Dialog*`, `Label`, `Input`, `Button`, `Table*`, `SectionCard`, `StatusBadge`, `EmptyState`, `useToast`/`ToastContainer`, dan `Checkbox` (pemakaian nyata pertama). Tidak ada komponen file baru.
- **Data/types/constants affected:** `Traveler`/`TravelerGroup` diperluas (aditif), `+RoomAssignment` (entitas baru), `+ROOM_TYPES` (constant baru). Lihat CI-013.
- **Validation results:** `nuxi prepare` + `npm run build` sukses. Smoke test konten (curl+grep) mengonfirmasi 6/6 traveler "Dokumen Lengkap" di PRJ-101, 2/6 "Dokumen Belum Lengkap" di PRJ-102 (paspor expiring + belum diisi), 1/6 "Dokumen Belum Lengkap" di PRJ-103, rooming list dan group filter tampil benar; regresi tab lain (`?tab=itinerary-services`, `?tab=finance`, `?tab=overview`) dikonfirmasi tidak berubah. `vitest`/`typecheck`/lint tetap pre-existing gap (Q8).
- **Known issues:** Q8 tetap terbuka (tujuh section berturut-turut); CRUD `TravelerGroup` sengaja tidak diimplementasikan (di luar scope literal); profil traveler tetap sampel representatif (6/6/6 dari headcount 6/18/60), didokumentasikan transparan; verifikasi interaktif klik/toggle tidak dilakukan (keterbatasan tooling).
- **Cross-section impact:** `docs/mockup-change-impact-log.md` CI-013 (Traveler/TravelerGroup jadi reactive + field baru + entitas RoomAssignment, milik Section 05).
- **Next action:** Section 12 — Itinerary and Operations. Rekomendasi sangat kuat: selesaikan Q8 sebelum Section 12. Menunggu perintah user — tidak dieksekusi otomatis.

## Section 12 — Itinerary and Operations

- **Tanggal:** 2026-07-30
- **Status:** COMPLETED
- **Scope dan completed items:** Mengisi penuh tab "Itinerary & Services" pada Project Detail (baseline Foundation sejak Section 05): daily itinerary, conditional sub-section Flight/Hotel/Transportation/MICE/Additional Service, booking/reference mock, service status dan readiness (dengan update status role-gated), operational tasks preview, timeline/list pattern (bukan kalender baru), change markers untuk High-Change Project, states, dan role behavior granular per sub-domain (`canManageServiceType`). Tab lain (Vendors, Finance) tidak disentuh; Overview dan Travelers (Section 10/11) tidak diubah kodenya.
- **Files created/changed/removed:** Dibuat — `docs/mockup-section-reports/section-12-itinerary-operations.md`. Diubah — `app/types/project.ts` (`ServiceTypeKey` +`additional`, `ProjectService` +`bookingReference`, `+ItineraryItem`), `app/data/projects.ts` (`PROJECT_SERVICES` jadi `reactive()`, +`bookingReference` pada 5 baris, +1 baris `SVC-1036` additional, `+ITINERARY_ITEMS` 15 baris), `app/data/index.ts` (+`getItineraryItems`, `+updateServiceStatus`), `app/constants/status.ts` (`SERVICE_TYPES` +`additional`), `app/utils/format.ts` (+`formatDayLabel`), `app/pages/projects/[id]/index.vue` (tab Itinerary & Services ditulis ulang total).
- **Routes affected:** Tidak ada route baru — `/projects/[id]` (tab `itinerary-services`) diisi penuh.
- **Components reused/created:** Reused — `SectionCard`, `Table*`, `StatusBadge`, `EmptyState`, `Button`, `useToast`/`ToastContainer`, pola list `divide-y` existing. Tidak ada komponen file baru.
- **Data/types/constants affected:** `ProjectService` diperluas (aditif), `+ItineraryItem` (entitas baru), `SERVICE_TYPES` +`additional` (constant). Lihat CI-014.
- **Validation results:** `nuxi prepare` + `npm run build` sukses. Smoke test konten (curl+grep) mengonfirmasi conditional service section bekerja tepat (PRJ-101 hanya Flight, tidak ada Hotel/Transportation/MICE), banner "Penanda Perubahan" tampil untuk PRJ-102, "Additional Service" tampil untuk PRJ-103 dengan booking reference, readiness fraction presisi per section (Flight 1/2, Hotel 1/1, Transportation 0/1, MICE 1/1, Additional 1/1). Efek fixture ke Overview Service Summary (Confirmed 3→4) diverifikasi presisi, bukan diasumsikan. `vitest`/`typecheck`/lint tetap pre-existing gap (Q8).
- **Known issues:** Q8 tetap terbuka (delapan section berturut-turut); daily itinerary read-only (tidak diminta CRUD di scope); CRUD `ProjectService` (tambah/hapus baris) tidak diimplementasikan (di luar scope literal — hanya update status); verifikasi interaktif klik/ganti-role tidak dilakukan (keterbatasan tooling).
- **Cross-section impact:** `docs/mockup-change-impact-log.md` CI-014 (ProjectService jadi reactive + field baru + entitas ItineraryItem, milik Section 05; dampak terverifikasi ke Service Summary Overview, milik Section 10).
- **Next action:** Section 13 — Vendor Management. Rekomendasi sangat kuat: selesaikan Q8 sebelum Section 13. Menunggu perintah user — tidak dieksekusi otomatis.

## Section 13 — Vendor Management

- **Tanggal:** 2026-07-30
- **Status:** COMPLETED
- **Scope dan completed items:** Membangun `/vendors` (list, filter, create — Super Admin), `/vendors/[id]` (Vendor Detail baru, 4 tab Overview/Services/Quotations/Contacts), dan mengisi tab "Vendors" Project Detail (baseline Foundation) dengan vendor assignment per service, perbandingan quotation, dan aksi Accept/Reject yang mengubah confirmation status (reuse `updateServiceStatus` Section 12). Ditemukan dan dikoreksi inkonsistensi dokumentasi lama (`docs/route-and-role-matrix.md` bagian 0/1.4) soal role Vendor yang tidak sinkron dengan kode `ROLE_MODULE_ACCESS` sejak Foundation.
- **Files created/changed/removed:** Dibuat — `app/pages/vendors/[id]/index.vue`, `docs/mockup-section-reports/section-13-vendor-management.md`. Diubah — `app/types/vendor.ts` (+`VendorContact`, `+VendorQuotation`, `+VendorActivity`, `+VendorDetailTab`), `app/data/vendors.ts` (`VENDORS` jadi `reactive()`, `+VENDOR_CONTACTS`/`VENDOR_QUOTATIONS`/`VENDOR_ACTIVITIES`), `app/data/index.ts` (+9 selector/mutator), `app/constants/status.ts` (`+VENDOR_QUOTATION_STATUSES`), `app/pages/vendors/index.vue` (ditulis ulang), `app/pages/projects/[id]/index.vue` (tab Vendors ditulis ulang).
- **Routes affected:** `/vendors/[id]` (baru); `/vendors` (Section 05 shell) diisi penuh.
- **Components reused/created:** Reused — `Dialog*`, `Table*`, `SectionCard`, `StatusBadge`, `EmptyState`, `Tabs*`, `DetailMetadataList`, `useToast`, dan `canManageServiceType` (Section 12, reuse langsung untuk gerbang Accept/Reject). Tidak ada komponen file baru.
- **Data/types/constants affected:** `Vendor` jadi `reactive()`; `+VendorContact`/`VendorQuotation`/`VendorActivity` (entitas baru); `+VENDOR_QUOTATION_STATUSES` (constant baru). Lihat CI-015.
- **Validation results:** `nuxi prepare` + `npm run build` sukses. Smoke test konten (curl+grep) mengonfirmasi vendor list/detail/not-found benar, skenario comparison Ground Transportation (PRJ-103, Rp45jt vs Rp52jt) tampil tepat dengan tombol Terima/Tolak, regresi tab lain Project Detail tidak berubah. `vitest`/`typecheck`/lint tetap pre-existing gap (Q8).
- **Known issues:** Q8 tetap terbuka (sembilan section berturut-turut); CRUD hapus vendor/contact/quotation tidak diimplementasikan (di luar scope literal); verifikasi interaktif klik Accept/Reject/ganti-role tidak dilakukan (keterbatasan tooling).
- **Cross-section impact:** `docs/mockup-change-impact-log.md` CI-015 (Vendor jadi reactive + entitas baru, milik Section 05; tab Vendors Project Detail diisi, belum ada owner sebelumnya; koreksi dokumentasi role Vendor di route-and-role-matrix.md bagian 0/1.4).
- **Next action:** Section 14 — Project Changes. Rekomendasi sangat kuat: selesaikan Q8 sebelum Section 14. Menunggu perintah user — tidak dieksekusi otomatis.

## Section 14 — Project Changes

- **Tanggal:** 2026-07-30
- **Status:** COMPLETED
- **Scope dan completed items:** Mengisi penuh tab "Activity & Changes" Project Detail: change list/detail (category, reason, requester, before/after), dampak traveler/itinerary/service/vendor/budget, status dan approval mock (Setujui/Tolak, `canApprove('project')`), change timeline kronologis, attention indicator, dan role access (`canLogChange` untuk mengajukan). `ActivityEntry` diperluas aditif — bukan entitas Change paralel (LOCKED IA bagian 4). 4 entri `CHG-*` existing diperkaya (bukan record baru); `CHG-1023` (PRJ-102) jadi skenario approval hidup (`pending`).
- **Files created/changed/removed:** Dibuat — `docs/mockup-section-reports/section-14-project-changes.md`. Diubah — `app/types/activity.ts` (`+ChangeCategory`, `+ChangeApprovalStatus`, `ActivityEntry` +7 field opsional), `app/data/activity.ts` (4 baris `CHG-*` diperkaya), `app/constants/status.ts` (`+CHANGE_CATEGORIES`, `+CHANGE_APPROVAL_STATUSES`), `app/data/index.ts` (+`createChangeEntry`/`approveChangeEntry`/`rejectChangeEntry`), `app/pages/projects/[id]/index.vue` (tab Activity & Changes diperkaya).
- **Routes affected:** Tidak ada route baru — `/projects/[id]` (tab `activity-changes`) diisi penuh.
- **Components reused/created:** Reused — `Dialog*`, `Label`, `Input`, `Button`, `SectionCard`, `StatusBadge`, `AttentionIndicator`, `EmptyState`, `useToast`. Tidak ada komponen file baru.
- **Data/types/constants affected:** `ActivityEntry` diperluas (aditif), `+CHANGE_CATEGORIES`/`CHANGE_APPROVAL_STATUSES` (constant baru). Lihat CI-016.
- **Validation results:** `nuxi prepare` + `npm run build` sukses. Smoke test konten (curl+grep) mengonfirmasi 3 change PRJ-102 (2 Disetujui, 1 Menunggu Approval dengan tombol Setujui/Tolak), before/after dan requester tampil tepat, 1 change PRJ-103 (Disetujui, 20→25 pax). Regresi tab lain (Overview/Travelers/Itinerary & Services/Vendors) dan Dashboard tidak berubah. `vitest`/`typecheck`/lint tetap pre-existing gap (Q8).
- **Known issues:** Q8 tetap terbuka (sepuluh section berturut-turut); tidak ada detail-route terpisah per Change (inline, konsisten single-route); CRUD hapus Change tidak diimplementasikan; verifikasi interaktif tidak dilakukan (keterbatasan tooling).
- **Cross-section impact:** `docs/mockup-change-impact-log.md` CI-016 (ActivityEntry diperluas aditif, milik Section 05; `reviewed` Section 06 tidak diubah maknanya; integrasi Dashboard terjadi otomatis lewat selector existing tanpa perubahan kode Dashboard).
- **Next action:** Section 15 — Project Finance. Rekomendasi sangat kuat: selesaikan Q8 sebelum Section 15. Menunggu perintah user — tidak dieksekusi otomatis.

## Section 15 — Project Finance

- **Tanggal:** 2026-07-30
- **Status:** COMPLETED
- **Scope dan completed items:** Membangun `/finance/invoices` dan `/finance/payments` (dari `ModulePlaceholder`) menjadi list/detail penuh dengan aging dan payment history; merestrukturisasi tab "Finance" Project Detail dengan Budget/Actual/Variance/Quotation/Committed Vendor Cost/Margin dan **visibilitas berbasis role** (Tier 0: Sales/Ops/subdomain hanya Quotation+Outstanding; Tier 1: PM/Finance/Management/SuperAdmin/Viewer full breakdown; Margin dikecualikan untuk PM). Tidak ada perubahan type/fixture — murni selektor turunan baru + tampilan.
- **Files created/changed/removed:** Dibuat — `docs/mockup-section-reports/section-15-project-finance.md`. Diubah — `app/utils/attention.ts` (+`invoiceAgingDays`), `app/data/index.ts` (+`getInvoiceOutstandingIdr`/`getProjectOutstandingIdr`/`getCommittedVendorCostIdr`), `app/pages/finance/invoices.vue` (ditulis ulang dari placeholder), `app/pages/finance/payments.vue` (ditulis ulang dari placeholder), `app/pages/projects/[id]/index.vue` (tab Finance ditulis ulang, role-tiered).
- **Routes affected:** Tidak ada route baru — `/finance/invoices`, `/finance/payments`, dan `/projects/[id]` (tab `finance`) diisi penuh.
- **Components reused/created:** Reused — `StatsCard`, `Table*`, `SectionCard`, `Dialog*`, `DetailMetadataList`, `EmptyState`. Tidak ada komponen file baru.
- **Data/types/constants affected:** Tidak ada — `Invoice`/`Payment` dipakai apa adanya, murni selektor turunan baru.
- **Validation results:** `nuxi prepare` + `npm run build` sukses. Smoke test konten (curl+grep) mengonfirmasi aging invoice (28 & 9 hari overdue) presisi, dan Margin/Variance/Committed Vendor Cost/Outstanding untuk PRJ-101/102/103 seluruhnya cocok persis dengan `docs/mockup-data-scenarios.md` bagian 1.3/2.3/3.3 yang sudah ada sejak Prompt 4. Regresi Section 06/08/10/13/14 terverifikasi tidak berubah. `vitest`/`typecheck`/lint tetap pre-existing gap (Q8).
- **Known issues:** Q8 tetap terbuka (sebelas section berturut-turut); tidak ada CRUD invoice/payment (di luar scope literal); verifikasi interaktif ganti-role tidak dilakukan (keterbatasan tooling).
- **Cross-section impact:** Tidak ada entri change-impact-log baru — tidak ada data/type section lain yang diubah, hanya selektor turunan baru dan pengisian tab/route yang memang belum dikerjakan section manapun (dicatat sejak Section 10 sebagai "menyusul Section 15").
- **Next action:** Section 16 — Reports. Rekomendasi sangat kuat: selesaikan Q8 sebelum Section 16. Menunggu perintah user — tidak dieksekusi otomatis.

## Section 16 — Reports

- **Tanggal:** 2026-07-30
- **Status:** COMPLETED
- **Scope dan completed items:** Membangun `/reports` (dari `ModulePlaceholder` Section 05) menjadi satu halaman dengan 6 section granular: Sales Pipeline, Project Performance, Upcoming Departure dan Service Readiness, Vendor Summary, Budget vs Actual dan Margin, Invoice Aging dan Outstanding — dengan filter (status/tipe/periode project), chart/table (`StatusBreakdownList`/`BudgetChart`/`Table`), states (loading/empty/unauthorized), dan visibilitas per role (pemetaan didokumentasikan di `docs/route-and-role-matrix.md` bagian 1.6 catatan implementasi Section 16). Tidak ada dataset report terpisah — seluruh angka reuse fixture/selektor existing (terutama selektor finansial Section 15).
- **Files created/changed/removed:** Dibuat — `app/pages/reports/index.vue` (rewrite total dari `ModulePlaceholder`), `docs/mockup-section-reports/section-16-reports.md`. Diubah — `app/constants/navigation.ts` (flag `comingSoon` item Reports dihapus, satu baris).
- **Routes affected:** `/reports` (tidak ada route baru — shell Section 05 diisi penuh).
- **Components reused/created:** Reused — `PageHeader`, `SectionCard`, `RoleAccessState`, `LoadingState`, `EmptyState`, `StatusBreakdownList`, `StatsCard`, `BudgetChart`, `Table*`, `Select*`. Tidak ada komponen file baru.
- **Data/types/constants affected:** Tidak ada — murni agregasi read-only di atas `PROJECTS`/`OPPORTUNITIES`/`QUOTATIONS`/`VENDOR_QUOTATIONS`/`INVOICES` dan selektor `app/data/index.ts` existing.
- **Validation results:** `nuxi prepare` + `npm run build` sukses (2x run — run kedua setelah fix `comingSoon`). Smoke test HTTP 8 route seluruhnya 200. Verifikasi bundle server (`reports-*.mjs`) mengonfirmasi 6 judul section ter-compile. Verifikasi angka manual terhadap fixture: Budget/Actual/Variance/Quotation/Margin agregat 3 project, Invoice Aging (28 & 9 hari overdue, cocok Section 15), Committed Vendor Cost Rp1.365.000.000, Sales Pipeline Win Rate 75% — seluruhnya presisi. `vitest`/`typecheck`/lint tetap pre-existing gap (Q8). Verifikasi interaktif ganti-role tidak dilakukan (keterbatasan tooling, konsisten sejak Section 06).
- **Known issues:** Q8 tetap terbuka (dua belas section berturut-turut); export mock tidak dikerjakan (belum disepakati, sesuai hard rule literal); pemetaan role 2 section baru (Upcoming Departure/Service Readiness, Vendor Summary) adalah keputusan implementasi Section 16, bukan perluasan tabel LOCKED; nav item Invoices/Payments masih bertanda `comingSoon: true` (oversight Section 15, ditemukan namun sengaja tidak diperbaiki — di luar scope Section 16).
- **Cross-section impact:** `docs/mockup-change-impact-log.md` CI-017 (flag `comingSoon` nav Reports dihapus, milik Section 05).
- **Next action:** Section 17 — Administration. Rekomendasi sangat kuat: selesaikan Q8 sebelum Section 17. Menunggu perintah user — tidak dieksekusi otomatis.

## Section 17 — Administration

- **Tanggal:** 2026-07-30
- **Status:** COMPLETED
- **Scope dan completed items:** 
  1. User List & Detail Mock: Mengubah `/admin/users` menjadi daftar user lengkap dengan pencarian, filter role, indikator user yang sedang login aktif, serta dialog detail yang menunjukkan permission matrix personal user dan tombol beralih user.
  2. Role Switcher Demo: Membangun kontrol switcher reaktif di `/admin/index.vue` dan `/admin/users.vue` (dialog detail) menggunakan source of truth dari `useCurrentUser()`.
  3. Role & Permission Matrix: Meningkatkan `/admin/roles.vue` dengan visualisasi matrix grid berwarna, penjelasan level akses legend, ringkasan peranan tiap role, dan action flags khusus.
  4. Master Data: Mengisi `/admin/master-data.vue` dengan data referensi tipe project, jenis layanan, destinasi perjalanan, dan kategori vendor menggunakan file konstanta master-data baru.
  5. Audit Trail: Menyelesaikan `/admin/audit-trail.vue` dengan summary stats, filter project/tipe/review status, dan tampilan detail log perubahan (kategori, requester, approval status, before/after, dampak).
  6. Navigasi: Menghapus flag `comingSoon` pada sub-item Administration dan Finance.
- **Files created/changed/removed:**
  - Dibuat: `app/constants/master-data.ts`, `docs/mockup-section-reports/section-17-administration.md`.
  - Diubah: `app/constants/navigation.ts`, `app/pages/admin/index.vue`, `app/pages/admin/users.vue`, `app/pages/admin/roles.vue`, `app/pages/admin/master-data.vue`, `app/pages/admin/audit-trail.vue`, `docs/mockup-change-impact-log.md`.
- **Routes affected:** `/admin`, `/admin/master-data`, `/admin/users`, `/admin/roles`, `/admin/audit-trail`, `/finance/invoices`, `/finance/payments` (tidak ada route baru, fungsionalitas placeholder diisi penuh).
- **Components reused/created:** Reused: `PageHeader`, `SectionCard`, `RoleAccessState`, `EmptyState`, `StatusBadge`, `Table*`, `Dialog*`, `Button`, `Input`.
- **Data/types/constants affected:** Dibuat konstanta baru `MASTER_PROJECT_TYPES`/`MASTER_SERVICE_TYPES`/`MASTER_DESTINATIONS`/`MASTER_VENDOR_CATEGORIES` di `app/constants/master-data.ts`.
- **Validation results:** `nuxi prepare` sukses. `npm run build` sukses melakukan kompilasi penuh client & server build (10.77 detik).
- **Known issues:** Q8 tetap terbuka (tiga belas section berturut-turut); verifikasi interaktif visual ganti-role tidak dilakukan secara headless otomatis (keterbatasan tooling).
- **Cross-section impact:** `docs/mockup-change-impact-log.md` CI-018 (menghapus flag `comingSoon` pada Finance dan Administration).
- **Next action:** Berhenti. Jangan lanjut ke Section 18.
