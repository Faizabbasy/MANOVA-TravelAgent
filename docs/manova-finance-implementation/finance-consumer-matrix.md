# Matriks consumer finance mock → kontrak baru

Audit baca-saja Phase 1, 29 Sep 2026, branch `monorepo` @ `685d708`. Path relatif ke `frontend/`. Dipakai untuk menghapus UI finance lama **tanpa** memutus alur non-finance (paket `01`, `06`, `12` #2). Nomor baris adalah snapshot; cari ulang simbolnya sebelum mengedit.

## Ringkasan keputusan hapus

| Kelompok | Boleh dihapus kapan | Catatan |
|---|---|---|
| `app/pages/finance/**` (5 halaman + 5 redirect stub) dan 9 panel `app/components/finance/*` | Phase 4, setelah route baru + redirect siap | Panel **hanya** dipakai halaman finance (tidak ada consumer non-finance). |
| `app/data/finance.ts`, `app/data/finance-ext.ts` | Setelah semua consumer di tabel B pindah (Phase 3–7) | Masih dibaca dashboard, project detail, laporan, client billing, refund, marketing, CRM, plugin reset demo. |
| `app/types/finance.ts`, `finance-ext.ts` | Bersamaan dengan data di atas | Diimpor 9 tempat non-finance (tipe) → ganti ke `app/types/api.ts`. |
| Selector/mutator finance di `app/data/index.ts` | Per slice setelah consumer-nya pindah | `getInvoiceOutstandingIdr`:223, `createInvoice`:266, `recordPayment`:331, `issueCreditNote`:369, `evaluateFinanceClosureGate`:470, `closeProjectFinance`:494, `paySupplierInvoice`:3682, `createCancellationRecord`:3931, `createRefundRequest`:3975, `updateRefundRequestStatus`:4024, `getClientFinanceSummary`≈6455. |
| `app/components/dashboard/DashboardCashFlowSection.vue` | Phase 7 (atau Phase 4 bila chart dihapus dari dashboard app) | Presentasional; datanya mock `getRevenueByPeriod`/`OPEX_ENTRIES`, bukan proyeksi kas. |
| `app/components/project-order/ProjectOrderInvoicesCard.vue` | Kapan saja | **Orphan** (tidak dipakai di mana pun). |

Tanpa consumer UI di luar finance: `getReceivables`, `getJournalEntries`, `LEDGER_ACCOUNTS` (hanya panel finance). `createInvoice`, `recordPayment`, `paySupplierInvoice`, `issueCreditNote` tidak dipanggil halaman non-finance secara langsung, tetapi `recordPayment` dipanggil `runPaymentVerificationMock` (≈6412, dari client billing) dan `issueCreditNote` dari `updateRefundRequestStatus` (:4036).

## A. File milik finance mock

| Jenis | Path |
|---|---|
| Halaman | `app/pages/finance/index.vue`, `invoices.vue`, `payables/index.vue`, `payments.vue`, `ledger/index.vue` |
| Redirect stub | `finance/receivables/index.vue` → `/finance/invoices#receivables`; `notes.vue` → `/finance/invoices`; `opex/index.vue` → `/finance/payables#opex`; `reconciliation.vue` → `/finance/payments#reconciliation`; `tax/index.vue` → `/finance/ledger#tax` |
| Komponen | `app/components/finance/{CreditDebitNotesPanel, InvoiceListPanel, LedgerPanel, OpexPanel, PayablesPanel, PaymentsPanel, ReceivablesPanel, ReconciliationPanel, TaxCurrencyPanel}.vue` |
| Tipe | `app/types/finance.ts`, `app/types/finance-ext.ts` |
| Data | `app/data/finance.ts` (`INVOICES`, `PAYMENTS`, `CREDIT_NOTES`, `DEBIT_NOTES`), `app/data/finance-ext.ts` (`OPEX_ENTRIES`, `getReceivables`, `LEDGER_ACCOUNTS`, `getJournalEntries`, `getProjectActualCostIdr`, `getJournalEntriesByProject`, `getRevenueByPeriod`, …) |

## B. Consumer di luar finance

| Consumer | Memakai | Kontrak pengganti | Fase | Regression check |
|---|---|---|---|---|
| `pages/project-orders/[id]/index.vue` :13-14, :35, :49, :619-635, :2546, :2673, :2689 | invoice/payment/credit/debit per project, supplier invoice, `getProjectActualCostIdr`, jurnal project, `evaluateFinanceClosureGate`, `closeProjectFinance`, link `/finance/invoices` & `/finance/ledger` | `GET /projects/{id}/finance-summary` (AR/AP/receipts/disbursements/refund, tersanitasi role) + gate closure yang dievaluasi ulang dari sumber baru; link ke `/finance/receivables?projectId=` dan `/finance/accounts` | 3 (API) → 4 (UI) | Tab Finance project: angka = detail AR/AP; closure gate tidak melemah/menguat diam-diam; alur Lead→Project→Closed tetap jalan |
| `pages/index.vue` (dashboard app) :11, :14, :18, :24, :159-189, :267, :383, :445-453, :592, :798 | `DashboardCashFlowSection`, `getRevenueByPeriod`, `OPEX_ENTRIES`, `getOpexTotalIdr`, `getProjectActualCostIdr`, outstanding/overdue KPI | Ringkasan dari `GET /finance/dashboard` (role-scoped) atau hapus chart mock; budget chart dari project finance summary | 7 (4 bila chart dihapus) | Dashboard tiap role render tanpa error; tidak ada Rp0 palsu |
| `components/reports/ReportsOperationalPanel.vue` :5-10, :235-251, :606 | `INVOICES`, outstanding, aging, actual cost | Read model laporan dari API (AR aging, budget vs actual) | 7–8 | Laporan operasional tetap tampil; aging = AR API |
| `components/reports/ReportsAnalyticsPanel.vue` :5-6, :26, :43-68 | revenue/opex/actual, invoice/payment/supplier invoice per project | Read model analitik dari API | 7–8 | Angka analitik konsisten dengan dashboard finance |
| `components/client/DashboardOverviewPanel.vue` :9-16, :57, :102-141 | outstanding/overdue customer | Endpoint client-facing tersanitasi (invoice/payment milik party sendiri) | 3 → 4 | Portal client: hanya data PTY sendiri; tanpa AP/margin/bank internal |
| `components/client/NotificationsPanel.vue` :7, :80 | `INVOICES` untuk label | Payload notifikasi membawa label, atau `GET` invoice client | 4 | Notifikasi tetap berlabel |
| `components/client/ReportsAnalyticsPanel.vue` :9 | tipe `InvoiceStatus` | `app/types/api.ts` | 4 | typecheck |
| `pages/client/billing/index.vue` :4, :8, :139; `statement.vue` :3, :149; `invoices/[id]/index.vue` :6-8, :28, :41; `invoices/[id]/preview.vue` :5, :19, :24 | `getClientInvoices`, outstanding, `getClientFinanceSummary`, payments, credit notes | Client billing API tersanitasi | 3 → 4 | Journey client billing (list → detail → preview → bukti bayar) |
| `pages/client/project-orders/[id]/index.vue` :8, :22, :91, :708-725 | invoice/payment per project, overdue, aging | `GET /projects/{id}/finance-summary` versi client (sell-side saja) | 3 → 4 | Tidak ada AP/vendor net cost di respons client |
| `pages/client/company-profile/index.vue` :13 | tipe `InvoiceCurrency` | tipe master/API | 4 | typecheck |
| `pages/crm/parties/[id]/index.vue` :8, :74 | `getInvoicesByProject` | `GET /parties/{id}/finance-summary` (usulan) | 7 | Detail party CRM tetap render |
| `pages/changes/refunds/[id]/index.vue` :5, :30, :54, :60 | invoice project, `updateRefundRequestStatus` (auto `issueCreditNote`) | Refund API: approve/reject/settle; credit note diterbitkan server | 5 | Refund: approved ≠ uang keluar; settlement posting sekali |
| `pages/changes/index.vue` :8, :191; `changes/cancellations/[id]/index.vue` :5, :59 | `createRefundRequest` | `POST /bookings/{type}/{id}/cancellations` (membuat case + obligation) | 5 | Alur change/cancel tetap jalan |
| `pages/ticketing/[id]` :10, :87; `accommodation/[id]` :10, :96; `transportation/[id]` :10, :93; `mice/[id]` :11, :84 | `createCancellationRecord` | `POST /bookings/{type}/{id}/cancellation-preview` + `/cancellations` | 5 | Status booking bertransisi via service booking resmi; regresi 4 tipe booking |
| `pages/admin/master-data.vue` :6, :76 | `CANCELLATION_RULES` (display-only) | Master policy versioned `GET/POST /finance/policies` | 5 | Master data non-finance tetap bisa dikelola |
| `pages/procurement/service-orders/[id]/index.vue` :6-7, :30, :86 | `getSupplierInvoicesByServiceOrder`, `reviewSupplierInvoice` | Vendor invoice API (`/finance/vendor-invoices`, approve/reject) terhubung `service_orders` | 3 | Review supplier invoice di SO; supplier portal hanya miliknya |
| `data/marketing.ts` :18, :265 | `INVOICES` (ROI kampanye) | Read model revenue dari API | 7 | ROI marketing tetap terhitung |
| `data/crm-engagement.ts` :14, :260 | `INVOICES` (LTV) | Party finance summary | 7 | LTV tampil |
| `data/index.ts` :8, :58, :83, :4549 | re-export finance, `getMasterDataUsageCount` memakai `INVOICES` | Hapus re-export per slice | 4–8 | typecheck + test data |
| `plugins/mock-reset.client.ts` :7, :13-14, :41-43, :63-64 | registrasi `INVOICES`, `PAYMENTS`, `CREDIT_NOTES`, `OPEX_ENTRIES`, `SUPPLIER_INVOICES` | Hapus entri saat array dihapus; **jangan** pernah mereset data API | 4+ | Tombol Reset Demo tetap jalan |
| `utils/attention.ts` :3, :38, :43, :126; `constants/status.ts` :4, :213-253; `types/party.ts` :2 | tipe `Invoice`, helper overdue/aging, opsi status invoice/note | Retarget ke `app/types/api.ts` | 4 | typecheck |
| `components/project-order/ProjectOrderInvoicesCard.vue` :4, :106 | orphan | Hapus | 4 | — |

## C. Referensi route `/finance`

| Lokasi | Route | Rencana (Phase 4) |
|---|---|---|
| `constants/navigation.ts` :100-113 | grup `finance` "Finance & ACC" + 5 anak (`/finance`, `/finance/invoices`, `/finance/payables`, `/finance/payments`, `/finance/ledger`) | Ganti tepat 6 menu: Dashboard `/finance`, Account Statement `/finance/statement`, Account Ledger `/finance/accounts`, Receivable `/finance/receivables`, Payable `/finance/payables`, Cash Flow `/finance/cash-flow` |
| `constants/navigation.ts` :241-245 `HIDDEN_NAV_ROUTES` | `/finance/receivables`, `/finance/notes`, `/finance/opex`, `/finance/reconciliation`, `/finance/tax` | Hapus entri yang menjadi menu utama; sisakan hanya redirect |
| `middleware/rbac.global.ts` | tidak ada literal; bergantung `findNavItemForPath` | Pastikan semua route finance baru punya nav item/hidden route ber-`moduleKey: 'finance-acc'`, jika tidak rute lolos gate nav |
| `nuxt.config.ts` routeRules | `/expenses` → `/finance/opex` (301) | Ubah ke `/finance/payables` |
| `pages/project-orders/[id]/index.vue` :2546, :2689 | `/finance/invoices`, `/finance/ledger` | Ke `/finance/receivables?projectId=…`, `/finance/accounts` |

**Peta redirect deep link lama (Phase 4):** `/finance/invoices` → `/finance/receivables`; `/finance/payments` → `/finance/statement`; `/finance/ledger` → `/finance/accounts` (bank ledger, **bukan** General Ledger); `/finance/notes` → `/finance/receivables`; `/finance/reconciliation` → `/finance/statement`; `/finance/opex` → `/finance/payables`; `/finance/tax` → `/finance` (pajak di luar v1). Anchor hash lama diabaikan dengan aman.

## D. Test yang terdampak

| Test | Sentuhan | Tindakan Phase 4 |
|---|---|---|
| `app/constants/navigation.test.ts` :97, :108 | `/finance/invoices` → `finance.invoices`; `/finance` bukan dashboard | Tulis ulang untuk 6 menu + redirect |
| `app/data/rbac.test.ts` :37-52, :138, :254-275 | level modul `finance`, alias `finance → finance-acc`, clone role finance, `finance.opex` (bukan nav key aktif) | Pertahankan alias; perbarui menu key |

Tidak ada test yang memakai `INVOICES`/`PAYMENTS`/`finance-ext` secara langsung.
