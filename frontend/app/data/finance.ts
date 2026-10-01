import { reactive } from 'vue'
import type { Invoice, Payment, CreditNote, DebitNote } from '~/types/finance'

/**
 * docs/mockup-data-scenarios.md bagian 1-3, diperluas Section 20 (D-077). `currency`/`invoiceType` di-backfill
 * ke seluruh invoice existing TANPA mengubah nilai efektifnya (seluruhnya tetap `'IDR'`, `amountIdr` tidak
 * disentuh) — `invoiceType` diturunkan dari label/urutan invoice per project apa adanya (invoice pertama per
 * project yang punya makna termin awal → `'dp'`, invoice tunggal/penutup → `'final'`, invoice tambahan di
 * tengah → `'progress'`). `INV-1041` (PRJ-104) BARU — satu-satunya invoice project itu (sebelumnya kosong,
 * tidak pernah divalidasi angka apa pun oleh section manapun), didesain khusus mendemokan currency non-IDR +
 * `exchangeRateSnapshot` tanpa mengubah satu pun angka Outstanding/Margin/Variance yang sudah divalidasi
 * sejak Section 15/16 untuk PRJ-101/102/103.
 *
 * `reactive()` (mengikuti pola Section 07 dst.) — sebelumnya array polos karena belum ada mutator; Section 20
 * menambahkan `createInvoice`/`voidInvoice`/`recordPayment`, sehingga perubahan harus reaktif di seluruh UI.
 */
export const INVOICES: Invoice[] = reactive([
  { id: 'INV-1011', projectId: 'PRJ-101', label: 'Invoice Manila Business Trip', amountIdr: 95_000_000, issuedAt: '2026-06-26', dueAt: '2026-07-10', status: 'paid', currency: 'IDR', invoiceType: 'final' },

  { id: 'INV-1021', projectId: 'PRJ-102', label: 'Invoice Abu Dhabi (Termin Awal)', amountIdr: 310_000_000, issuedAt: '2026-06-21', dueAt: '2026-07-01', status: 'partially-paid', currency: 'IDR', invoiceType: 'dp' },
  { id: 'INV-1022', projectId: 'PRJ-102', label: 'Invoice Tambahan (Perubahan Kamar & Traveler)', amountIdr: 35_000_000, issuedAt: '2026-07-05', dueAt: '2026-07-20', status: 'unpaid', currency: 'IDR', invoiceType: 'progress' },

  { id: 'INV-1031', projectId: 'PRJ-103', label: 'Invoice Palu MICE (Termin 1)', amountIdr: 700_000_000, issuedAt: '2026-06-10', dueAt: '2026-06-20', status: 'paid', currency: 'IDR', invoiceType: 'dp' },
  { id: 'INV-1032', projectId: 'PRJ-103', label: 'Invoice Palu MICE (Termin 2)', amountIdr: 700_000_000, issuedAt: '2026-07-15', dueAt: '2026-08-05', status: 'unpaid', currency: 'IDR', invoiceType: 'final' },

  {
    id: 'INV-1041',
    projectId: 'PRJ-104',
    label: 'Invoice DP Manila Follow-up Training (USD)',
    amountIdr: 20_000_000,
    issuedAt: '2026-07-20',
    dueAt: '2026-08-20',
    status: 'unpaid',
    currency: 'USD',
    invoiceType: 'dp',
    exchangeRateSnapshot: { rate: 15_600, baseCurrency: 'IDR', capturedAt: '2026-07-20' }
  },

  /** PRJ-201-204 (Client Experience — Repair Phase Section 1) — status invoice mengikuti narasi skenario `docs/client-mock-data-scenarios.md`. */
  { id: 'INV-2011', projectId: 'PRJ-201', label: 'Invoice Korea Incentive Trip (Termin Awal)', amountIdr: 490_000_000, issuedAt: '2026-08-01', dueAt: '2026-08-15', status: 'partially-paid', currency: 'IDR', invoiceType: 'dp' },
  { id: 'INV-2021', projectId: 'PRJ-202', label: 'Invoice Abu Dhabi Business Delegation', amountIdr: 460_000_000, issuedAt: '2026-07-05', dueAt: '2026-07-20', status: 'paid', currency: 'IDR', invoiceType: 'final' },
  { id: 'INV-2031', projectId: 'PRJ-203', label: 'Invoice Final Manila Corporate Meeting', amountIdr: 165_000_000, issuedAt: '2026-06-01', dueAt: '2026-06-08', status: 'paid', currency: 'IDR', invoiceType: 'final' },
  { id: 'INV-2041', projectId: 'PRJ-204', label: 'Invoice Singapore Conference (Termin Awal)', amountIdr: 150_000_000, issuedAt: '2026-07-20', dueAt: '2026-08-05', status: 'partially-paid', currency: 'IDR', invoiceType: 'dp' },

  /** PRJ-205 (dummy Project B2C) — konsolidasi DP dari peserta yang sudah Confirmed (SLO-006 + SLO-009,
   * `app/data/sales-orders.ts`), pelunasan termin akhir jatuh tempo H-14 sebelum keberangkatan. */
  { id: 'INV-2051', projectId: 'PRJ-205', label: 'Invoice DP Group Bromo Ijen (Batch 1)', amountIdr: 17_500_000, issuedAt: '2026-08-12', dueAt: '2026-08-19', status: 'paid', currency: 'IDR', invoiceType: 'dp' },
  { id: 'INV-2052', projectId: 'PRJ-205', label: 'Invoice Pelunasan Group Bromo Ijen (Termin Akhir)', amountIdr: 20_000_000, issuedAt: '2026-08-20', dueAt: '2026-09-04', status: 'unpaid', currency: 'IDR', invoiceType: 'final' },

  /**
   * PRJ-501/502 (Demo Client Presentation) — DP + Final SENGAJA sudah `status: 'paid'` sejak awal (bukan
   * `partially-paid`/`unpaid`) supaya gate "Start" (`getDepartureReadiness`, seluruh invoice harus
   * `paid`/`void`) lolos statis tanpa aksi Finance tambahan saat demo — `closureChecklist.financeSettled`
   * tetap dibiarkan kosong di `app/data/projects.ts` agar tombol "Close Finance" (Section 20) masih
   * bisa didemokan live tepat sebelum step "Done" (`evaluateFinanceClosureGate` langsung lolos karena
   * outstanding sudah 0).
   */
  { id: 'INV-5011', projectId: 'PRJ-501', label: 'Invoice DP Kuala Lumpur Manufacturing Delegation', amountIdr: 63_000_000, issuedAt: '2026-07-02', dueAt: '2026-07-09', status: 'paid', currency: 'IDR', invoiceType: 'dp' },
  { id: 'INV-5012', projectId: 'PRJ-501', label: 'Invoice Pelunasan Kuala Lumpur Manufacturing Delegation', amountIdr: 147_000_000, issuedAt: '2026-07-03', dueAt: '2026-07-07', status: 'paid', currency: 'IDR', invoiceType: 'final' },

  { id: 'INV-5021', projectId: 'PRJ-502', label: 'Invoice DP Group Labuan Bajo Komodo Explorer', amountIdr: 15_000_000, issuedAt: '2026-07-03', dueAt: '2026-07-08', status: 'paid', currency: 'IDR', invoiceType: 'dp' },
  { id: 'INV-5022', projectId: 'PRJ-502', label: 'Invoice Pelunasan Group Labuan Bajo Komodo Explorer', amountIdr: 25_000_000, issuedAt: '2026-07-04', dueAt: '2026-07-07', status: 'paid', currency: 'IDR', invoiceType: 'final' }
])

/** `recordedBy` di-backfill ke `USR-008` (Budi Santoso, role `finance`) untuk seluruh payment existing — plausible, konsisten dengan `reviewedBy`/`recordedBy` internal user lain di codebase. `method` diisi `'bank-transfer'` (metode paling umum pada skenario B2B travel ini). */
export const PAYMENTS: Payment[] = reactive([
  { id: 'PAY-1011', invoiceId: 'INV-1011', amountIdr: 95_000_000, receivedAt: '2026-07-10', method: 'bank-transfer', recordedBy: 'USR-008' },
  { id: 'PAY-1021', invoiceId: 'INV-1021', amountIdr: 250_000_000, receivedAt: '2026-07-05', method: 'bank-transfer', recordedBy: 'USR-008' },
  { id: 'PAY-1031', invoiceId: 'INV-1031', amountIdr: 700_000_000, receivedAt: '2026-06-18', method: 'bank-transfer', recordedBy: 'USR-008' },

  /** PRJ-201-204 (Client Experience — Repair Phase Section 1) — payment mengikuti status invoice terkait. */
  { id: 'PAY-2011', invoiceId: 'INV-2011', amountIdr: 245_000_000, receivedAt: '2026-08-10', method: 'bank-transfer', recordedBy: 'USR-008' },
  { id: 'PAY-2021', invoiceId: 'INV-2021', amountIdr: 460_000_000, receivedAt: '2026-07-18', method: 'bank-transfer', recordedBy: 'USR-008' },
  { id: 'PAY-2031', invoiceId: 'INV-2031', amountIdr: 165_000_000, receivedAt: '2026-06-07', method: 'bank-transfer', recordedBy: 'USR-008' },
  { id: 'PAY-2041', invoiceId: 'INV-2041', amountIdr: 75_000_000, receivedAt: '2026-08-01', method: 'bank-transfer', recordedBy: 'USR-008' },
  { id: 'PAY-2051', invoiceId: 'INV-2051', amountIdr: 17_500_000, receivedAt: '2026-08-14', method: 'bank-transfer', recordedBy: 'USR-008' },

  /** PRJ-501/502 (Demo Client Presentation) — payment penuh, konsisten dengan `INV-5011/5012`/`INV-5021/5022` di atas yang sudah `status: 'paid'`. */
  { id: 'PAY-5011', invoiceId: 'INV-5011', amountIdr: 63_000_000, receivedAt: '2026-07-04', method: 'bank-transfer', recordedBy: 'USR-008' },
  { id: 'PAY-5012', invoiceId: 'INV-5012', amountIdr: 147_000_000, receivedAt: '2026-07-06', method: 'bank-transfer', recordedBy: 'USR-008' },
  { id: 'PAY-5021', invoiceId: 'INV-5021', amountIdr: 15_000_000, receivedAt: '2026-07-05', method: 'bank-transfer', recordedBy: 'USR-008' },
  { id: 'PAY-5022', invoiceId: 'INV-5022', amountIdr: 25_000_000, receivedAt: '2026-07-06', method: 'bank-transfer', recordedBy: 'USR-008' }
])

/**
 * `CreditNote`/`DebitNote` (Section 20, BARU). `CN-001` SENGAJA ditautkan ke `INV-1011` (PRJ-101, `status:
 * 'paid'`, outstanding sudah 0) — BUKAN ke `INV-1021` (REF-001, Section 19, sudah `creditStatus: 'issued'`
 * sejak fixture lama) untuk menghindari mengubah Outstanding PRJ-102 (Rp95.000.000) yang sudah divalidasi
 * presisi sejak Section 15/16 (`docs/mockup-data-scenarios.md` bagian 2.3) — hook baru `issueCreditNote` di
 * `updateRefundRequestStatus` (D-077) bersifat PROSPEKTIF (berlaku untuk transisi status baru sejak Section
 * 20 berjalan), bukan migrasi retroaktif data historis Section 19. Outstanding `INV-1011` sudah 0 sebelum dan
 * sesudah `CN-001` (floor `Math.max(...,0)` di `getInvoiceOutstandingIdr`) — nol regresi. `DN-001` murni
 * informasional (Wajib, TIDAK mempengaruhi kalkulasi outstanding mana pun).
 */
export const CREDIT_NOTES: CreditNote[] = reactive([
  { id: 'CN-001', invoiceId: 'INV-1011', amountIdr: 2_000_000, issuedAt: '2026-07-25', reason: 'Penyesuaian billing minor — kelebihan pembebanan airport tax pada invoice awal.', status: 'issued' }
])

export const DEBIT_NOTES: DebitNote[] = reactive([
  { id: 'DN-001', projectId: 'PRJ-102', invoiceId: 'INV-1022', amountIdr: 5_000_000, issuedAt: '2026-07-20', reason: 'Biaya tambahan perubahan kamar melebihi kuota yang disepakati di quotation awal.', status: 'issued' }
])
