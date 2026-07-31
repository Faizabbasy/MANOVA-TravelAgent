# Mockup Design Decisions — MANOVA

Status dokumen: log keputusan kumulatif lintas tahap, **direstrukturisasi di Prompt 4** ke format decision-record standar (Prompt 4 bagian E). Seluruh isi dari versi sebelumnya (Prompt 2 & 3) dipertahankan — hanya format penyajian yang dirapikan, tidak ada informasi yang dihapus. ID keputusan (`D-001` dst.) mengikuti nomor urut versi sebelumnya secara 1:1 (mis. `D-018` = entri `#18` versi lama) agar referensi silang dari dokumen lain (`mockup-information-architecture.md`, `route-and-role-matrix.md`, `mockup-open-questions.md`) tetap valid.

**Format setiap entri:** Decision ID · Title · Status · Date · Affected files/modules, diikuti Context / Decision / Reason / Consequence.
**Status yang dipakai:** `LOCKED` · `PROPOSED` · `NEEDS_VALIDATION` · `DEFERRED` · `SUPERSEDED`.

---

## Kelompok A — Diwarisi dari Prompt 0 (Konteks Bisnis)

### D-001 — Party Tunggal untuk Prospect dan Client
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** model data `Party`, seluruh modul CRM
**Context:** Template lama tidak punya konsep CRM sama sekali; MANOVA butuh cara merepresentasikan Prospect dan Client tanpa duplikasi data pihak yang sama.
**Decision:** Client dan Prospect memakai satu master data pihak/customer (`Party`/Customer Account) dengan field lifecycle/status yang membedakan keduanya, bukan dua entitas terpisah.
**Reason:** Keputusan eksplisit user di Prompt 0.
**Consequence:** Model UI dan detail teknis dirinci di D-024 (Prompt 3).

### D-002 — Opportunity Won Otomatis Membuat Project
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** modul CRM, Project, alur Opportunity-to-Project
**Context:** Baseline alur bisnis MANOVA dari Lead sampai Project selesai.
**Decision:** Opportunity yang berubah menjadi Won otomatis membuat Project; tidak ada jalur "buat project manual" sebagai default.
**Reason:** Keputusan eksplisit user di Prompt 0 bagian C.
**Consequence:** Wizard create-project manual lama harus direpurpose, bukan dipertahankan sebagai entry point independen — lihat D-018.

### D-003 — Seluruh Role Dipakai Saat Demo
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** RBAC, Role & Access Matrix, Dashboard
**Context:** MANOVA harus didemokan dengan seluruh peran organisasi terwakili.
**Decision:** Seluruh 11 role minimum Prompt 0-E digunakan saat demo, tidak ada yang di-skip.
**Reason:** Eksplisit dari user.
**Consequence:** Role & Access Matrix (D-030) harus mencakup ke-11 role tanpa kecuali.

### D-004 — Hak Ubah Opportunity ke Won Berbasis Role/Permission Terdokumentasi
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** modul CRM, permission model
**Context:** Aksi Won men-trigger efek besar (pembuatan Project) sehingga tidak boleh sembarangan.
**Decision:** Hak mengubah Opportunity menjadi Won mengikuti role/permission yang direkomendasikan berdasarkan audit dan kebutuhan operasional — tidak boleh hardcode tanpa didokumentasikan.
**Reason:** User meminta rekomendasi berbasis analisis, bukan asumsi sepihak.
**Consequence:** Model role final dirinci di D-025.

### D-005 — Sistem adalah Frontend Mockup Murni
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** seluruh codebase
**Context:** Perlu kejelasan batas scope teknis sebelum implementasi.
**Decision:** Sistem saat ini adalah frontend mockup dummy data; tidak ada backend nyata yang perlu dipertahankan.
**Reason:** Dikonfirmasi ulang oleh audit Prompt 1 — tidak ditemukan integrasi API/backend nyata di codebase existing.
**Consequence:** Seluruh data "tersimpan"/"terkirim" tetap simulasi client-side.

### D-006 — Larangan Fabrikasi Integrasi Nyata
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** seluruh modul, khususnya Vendor/Operations/Finance
**Context:** Risiko miskomunikasi ke stakeholder bila mockup terlihat seperti sistem produksi penuh.
**Decision:** Tidak boleh mengarang integrasi airline/hotel/payment gateway/WhatsApp API/vendor API nyata, dan tidak boleh mengklaim fitur mockup sebagai sudah terintegrasi.
**Reason:** Eksplisit dari user (Prompt 0-C).
**Consequence:** Sidebar item `/integrations` dieksklusi (lihat D-021); dummy vendor memakai nama fiktif, bukan brand nyata.

---

## Kelompok B — Fondasi Stack & Reuse (dikonfirmasi ulang di Prompt 4 untuk kelengkapan traceability)

### D-034 — Nuxt.js Dipertahankan sebagai Stack
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** seluruh codebase
**Context:** Prompt 0 mensyaratkan reuse stack existing, bukan migrasi framework.
**Decision:** Stack Nuxt 4 + Vue 3 + TypeScript + Tailwind + shadcn-nuxt/Reka UI dipertahankan sepenuhnya; tidak ada migrasi ke framework lain.
**Reason:** Audit Prompt 1 mengonfirmasi stack ini solid dan layak dipakai ulang; migrasi framework dilarang eksplisit (Prompt 0-H: "jangan mengubah stack Nuxt.js menjadi framework lain").
**Consequence:** Seluruh keputusan implementasi berikutnya harus kompatibel dengan konvensi Nuxt 4 (file-based routing, auto-import, dst.).

### D-035 — Design System Existing Direuse, Tidak Dibangun Baru
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** `tailwind.config.ts`, `assets/css/tailwind.css`, `app/components/ui/*`
**Context:** Template sudah punya design token (warna/radius/breakpoint via CSS variable) dan 15 primitive shadcn-nuxt/Reka UI yang bebas domain logic.
**Decision:** Design token dan seluruh primitive `ui/*` direuse apa adanya; komponen baru mengikuti pola visual yang sama (token HSL, CVA variant), bukan sistem desain paralel.
**Reason:** Audit Prompt 1 mengonfirmasi primitive ini generic dan sehat; Prompt 0-H eksplisit melarang "membuat design system baru bila template sudah memilikinya".
**Consequence:** Primitive baru yang dibutuhkan (`ui/tabs`, dll. — lihat D-009) harus mengikuti pola CVA + token yang sama dengan primitive existing.

### D-036 — Kebijakan Penambahan Package
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** `package.json`
**Context:** Prompt 0-H melarang instalasi package baru sebelum memastikan yang existing tidak cukup.
**Decision:** Tidak ada package baru dipasang sepanjang Prompt 0–4 (murni dokumentasi); setiap kebutuhan fungsional dicek dulu terhadap dependency existing (`vee-validate`, `zod`, `date-fns`, `chart.js`, `vue-draggable-plus`, dll.) sebelum mengusulkan package baru pada tahap implementasi.
**Reason:** Kebijakan eksplisit Prompt 0-H; dikonfirmasi lewat audit Prompt 1 bahwa banyak dependency yang sudah terpasang namun belum dipakai (`vee-validate`+`zod` 0% dipakai, `date-fns` 0% dipakai).
**Consequence:** Keputusan adopsi `vee-validate`/`zod` untuk form baru tetap terbuka sebagai Q7 (bukan larangan, tapi harus melalui audit dulu, bukan otomatis instal alternatif).

---

## Kelompok C — Keputusan dari Gap Analysis (Prompt 2)

### D-007 — Strategi Reuse per Route (Kategori Awal)
**Status:** LOCKED (sebagian di-supersede — lihat catatan) · **Date:** 2026-07-29 · **Affected:** seluruh route existing, `docs/template-reuse-mapping.md`
**Context:** 9 route existing perlu kategori reuse eksplisit sebelum IA final disusun.
**Decision:** Kategori reuse per route mengikuti `docs/template-reuse-mapping.md` bagian C (mis. `/projects/:id` → `REUSE_LAYOUT_REPLACE_CONTENT`, `/login` → `REUSE_COMPONENTS`).
**Reason:** Berdasarkan tingkat kematangan pola interaksi vs seberapa domain-specific isi komponennya.
**Consequence:** Sub-mapping untuk `/projects/create` dan `/tasks` di tabel asli **SUPERSEDED oleh D-018 dan D-019** (Prompt 3) — keduanya tidak lagi jadi route/menu mandiri. Baris lain (`/`, `/login`, `/expenses`, `/projects`, `/projects/:id`, `/projects/:id/edit`, `/[...slug]`) tetap berlaku sebagai starting point implementasi.

### D-008 — Arsitektur Tab Project Workspace Dipertahankan sebagai Kerangka
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** `pages/projects/[id]/index.vue`
**Context:** Ini aset reuse struktural paling bernilai di codebase (drag-drop kanban, chart, file list, activity log).
**Decision:** Arsitektur tab existing dipertahankan strukturnya sebagai kerangka Project Workspace MANOVA; isi diganti total per domain.
**Reason:** Kompleksitas dan kematangan interaksi tertinggi di seluruh codebase.
**Consequence:** Detail final 8-tab dan keputusan single-route dirinci di D-026/D-027 (Prompt 3) — memperkuat, bukan mengubah, keputusan ini.

### D-009 — Ekstraksi Primitive `ui/tabs`
**Status:** PROPOSED · **Date:** 2026-07-29 · **Affected:** `app/components/ui/tabs/*` (baru), `pages/projects/[id]/index.vue`
**Context:** Reka-ui menyediakan primitive Tabs, tapi belum dibungkus jadi komponen `ui/` (temuan Prompt 1); tab project workspace saat ini ad-hoc.
**Decision:** Implementasi tab existing diekstrak menjadi primitive `ui/tabs` berbasis reka-ui, dipakai ulang di Party Detail, Vendor Detail, dan Project Detail.
**Reason:** Menghindari duplikasi logic tab di banyak halaman detail baru.
**Consequence:** Ekstraksi harus hati-hati agar tidak merusak Project Workspace yang sudah kompleks — tetap PROPOSED (belum diputuskan teknis detailnya), bukan LOCKED, karena ini keputusan implementasi bukan IA.

### D-010 — Status-Badge Terpusat (lihat juga D-038)
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** komponen badge lintas modul
**Context:** `ProjectsTable`, `TasksOverview`, `StatsCard` existing masing-masing mendefinisikan ulang peta warna status sendiri (drift risk, temuan Prompt 1 bagian 8).
**Decision:** Status-badge (project status, task status/priority, invoice/payment status, dll.) memakai satu wrapper/mapping warna terpusat.
**Reason:** Mencegah drift taksonomi status yang sudah terjadi di template existing.
**Consequence:** Digeneralisasi lebih lanjut sebagai kebijakan status-constant menyeluruh di D-038.

### D-011 — `BudgetChart.vue` sebagai Basis "Budget vs Actual"
**Status:** PROPOSED · **Date:** 2026-07-29 · **Affected:** `app/components/dashboard/BudgetChart.vue`
**Context:** Satu-satunya komponen chart existing yang konsepnya 1:1 cocok dengan kebutuhan MANOVA (Prompt 0-F).
**Decision:** `BudgetChart.vue` menjadi basis komponen "Budget vs Actual", direfactor jadi props-driven per-project.
**Reason:** Reuse dan hindari membangun chart baru dari nol.
**Consequence:** Bug `console.log` dan non-reaktifnya warna tema harus diperbaiki sekalian saat refactor.

### D-012 — Pola `expenses.vue` sebagai Basis Invoice/Traveler Table
**Status:** PROPOSED · **Date:** 2026-07-29 · **Affected:** `pages/expenses.vue`, komponen Invoice/Traveler table baru
**Context:** Pola table+filter+search+modal+toast paling matang di codebase.
**Decision:** Dijadikan acuan/basis untuk komponen Invoice table dan Traveler table baru.
**Reason:** Kematangan interaksi tertinggi di antara pola table existing.
**Consequence:** Bug `handleDelete` (`ReferenceError`) wajib diperbaiki dulu sebelum pola ini direplikasi ke modul lain, agar bug tidak ikut ter-copy.

### D-013 — Data Dummy Dipusatkan Sebelum Modul Baru Dibangun
**Status:** PROPOSED · **Date:** 2026-07-29 · **Affected:** seluruh dashboard widget & page existing
**Context:** Project/Task/Expense existing punya 2–3 shape tidak sinkron (temuan Prompt 1).
**Decision:** Data dummy lintas dashboard-widget dan lintas-page dipindahkan ke satu modul data terpusat sebelum modul MANOVA baru dibangun di atasnya.
**Reason:** Mengonfirmasi peringatan Prompt 0-G soal data yang harus "berasal dari satu source yang terpusat".
**Consequence:** Lokasi modul (`app/data/` vs `app/constants/`) tetap DEFERRED — lihat D-015.

### D-014 — Skema ID Bergaya Bisnis
**Status:** PROPOSED (detail DEFERRED) · **Date:** 2026-07-29 · **Affected:** seluruh entitas MANOVA
**Context:** `Date.now()` dipakai di 2 tempat existing untuk ID runtime, rawan collision; tipe `id` campuran number/string.
**Decision:** ID entitas MANOVA memakai skema string bergaya bisnis (mengikuti pola `PRJ-001` yang sudah sebagian ada).
**Reason:** Konsistensi dan menghindari collision.
**Consequence:** Format detail per entitas — lihat D-016.

## Kelompok D — Keputusan yang Sengaja Ditunda dari Prompt 2 (DEFERRED)

### D-015 — Lokasi Modul Data Terpusat
**Status:** DEFERRED · **Date:** 2026-07-29 · **Affected:** struktur folder `app/`
**Context:** Prompt 0 aturan teknis #5–6 mensyaratkan struktur data terpusat, tapi lokasi persis (`app/data/` vs `app/constants/`) belum diputuskan.
**Decision:** Ditunda ke tahap implementasi/desain type definitions.
**Reason:** Lebih tepat diputuskan bersamaan dengan desain type, bukan di tahap dokumentasi murni.
**Consequence:** Belum ada folder yang dibuat sampai tahap ini.

### D-016 — Format ID Final per Entitas
**Status:** DEFERRED · **Date:** 2026-07-29 · **Affected:** seluruh entitas baru
**Context:** Prinsip umum sudah dikunci di D-014, detail prefix per entitas (mis. `TRV-`, `VND-`) belum.
**Decision:** Ditunda ke tahap implementasi.
**Reason:** Baru relevan saat type definitions benar-benar dirancang.
**Consequence:** Skenario data demo di `docs/mockup-data-scenarios.md` tetap memakai contoh ID konkret sebagai preview, namun format resmi final tetap ditentukan saat implementasi.

### D-017 — Nasib Teknis Duplikasi Kode (`cn()`, Dialog)
**Status:** DEFERRED · **Date:** 2026-07-29 · **Affected:** `app/lib/utils.ts`, `app/utils/cn.ts`, `app/components/ui/dialog/*`
**Context:** Dua file `cn()` identik; dua komponen Dialog ~90% identik.
**Decision:** Ditunda ke fase implementasi.
**Reason:** `cn()` dipanggil hampir di semua komponen — perubahan berisiko lebih aman dilakukan bersamaan mulainya implementasi, bukan berdiri sendiri sebagai keputusan dokumentasi.
**Consequence:** Tidak ada tindakan sampai tahap ini.

---

## Kelompok E — Keputusan Finalisasi IA/Route/Role/Workflow (Prompt 3)

Seluruh entri berikut berstatus LOCKED karena Prompt 3 secara eksplisit meminta "finalisasikan rancangan".

### D-018 — Wizard `/projects/create` Direpurpose, Bukan Entry Point Mandiri
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** `pages/projects/create.vue`, alur Opportunity-to-Project
**Context:** Resolusi open question Q1 — wizard manual berpotensi bertentangan dengan D-002.
**Decision:** Wizard 3-langkah existing tidak lagi jadi entry point mandiri "buat project manual"; pola stepper-nya direpurpose sebagai tampilan konfirmasi/setup awal Project yang muncul otomatis setelah Opportunity Won disetujui.
**Reason:** Entry point manual independen berlawanan langsung dengan D-002; me-repurpose pola tetap memenuhi prinsip reuse Prompt 0.
**Consequence:** Detail lengkap: `docs/route-and-role-matrix.md` bagian 2.

### D-019 — `Tasks` Tidak Jadi Menu Top-Level
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** `pages/tasks.vue`, tab "Tasks" Project Detail
**Context:** Resolusi Q2 — duplikasi konsep task antara `/tasks` dan Kanban tab.
**Decision:** Task management terjadi di dalam tab "Tasks" pada Project Detail; visibilitas lintas-project lewat widget dashboard, bukan menu/route tersendiri.
**Reason:** Mencegah duplikasi konsep task dengan shape data berbeda.
**Consequence:** Route `/tasks` dieksklusi dari IA final.

### D-020 — Operations & Travelers Bukan Menu Top-Level, Vendor Tetap Top-Level
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** IA, sidebar, Project Detail
**Context:** Resolusi Q3 — menghindari menu global kosong/tipis.
**Decision:** Operations melebur jadi tab "Itinerary & Services", Travelers melebur jadi tab "Travelers" — keduanya di Project Detail. Vendor tetap menu top-level (`/vendors`).
**Reason:** Operations/Traveler inheren single-project-scoped tanpa kebutuhan direktori lintas-project eksplisit di Prompt 0; Vendor melayani banyak project sekaligus.
**Consequence:** Detail lengkap: `docs/mockup-information-architecture.md` bagian 3.4–3.6. Opsi menu top-level tetap dicatat sebagai kemungkinan evolusi (D-033).

### D-021 — Resolusi 9 Dead Link Sidebar
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** `AppSidebar.vue` (rencana), route baru
**Context:** Resolusi Q4.
**Decision:** `/clients`→`/crm/clients`, `/invoices`→`/finance/invoices`, `/reports`→`/reports`, `/files`→tab Documents Project Detail, `/team`→`/admin/users`+info tim Overview, `/time-tracking`/`/templates`/`/integrations`→excluded.
**Reason:** Per item, lihat `docs/route-and-role-matrix.md` bagian 1.8.
**Consequence:** Tidak ada eksekusi (rename/hapus) pada tahap dokumentasi ini.

### D-022 — Settings Minimal, Bukan Item Sidebar Utama
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** popover profil `AppSidebar.vue`, `pages/settings.vue` (rencana)
**Context:** Resolusi Q5.
**Decision:** Settings dipertahankan skema minimal (profil/akun pribadi), diakses lewat popover profil user, bukan item sidebar utama.
**Reason:** Isi saat ini tidak cukup substansial untuk jadi menu top-level tersendiri.
**Consequence:** Tombol "Profile Settings" existing punya tujuan jelas untuk implementasi berikutnya.

### D-023 — `AIAssistant.vue` Tidak Dilanjutkan
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** `app/components/dashboard/AIAssistant.vue`
**Context:** Resolusi Q6 — tidak ada mapping domain MANOVA.
**Decision:** Tidak dilanjutkan sebagai bagian desain dashboard MANOVA.
**Reason:** Tidak ada konsep AI assistant di Prompt 0 manapun.
**Consequence:** Penghapusan fisik file tetap menunggu tahap cleanup (Prompt 5) — bukan dieksekusi sekarang.

### D-024 — Model UI Party/Prospect/Client
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** type `Party`, modul CRM
**Context:** Merinci D-001 menjadi model UI konkret.
**Decision:** Satu record `Party` dengan field `lifecycleStatus` (`Prospect`|`Client`); transisi `Prospect`→`Client` otomatis saat opportunity milik party tsb menjadi Won; history (Activity/Contact/Opportunity) tidak hilang setelah transisi.
**Reason:** Mencegah pola "banyak shape untuk satu konsep" seperti Project/Task/Expense di template lama.
**Consequence:** Detail lengkap: `docs/mockup-information-architecture.md` bagian 5.

### D-025 — Model Role Approval Won Dua-Langkah
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** modul CRM, Opportunity Detail
**Context:** Merinci D-004 — daftar role Prompt 3-H tidak menyediakan "Sales Manager" terpisah.
**Decision:** Sales mengajukan ("Submit as Won" / stage internal `WonRequested`); Management atau Super Admin menyetujui (aksi yang benar-benar mengeksekusi pembuatan Project).
**Reason:** Memakai role yang sudah tersedia tanpa mengarang role baru, tetap merepresentasikan pemisahan tanggung jawab sesuai Prompt 3-E.
**Consequence:** Model approval berjenjang berdasarkan nilai/kompleksitas dipertimbangkan tapi tidak dipilih untuk versi pertama — dicatat di D-032. Detail lengkap: `docs/route-and-role-matrix.md` bagian 2.3.

### D-026 — Konsolidasi Project Detail Jadi 8 Tab
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** `pages/projects/[id]/index.vue`
**Context:** 16 kandidat area Prompt 3-C perlu dikonsolidasi agar tidak berlebihan.
**Decision:** Overview, Itinerary & Services (sub-section kondisional sesuai `project.serviceScope`), Travelers, Vendors, Finance, Tasks, Documents, Activity & Changes.
**Reason:** Menggabungkan area yang seharusnya satu konteks (mis. Flight/Hotel/Transportation/MICE/Timeline → satu tab).
**Consequence:** Ini juga jadi keputusan eksplisit untuk "conditional modules berdasarkan service" (Prompt 4-E) — lihat D-039. Detail lengkap: `docs/mockup-information-architecture.md` bagian 4.

### D-027 — Tab Project Detail Tetap Satu Route
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** routing `/projects/[id]`
**Context:** Prompt 3-B mencontohkan opsi nested route (`/projects/[id]/itinerary`, dst.) tapi tidak mewajibkan.
**Decision:** Tab tetap satu route `/projects/[id]` dengan state client-side (deep-link via query param), bukan nested route per tab.
**Reason:** Mempertahankan pola coding existing yang sehat dan menghindari overengineering (Prompt 0 aturan teknis #3, #7).
**Consequence:** Route inventory `docs/route-and-role-matrix.md` tidak mencantumkan route terpisah per tab.

### D-028 — Project Status Final (8 status)
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** enum `ProjectStatus`
**Context:** Prompt 3-F meminta status cukup untuk demo tanpa berlebihan.
**Decision:** Draft, Planning, Confirmed, In Progress, Ongoing Trip, Completed, On Hold, Cancelled — transisi linear maju + cabang On Hold/Cancelled dari status non-terminal manapun.
**Reason:** Cukup mewakili siklus hidup project travel tanpa kompleksitas berlebih.
**Consequence:** Detail lengkap termasuk badge & attention condition: `docs/route-and-role-matrix.md` bagian 3.

### D-029 — Service Status Generik
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** enum `ServiceStatus` (Flight/Hotel/Transportation/MICE)
**Context:** Prompt 3-G meminta menghindari status berbeda total per jenis layanan.
**Decision:** Not Started → Sourcing → Quoted → Pending Confirmation → Confirmed → (Changed ⇄ Confirmed) → Completed, dengan Cancelled sebagai cabang terminal. Perbedaan antar jenis layanan lewat field tambahan, bukan status set berbeda.
**Reason:** Konsistensi lintas 4 jenis layanan operasional.
**Consequence:** Detail lengkap: `docs/route-and-role-matrix.md` bagian 4.

### D-030 — Role & Access Matrix (5 Level, Granularity Modul)
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** seluruh modul
**Context:** Prompt 3-H meminta matrix untuk 11 role x modul, tanpa granularity field.
**Decision:** `NONE`/`VIEW`/`MANAGE`/`APPROVE`/`ADMIN` pada granularity modul (CRM/Project/Vendor/Finance/Reports/Administration); pengecualian granularity untuk role sub-domain (Ticketing/Accommodation/Transportation/MICE) yang scoped ke satu sub-section layanan (sesuai definisi role di Prompt 0-E).
**Reason:** Memenuhi instruksi eksplisit untuk tidak membuat permission field-level.
**Consequence:** Detail lengkap: `docs/route-and-role-matrix.md` bagian 5.

### D-031 — Dashboard Satu Komponen, Widget Kondisional per Role
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** `pages/index.vue`
**Context:** Prompt 3-I melarang dashboard terpisah sepenuhnya per role.
**Decision:** Satu komponen dashboard, widget difilter berdasarkan role user login.
**Reason:** Instruksi eksplisit Prompt 3-I.
**Consequence:** Detail lengkap: `docs/route-and-role-matrix.md` bagian 6.

## Kelompok F — Alternatif yang Dipertimbangkan, Belum Dipilih (DEFERRED)

### D-032 — Approval Won Berjenjang Berdasarkan Nilai/Kompleksitas
**Status:** DEFERRED · **Date:** 2026-07-29 · **Affected:** model role Opportunity
**Context:** Alternatif terhadap D-025.
**Decision:** Tidak dipilih untuk versi pertama.
**Reason:** Menambah kompleksitas tanpa dasar threshold nyata dari bisnis di Prompt 0; melanggar instruksi "pilih model paling sederhana yang tetap realistis".
**Consequence:** Bisa dievaluasi lagi setelah ada data threshold nyata — lihat juga Q9 (`docs/mockup-open-questions.md`).

### D-033 — Direktori Operations/Travelers Lintas-Project sebagai Menu Top-Level
**Status:** DEFERRED · **Date:** 2026-07-29 · **Affected:** IA, sidebar
**Context:** Alternatif terhadap D-020.
**Decision:** Tidak dipilih untuk fase mockup awal.
**Reason:** Tidak ada kebutuhan agregasi lintas-project yang tervalidasi di Prompt 0 saat ini.
**Consequence:** Dipertimbangkan lagi bila kebutuhan agregasi lintas-project (mis. "traveler yang dokumennya belum lengkap di semua project") benar-benar tervalidasi di fase setelah mockup awal.

---

## Kelompok G — Pelengkap Traceability Prompt 4 (status constants & formatting)

### D-037 — Format Rupiah dan Tanggal Konsisten
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** formatter currency/date (baru, lokasi menyusul di implementasi)
**Context:** Audit Prompt 1 menemukan nol pemakaian format IDR dan format tanggal yang tidak konsisten (`'2025-01-15'` vs `'Today'` vs `'Feb 15, 2025'`) di seluruh codebase existing; `date-fns` terpasang tapi 0% dipakai.
**Decision:** Seluruh nilai currency bertipe IDR wajib memakai format Rupiah Indonesia (`Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR'})` atau setara); seluruh tanggal demo memakai satu formatter konsisten berbasis `date-fns` (dependency existing, tidak perlu package baru).
**Reason:** Wajib sesuai Prompt 0 aturan teknis #11–12; `date-fns` sudah terpasang sehingga tidak melanggar kebijakan penambahan package (D-036).
**Consequence:** Seluruh skenario data di `docs/mockup-data-scenarios.md` memakai nilai Rupiah dan tanggal yang konsisten formatnya sebagai contoh.

### D-038 — Sentralisasi Status Constants (generalisasi dari D-010)
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** seluruh enum status (Opportunity stage, Project status, Service status, Invoice/Payment status, Task status/priority)
**Context:** D-010 awalnya hanya membahas status-badge warna; Prompt 0 aturan teknis #10 mensyaratkan seluruh status memakai constant/enum konsisten, bukan hanya soal warna badge.
**Decision:** Seluruh status di seluruh modul MANOVA (bukan hanya Project) didefinisikan sebagai satu set constant/enum terpusat per domain, dipakai bersama oleh logic maupun badge — tidak didefinisikan ulang per komponen seperti pola lama.
**Reason:** Mencegah drift taksonomi status seperti temuan Prompt 1 (kategori expense berbeda di 3 tempat, status project berbeda di 3 tempat).
**Consequence:** Lokasi modul constant mengikuti keputusan D-015 (masih DEFERRED lokasinya, tapi prinsip sentralisasi sudah LOCKED).

### D-039 — Conditional Modules Berdasarkan Service (restatement eksplisit)
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** tab "Itinerary & Services" Project Detail
**Context:** Prompt 4-C secara eksplisit meminta dokumentasi "conditional service sections" sebagai bagian IA.
**Decision:** Sub-section dalam tab "Itinerary & Services" (Flight/Hotel/Transportation/MICE) tampil kondisional sesuai `project.serviceScope`, sesuai 4 kombinasi tipe project Prompt 0-B (flight-only, +hotel, +transport, +MICE).
**Reason:** Menghindari UI menampilkan section kosong untuk layanan yang tidak dipakai project tsb.
**Consequence:** Ini adalah restatement eksplisit dari bagian D-026 untuk traceability langsung terhadap requirement Prompt 4-C — tidak mengubah keputusan, hanya menegaskan.

### D-040 — Nilai Ambang Batas Default untuk Attention Condition
**Status:** DEFERRED (asumsi aman dipakai untuk mockup, bukan angka final bisnis) · **Date:** 2026-07-29 · **Affected:** widget dashboard "Attention list", `docs/mockup-data-scenarios.md`
**Context:** Resolusi Q9 (`docs/mockup-open-questions.md`) — Prompt 4-F melarang menjadikan hal kecil sebagai blocker bila ada asumsi aman untuk mockup.
**Decision:** Attention dipicu bila salah satu: `Actual Cost > 100% Budget`; keberangkatan ≤ 30 hari dari tanggal berjalan; invoice/task melewati tanggal jatuh tempo (tanpa masa tenggang).
**Reason:** Nilai default yang cukup realistis untuk mockup tanpa perlu menunggu data threshold bisnis nyata.
**Consequence:** Dipakai konsisten di `docs/mockup-data-scenarios.md`; dapat disesuaikan bila ada masukan bisnis nyata di kemudian hari (karena itu tetap `DEFERRED`, bukan `LOCKED`).

---

## Kelompok I — Change Request Prompt 19 (Customer Journey, Account Executive, Supplier, Commercial Approval)

Prompt 19 adalah **change request** di atas mockup 18-section yang sudah COMPLETED (Section 00–18), bukan lanjutan phasing baku. Keputusan berikut LOCKED untuk perubahan ini kecuali dinyatakan lain.

### D-046 — 2 Role Baru: Account Executive dan Supplier (Total 13 Role)
**Status:** LOCKED · **Date:** 2026-07-30 · **Affected:** `app/types/user.ts`, `app/constants/roles.ts`, `app/data/users.ts`
**Context:** Prompt 19 secara eksplisit meminta pemisahan tanggung jawab Sales (Lead) vs Account Executive (Opportunity/Quotation/Won), plus area External Partners dengan akun supplier ter-isolasi.
**Decision:** `RoleId` diperluas dari 11 menjadi 13 nilai — `account-executive` disisipkan setelah `management`, `supplier` ditambahkan di akhir. Satu demo user per role baru (`USR-014` Account Executive, `USR-015`/`USR-016` Supplier PT ABC/PT EFG).
**Reason:** D-003 (seluruh role dipakai demo) tetap berlaku — role baru mengikuti pola yang sama, bukan pengecualian.
**Consequence:** `ROLE_MODULE_ACCESS` bertambah kolom `supplier-portal` (module key baru, lihat D-048); seluruh matrix existing (11 role x 6 modul lama) **tidak diubah nilainya**, murni ekstensi baris/kolom.

### D-047 — Sales Dipersempit ke Lead, Account Executive Mengambil Alih Opportunity/Quotation
**Status:** LOCKED · **Date:** 2026-07-30 · **Affected:** `app/pages/crm/opportunities/[id]/index.vue`, `app/data/opportunities.ts`
**Context:** Prompt 19-2 eksplisit merinci pemisahan tanggung jawab: Sales = screening/qualification Lead; AE = create Opportunity s/d Won, tetap Account Owner setelah project berjalan.
**Decision:** Narrow role exception `canManageOpportunity` (Opportunity Detail, pola sama seperti `canManageParty` Section 07) dipindah dari `['sales', 'super-admin']` menjadi `['account-executive', 'super-admin']`. `Opportunity.ownerId` pada 7 record existing (OPP-001–007) di-reassign dari `USR-001` (Sales) ke `USR-014` (AE) — perubahan **nilai field**, bukan struktur/hapus data.
**Reason:** Di bawah model role baru, mempertahankan `ownerId` lama akan membuat "Account Owner" menunjuk ke role yang menurut definisi baru tidak lagi mengelola Opportunity — inkonsistensi yang perlu diperbaiki untuk integrasi (protokol bagian C, "diperlukan untuk integrasi").
**Consequence:** `canManageParty` (Party/Prospect, `crm/parties/[id]/index.vue` dan `crm/prospects.vue`) diperluas menambahkan `account-executive` (AE "mengelola relationship dengan prospect/client", literal Prompt 19-2) — Sales **tetap dipertahankan** di daftar ini (tidak ada larangan eksplisit Party-level). Dashboard (Section 06) widget Sales (Opportunity Pipeline read-only, Follow-up Mendatang) **sengaja tidak diubah** — read-only, tidak melanggar "Sales tidak boleh Mark as Won" (gate ada di halaman aksi, bukan dashboard).

### D-048 — Modul `supplier-portal` Terpisah dari `vendor`, Isolasi via `User.vendorId`
**Status:** LOCKED · **Date:** 2026-07-30 · **Affected:** `app/types/user.ts`, `app/constants/roles.ts`, `app/composables/usePermissions.ts`
**Context:** Prompt 19-1/7 eksplisit: supplier hanya boleh melihat company sendiri, tidak boleh melihat vendor lain, tidak boleh melihat Customer Journey/leads/opportunity internal/margin/activity internal.
**Decision:** `ModuleKey` baru `supplier-portal` (terpisah dari `vendor` yang tetap berarti "direktori vendor internal, dilihat seluruh role internal"). `User.vendorId?` (opsional, hanya terisi untuk role `supplier`) menyimpan satu-satunya vendor company yang boleh dilihat user tsb. `usePermissions()` menyediakan `vendorScopeId` (computed, `undefined` untuk role selain `supplier`) — seluruh halaman `/supplier/*` WAJIB memfilter data lewat `vendorScopeId`, tidak pernah membaca `VENDORS`/`PROJECT_SERVICES`/`VENDOR_QUOTATIONS` penuh.
**Reason:** Field-level filtering (satu vendor per user) tidak bisa direpresentasikan oleh granularity modul biasa (D-030) — ini bukan pengecualian terhadap D-030 (yang membahas permission action-level per modul), melainkan mekanisme **data-scoping** terpisah, pola baru yang eksplisit dibutuhkan Prompt 19 (vendor isolation).
**Consequence:** `ROLE_MODULE_ACCESS['supplier-portal']`: `supplier` = `MANAGE`, `super-admin` = `ADMIN` (oversight — melihat halaman `/supplier/*` tapi `vendor.value` selalu `undefined` karena Super Admin tidak punya `vendorId`, sehingga tetap tidak bocor data vendor manapun), seluruh role internal lain = `NONE`.

### D-049 — Commercial Approval Terpisah dari Won Approval (Quotation-Level, Bukan Merestrukturisasi Opportunity Stage)
**Status:** LOCKED · **Date:** 2026-07-30 · **Affected:** `app/types/opportunity.ts` (`QuotationApprovalStatus`), `app/data/index.ts` (`submitQuotationForApproval`/`approveQuotation`/`rejectQuotation`), `app/pages/crm/opportunities/[id]/index.vue`
**Context:** Prompt 19-3 meminta workflow "Draft Quotation→Submitted for Approval→Approved by Management→Negotiation/Final Confirmation→Opportunity Won", dengan AE tidak dapat Mark as Won sebelum approval Management. `Opportunity.stage` (D-028/state machine existing, LOCKED sejak Prompt 3, dipakai luas — Section 08/09/14) sudah punya gerbang approval sendiri di transisi `won-requested → won` (D-025, Management/Super Admin).
**Decision:** **Tidak merestrukturisasi** `OpportunityStage` (union 9 nilai existing dipertahankan utuh). Field baru `Quotation.approvalStatus` (`draft|submitted|approved|rejected`, opsional) + 3 mutator baru (`submitQuotationForApproval`, `approveQuotation`, `rejectQuotation`) mengimplementasikan Commercial Approval sebagai lapisan **tambahan, ortogonal** terhadap stage: tombol "Ajukan sebagai Won" (transisi `negotiation → won-requested`) di-gate tambahan `quotation?.approvalStatus === 'approved'`. "Negotiation/Final Confirmation" pada diagram Prompt 19 dipetakan ke stage `negotiation` existing (setelah quotation approved); "Opportunity Won" final tetap memakai gerbang `won-requested → won` (D-025) yang sudah ada — bukan langkah baru, melainkan "Final Confirmation" itu sendiri.
**Reason:** Merestrukturisasi state machine Opportunity yang sudah dipakai luas oleh Section 08/09/14 (dan divalidasi lintas banyak section) berisiko tinggi/besar untuk perubahan yang sebenarnya bisa dipenuhi secara aditif; protokol bagian C eksplisit meminta "perubahan paling minimal" saat menyentuh hasil section lama.
**Consequence:** 2 opportunity existing di-restage untuk mendemokan kedua skenario literal Prompt 19-9 ("satu quotation menunggu approval", "satu quotation approved") — **OPP-005 dikembalikan** dari `won-requested` (Section 09 CI-012) ke `negotiation` (`QUO-005.approvalStatus = 'submitted'`); **OPP-006 tetap `negotiation`** dengan `QUO-006.approvalStatus = 'approved'`, siap didemokan "Ajukan sebagai Won" → Approve Won (Management). Dicatat di `docs/mockup-change-impact-log.md`.

### D-050 — "Company" dan "Project Order" Adalah Party dan Project yang Sama (Bukan Entitas Paralel)
**Status:** LOCKED · **Date:** 2026-07-30 · **Affected:** `app/pages/customer-journey/customers/*`, `app/pages/customer-journey/project-orders/*`, `app/types/party.ts`
**Context:** Prompt 19-5B/5C meminta halaman "Customers/Companies" dan "Project Orders" dengan struktur tab/field yang terlihat seperti entitas baru; hard rule "Jangan membuat route duplikat bila route existing dapat diadaptasi" dan "gunakan fixture yang sama, bukan dataset terpisah".
**Decision:** "Company" = `Party` (D-001/D-024, tidak diubah), diperluas aditif dengan `size?`/`city?`/`phone?`/`accountOwnerId?`. "Project Order" = `Project` (tidak ada field baru — Account Executive derivasi via `Project.opportunityId → Opportunity.ownerId`, bukan field baru di `Project`). Halaman `/customer-journey/customers`/`/customer-journey/project-orders` adalah **route baru** (AE-centric lens, field/filter berbeda dari `/crm/prospects`/`/crm/clients`/`/projects`) tapi 100% membaca array `PARTIES`/`PROJECTS` yang sama — bukan alias/redirect, bukan dataset paralel.
**Reason:** IA literal Prompt 19-8 merekomendasikan route baru untuk kelompok menu "Customer Journey" yang terpisah dari sidebar "CRM"/"Projects" existing (kebutuhan navigasi/UX berbeda: AE ingin melihat "Customers"+"Project Orders" dalam satu konteks Customer Journey), namun hard rule melarang duplikasi dataset — kombinasi keduanya adalah route presentasi baru di atas data existing, bukan model data baru.
**Consequence:** `/crm/prospects`, `/crm/clients`, `/crm/parties/[id]`, `/projects`, `/projects/[id]` **tidak disentuh sama sekali** (selain ekstensi type `Party` yang backward-compatible). Tab "Documents" Customer Detail = union `getDocumentsByProject` lintas seluruh Project Order milik company (selektor baru `getDocumentsByParty`, bukan entitas `PartyDocument` baru).

### D-051 — Lead sebagai Entitas Baru (Pre-Party), Bukan Perluasan Party
**Status:** LOCKED · **Date:** 2026-07-30 · **Affected:** `app/types/lead.ts` (baru), `app/data/leads.ts` (baru)
**Context:** Prompt 19-5A meminta Lead dengan lifecycle sendiri (New/Contacted/Qualified/Unqualified, terpisah dari `Party.lifecycleStatus` Prospect/Client) dan aksi "Qualify & Create Opportunity" (bukan "Convert to Customer").
**Decision:** `Lead`/`LeadActivity` adalah entitas baru (bukan perluasan `Party`) — Lead merepresentasikan pra-kualifikasi sebelum ada relasi CRM formal; begitu di-qualify, `Party` (baru atau existing yang cocok namanya — mencegah duplicate company, literal Prompt 19-4) dan `Opportunity` dibuat, `Lead.partyId`/`opportunityId` diisi sebagai referensi (bukan Lead "berubah menjadi" Party). `LeadActivity` reuse `PartyActivityType` (union sama persis) — satu entitas untuk "Activities" dan "Follow-ups" drawer (follow-up = activity dengan `dueAt` terisi), pola identik `PartyActivity` (Section 07).
**Reason:** Lead dan Party mewakili konsep bisnis berbeda (pra-kualifikasi vs relasi CRM formal); memaksakan Lead sebagai varian `Party` akan mencampur dua lifecycle independen dalam satu field (anti-pola yang sama yang dihindari D-001/D-024 dengan memisahkan sekaligus tidak mengizinkan duplikasi shape).
**Consequence:** `getUpcomingFollowUps`(Party, Section 07)/`getLeadFollowUps` (Lead, Prompt 19) tetap 2 selektor terpisah (entitas sumber beda), tapi keduanya reuse fungsi generik `isFollowUpUpcoming` yang sama (tipe parameter dipersempit ke `{ dueAt? }` di `app/utils/attention.ts` — perubahan backward-compatible, bukan logic baru).

### D-052 — Activity Center: Narrow Role Override di Level Navigasi (Bukan Hanya Level Halaman)
**Status:** LOCKED · **Date:** 2026-07-30 · **Affected:** `app/constants/navigation.ts` (`NavItem.roles`), `app/components/layout/AppSidebar.vue`
**Context:** Prompt 19-6 eksplisit "Activity Center" hanya untuk Super Admin — lebih sempit dari modul `administration` existing (`ROLE_MODULE_ACCESS.administration` juga memberi Management/Viewer `VIEW`, dipakai `/admin/audit-trail`).
**Decision:** `NavItem` diperluas dengan field opsional `roles?: RoleId[]` — bila diisi, MENGGANTIKAN (bukan menambah) cek `moduleKey` untuk visibilitas item nav tsb. `AppSidebar.vue` diupdate untuk mengecek `roles` dulu sebelum fallback ke `moduleKey`. Item "Activity Center" dan 3 child "Customer Journey" (Customers/Project Orders/Lead Source Recap, dibatasi Sales — lihat Prompt 19-10) memakai field ini; seluruh nav item lain **tidak berubah perilakunya** (tidak mengisi `roles`, tetap murni `moduleKey`).
**Reason:** Ini adalah pola "narrow role exception" (sudah mapan di level halaman sejak Section 07/08 — `canManageParty`/`canManageOpportunity`) diterapkan di level nav — dibanding membuat modul baru granular (`activity-center`, `customer-journey`) yang akan menambah kolom permanen ke `ROLE_MODULE_ACCESS` untuk kasus yang genuinely sempit/khusus.
**Consequence:** Halaman `/activity-center` sendiri tetap melakukan pengecekan independen (`currentRole === 'super-admin'`) — `roles` di nav HANYA mengontrol visibilitas link, bukan pengganti page-level guard (defense in depth, konsisten pola `RoleAccessState` di seluruh halaman lain).

---

## Referensi Silang Open Questions

Lihat `docs/mockup-open-questions.md` untuk pertanyaan yang **masih benar-benar terbuka** (Q7 non-blocking, Q8 blocking-before-module-implementation) dan yang deferred (Q9, Q10, Q11) — pertanyaan yang sudah diresolusi (Q1–Q6) diarsipkan di sana, tidak diulang di sini; hasil resolusinya ada di D-018 s/d D-023 di atas.

---

## Kelompok H — Keputusan Implementasi Foundation (Prompt 5)

Prompt 5 adalah tahap coding pertama. Keputusan berikut bersifat teknis-implementasi (bukan keputusan IA/route/role baru — itu semua sudah LOCKED di Prompt 3), dicatat untuk traceability.

### D-041 — Default Demo User: Super Admin
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** `app/composables/useCurrentUser.ts`
**Context:** Current user mock butuh nilai default sebelum user memilih lewat role switcher.
**Decision:** Default demo user adalah `USR-010` (Super Admin) agar seluruh navigasi terlihat penuh saat pertama kali dibuka, bukan role dengan akses terbatas.
**Reason:** Menghindari kebingungan "kenapa menu saya sedikit" saat pertama kali mencoba mockup; role switcher di halaman Settings memungkinkan eksplorasi role lain kapan saja.
**Consequence:** Pilihan role dipersist ke `localStorage` (`manovaCurrentUserId`) agar konsisten antar reload, mengikuti pola persistence existing (`isAuthenticated`/`userEmail`).

### D-042 — Tanggal Acuan Demo Fixed (Bukan `new Date()`)
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** `app/utils/attention.ts` (`DEMO_REFERENCE_DATE`)
**Context:** Perhitungan "upcoming departure" dan "invoice overdue" butuh titik acuan "hari ini".
**Decision:** Memakai konstanta `DEMO_REFERENCE_DATE = '2026-07-29'` (sesuai `docs/mockup-data-scenarios.md`), bukan `new Date()` runtime.
**Reason:** Bila memakai tanggal sungguhan, demo akan "rusak" secara visual seiring waktu berjalan (project yang sekarang "upcoming" akan terlihat sudah lewat beberapa bulan kemudian) — tanggal fixed menjaga demo tetap konsisten kapan pun dibuka, sesuai Prompt 0 aturan teknis #12.
**Consequence:** Bila fixture data diperbarui di masa depan dengan tanggal baru, `DEMO_REFERENCE_DATE` harus disesuaikan bersamaan.

### D-043 — Tab Project Detail via Query Param, Role Switcher di Settings
**Status:** LOCKED · **Date:** 2026-07-29 · **Affected:** `app/pages/projects/[id]/index.vue`, `app/pages/settings.vue`
**Context:** Merealisasikan D-027 (tab satu route) dan D-022 (Settings minimal) menjadi kode nyata.
**Decision:** Tab Project Detail disinkronkan ke `?tab=` query param (deep-link tanpa nested route); role switcher demo ditempatkan sebagai section di halaman Settings (bukan dropdown di header/sidebar) agar tidak mengganggu chrome utama.
**Reason:** Konsisten dengan keputusan desain yang sudah LOCKED; Settings sudah punya alasan eksplisit untuk ada (D-022), jadi lokasi switcher di sana tidak menambah menu baru.
**Consequence:** `TopHeader.vue` disederhanakan — title halaman per-route yang dulu hardcoded "Dashboard" dihapus (digantikan `PageHeader` di tiap halaman) karena judul ganda (header + body) dinilai redundan; `TopHeader` kini hanya menampilkan indikator role aktif + notifikasi.

### D-044 — Eksekusi Cleanup Fisik (AIAssistant, `cn.ts`, `.gradient-primary`)
**Status:** LOCKED (dieksekusi) · **Date:** 2026-07-29 · **Affected:** `app/components/dashboard/AIAssistant.vue` (dihapus), `app/utils/cn.ts` (dihapus), `assets/css/tailwind.css` (`.gradient-primary` dihapus)
**Context:** D-023 (Prompt 3) sudah mengunci "tidak dilanjutkan" untuk AIAssistant dengan catatan eksekusi fisik menunggu Prompt 5; D-017 (DEFERRED) mencatat duplikasi `cn()` menunggu momen aman; `.gradient-primary` sudah dikonfirmasi tidak dipakai sejak audit Prompt 1.
**Decision:** Ketiganya dieksekusi (dihapus) di Prompt 5 setelah dependency check ulang mengonfirmasi nol pemakaian.
**Reason:** Prompt 5 secara eksplisit adalah tahap cleanup aman dengan syarat dependency check — ketiga item ini memenuhi syarat (locked decision untuk AIAssistant; nol dependency terverifikasi untuk `cn.ts` dan `.gradient-primary`).
**Consequence:** `app/lib/utils.ts` menjadi satu-satunya sumber `cn()` (menyelesaikan sebagian D-017 — duplikasi Dialog `DialogContent`/`DialogScrollContent` **masih belum** dikonsolidasi, tetap DEFERRED karena risikonya berbeda — keduanya aktif dipakai, bukan dead code).

### D-045 — Tidak Menginstal Tooling Lint/Typecheck di Prompt 5
**Status:** DEFERRED · **Date:** 2026-07-29 · **Affected:** `package.json` (tidak diubah)
**Context:** `docs/mockup-open-questions.md` Q8 mencatat tooling ini "harus diselesaikan di dalam fase Foundation" (ditulis di Prompt 4).
**Decision:** Prompt 5 **tidak** menginstal `eslint` inti maupun `vue-tsc`, meski Q8 sebelumnya menyiratkan penyelesaian di fase ini.
**Reason:** Prompt 5 sendiri tidak secara eksplisit memerintahkan instalasi package baru di teksnya (section N hanya bilang "jalankan lint/typecheck", mengasumsikan tool sudah ada); menginstal package baru tanpa instruksi eksplisit dinilai melampaui scope "cleanup aman dan foundation" dan berisiko dianggap keputusan sepihak yang seharusnya dikonfirmasi dulu.
**Consequence:** Q8 tetap berstatus terbuka/blocking-sebelum-CRM (lihat update di `docs/mockup-open-questions.md`); build tetap divalidasi penuh (sukses) sebagai bentuk quality gate yang tersedia saat ini.
