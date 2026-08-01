# Mockup Open Questions — MANOVA

Status dokumen: **direstrukturisasi di Prompt 4** sesuai Prompt 4 bagian F. Bagian utama dokumen ini (bagian 1–4) **hanya berisi pertanyaan yang benar-benar belum diputuskan** — pertanyaan yang sudah diresolusi di Prompt 2/3 dipindahkan ke Arsip (bagian 5) agar tidak mengulang keputusan yang sudah `LOCKED`, tapi tetap tidak dihapus (konsisten dengan aturan append-only sebelumnya).

**Format setiap entri:** ID · Category · Blocking status · Impact · Recommendation · Owner · Status.

---

## 1. Blocking Before Foundation

*(Tidak ada.)* Tidak ditemukan open question yang benar-benar memblokir dimulainya coding fase Foundation — seluruh keputusan fondasi (stack, reuse strategy, IA, route, role, Party model, Opportunity-to-Project workflow) sudah `LOCKED` (lihat `docs/mockup-design-decisions.md`).

## 2. Blocking Before Module Implementation

### Q8 — Kelengkapan Tooling Lint/Typecheck/Test
- **Category:** Tooling / Code Quality
- **Blocking:** ~~Blocking before module implementation~~ — **RESOLVED Section 24** (2026-08-01).
- **Impact:** `eslint`+`vue-tsc` kini terpasang dan diverifikasi (`npm run lint`/`npm run typecheck` berfungsi). Regresi kualitas kode sepanjang Section 06–23 TIDAK tertangkap otomatis oleh lint/typecheck (hanya `build` sebagai gate) — dicatat sebagai keterbatasan historis yang genuinely berlaku selama itu, sekarang ditutup.
- **Recommendation:** Tidak berlaku lagi — sudah dikerjakan (`eslint@8.57.1`+`vue-tsc@2.2.12` via `pnpm add -D`, `.eslintrc.cjs` baru, script `lint`/`typecheck` di `package.json`). Detail lengkap termasuk hasil lint (~9.428 temuan style, non-blocking): `docs/frontend-known-issues.md` bagian 19, `docs/mockup-section-reports/section-24-full-regression-final-docs.md`.
- **Owner:** Tidak diketahui (keputusan teknis tim implementasi).
- **Update Prompt 5:** Foundation coding **tidak** menginstal `eslint`/`vue-tsc` (lihat D-045, `docs/mockup-design-decisions.md`) karena Prompt 5 sendiri tidak secara eksplisit memerintahkan instalasi package baru. Validasi yang dijalankan sebagai gantinya: `pnpm run build` (sukses, exit 0, 3x run) dan `pnpm exec vitest run` (0 test file, pre-existing). Q8 tetap terbuka, sekarang eksplisit sebagai blocker sebelum Prompt 6 (CRM) dimulai.
- **Update Prompt 19 (Change Request, 2026-07-30):** Tetap belum diselesaikan — `npm run build` sukses, `npx vitest run` "No test files found", `npx nuxi typecheck` gagal (`vue-tsc` tidak terpasang). Instalasi package baru tetap di luar scope literal Prompt 19 (D-036 tidak berubah).
- **Update Section 24 (2026-08-01, FINAL):** `eslint`/`vue-tsc` terpasang, `lint`/`typecheck` script berfungsi, build tetap sukses (exit 0), typecheck 0 error. Test (`vitest`) TETAP "No test files found" — tidak ada test file ditulis sepanjang 24 section (di luar scope literal manapun, dicatat sebagai keterbatasan bukan kegagalan).
- **Status:** `RESOLVED` (Section 24).

---

## 3. Non-Blocking

### Q7 — Adopsi `vee-validate` + `zod` untuk Form Baru
- **Category:** Implementation Pattern
- **Blocking:** ~~Non-blocking~~ — **selesai tidak-diblokir**: 24 section (Section 00–24) berjalan penuh memakai pola manual existing tanpa migrasi, tanpa insiden kualitas tercatat akibat pola ini.
- **Impact:** Risiko dua pola validasi berbeda hidup berdampingan tidak pernah terjadi — seluruh form baru sepanjang roadmap (Lead Qualification, Requirement Detail, Quotation, Cost Sheet, RFQ, Booking lifecycle, Change Request, Invoice, Master Data, dst.) konsisten memakai pola manual (`ref`+validasi inline).
- **Recommendation:** Tidak berlaku lagi sebagai rekomendasi aktif untuk roadmap ini (sudah selesai). Migrasi ke `vee-validate`+`zod` tetap layak dipertimbangkan HANYA bila proyek dilanjutkan ke fase pengembangan berikutnya di luar roadmap 25-tahap ini — lihat `docs/frontend-end-to-end-implementation-guide.md` bagian 8.
- **Owner:** Tidak diketahui.
- **Status:** `DEFERRED_PERMANENTLY` (Section 24, 2026-08-01 — keputusan final, bukan lagi terbuka; lihat `docs/frontend-known-issues.md` bagian 19).

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
- **Blocking:** ~~Non-blocking / Deferred~~ — **RESOLVED Section 17** (2026-08-01, D-074, `docs/mockup-design-decisions.md`).
- **Impact:** `/supplier/orders` (Section 13 lama, VendorQuotation submit-accept-reject) TETAP read-only sebagaimana adanya — TIDAK diubah. Sebagai gantinya, Section 17 menambahkan jalur self-service BARU dan lebih lengkap: `/supplier/rfq/[id]` (respons harga per-line-item terhadap RFQ formal yang mengundang company, resubmit diizinkan sampai keputusan diambil) DAN `/supplier/service-orders/[id]` (Invoice Submission preview form — `submitSupplierInvoice`, hanya untuk Service Order berstatus `fulfilled` milik vendor yang sama). Ini melebihi resolusi literal Q12 asli (yang hanya membahas quotation submission) — sekaligus menutup kebutuhan "supplier quotation, documents, fulfillment updates, invoice submission preview" dari Wajib Section 17.
- **Recommendation:** Tidak berlaku lagi — sudah dikerjakan. `submitVendorQuotation` (Section 13) tetap TIDAK dipanggil dari sisi supplier (deliberate, dua jalur berbeda — lihat D-074 poin 2).
- **Owner:** Tidak diketahui.
- **Status:** `RESOLVED` (Section 17).

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
- **Impact:** ~~Commercial Approval (submit/approve/reject Quotation) saat ini hanya dapat diakses per-Opportunity dari `/crm/opportunities/[id]` — tidak ada halaman agregat "Approval Queue" yang menampilkan seluruh quotation menunggu approval lintas Opportunity untuk Management. Client confirmation (gerbang tambahan sebelum Mark as Won per Section 06) juga belum ada representasinya di data model maupun UI.~~ **RESOLVED sepenuhnya oleh Section 05+06** (2026-07-31, D-062/D-063): `Opportunity.clientConfirmedAt`/`clientConfirmationNote` + `recordClientConfirmation` + dialog AE-facing (Section 05); halaman agregat `/crm/quotations` (Section 06) dengan 3 tab — Menunggu Approval, Menunggu Client Confirmation (visibilitas Management), Semua Quotation — plus dialog review detail (margin/discount/tax/markup/terms/complexity/risk) dan aksi Approve/Reject langsung dari queue.
- **Recommendation:** Tidak ada — resolved. Notifikasi push/email untuk Management (di luar scope literal, tidak ada integrasi nyata per protokol) tetap tidak dikerjakan, dicatat sebagai batasan mock yang disengaja, bukan gap tersembunyi.
- **Owner:** Tidak diketahui.
- **Status:** `RESOLVED` (Section 06, 2026-07-31).

### Q15 — Public Lead Intake Belum Ada
- **Category:** Scope Boundary
- **Blocking:** ~~Blocking sebelum Section 03~~ — **RESOLVED di Section 03** (2026-08-01, D-060, `docs/mockup-design-decisions.md`).
- **Impact:** `/lead-intake` (baru) — form publik 4 kategori, consent, UTM/referrer preview, duplicate suggestion, menulis ke `LEADS` centralized state yang sama.
- **Recommendation:** Tidak berlaku lagi — sudah dikerjakan.
- **Owner:** Tidak diketahui.
- **Status:** `RESOLVED` (Section 03).

### Q16 — Taksonomi Status Project Order Baru vs `ProjectStatus` Existing
- **Category:** Data Model / Business Rule
- **Blocking:** **Blocking sebelum Section 09 (Project Order dan Handover)** — perlu keputusan desain eksplisit (LOCKED) sebelum diimplementasikan, mengikuti pola D-049/D-055 (aditif/dirivasi) alih-alih merestrukturisasi.
- **Impact:** ~~Section 09 meminta status Project Order: Created, Handover Pending, Planning, Confirmed, Ready, In Progress, Completed, Closed, On Hold, Cancelled — berbeda dari `ProjectStatus` existing... Tidak ada mekanisme "AE-to-PM handover accept/return" saat ini.~~ **RESOLVED** (2026-07-31, D-066): `ProjectOrderStatus` (10 nilai) dirivasi via `getProjectOrderStatus()` dari `ProjectStatus` (tidak diubah) + field handover/ready/closure baru. `acceptProjectHandover`/`returnProjectHandover` (baru) melengkapi mekanisme Accept/Return Handover dengan reason.
- **Recommendation:** Tidak ada — resolved sesuai rekomendasi asli (derivasi aditif, pola D-053/D-056).
- **Owner:** Tidak diketahui.
- **Status:** `RESOLVED` (Section 09, 2026-07-31).

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
