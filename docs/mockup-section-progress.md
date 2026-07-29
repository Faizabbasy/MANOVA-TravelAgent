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

---

*(Belum ada entri Section 06 ke atas — belum dieksekusi pada saat dokumen ini ditulis.)*
