# Section 15 — Project Finance

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/17-PROMPT-15-PROJECT-FINANCE.md`, dijalankan lewat `prompts/99-RUN-CURRENT-SECTION.md` atas perintah user.

---

## 1. Section Objective dan Scope

Membangun `/finance/invoices` dan `/finance/payments` (sebelumnya `ModulePlaceholder` sejak Section 05) menjadi list/detail penuh (invoice lintas-project dengan aging, payment history per invoice, payment lintas-project), dan merestrukturisasi tab "Finance" pada Project Detail (baseline Foundation, sebelumnya menampilkan Budget/Actual/Quotation ke SEMUA role tanpa pembatasan) dengan Budget, Estimated/Actual Cost, Committed Vendor Cost, Variance, Quotation value, Margin, dan **visibilitas finansial berbasis role** sesuai hard rule eksplisit ("User tanpa finance access tidak melihat nilai sensitif"). **Tidak mengerjakan** modul lain, tidak menyentuh Overview/Travelers/Itinerary & Services/Vendors/Activity & Changes (Section 10/11/12/13/14) kodenya.

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/17-PROMPT-15-PROJECT-FINANCE.md`, `CLAUDE.md`, seluruh `docs/*.md` (implementation-state, section-progress, change-impact-log, data-scenarios bagian 5 "Role-Restricted Finance View", design-decisions D-037, route-and-role-matrix bagian 5/5.1), `docs/mockup-section-reports/section-05-foundation.md` s/d `section-14-project-changes.md`, source code aktual (`app/types/finance.ts`, `app/data/finance.ts`, `app/data/index.ts`, `app/constants/roles.ts`, `app/composables/usePermissions.ts`, `app/pages/finance/index.vue`, `app/pages/finance/invoices.vue`, `app/pages/finance/payments.vue`, `app/pages/projects/[id]/index.vue`, `app/pages/index.vue` untuk memastikan tidak ada duplikasi widget Dashboard), `git status`/`git log`.

## 3. Existing Implementation yang Diperiksa

`/finance/invoices` dan `/finance/payments` masih `ModulePlaceholder` (Section 05). `/finance` (overview) sudah shell nyata (Outstanding stats). Tab "Finance" Project Detail (Section 05, tidak pernah diberi role-gating oleh section manapun) menampilkan Budget/Actual Cost/Nilai Quotation + tabel invoice ke **seluruh** role yang bisa membuka `canView('project')` — bertentangan langsung dengan hard rule Section 15 dan dengan `docs/mockup-data-scenarios.md` bagian 5 (Role-Restricted Finance View) yang sudah menetapkan sejak Prompt 4 bahwa Sales hanya boleh melihat Quotation+Outstanding ringkas, PM tidak melihat Margin. `usePermissions()` sudah punya `canViewFinancials` (role-set identik dengan `ROLE_MODULE_ACCESS.finance` VIEW+: super-admin/management/finance/project-manager/viewer) dan `canView('finance')` — dikonfirmasi cukup presisi tanpa perlu constant baru. Dashboard (Section 06) sudah punya widget Budget vs Actual/Cost Breakdown/Outstanding sendiri, dikonfirmasi tidak terganggu dan tidak perlu diduplikasi. `git log`/`git status` dikonfirmasi bersih (kecuali `prompts/99-RUN-CURRENT-SECTION.md` yang diedit user), commit terakhir `069c898 "SECTION14-PROJECT-CHANGES"`.

## 4. Decisions yang Digunakan

D-037 (format Rupiah konsisten, dipakai `formatCurrencyIdr` di seluruh angka baru), Route Matrix bagian 5 (Role & Access Matrix modul Finance — `ROLE_MODULE_ACCESS.finance`, sumber tunggal, dipakai apa adanya), Route Matrix bagian 5.1 ("View financial information" — PM eksplisit "terbatas budget vs actual", dasar pengecualian Margin untuk PM), `docs/mockup-data-scenarios.md` bagian 5 (Role-Restricted Finance View, contoh konkret PRJ-103 dipakai sebagai spesifikasi literal untuk tier visibilitas).

## 5. Implementation Summary dan User Flow

- **`/finance/invoices`:** list seluruh invoice lintas-project (search + filter status), kolom Aging (hari overdue / hari tersisa / "Lunas"), klik baris → dialog detail (metadata + riwayat pembayaran, reuse `getPaymentsByInvoice`).
- **`/finance/payments`:** list seluruh payment lintas-project (invoice, project, jumlah, tanggal diterima), search.
- **Tab "Finance" Project Detail — role-tiered:**
  - **Tier 1 (`canViewFinancials` — Super Admin/Management/Finance/PM/Viewer):** Budget, Actual Cost, **Variance** (Budget − Actual, baru), Nilai Quotation, **Committed Vendor Cost** (baru, sum quotation vendor `accepted` — Section 13, reuse), **Margin** (baru, Quotation − Actual) khusus non-PM, tabel invoice lengkap + kolom **Aging** (baru), **Riwayat Pembayaran** per invoice (baru).
  - **Tier 0 (role lain — Sales, Operations, Ticketing, Accommodation, Transportation, MICE, seluruhnya `finance: NONE`):** hanya Nilai Quotation + **Outstanding** (ringkas, agregat — baru), tanpa Budget/Actual/Committed/Margin/tabel invoice individual. Pesan penjelas ditampilkan.
  - **Margin dikecualikan khusus untuk Project Manager** (`canViewMargin = canViewFinancials && role !== 'project-manager'`) — sesuai Route Matrix bagian 5.1 eksplisit, satu-satunya pengecualian sempit tambahan yang dibutuhkan.

**User flow yang bisa didemokan:** buka `/projects/PRJ-102?tab=finance` sebagai Finance/Super Admin → lihat Budget Rp310.000.000, Actual Cost Rp335.000.000, **Variance -Rp25.000.000** (merah, over budget), Nilai Quotation Rp345.000.000, Committed Vendor Cost Rp345.000.000, Margin Rp10.000.000, tabel invoice dengan INV-1022 menampilkan **"9 hari overdue"** (merah), dan Riwayat Pembayaran menampilkan PAY-1021 → beralih role ke Project Manager → Margin card hilang, sisanya tetap tampil → beralih ke Sales → seluruh detail hilang, hanya tersisa Nilai Quotation Rp345.000.000 dan Outstanding Rp95.000.000 dengan pesan "Ringkasan terbatas...".

## 6. Routes

Tidak ada route baru. `/finance/invoices`, `/finance/payments` (Section 05 shell) diisi penuh. `/projects/[id]` (tab `finance`) diisi penuh.

## 7. Files Created, Changed, dan Removed

**Created:** `docs/mockup-section-reports/section-15-project-finance.md`.

**Changed:**
- `app/utils/attention.ts` — `+invoiceAgingDays`.
- `app/data/index.ts` — `+getInvoiceOutstandingIdr`, `+getProjectOutstandingIdr`, `+getCommittedVendorCostIdr` (seluruhnya selektor turunan murni, tidak ada fixture/type yang diubah).
- `app/pages/finance/invoices.vue` — ditulis ulang total (dari `ModulePlaceholder`).
- `app/pages/finance/payments.vue` — ditulis ulang total (dari `ModulePlaceholder`).
- `app/pages/projects/[id]/index.vue` — tab "Finance" ditulis ulang total (role-tiered); tab lain **tidak diubah** (diverifikasi smoke test, bagian 13).

**Removed:** Tidak ada.

## 8. Components Reused dan Created

**Reused:** `StatsCard`, `Table*`, `SectionCard`, `StatusBadge`, `Dialog*`, `DetailMetadataList`, `EmptyState`, `Input`. Tidak ada komponen file baru.

**Created:** Tidak ada.

## 9. Types, Constants, Fixtures, dan Mock State

**Tidak ada perubahan type/constant/fixture** — `Invoice`/`Payment`/`INVOICES`/`PAYMENTS` (Foundation) dipakai apa adanya. Section 15 murni menambah selektor turunan (bagian 7) dan tampilan. Nilai Margin/Variance/Committed/Outstanding yang ditampilkan seluruhnya dihitung on-the-fly dari field existing (`budgetIdr`/`actualCostIdr`/`quotationAmountIdr`/`Invoice.amountIdr`/`Payment.amountIdr`/`VendorQuotation.amountIdr`), diverifikasi presisi cocok dengan angka yang sudah didokumentasikan sejak Prompt 4 (`docs/mockup-data-scenarios.md` bagian 1.3/2.3/3.3) — lihat bagian 4i dokumen tsb.

## 10. Responsive Behavior

`/finance/invoices` filter row: `flex-col sm:flex-row`. Tab Finance stats: `grid-cols-1 sm:grid-cols-3` (dua baris terpisah: Budget/Actual/Variance, lalu Quotation/Committed/Margin) — konsisten pola existing. Tidak diverifikasi lewat browser interaktif — tidak ada tool headless browser tersedia (konsisten keterbatasan sejak Section 06).

## 11. Loading, Empty, Error, Not-Found, dan Unauthorized States

- **Loading:** Tidak ada simulasi baru.
- **Empty:** `TableEmpty` untuk filter tanpa hasil di `/finance/invoices`/`/finance/payments`; `EmptyState` untuk "Belum ada payment tercatat" (dialog detail invoice tanpa payment, dan tab Finance Riwayat Pembayaran bila tidak ada satu pun invoice punya payment).
- **Error:** Tidak ada state error baru.
- **Not-found:** Tidak berubah dari Section 05 — diverifikasi ulang tetap benar (`PRJ-999?tab=finance`).
- **Unauthorized:** `RoleAccessState` untuk `!canView('finance')` di `/finance/invoices`/`/finance/payments` (baru diterapkan penuh, sebelumnya `ModulePlaceholder` tidak punya role gate eksplisit). Tab Finance Project Detail tetap gerbang `canView('project')` di level halaman (tidak berubah), dengan **tier tampilan internal baru** menggantikan tampilan seragam lama.

## 12. Role Behavior

`canView('finance')` — gerbang akses `/finance/invoices`/`/finance/payments` (baru, sebelumnya tidak ada gate karena masih placeholder). `canViewFinancials` (existing, `usePermissions()`) — gerbang Tier 1 tab Finance Project Detail, **tidak perlu constant baru** karena `FULL_FINANCIAL_VISIBILITY_ROLES` sudah persis sesuai kebutuhan. `canViewMargin` (baru, satu baris turunan dari `canViewFinancials`) — mengecualikan Project Manager dari Margin sesuai Route Matrix bagian 5.1.

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses (exit 0)**.
- `npx vitest run` — "No test files found" (pre-existing, Q8).
- `npx nuxi typecheck` — gagal, `vue-tsc` tidak terpasang (Q8, pre-existing).
- Lint — tidak tersedia (Q8, pre-existing).
- **Smoke test konten mendalam** (curl + grep):
  - `/finance/invoices` — HTTP 200, seluruh 4 label invoice tampil, aging "28 hari overdue" (INV-1021) dan "9 hari overdue" (INV-1022) terverifikasi presisi (cocok `daysUntil` manual terhadap `DEMO_REFERENCE_DATE`).
  - `/finance/payments` — HTTP 200, 3 payment tampil dengan invoice/project yang benar.
  - `/projects/PRJ-101?tab=finance` — Margin "Rp 12.500.000", Committed Vendor Cost "Rp 90.000.000" — cocok persis `docs/mockup-data-scenarios.md` bagian 1.3.
  - `/projects/PRJ-102?tab=finance` — Variance **"-Rp 25.000.000"** (over budget, tone destructive), Margin "Rp 10.000.000", Committed "Rp 345.000.000", Outstanding "Rp 95.000.000" — cocok persis bagian 2.3.
  - `/projects/PRJ-103?tab=finance` — Margin "Rp 220.000.000", Committed "Rp 930.000.000", Outstanding "Rp 700.000.000" — cocok persis bagian 3.3.
  - "Riwayat Pembayaran" terkonfirmasi ter-render.
  - Tidak ditemukan string "Internal Server Error"/"TypeError"/"is not defined" di HTML manapun.
  - **Regresi** — `?tab=overview`, `?tab=vendors`, `?tab=activity-changes`, `/`, `/finance` tetap HTTP 200 tanpa perubahan konten.
- **Verifikasi interaktif** (ganti role dan cek tier Tier 0/Tier 1/Margin berubah live) **tidak dilakukan** — tidak ada tool browser headless (keterbatasan konsisten sejak Section 06; role tersimpan di `localStorage` klien, tidak dapat disimulasikan lewat curl SSR). Dimitigasi lewat code review ketat terhadap `canViewFinancials`/`canViewMargin` (reuse permission existing yang sudah diverifikasi presisi terhadap `ROLE_MODULE_ACCESS` sejak Foundation) dan manual trace kondisi `v-if`/`v-else` template.

## 14. Regression Checks

Section 06 (Dashboard — widget Budget vs Actual/Cost Breakdown/Outstanding tidak disentuh kodenya, dikonfirmasi tetap HTTP 200 dan tidak diduplikasi oleh perubahan Section 15), Section 08 (Opportunity/Quotation — entitas tidak terkait langsung, tidak terdampak), Section 10 (Overview tab — tidak disentuh, dikonfirmasi smoke test), Section 13 (Vendor — `VENDOR_QUOTATIONS` hanya dibaca untuk `getCommittedVendorCostIdr`, tidak dimutasi; tab Vendors dikonfirmasi tidak berubah), Section 14 (Activity & Changes — tidak disentuh, dikonfirmasi smoke test) — seluruhnya diverifikasi tidak beregresi.

## 15. Cross-Section Impact

**Tidak ada entri change-impact-log baru.** Section 15 tidak mengubah shape/data entitas manapun yang dimiliki section sebelumnya — `Invoice`/`Payment` (Foundation) dipakai apa adanya, `VENDOR_QUOTATIONS` (Section 13) hanya dibaca (read-only) untuk agregasi baru. Perubahan pada `/finance/invoices`/`/finance/payments` (dari `ModulePlaceholder` ke implementasi nyata) dan tab "Finance" Project Detail adalah pengisian scope yang memang belum dikerjakan section manapun sebelumnya (`docs/mockup-implementation-state.md` sudah mencatat tab Finance sebagai "baseline Foundation, menyusul Section 15" sejak Section 10), konsisten dengan kriteria protokol bagian C (bukan modifikasi tak terduga atas deliverable section lain).

## 16. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja (`npm run dev` / `node .output/server/index.mjs`, tidak ada deployment publik).

## 17. Known Issues dan Deferred Work

- **Q8 (tooling lint/typecheck/test) masih terbuka** — **sebelas section berturut-turut** (06–15) berjalan tanpa validasi otomatis penuh.
- Tidak ada CRUD invoice/payment (create/edit/delete) — scope literal Section 15 hanya meminta "list/detail" dan "payment, outstanding, payment history, dan aging" (tampilan), bukan mutasi; konsisten dengan tidak adanya bullet "add/edit/remove mock" seperti Section 11.
- Verifikasi interaktif ganti-role untuk memastikan tier visibilitas berubah live tidak dilakukan langsung (keterbatasan tooling lingkungan, konsisten sejak Section 06).
- "Estimated cost" (scope bullet) tidak dimodelkan sebagai field terpisah dari `budgetIdr` — `Project.budgetIdr` sudah merepresentasikan estimasi/rencana biaya sejak Foundation, menambah field `estimatedCostIdr` terpisah akan menduplikasi konsep tanpa kebutuhan nyata yang berbeda pada mockup ini.

## 18. Protection Notes untuk Section Berikutnya

- Tab "Finance" Project Detail dan `/finance/invoices`/`/finance/payments` kini sumber lengkap untuk budget/cost/margin/invoice/payment — Section 16 (Reports) **tidak perlu** menduplikasi tampilan ini; cukup agregasi lintas-project di atas selektor existing (`getProjectOutstandingIdr`, `getCommittedVendorCostIdr`, dst.).
- `getInvoiceOutstandingIdr`/`getProjectOutstandingIdr`/`getCommittedVendorCostIdr` (`app/data/index.ts`) — gunakan selektor ini untuk kebutuhan agregasi finansial baru, jangan hitung ulang logic yang sama di tempat lain.
- `canViewFinancials`/`canViewMargin` — pola role-tiered ini (bukan constant baru, murni reuse + satu pengecualian) sebaiknya diikuti bila Section 16/17 butuh gating visibilitas finansial serupa.
- Overview/Travelers/Itinerary & Services/Vendors/Activity & Changes (Section 10/11/12/13/14) **tidak disentuh** — perubahan apa pun pada tab tsb ke depannya harus jelas kepemilikannya.

## 19. Recommended Next Section

Section 16 — Reports (`prompts/18-PROMPT-16-REPORTS.md`), dengan rekomendasi sangat kuat menyelesaikan Q8 terlebih dahulu — sebelas section berturut-turut telah berjalan tanpa validasi otomatis penuh. Tidak dieksekusi otomatis — menunggu perintah user.
