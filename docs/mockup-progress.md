# MANOVA Mockup — Progress Log

File ini adalah log kronologis progres pengerjaan mockup MANOVA di atas template Nuxt 4 existing. Entri baru ditambahkan di bagian bawah tanpa menghapus histori sebelumnya.

---

## 2026-07-29 — Prompt 0: Konteks Bisnis dan Aturan Kerja

- **Status:** Selesai.
- Membaca dan mengonfirmasi seluruh isi `prompts/PROMPT 0-KONTEKS BISNIS DAN ATURAN KERJA.md` sebagai landasan kerja (domain MANOVA, tipe project, alur bisnis, entitas, role, kebutuhan dashboard, skenario data demo, prinsip reuse, aturan teknis, dokumentasi source of truth, aturan pelaporan).
- Tidak ada kode yang diubah, tidak ada halaman dibuat, tidak ada package diinstal, tidak ada file dihapus (sesuai batasan tahap ini).
- Output: ringkasan pemahaman disampaikan langsung ke user (belum ada dokumen `docs/` yang dibuat pada tahap ini).

## 2026-07-29 — Prompt 1: Audit Template dan Codebase

- **Status:** Selesai.
- Melakukan audit read-only menyeluruh terhadap template Nuxt 4 existing: project foundation (versi, package, config), struktur codebase, UI & design system, fitur/halaman, data & state, serta kualitas codebase (build/lint/typecheck/test).
- Metode: audit langsung untuk config/versi/struktur + 3 sub-agent riset paralel (rute-layout-middleware, UI-design tokens, data-state-code quality) untuk pembacaan menyeluruh tiap file, lalu verifikasi build.
- **Temuan utama:**
  - Fondasi Nuxt 4/Vue 3/TypeScript/Tailwind/shadcn-nuxt/Reka UI/Chart.js layak direuse, dengan banyak pola (layout, sidebar, wizard, kanban, chart) yang sudah matang.
  - Data mock (Project/Task/Expense) tidak konsisten lintas halaman (2–3 shape berbeda per entitas, taksonomi status/kategori tidak sinkron, satu project "PRJ-005" orphan hanya muncul di satu file).
  - Bug nyata: tombol Delete di modal detail `expenses.vue` memanggil fungsi `handleDelete` yang tidak terdefinisi.
  - 9 dari 13 menu sidebar menunjuk ke halaman yang belum ada.
  - Tidak ada RBAC/role mock — auth hanya flag boolean `localStorage`, perlu dibangun dari nol untuk kebutuhan role MANOVA (Prompt 0-E).
  - Tidak ada formatter currency/date bersama, dan belum ada satu pun format Rupiah/IDR (wajib untuk MANOVA).
  - Tidak ada tooling lint/typecheck/test yang berfungsi (eslint tidak terpasang, 0 file test) meski sebagian devDependency-nya sudah ada.
  - **Di luar kode**: folder `.git` sudah tidak ditemukan di working directory saat audit berlangsung — dilaporkan langsung ke user, dicatat sebagai risiko utama, tidak ada tindakan pemulihan yang diambil (di luar kendali/scope Prompt 1).
- Tindakan yang **tidak** dilakukan sesuai batasan Prompt 1: implementasi halaman MANOVA, rename menu/route, penggantian dummy data, penghapusan fitur, instalasi library baru, perubahan design system, refactor besar.
- **Validasi:** `npm run build` sukses (exit 0) dua kali; lint/typecheck/test tidak dapat dijalankan karena tooling belum dikonfigurasi (dicatat sebagai temuan, bukan dieksekusi paksa dengan instalasi baru).
- Output: `docs/template-audit.md` (dibuat, 15 bagian lengkap sesuai spesifikasi Prompt 1), `docs/mockup-progress.md` (dibuat, entri ini).
- **Belum dikerjakan** (menunggu prompt berikutnya): `docs/mockup-scope.md`, `docs/mockup-information-architecture.md`, `docs/mockup-data-scenarios.md`, `docs/mockup-design-decisions.md`, `docs/mockup-open-questions.md`, `docs/template-reuse-mapping.md`, `docs/route-and-role-matrix.md`.

## 2026-07-29 — Prompt 2: Gap Analysis dan Template Reuse Mapping

- **Status:** Selesai.
- Membaca ulang `docs/template-audit.md`, `docs/mockup-progress.md`, `prompts/PROMPT 0-KONTEKS BISNIS DAN ATURAN KERJA.md`, dan `prompts/PROMPT 1 — AUDIT TEMPLATE DAN CODEBASE.md` sebagai landasan; memverifikasi `app/components/layout/AppSidebar.vue` untuk memastikan daftar 13 menu item persis sesuai temuan audit sebelum dipetakan.
- Menyusun gap analysis dan reuse mapping murni dokumentasi: tidak ada kode yang diubah, tidak ada file dihapus, tidak ada rename, tidak ada route/sidebar yang diubah, tidak ada package dipasang, tidak ada halaman baru dibuat.
- **Cakupan pekerjaan:**
  - Mapping Matrix 9 route existing → kategori reuse (`REUSE_AS_IS`/`REUSE_COMPONENTS`/`REUSE_LAYOUT_REPLACE_CONTENT`/`ADAPT`/dst.) dengan required adaptation, data impact, navigation impact, risk, dan execution phase per baris.
  - Component Reuse Matrix untuk 19 kebutuhan komponen MANOVA (KPI card s/d Empty/loading/error state) terhadap komponen existing.
  - Data Model Gap: pemetaan type yang bisa digeneralisasi (Project/Task/Expense, masing-masing 2–3 shape tidak sinkron di codebase existing) vs type baru yang harus dibangun total (CRM, Traveler, Operations, Vendor, sebagian Finance, Administration/RBAC).
  - Navigation Gap: evaluasi 13 menu sidebar existing (4 punya halaman, 9 dead link) terhadap rekomendasi menu MANOVA, dengan keputusan eksplisit untuk tidak membuat menu kosong (Operations/Travelers/Settings ditandai sebagai open question, bukan langsung ditambahkan).
  - Fitur tidak relevan: dianalisis alasan, komponen reusable di dalamnya, dependensi, dan rekomendasi aman-dihapus/disembunyikan/dipertahankan — tanpa eksekusi penghapusan apa pun.
  - Rekomendasi phasing 11 tahap (Foundation s/d Regression and demo readiness) dengan scope/route/main components/reuse target/data dependency/exit criteria per tahap.
- **Keputusan LOCKED dari Prompt 0 dipakai sebagai constraint**, terutama: Party/Customer Account tunggal untuk Client+Prospect, Opportunity Won → Project otomatis (memicu open question soal nasib wizard manual `/projects/create`), seluruh role dipakai saat demo, larangan mengarang integrasi nyata.
- Seluruh keputusan reuse/phasing baru pada tahap ini dicatat berstatus **PROPOSED** (belum divalidasi user), bukan `LOCKED` — akan dikunci di Prompt 3.
- Output: `docs/template-reuse-mapping.md` (dibuat baru), `docs/mockup-scope.md` (dibuat baru), `docs/mockup-design-decisions.md` (dibuat baru), `docs/mockup-open-questions.md` (dibuat baru, 8 pertanyaan terbuka), `docs/mockup-progress.md` (diupdate, entri ini).
- **Belum dikerjakan** (menunggu prompt berikutnya): `docs/mockup-information-architecture.md`, `docs/mockup-data-scenarios.md`, `docs/route-and-role-matrix.md` — seluruhnya scope Prompt 3 (Information Architecture, Route, Role, dan Workflow) ke atas.

## 2026-07-29 — Prompt 3: Information Architecture, Route, Role, dan Workflow

- **Status:** Selesai.
- Membaca ulang `docs/template-audit.md`, `docs/template-reuse-mapping.md`, `docs/mockup-scope.md`, `docs/mockup-design-decisions.md`, `docs/mockup-open-questions.md`, `docs/mockup-progress.md`, serta `prompts/PROMPT 0-...md` dan `prompts/PROMPT 1 — ...md` sebagai landasan sebelum menyusun IA final.
- Murni dokumentasi/desain: tidak ada kode yang diubah, tidak ada halaman diimplementasikan, tidak ada rename massal, tidak ada fitur dihapus, tidak ada route/sidebar yang benar-benar diubah di codebase.
- **Cakupan pekerjaan:**
  - Information Architecture final: 9 kelompok baseline Prompt 3-A dievaluasi satu per satu; Operations dan Travelers diputuskan **tidak** jadi menu top-level (melebur jadi tab Project Detail), Vendor dipertahankan top-level; CRM disederhanakan jadi 4 sub-menu (Prospects/Clients/Opportunities/Quotations) dengan Contacts/Activities sebagai tab kontekstual di Party Detail.
  - Route inventory lengkap per kelompok menu (path, page name, parent menu, purpose, required data, main reusable component, access role, demo inclusion, status foundation/phase later/deferred/excluded), termasuk pemetaan eksplisit 9 dead link sidebar lama ke tujuan barunya.
  - Project Detail Structure dikonsolidasikan dari 6 tab existing menjadi 8 tab final (Overview, Itinerary & Services, Travelers, Vendors, Finance, Tasks, Documents, Activity & Changes), dengan sub-section kondisional sesuai kombinasi layanan project; tab tetap satu route (`/projects/[id]`) dengan state client-side, bukan nested route.
  - Model UI Party/Prospect/Client dirinci: satu record `Party` dengan `lifecycleStatus`, transisi Prospect→Client otomatis saat Opportunity Won, history tidak hilang.
  - Opportunity-to-Project workflow dirancang lengkap (diagram Mermaid stage + checklist efek Won) dengan model role approval dua-langkah (Sales mengajukan, Management/Super Admin menyetujui) — dipilih karena daftar role tidak menyediakan "Sales Manager" terpisah dan tetap merepresentasikan pemisahan tanggung jawab sesuai instruksi Prompt 3-E.
  - Project Status (8 status + diagram transisi + attention condition) dan Service Status generik (lifecycle sama untuk Flight/Hotel/Transportation/MICE, dibedakan lewat subtype field, bukan status berbeda) dirancang sesuai Prompt 3-F dan 3-G.
  - Role & Access Matrix penuh untuk 11 role x 6 modul dengan 5 access level (`NONE`/`VIEW`/`MANAGE`/`APPROVE`/`ADMIN`), plus action flag khusus (view financial info, manage users, approve, delete/export mock).
  - Dashboard Role Behavior: satu dashboard dengan widget kondisional per role, bukan dashboard terpisah per role.
- **Resolusi open questions Prompt 2:** Q1–Q6 diresolusi tuntas (nasib wizard `/projects/create`, scope `Tasks`, Operations/Travelers top-level vs tab, 9 dead link, menu `Settings`, `dashboard/AIAssistant.vue`) — seluruhnya dicatat sebagai keputusan **LOCKED** baru (entri #18–#31 di `docs/mockup-design-decisions.md`), sesuai instruksi eksplisit Prompt 3 untuk "memfinalisasikan rancangan". Q7–Q8 tetap terbuka (di luar scope IA/route/role); Q9 baru ditambahkan (threshold numerik attention/approval, sengaja ditunda ke implementasi).
- Output: `docs/mockup-information-architecture.md` (dibuat baru), `docs/route-and-role-matrix.md` (dibuat baru), `docs/mockup-design-decisions.md` (diupdate, +14 entri LOCKED baru), `docs/mockup-open-questions.md` (diupdate, Q1–Q6 ditandai RESOLVED, +Q9), `docs/mockup-scope.md` (diupdate, mencerminkan IA final), `docs/mockup-progress.md` (diupdate, entri ini).
- **Belum dikerjakan** (menunggu prompt berikutnya): `docs/mockup-data-scenarios.md` (skenario data 3 tipe demo) dan seluruh implementasi kode — scope Prompt 4 (dokumentasi lanjutan) dan Prompt 5 (cleanup/foundation) ke atas.
