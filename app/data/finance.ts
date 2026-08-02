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
  }
])

/** `recordedBy` di-backfill ke `USR-008` (Budi Santoso, role `finance`) untuk seluruh payment existing — plausible, konsisten dengan `reviewedBy`/`recordedBy` internal user lain di codebase. `method` diisi `'bank-transfer'` (metode paling umum pada skenario B2B travel ini). */
export const PAYMENTS: Payment[] = reactive([
  { id: 'PAY-1011', invoiceId: 'INV-1011', amountIdr: 95_000_000, receivedAt: '2026-07-10', method: 'bank-transfer', recordedBy: 'USR-008' },
  { id: 'PAY-1021', invoiceId: 'INV-1021', amountIdr: 250_000_000, receivedAt: '2026-07-05', method: 'bank-transfer', recordedBy: 'USR-008' },
  { id: 'PAY-1031', invoiceId: 'INV-1031', amountIdr: 700_000_000, receivedAt: '2026-06-18', method: 'bank-transfer', recordedBy: 'USR-008' }
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
