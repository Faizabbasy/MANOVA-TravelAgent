# Fase 0 — kondisi aktual dan matriks integrasi

21 Oktober 2026, Asia/Bangkok. HEAD `0a2e5b2`, branch `production`, ahead 240 terhadap tracking lokal; tidak fetch remote. Sebelum pekerjaan: untracked `app/`, `docs/MANOVA_FINANCE_CLAUDE_CODE_PACKAGE/`, dan paket ini. Semuanya dipertahankan. Tidak ada AGENTS.md di repository/ancestor yang diperiksa. CLAUDE root/backend/frontend dan dokumen 00–12 dibaca; ADR-001–007 ditinjau termasuk update terbaru.

Schema awal 0044. Migrasi baru 0045 berpasangan; tidak ada applied migration yang diedit. Tidak membuka/migrasi database aplikasi. Test menggunakan PGlite memory dan PostgreSQL cluster baru `.data/accounting-pg-rehearsal`, loopback 55439, database `accounting_test` dengan schema random per file. Tidak menyentuh PostgreSQL service/data existing. Cluster ini hanya data sintetis tanpa credential produksi.

Runtime: Bun 1.4.2, Node 22.16.0, pnpm 12.6.0. Installed frontend: Nuxt 4.5.1, Vue 3.5.40, TS 5.9.3, Vitest 4.1.10, vue-tsc awal 2.2.12, vue-router awal 4.6.4. Manifest Nuxt actual memerlukan router ^5.2.0. Perbaikan sempit: vue-tsc 3.3.13/router 5.4.0 dan solution build typecheck. Fixed package managers dipertahankan.

Hasil baseline baru: backend typecheck exit 0, 30.78s; frontend 1.241 tests/64 files exit 0, 196.18s; lint exit 1, 105 error/2.691 warning. Direct app typecheck awal exit 2 (plugin Vue gagal dan source errors); setelah tooling, script app sebenarnya tetap exit 2 karena error source existing, tanpa plugin error yang sama. Full backend/build dan diagnosis source dicatat di dokumen 11 saat selesai, tidak diasumsikan lulus. Raw output tersimpan di `baseline-*.log` dan `app-typecheck.log` pada paket ini. Suite baseline backend dimulai sebelum 0045 ditulis; checkpoint sesudahnya harus diverifikasi terpisah.

## Matriks sumber pada HEAD awal

E = server existing; X = perlu extension; N = fitur accounting baru. Kolom hook adalah pemilik service yang harus tetap authoritative. Seluruh baris belum boleh dinyatakan tested accounting hanya karena operational tests exist.

| Aksi dokumen 03 | Kondisi/pemilik aktual | Pekerjaan accounting / acceptance |
|---|---|---|
| Lead Won/project baru | E sales/leads, core/project-writes | X contract snapshot/termin; bukan revenue; A10/A11 |
| Quotation/client acceptance | E sales/quotations, client-commerce | X frozen component policy/billing draft; A10 |
| Project manual | E core/project-writes | X missing policy setup, tanpa quotation palsu; A10 |
| Budget layanan | E core/service-writes | X baseline versions, tidak actual cost; A10/A12 |
| Task/milestone | E core/tasks, milestones | X configured fulfillment/billing evidence; A09/A10 |
| Itinerary/version | E core/itinerary, trip-collab | X linked impact, no duplicate booking cost; A10 |
| RFQ/vendor quote | RFQ lokal; quotation E vendor-quotations | X persist RFQ economics; A10/A11 |
| SO approval | E core/service-orders | N commitment/consumption; A01/A12 |
| SO amendment/vendor change | Amendment lokal; vendor-change guards E | X server amendments/old obligation; A10 |
| Flight/hotel/transport/MICE | E booking-writes/status/orchestration | N component and evidence linkage; A01/A09/A10 |
| Ticket/delivery | Operational status E | N policy-controlled partial fulfillment; A04/A09 |
| Participants | E core/travelers | X commercial change/version guard; A10 |
| Group Trip DP | E finance/group-trip → receipt + traveler | X derived journal only; A03/A10 |
| B2C standalone | E sales order, Finance rejects no project | X native order dimension, no dummy; A10 |
| Billing terms/milestone | E finance/receivables schedule | X configured draft/issue; A01/A10 |
| Payment proof | E metadata queue, payment-proofs → receipt | X private file, derived journal; A13 |
| Receipt confirmed | E finance/receivables → financial_transactions | X Bank/advance then allocation/AR; A01/A03/A11 |
| Supplier service receipt | Operational fulfilled E, no cost accrual | N valued receipt/accrual; A01/A09 |
| Vendor invoice approved | E finance/payables | X prepaid/accrual clearing; A01 |
| Vendor payment/deposit allocation | E finance/payables | X advance/AP/cash derivation; A01/A11 |
| Field expense | E finance/postings (cash + project summary) | X explicit nature mapping, no second cash; A02/A12 |
| Kasbon | N | N advance/evidence/return/reimburse, shared cash; A06 |
| CR accepted | E core/change-requests/client-writes | X contract delta + linked draft billing; A10 |
| Incident/no-show | E incidents/booking-status | X authorized valued claim/penalty; A05/A10 |
| Cancellation | E finance/refunds/credit notes | X reversal/claim/commitment effects; A05 |
| Refund approval/settlement | E finance/refunds | X liability then cash, no duplicate adjustment; A05 |
| Supplier recovery | cash kind vendor_refund exists, lifecycle incomplete | X claim/credit/offset; A05 |
| Trip completed | E project-workflow | X review missing fulfillment/accrual, not paid; A10 |
| Accounting review | N | N evidence/completeness separate settlement; A10/A12 |
| Finance/project close | E project-workflow settlement + asset gates | X accounting blockers without relaxing legacy gate; A10/A15 |
| Payroll/commission/incentive | E core/hr; payroll paid only status; commission closed → paid | X expense/payable + cash settlement and versioned rule; A02/A10 |
| Inventory asset | E core/inventory; values operational only | N acquisition link/depreciation/disposal; A07 |
| Office/marketing/utilities | E manual cash categories, no accrual schedule | X nature mapping + company-only schedules; A02/A12 |
| Loan/owner funds/prepaid/tax | N financial lifecycle; tax master reference only | N versioned profile, no tax unknown=0; A07/A08 |

## Backlog/dependency order

Pembaruan implementasi setelah baseline: dokumen 11 checkpoint 2–5 mencatat irisan fulfillment/accrual/credit-refund/staf/payroll/aset/funding/B2C/CSV/opening/reporting; tabel di atas tetap matriks historis HEAD awal, bukan status source terbaru. Checkpoint 6 menambahkan jalur berikut:

| Aksi | Source/hook aktual | Posting dan koreksi | Evidence |
|---|---|---|---|
| Bayar sewa/langganan kantor di muka | `finance/prepaid-expenses.payPrepaidExpense` → `financial_transactions` + `prepaid_expenses` immutable | Prepaid vs bank, satu cash; unknown shadow pending/active rollback; reversal existing sebelum amortisasi, koreksi sesudah amortisasi masih ditahan | `accounting-prepaid.test.ts` PGlite + PostgreSQL |
| Bebankan bulan manfaat kantor | `runPrepaidAmortization` → unique source/month → `accounting/prepaid.postPrepaidAmortization` | Office expense vs prepaid-office; tidak menulis cash; mandatory posting, period lock, retry; source/original opening wajib tersedia | A02/A07/A09/A11/A12, UI funding + form tests + HTTP smoke |
| Opening/cek bulanan prepaid | `opening`, `review`, `reports` memakai `prepaid-completeness` | Sisa manfaat historis dalam opening; missing completed month tampak dan memblokir close/validasi opening; after-tax tidak diklaim lengkap | Opening September prepaid 6; expense September 3; bank tetap 91 |

F1 (A11/A12/A14): immutable ledger + setup/status/detail UI; F2 (A01/A03/A05/A11): source Finance hooks + status panel. F3 (A01/A04/A09/A10): obligations/fulfillment/commitments/accrual + project UI. F4 (A10): retail/Group Trip/CR/RFQ/credit loss. F5 (A02/A06): company/staff/HR. F6 (A07/A08): assets/funding/tax; actual rates require validation. F7 (A13/A14): CSV/private files/access/owner mode. F8 (A12/A14): unified company/project reports/forecast. F9 (A15): monthly close/opening/mapping/recovery. F10: full engines/build/browser/UAT/handoff. Referensi desain: ADR-008. Register kebijakan D02–D13 tetap unknown; fixtures bukan persetujuan produksi.

Pembaruan checkpoint 7: rencana rutin (`company_expense_schedules`) hanya masuk forecast; konfirmasi biaya (`company_expenses`) mengakui office expense/company-accrued dengan policy eksplisit; tautan invoice asli (`company_expense_invoice_links` + existing `vendor_invoices`) mengganti accrual dan membukukan selisih actual. Pembayaran tetap existing cash/payment allocation. Source matrix aktual dan correction/acceptance ada pada addendum dokumen 03; semua fase tetap partial.
