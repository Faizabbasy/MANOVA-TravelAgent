# Section 20 — Project Finance

**Status:** COMPLETED

Dikerjakan berdasarkan `prompts/SECTION_20_Project_Finance.md`, dijalankan atas perintah user.

---

## 1. Section Objective dan Scope

Melengkapi Project Finance frontend tanpa backend — mengekstensi modul `/finance` existing (Section 15 lama, sudah punya read-only Invoice/Payment/Budget-vs-Actual/Aging/Margin) menjadi CRUD/workflow AR/AP penuh sampai settlement dan closure gate. Wajib literal: Budget/estimate/committed/actual/variance/margin (sudah ada Section 15 lama, tidak dikerjakan ulang), multi-currency display dan exchange-rate snapshot mock, client invoice/DP/payment/outstanding/aging, supplier invoice/AP/payment schedule/match status, refund/credit/debit note states, reconciliation workspace mock, financial permissions. Acceptance: "Finance dapat menjalankan frontend workflow AR/AP sampai settlement dan closure gate." **Tidak mengerjakan** section lain — Section 19 (`app/types/change-incident.ts`, `app/data/change-incident.ts`, `app/pages/changes/**`) TIDAK disentuh kecuali satu hook aditif eksplisit-diizinkan (lihat bagian 4/9).

## 2. Source Documents yang Dibaca

`prompts/01-PROTOKOL WAJIB — CONTINUITY, DOKUMENTASI PER SECTION, DAN PERLINDUNGAN HASIL.md`, `prompts/SECTION_20_Project_Finance.md`, `CLAUDE.md`, `docs/mockup-section-progress.md` (entri Section 15 lama dan Section 19 baru secara penuh), `docs/mockup-section-reports/section-15-project-finance.md` (laporan skema lama, dibaca penuh — sumber selektor `getInvoiceOutstandingIdr`/`getProjectOutstandingIdr`/`getCommittedVendorCostIdr`/`invoiceAgingDays` dan pola tier visibilitas `canViewFinancials`/`canViewMargin`), `docs/mockup-design-decisions.md` D-067 (Product Planning/CostSheet, pola `status:'final'` locking + `duplicateCostSheetVersion`) dan D-076 penuh (rasional Section 19 kenapa `RefundRequest.creditStatus` tetap self-contained, forward dependency literal ke Section 20), `docs/frontend-known-issues.md` bagian 15 (gap statement literal), `docs/frontend-implementation-roadmap.md`/`docs/frontend-module-map.md`/`docs/frontend-workflow-map.md` (baris Section 20), `docs/mockup-section-reports/README.md` dan `section-19-change-cancel-refund-incident.md` (template struktur laporan). Source code dibaca penuh: `app/types/finance.ts`, `app/types/change-incident.ts`, `app/types/procurement.ts`, `app/types/project.ts` (`ProjectClosureChecklist`), `app/data/finance.ts`, `app/data/index.ts` (seluruh selektor/mutator finance/procurement/change-incident terkait), `app/utils/attention.ts`, `app/pages/finance/index.vue`/`invoices.vue`/`payments.vue`, `app/pages/projects/[id]/index.vue` (tab Finance dan Closure Checklist), `app/pages/client/project-orders/[id]/index.vue` (tab Finance), `app/constants/roles.ts`/`navigation.ts`/`status.ts`, `app/composables/usePermissions.ts`, `app/pages/changes/index.vue` dan `app/pages/changes/refunds/[id]/index.vue` (pola tabbed-list dan dialog mandatory-reason untuk direplikasi). `git status`/`git log` diperiksa — dikonfirmasi bersih kecuali working tree Section 00-19 yang memang belum di-commit (tidak disentuh).

## 3. Existing Implementation yang Diperiksa

`/finance/invoices` dan `/finance/payments` sudah list/detail penuh dengan aging dan payment history (Section 15 lama), TAPI 100% read-only — tidak ada create/edit/void invoice, tidak ada record payment. Tab "Finance" Project Detail sudah role-tiered (Tier 0/Tier 1, `canViewFinancials`/`canViewMargin`) dengan Budget/Actual/Variance/Quotation/Committed/Margin/Invoice table/Payment history. `Invoice`/`Payment` (`app/types/finance.ts`) minimal — tidak ada currency/DP/void/method/recordedBy. `SupplierInvoice` (`app/types/procurement.ts`, Section 17) punya lifecycle submit/review tapi tidak ada AP scheduling/match-status. `RefundRequest.creditStatus` (Section 19) field mock self-contained (`pending`/`issued`/`not-applicable`), eksplisit didokumentasikan sebagai forward dependency Section 20 di D-076 poin 5 dan `docs/frontend-known-issues.md` bagian 15 — TIDAK menyentuh `Invoice`/`Payment` sama sekali. `ProjectClosureChecklist.financeSettled` (Section 09/D-066) adalah shell inert — checkbox manual toggle tanpa logic apa pun, dikonfirmasi lewat `updateProjectClosureChecklist` (murni `Object.assign`, tidak ada gate). Nav Finance sudah punya 2 child (Invoices/Payments). `ROLE_MODULE_ACCESS.finance`: `super-admin` ADMIN, `finance` MANAGE, `management`/`project-manager`/`viewer` VIEW, role lain NONE — `canManage('finance')` (rank ≥ MANAGE) hanya true untuk `super-admin`/`finance`.

## 4. Decisions yang Digunakan

D-067 (pola locking `status: 'final'` + duplicate-version — dipertimbangkan tapi TIDAK diterapkan ke Invoice, karena Invoice tidak butuh versioning, cukup status lifecycle + Credit Note terpisah untuk koreksi). D-076 poin 5 (rasional literal kenapa `RefundRequest.creditStatus` self-contained saat itu — dasar hook penutup di Section 20). D-077 (BARU, dicatat section ini — rasional lengkap kenapa Section 20 memperluas `app/types/finance.ts` secara langsung, berbeda dari pola D-070 s.d. D-076 yang seluruhnya "entitas baru menaut ID, jangan mutasi" — lihat `docs/mockup-design-decisions.md`). Pola halaman list-tab query-param (`/changes`, Section 19) direplikasi untuk `/finance/notes.vue`. Pola dialog mandatory-reason (`/changes/refunds/[id]`) direplikasi untuk Void Invoice/Flag Disputed.

## 5. Implementation Summary dan User Flow

**Types (`app/types/finance.ts`, aditif):** `InvoiceStatus` +`'void'`; `Invoice` +`currency`/`exchangeRateSnapshot`/`invoiceType`/`voidedAt`/`voidReason`; `Payment` +`method`/`recordedBy`; `+CreditNote`/`+DebitNote` (entitas baru). `app/types/procurement.ts`: `SupplierInvoice` +`paymentScheduleDate`/`matchStatus`.

**Mutators baru (`app/data/index.ts`):** `createInvoice` (unpaid baru), `voidInvoice` (terminal, alasan wajib, blok bila `paid`/`void`), `recordPayment` (mock ledger, reuse `getInvoiceOutstandingIdr` untuk recompute status), `issueCreditNote`/`issueDebitNote`, `updateSupplierInvoiceMatchStatus`, `evaluateFinanceClosureGate` (derivasi murni, 3 kondisi blocker), `closeProjectFinance` (reuse `updateProjectClosureChecklist`, gate-protected). Selektor baru: `getCreditNotesByInvoice`/`getCreditNotesByProject`/`getDebitNotesByProject`/`getSupplierInvoicesByProject`/`getSupplierInvoiceReconciliationQueue`. `getInvoiceOutstandingIdr` diperbarui (void→0, minus Credit Note issued/applied). `getOutstandingInvoices`/`getDepartureReadiness` (Section 12 lama, satu baris) diperbarui exclude `'void'`.

**Hook penutup forward dependency (`updateRefundRequestStatus`, Section 19, LOCKED):** begitu status → `processed` dan `invoiceId` terisi, `issueCreditNote` otomatis dipanggil. Guard/transition-map/reason-wajib TIDAK disentuh — hook murni satu blok aditif setelah `creditStatus = 'issued'`.

**Halaman:**
- `/finance/invoices` — +Create Invoice (dialog: project/label/amount/currency/type/dueAt/FX snapshot bila non-IDR), dialog detail +Record Payment/Issue Credit Note/Void Invoice (guard status ditampilkan sebagai pesan, bukan silent-fail).
- `/finance/notes` (BARU) — 2 tab (Credit/Debit Notes, query-param), list cross-project, "Buat Debit Note" (Credit Note read-only di sini, dibuat dari invoices.vue atau hook otomatis).
- `/finance/reconciliation` (BARU) — worklist Supplier Invoice `unmatched`/`disputed`, "Mark Matched" (satu klik) dan "Flag Disputed" (dialog, catatan wajib).
- `/finance` — +link Notes/Reconciliation, +SectionCard "Financial Closure Readiness" (agregat lintas-project, hanya yang belum `financeSettled`).
- Tab Finance `/projects/[id]` — +kolom Tipe/currency invoice table, +SectionCard Credit/Debit Notes, +SectionCard AP Summary, +SectionCard Close Finance (blocker list atau tombol aktif).
- Closure Checklist (tab Overview) — item `financeSettled` kini selalu disabled + hint "dikelola lewat aksi Close Finance tab Finance"; 3 item lain tetap manual.
- Tab Finance `/client/project-orders/[id]` — +badge Tipe/currency SAJA (sell-side, tidak ada AP/Credit-Debit-Note/budget).

**User flow yang bisa didemokan:** buka `/finance/invoices` sebagai Finance/Super Admin → "Buat Invoice" → isi PRJ-104/label/amount/currency USD/tipe dp/due date/FX rate → invoice baru muncul unpaid → klik baris → "Record Payment" → isi jumlah → status berubah `partially-paid`/`paid` otomatis, `ActivityEntry` tercatat di project. Buka `/projects/PRJ-102?tab=finance` → lihat SectionCard "Close Finance" menampilkan 3 blocker (2 invoice outstanding, 1 Refund non-terminal, 1 Supplier Invoice AP unmatched) → tombol Close Finance disabled. Buka `/changes/refunds/REF-002` → klik "Proses Refund" → status `processed` → Credit Note baru otomatis muncul di `/finance/notes`, outstanding invoice terkait berkurang.

## 6. Routes

Baru: `/finance/notes`, `/finance/reconciliation`. Tidak ada route dihapus/di-rename — `/finance`, `/finance/invoices`, `/finance/payments`, `/projects/[id]` (tab `finance`), `/client/project-orders/[id]` (tab `finance`) diperkaya pada route yang sama.

## 7. Files Created, Changed, dan Removed

**Created:** `app/pages/finance/notes.vue`, `app/pages/finance/reconciliation.vue`, `docs/mockup-section-reports/section-20-project-finance.md` (laporan ini).

**Changed:** `app/types/finance.ts`, `app/data/finance.ts`, `app/types/procurement.ts`, `app/data/procurement.ts`, `app/utils/attention.ts`, `app/data/index.ts`, `app/constants/status.ts`, `app/constants/navigation.ts`, `app/pages/finance/invoices.vue`, `app/pages/finance/index.vue`, `app/pages/projects/[id]/index.vue`, `app/pages/client/project-orders/[id]/index.vue`, `docs/mockup-design-decisions.md` (+D-077), `docs/mockup-change-impact-log.md` (+CI-050), `docs/mockup-data-scenarios.md` (+bagian 4w), `docs/frontend-module-map.md`, `docs/frontend-workflow-map.md`, `docs/frontend-implementation-roadmap.md`, `docs/frontend-known-issues.md` (bagian 15 RESOLVED), `docs/mockup-implementation-state.md`, `docs/mockup-progress.md` (+Entri 29), `docs/mockup-section-progress.md` (+entri Section 20), `docs/mockup-section-reports/README.md`.

**Removed:** Tidak ada.

## 8. Components Reused dan Created

**Reused:** `PageHeader`, `SectionCard`, `DetailMetadataList`, `StatusBadge`, `EmptyState`, `RoleAccessState`, `Table*`, `Dialog*`/`DialogScrollContent`, `Tabs*`, `StatsCard`, `Checkbox`, `Input`, `Label`, `useToast`. Tidak ada komponen shared file baru.

**Created:** Tidak ada komponen — hanya 2 halaman baru (bagian 6/7).

## 9. Types, Constants, Fixtures, dan Mock State

`app/types/finance.ts`: `Invoice`/`Payment` diperluas aditif (lihat bagian 5); `+CreditNote`/`+DebitNote`. `app/types/procurement.ts`: `SupplierInvoice` +2 field opsional. Backfill fixture (`app/data/finance.ts`) — 5 invoice existing +`currency: 'IDR'`/`invoiceType` (nilai efektif TIDAK berubah), 3 payment existing +`recordedBy: 'USR-008'`/`method: 'bank-transfer'`; **BARU** `INV-1041` (PRJ-104, sebelumnya nol invoice — demo USD/DP tanpa risiko regresi angka manapun), `CN-001` (Credit Note pada `INV-1011` yang sudah `paid`, outstanding tetap 0 sebelum/sesudah), `DN-001` (Debit Note informasional PRJ-102). `app/data/procurement.ts` — 3 dari 4 `SUPPLIER_INVOICES` existing di-backfill `matchStatus` (`SINV-001` matched, `SINV-002` unmatched, `SINV-004` disputed; `SINV-003` rejected sengaja tidak diisi). `app/constants/status.ts` +5 constant baru (`INVOICE_CURRENCIES`/`INVOICE_TYPES`/`SUPPLIER_INVOICE_MATCH_STATUSES`/`CREDIT_NOTE_STATUSES`/`DEBIT_NOTE_STATUSES`), `INVOICE_STATUSES` +`'void'`. Detail lengkap skenario: `docs/mockup-data-scenarios.md` bagian 4w.

## 10. Responsive Behavior

Mengikuti pola grid existing (`grid-cols-1 sm:grid-cols-2/3/4`) di seluruh SectionCard/StatsCard baru — konsisten dengan halaman Finance/Project Detail existing. Tidak diverifikasi lewat browser interaktif — tidak ada tool headless browser tersedia (keterbatasan konsisten sejak Section 06).

## 11. Loading, Empty, Error, Not-Found, dan Unauthorized States

- **Loading:** Tidak ada simulasi baru.
- **Empty:** `TableEmpty`/`EmptyState` untuk seluruh list baru (Credit/Debit Notes kosong, Reconciliation queue kosong "seluruhnya sudah matched", Financial Closure Readiness kosong "seluruh project sudah Close Finance").
- **Error/Validation:** Void Invoice pada invoice `paid`/`void` diblokir dengan pesan eksplisit ("Invoice yang sudah lunas atau sudah void tidak dapat divoid"), bukan silent-fail. Record Payment pada invoice tanpa outstanding diblokir serupa. Close Finance menampilkan blocker list dan tombol disabled bila gate belum `ready`.
- **Not-found:** Tidak berubah dari Section 05/15 — diverifikasi ulang tetap benar.
- **Unauthorized:** `RoleAccessState` untuk `!canView('finance')` di `/finance/notes`/`/finance/reconciliation` (baru). Aksi mutasi (Create/Record Payment/Void/Issue Note/Mark Matched/Close Finance) digerbangi `canManage('finance')` — disembunyikan (bukan ditampilkan-lalu-gagal) untuk role tanpa akses MANAGE.

## 12. Role Behavior

`canView('finance')` — gerbang akses seluruh halaman `/finance/**` (existing, direuse). `canManage('finance')` — gerbang SELURUH aksi mutasi baru (Create Invoice/Record Payment/Void/Issue Credit-Debit Note/Mark Matched/Flag Disputed/Close Finance); berdasarkan `ROLE_MODULE_ACCESS.finance`, hanya `super-admin` (ADMIN) dan `finance` (MANAGE) yang lolos rank ≥ MANAGE — role `management`/`project-manager`/`viewer` (VIEW) dapat melihat tapi tidak memutasi. Tidak ada constant permission baru dibutuhkan — pola reuse murni, konsisten sejak Section 15 lama (`canViewFinancials`) dan Section 19 (`canManage('changes')`). Client Portal — badge Tipe/currency TIDAK digerbangi permission tambahan (sudah dalam scope sanitasi tab Finance existing D-065).

## 13. Validation Commands dan Hasilnya

- `npx nuxi prepare` — **sukses**.
- `npm run build` — **sukses (exit 0)**.
- `npx vitest run` — "No test files found" (pre-existing, Q8).
- `npx nuxi typecheck` — gagal, `vue-tsc` tidak terpasang (Q8, pre-existing).
- Lint — tidak tersedia (Q8, pre-existing).
- **Smoke test HTTP** (curl, `node .output/server/index.mjs`, port 3000): `/finance`, `/finance/invoices`, `/finance/payments`, `/finance/notes`, `/finance/notes?tab=debit`, `/finance/reconciliation`, `/projects/PRJ-101` s/d `PRJ-104?tab=finance`, `/projects/PRJ-101?tab=overview`, `/client/project-orders/PRJ-101`/`PRJ-102`, `/changes`, `/changes?tab=refunds`, `/changes/refunds/REF-001`/`REF-002`, `/procurement`, `/procurement?tab=service-orders`, `/procurement/service-orders/SO-001`/`SO-002`, `/supplier/service-orders/SO-001`, `/bookings`, `/bookings/exceptions`, `/admin/roles`, `/`, `/nonexistent-route-xyz` — **seluruhnya HTTP 200**. Catatan: run pertama menemukan HTTP 500 di 4 route (`/finance`, `/finance/invoices`, `/finance/payments`, `/client/project-orders/[id]`) yang ternyata disebabkan proses `node .output/server/index.mjs` STALE dari sesi sebelumnya (masih listening di port 3000 dengan chunk hash lama, sebelum rebuild) — diselesaikan dengan `taskkill` proses lama dan restart preview server dari build baru; run kedua seluruhnya 200. **Bukan bug kode.**
- **Smoke test konten mendalam** (curl+grep):
  - PRJ-101 (`?tab=finance`): Budget Rp85.000.000, Actual Cost Rp82.500.000, Variance Rp2.500.000, Quotation Rp95.000.000, Committed Rp90.000.000, **Margin Rp12.500.000**, Outstanding Rp0, Credit Note `CN-001` Rp2.000.000 tampil — SELURUHNYA identik persis dengan angka tervalidasi sejak Section 15/16.
  - PRJ-102 (`?tab=finance`): Budget Rp310.000.000, Actual Cost Rp335.000.000, Variance -Rp25.000.000, Quotation Rp345.000.000, Committed Rp345.000.000, **Margin Rp10.000.000**, **Outstanding Rp95.000.000** — identik persis (dikonfirmasi hook Credit Note ke `REF-001` SENGAJA tidak retroaktif, sehingga angka ini tidak berubah meski hook baru sudah aktif). AP Summary menampilkan `SINV-003`(rejected)/`SINV-004`(disputed) untuk SO-002.
  - PRJ-103 (`?tab=finance`): **Margin Rp220.000.000**, **Committed Rp930.000.000**, **Outstanding Rp700.000.000** — identik persis.
  - PRJ-104 (`?tab=finance`): menampilkan `INV-1041` (baru) dengan badge "Down Payment" dan label currency "USD".
  - Close Finance / Financial Closure Readiness (`/finance` dan tab Finance masing-masing project) — blocker presisi: PRJ-101 "1 Refund Request belum selesai"; PRJ-102 "2 invoice masih memiliki outstanding balance. 1 Refund Request belum selesai. 1 Supplier Invoice (AP) belum matched."; PRJ-103 3 blocker serupa (invoice+refund+AP); PRJ-104 "1 invoice masih memiliki outstanding balance."
  - `/finance/invoices` — badge "USD" dan label "Manila Follow-up Training" (`INV-1041`) tampil; opsi status "Void" tampil di filter.
  - `/finance/notes` — `CN-001` tampil di tab Credit (default); `DN-001` tampil di tab Debit (`?tab=debit`).
  - `/finance/reconciliation` — `SINV-002`/`SINV-004` (unmatched/disputed) tampil; `SINV-001` (matched) TIDAK tampil (filter benar).
  - Client Portal (`/client/project-orders/PRJ-102?tab=finance`) — diverifikasi TIDAK bisa dirender via curl langsung (default demo user SSR adalah Super Admin, `clientScopeId` undefined → halaman menampilkan "Project Order tidak ditemukan... bukan milik company Anda", konsisten keterbatasan role-switcher client-side sejak Section 08/19). Sanitasi diverifikasi via **code review**: `grep budgetIdr|actualCostIdr|CommittedVendorCost|Margin|CreditNote|DebitNote|matchStatus|paymentScheduleDate` pada `app/pages/client/project-orders/[id]/index.vue` hanya menemukan referensi di komentar dokumentasi, TIDAK PERNAH di template — SATU-SATUNYA perubahan template adalah badge Tipe/currency.
  - Tidak ditemukan string "Internal Server Error"/"TypeError"/"is not defined"/"ReferenceError" di HTML manapun (setelah restart server).
  - **Temuan regresi tidak terkait Section 20 (dicatat, tidak diperbaiki):** `/reports` (Section 16 lama) SSR selalu menampilkan `LoadingState` ("Menyusun laporan...") alih-alih konten laporan — root cause: `isLoading = ref(true)` di-toggle `false` lewat `setTimeout` di `onMounted`, yang tidak berjalan saat SSR (hanya browser real via hydration). Dikonfirmasi dengan membaca `git diff`/`git status` bahwa `app/pages/reports/index.vue` TIDAK disentuh oleh Section 20 sama sekali — PRE-EXISTING sejak Section 16, ditemukan murni sebagai efek samping smoke test regresi menyeluruh. Dicatat di `docs/frontend-known-issues.md` bagian 15.
- **Verifikasi interaktif** (klik Create Invoice/Record Payment/Void/Issue Credit Note/Mark Matched/Flag Disputed/Close Finance) **tidak dilakukan headless** — tidak ada tool browser headless (keterbatasan konsisten sejak Section 06). Dimitigasi lewat code review ketat terhadap seluruh guard (`voidInvoice` blok `paid`/`void`, `recordPayment` blok outstanding≤0, `updateSupplierInvoiceMatchStatus`, `evaluateFinanceClosureGate` 3 kondisi) dan smoke test konten SSR pada state awal fixture.

## 14. Regression Checks

Section 09/D-066 (`ProjectClosureChecklist` — shape TIDAK berubah, hanya `financeSettled` kini digerbangi; 3 item lain diverifikasi tetap toggle manual via smoke test `?tab=overview`), Section 12 lama (`getDepartureReadiness` — satu baris exclude `'void'`, hasil untuk seluruh project existing identik karena tidak ada invoice `'void'` di fixture), Section 15 lama (Invoice/Payment/Margin/Committed/Outstanding PRJ-101/102/103 — nol regresi, diverifikasi angka identik persis, bagian 13), Section 17 (`SupplierInvoice` submit/review flow — TIDAK disentuh, `/procurement/service-orders/SO-001`/`SO-002` dan `/supplier/service-orders/SO-001` dikonfirmasi HTTP 200 tanpa perubahan konten selain field AP baru yang murni tambahan), Section 19 (`updateRefundRequestStatus` — guard/transition-map/reason-wajib TIDAK berubah, `/changes/refunds/REF-001`/`REF-002` dikonfirmasi HTTP 200, alur approve/reject/under-review tidak terpengaruh), Section 08 (Client Portal — sanitasi dikonfirmasi via code review, bagian 13) — seluruhnya diverifikasi tidak beregresi.

## 15. Cross-Section Impact

`docs/mockup-change-impact-log.md` CI-050 — daftar lengkap seluruh titik sentuh lintas-section: hook `issueCreditNote` ke `updateRefundRequestStatus` (Section 19, LOCKED, satu blok aditif, guard/transition-map/reason-wajib tidak disentuh), extension aditif `SupplierInvoice` (Section 17, flow submit/review tidak disentuh), satu baris `getDepartureReadiness` (Section 12 lama), extension tab Finance Project Detail dan Client Portal (Section 15 lama/Section 08), `ProjectClosureChecklist.financeSettled` (Section 09/D-066, shell inert kini digerbangi — dikonfirmasi bukan perubahan shape, murni penggunaan baru), nav Finance (Section 02/17 lama, +2 child). Seluruh titik sentuh bersifat aditif/regression-tested, dikonfirmasi via smoke test bagian 13.

## 16. Review URLs

Tidak tersedia — lingkungan pengembangan lokal saja (`node .output/server/index.mjs`, tidak ada deployment publik). Server preview sudah **dihentikan** (`taskkill`) setelah smoke test selesai, sesuai instruksi validasi.

## 17. Known Issues dan Deferred Work

- **Q8 (tooling lint/typecheck/test) masih terbuka** — **20 section berturut-turut** (06–20) berjalan tanpa validasi otomatis penuh.
- `reports/index.vue` (Section 16 lama) SSR selalu menampilkan `LoadingState` — PRE-EXISTING sejak Section 16 (dikonfirmasi TIDAK disentuh Section 20 sama sekali), ditemukan sebagai efek samping regression check menyeluruh, diperbaiki otomatis oleh hydration browser real (bukan gap fungsional untuk pengguna nyata) — di luar scope kepemilikan Section 20, tidak diperbaiki.
- Payment gateway nyata, integrasi kurs pasar real-time, dan reconciliation engine algoritmik (automated matching) **TETAP di luar scope selamanya** sesuai protokol — batas permanen, bukan gap.
- Verifikasi interaktif (klik-demo seluruh aksi mutasi baru) tidak dilakukan headless (keterbatasan tooling lingkungan, konsisten sejak Section 06).
- Deviasi kecil dari draft literal brief (didokumentasikan penuh di D-077): mutator baru menerima objek input (bukan parameter positional `recordPayment(invoiceId, amountIdr, method?, recordedBy)` yang secara teknis tidak valid TypeScript karena optional sebelum required); `updateSupplierInvoiceMatchStatus` menambah parameter `actorId` (tidak ada di draft literal) mengikuti pola `reviewSupplierInvoice` di sebelahnya agar audit trail teratribusi.

## 18. Protection Notes untuk Section Berikutnya

- `Invoice`/`Payment`/`CreditNote`/`DebitNote`/`SupplierInvoice` AP fields kini LOCKED (D-077) — `Invoice.amountIdr` TIDAK PERNAH ditulis ulang oleh mutator mana pun, gunakan `getInvoiceOutstandingIdr` untuk kebutuhan agregasi baru.
- `evaluateFinanceClosureGate`/`closeProjectFinance` — SATU-SATUNYA jalur mengubah `ProjectClosureChecklist.financeSettled` sekarang; JANGAN toggle manual dari UI manapun tanpa melalui gate ini.
- Hook `issueCreditNote` di `updateRefundRequestStatus` (Section 19) bersifat PROSPEKTIF SAJA — JANGAN membuat migrasi retroaktif Credit Note untuk `RefundRequest` fixture lama yang sudah `processed` sebelum Section 20 (akan mengubah Outstanding yang sudah divalidasi sejak Section 15/16).
- `InvoiceStatus` `'void'` — bila section berikutnya menambah selektor baru yang memfilter berdasarkan `status !== 'paid'`, WAJIB turut mengecualikan `'void'` (pola yang sudah diterapkan di `isInvoiceOverdue`/`getInvoiceOutstandingIdr`/`getOutstandingInvoices`/`getDepartureReadiness`).
- Section 21 (Documents, Communication dan Notifications) — tidak ada dependency langsung ke Section 20, dapat dikerjakan independen.

## 19. Recommended Next Section

Section 21 — Documents, Communication dan Notifications (`prompts/SECTION_21_Documents_Communication_Notifications.md`), berbasis urutan roadmap literal (bukan dependency eksplisit seperti Section 20 terhadap Section 19). Tidak dieksekusi otomatis — menunggu perintah user.
