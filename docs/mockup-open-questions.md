# Mockup Open Questions — MANOVA

Status dokumen: **direstrukturisasi di Prompt 4** sesuai Prompt 4 bagian F. Bagian utama dokumen ini (bagian 1–4) **hanya berisi pertanyaan yang benar-benar belum diputuskan** — pertanyaan yang sudah diresolusi di Prompt 2/3 dipindahkan ke Arsip (bagian 5) agar tidak mengulang keputusan yang sudah `LOCKED`, tapi tetap tidak dihapus (konsisten dengan aturan append-only sebelumnya).

**Format setiap entri:** ID · Category · Blocking status · Impact · Recommendation · Owner · Status.

---

## 1. Blocking Before Foundation

*(Tidak ada.)* Tidak ditemukan open question yang benar-benar memblokir dimulainya coding fase Foundation — seluruh keputusan fondasi (stack, reuse strategy, IA, route, role, Party model, Opportunity-to-Project workflow) sudah `LOCKED` (lihat `docs/mockup-design-decisions.md`).

## 2. Blocking Before Module Implementation

### Q8 — Kelengkapan Tooling Lint/Typecheck/Test
- **Category:** Tooling / Code Quality
- **Blocking:** **Blocking before module implementation** — **masih belum diselesaikan setelah Prompt 5** (lihat update di bawah). Tidak memblokir Foundation itu sendiri (build tetap jadi quality gate yang valid), tapi harus diselesaikan sebelum masuk fase CRM.
- **Impact:** Tanpa script `lint`/`typecheck`/`test`, regresi kualitas kode di seluruh fase implementasi berikutnya (CRM s/d Administration) tidak akan tertangkap otomatis (risiko dicatat sejak audit Prompt 1 bagian 13).
- **Recommendation:** Lengkapi `eslint` inti + tambah script `lint`; putuskan juga script `typecheck` (catatan: `nuxi typecheck` memicu instalasi `vue-tsc` yang belum ada di lockfile — evaluasi dulu terhadap kebijakan penambahan package D-036 sebelum instal). Lepas `@nuxtjs/eslint-config-typescript` sebagai devDependency mati bila memang tidak dipakai.
- **Owner:** Tidak diketahui (keputusan teknis tim implementasi).
- **Update Prompt 5:** Foundation coding **tidak** menginstal `eslint`/`vue-tsc` (lihat D-045, `docs/mockup-design-decisions.md`) karena Prompt 5 sendiri tidak secara eksplisit memerintahkan instalasi package baru. Validasi yang dijalankan sebagai gantinya: `pnpm run build` (sukses, exit 0, 3x run) dan `pnpm exec vitest run` (0 test file, pre-existing). Q8 tetap terbuka, sekarang eksplisit sebagai blocker sebelum Prompt 6 (CRM) dimulai.
- **Update Prompt 19 (Change Request, 2026-07-30):** Tetap belum diselesaikan — `npm run build` sukses, `npx vitest run` "No test files found", `npx nuxi typecheck` gagal (`vue-tsc` tidak terpasang). Instalasi package baru tetap di luar scope literal Prompt 19 (D-036 tidak berubah).
- **Status:** `NEEDS_VALIDATION`.

---

## 3. Non-Blocking

### Q7 — Adopsi `vee-validate` + `zod` untuk Form Baru
- **Category:** Implementation Pattern
- **Blocking:** **Non-blocking** — form baru bisa dimulai dengan pola manual existing dan dimigrasikan kemudian bila diputuskan lain; tidak menghentikan progres modul manapun.
- **Impact:** Risiko dua pola validasi berbeda hidup berdampingan tanpa alasan terdokumentasi bila tidak diputuskan sebelum banyak form baru dibangun (CRM, Traveler, Vendor, dll.).
- **Recommendation:** Adopsi `vee-validate`+`zod` untuk seluruh form baru MANOVA — dependency sudah terpasang (0% dipakai saat ini per audit Prompt 1), sejalan dengan kebijakan penambahan package (D-036: pakai yang sudah ada sebelum mengusulkan alternatif). Pola manual existing (`create.vue`/`edit.vue`) tidak perlu dimigrasi paksa, cukup tidak dijadikan acuan untuk form baru.
- **Owner:** Tidak diketahui.
- **Status:** `PROPOSED` (rekomendasi di atas, menunggu konfirmasi tim implementasi).

---

## 4. Deferred

### Q9 — Nilai Ambang Batas Numerik untuk Attention Condition
- **Category:** Business Rule / Threshold
- **Blocking:** **Non-blocking / Deferred** — mockup dapat berjalan dengan asumsi aman (lihat Recommendation), sesuai instruksi Prompt 4-F untuk tidak menjadikan hal kecil sebagai blocker bila ada asumsi aman.
- **Impact:** Tanpa angka pasti, widget "Attention list" dan laporan terkait tidak bisa diimplementasikan presisi — namun ini bukan penghalang, karena asumsi default di bawah sudah cukup realistis untuk mockup.
- **Recommendation (diadopsi sebagai asumsi default, bukan lagi murni pertanyaan terbuka):** Budget overrun memicu attention bila `Actual Cost > 100% Budget`; upcoming departure memicu attention bila keberangkatan ≤ 30 hari dari tanggal berjalan; invoice/task overdue memicu attention segera setelah melewati tanggal jatuh tempo (tanpa masa tenggang). Nilai ini dipakai konsisten di `docs/mockup-data-scenarios.md`. Dicatat sebagai `DEFERRED` (bukan `LOCKED`) karena tetap terbuka untuk disesuaikan bila ada masukan bisnis nyata di kemudian hari — bukan karena mockup tidak bisa berjalan tanpanya.
- **Owner:** Tidak diketahui (idealnya divalidasi ke stakeholder bisnis MANOVA bila tersedia).
- **Status:** `DEFERRED`.

### Q10 — Approval Won Berjenjang Berdasarkan Nilai/Kompleksitas Opportunity
- **Category:** Business Rule / Role Model
- **Blocking:** **Deferred** — model approval dua-langkah sederhana (D-025) sudah cukup untuk mockup, tidak butuh angka threshold apa pun untuk berjalan.
- **Impact:** Tidak ada, karena model yang berjalan (D-025) tidak bergantung pada keputusan ini.
- **Recommendation:** Tinjau ulang hanya bila ada data threshold nilai/kompleksitas nyata dari bisnis MANOVA di fase setelah mockup awal (lihat D-032).
- **Owner:** Tidak diketahui.
- **Status:** `DEFERRED`.

### Q11 — Direktori Operations/Travelers Lintas-Project sebagai Menu Top-Level
- **Category:** Information Architecture
- **Blocking:** **Deferred** — keputusan D-020 (tab di Project Detail) sudah final untuk fase mockup ini.
- **Impact:** Tidak ada untuk fase ini; berdampak ke IA hanya bila kebutuhan agregasi lintas-project benar-benar muncul di fase setelah mockup awal.
- **Recommendation:** Evaluasi ulang setelah demo awal, berdasarkan masukan pengguna nyata (mis. kebutuhan "semua traveler yang dokumennya belum lengkap di semua project").
- **Owner:** Tidak diketahui.
- **Status:** `DEFERRED` (lihat D-033).

### Q12 — Self-Service Quotation Submission dari Supplier Portal (Prompt 19)
- **Category:** Business Rule / Scope Boundary
- **Blocking:** **Non-blocking / Deferred** — literal Prompt 19-7 hanya meminta supplier "melihat" assignment/quotation/order sendiri, tidak eksplisit meminta aksi submit quotation baru dari portal supplier sendiri (submit quotation sejauh ini tetap terjadi dari sisi internal, Vendor Detail — Section 13).
- **Impact:** `/supplier/orders` saat ini read-only (tabel assignment + quotation), tidak ada form submit quotation baru dari sisi supplier. Bila ke depannya supplier diharapkan bisa mengajukan quotation sendiri (bukan hanya dilihat), perlu form baru + kemungkinan notifikasi ke internal.
- **Recommendation:** Tunggu konfirmasi eksplisit — menambah form submit di `/supplier/orders` adalah perubahan aditif kecil (`submitVendorQuotation`, `app/data/index.ts`, sudah ada dan reusable) bila benar-benar dibutuhkan.
- **Owner:** Tidak diketahui.
- **Status:** `DEFERRED`.

---

## 4a. Ditemukan Section 00 — Current Progress Reconciliation (roadmap baru Section 00–24)

Section 00 (`prompts/Section 00 — Current Progress Reconciliation.md`, dijalankan 2026-08-01 lewat `prompts/99-RUN-CURRENT-SECTION.md`) memperkenalkan roadmap Section 00–24 baru (`prompts/01-PROTOKOL-WAJIB.md` versi terbaru, role final: Super Admin, Management, Sales, Account Executive, Product Planner/Travel Consultant, Project Manager, Operations, Ticketing, Accommodation, Transportation, MICE, Procurement/Vendor Management, Finance, Viewer/Auditor, Client, Supplier). Audit ini menemukan gap konkret berikut, dicatat sebagai open question baru (bukan dikerjakan sekarang — di luar scope Section 00 yang murni audit):

### Q13 — 3 Role Baru Belum Ada di `RoleId` (Client, Product Planner, Procurement)
- **Category:** Data Model / Role
- **Blocking:** ~~Blocking sebelum Section 08/10/17~~ — **RESOLVED di Section 02** (2026-08-01, D-059, `docs/mockup-design-decisions.md`).
- **Impact:** `app/types/user.ts` (`RoleId`) kini 16 nilai, memuat `client`/`product-planner`/`procurement`. Sisa pekerjaan (fitur penuh Client Portal, Product Planning module, RFQ/Procurement workflow) tetap milik Section 08/10/17 masing-masing — hanya role/permission/nav/shell minimal yang diselesaikan Section 02.
- **Recommendation:** Tidak berlaku lagi — sudah dikerjakan.
- **Owner:** Tidak diketahui.
- **Status:** `RESOLVED` (Section 02).

### Q14 — Dedicated Management Approval Queue Belum Ada
- **Category:** UX / Information Architecture
- **Blocking:** **Blocking sebelum Section 06 (Management Approval, Won dan Client Activation)** dianggap selesai penuh.
- **Impact:** Commercial Approval (submit/approve/reject Quotation) saat ini hanya dapat diakses per-Opportunity dari `/crm/opportunities/[id]` — tidak ada halaman agregat "Approval Queue" yang menampilkan seluruh quotation menunggu approval lintas Opportunity untuk Management. Client confirmation (gerbang tambahan sebelum Mark as Won per Section 06) juga belum ada representasinya di data model maupun UI.
- **Recommendation:** Section 06 menambahkan halaman/queue baru + field/aktivitas "client confirmation" pada `Opportunity` atau `Quotation` (field aditif, ikuti pola D-049/D-055).
- **Owner:** Tidak diketahui.
- **Status:** `NEEDS_VALIDATION`.

### Q15 — Public Lead Intake Belum Ada
- **Category:** Scope Boundary
- **Blocking:** **Blocking sebelum Section 03 (Public Lead Intake)**.
- **Impact:** Seluruh Lead saat ini dibuat oleh Sales lewat dialog "New Lead" di dalam dashboard yang sudah ter-autentikasi (`/customer-journey/leads`) — tidak ada form publik tanpa login dengan consent/UTM/duplicate-suggestion seperti diminta Section 03.
- **Recommendation:** Section 03 menambahkan route publik baru (di luar layout `dashboard`/`middleware: auth`) yang menulis ke `LEADS` centralized state yang sama (bukan dataset paralel).
- **Owner:** Tidak diketahui.
- **Status:** `NEEDS_VALIDATION`.

### Q16 — Taksonomi Status Project Order Baru vs `ProjectStatus` Existing
- **Category:** Data Model / Business Rule
- **Blocking:** **Blocking sebelum Section 09 (Project Order dan Handover)** — perlu keputusan desain eksplisit (LOCKED) sebelum diimplementasikan, mengikuti pola D-049/D-055 (aditif/dirivasi) alih-alih merestrukturisasi.
- **Impact:** Section 09 meminta status Project Order: Created, Handover Pending, Planning, Confirmed, Ready, In Progress, Completed, Closed, On Hold, Cancelled — berbeda dari `ProjectStatus` existing (`draft`/`planning`/`confirmed`/`in-progress`/`ongoing-trip`/`completed`/`on-hold`/`cancelled`, D-028 LOCKED, dipakai luas Section 08–18/Prompt 19). Tidak ada mekanisme "AE-to-PM handover accept/return" saat ini — Project langsung dibuat dengan PM default (`DEFAULT_PROJECT_OWNER_ID`) tanpa langkah accept eksplisit.
- **Recommendation:** Evaluasi opsi sama seperti D-053/D-056 (Prompt 20): derivasi status tampilan baru dari kombinasi `ProjectStatus` + field handover baru, TANPA merestrukturisasi `ProjectStatus` yang sudah LOCKED dan dipakai luas — dikerjakan saat Section 09 dimulai, bukan Section 00.
- **Owner:** Tidak diketahui.
- **Status:** `NEEDS_VALIDATION`.

Detail temuan lengkap: `docs/mockup-section-reports/section-00-current-progress-reconciliation.md`, `docs/frontend-known-issues.md`.

---

## 5. Arsip — Pertanyaan yang Sudah Diresolusi (Prompt 2 → Prompt 3)

Dipertahankan sebagai jejak historis (tidak dihapus), tidak lagi dianggap "open" — detail keputusan lengkap ada di `docs/mockup-design-decisions.md`.

| ID lama | Pertanyaan (ringkas) | Diresolusi di | Keputusan |
|---|---|---|---|
| Q1 | Fungsi final wizard `/projects/create` vs alur Opportunity Won→Project otomatis | Prompt 3 | D-018 — direpurpose jadi konfirmasi otomatis, bukan entry point manual |
| Q2 | `/tasks` top-level vs Kanban tab Project Workspace | Prompt 3 | D-019 — tidak top-level, melebur ke tab "Tasks" |
| Q3 | Operations & Travelers: menu top-level atau sub-tab | Prompt 3 | D-020 — sub-tab Project Detail; Vendor tetap top-level |
| Q4 | Nasib 9 dead link sidebar | Prompt 3 | D-021 — dipetakan satu per satu ke tujuan baru/excluded |
| Q5 | Nasib menu `Settings` | Prompt 3 | D-022 — minimal, via popover profil, bukan sidebar utama |
| Q6 | Nasib `dashboard/AIAssistant.vue` | Prompt 3 | D-023 — tidak dilanjutkan dalam desain dashboard MANOVA |

Detail konteks/opsi asli pertanyaan di atas dapat ditelusuri di riwayat versi dokumen ini sebelum Prompt 4 (tidak diulang di sini untuk menghindari duplikasi makna dengan `docs/mockup-design-decisions.md`, sesuai instruksi Prompt 4-A "hapus duplikasi hanya bila maknanya benar-benar sama").
