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

---

*(Belum ada entri Section 08 ke atas — belum dieksekusi pada saat dokumen ini ditulis.)*
