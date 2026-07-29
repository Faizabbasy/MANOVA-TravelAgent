import type { Invoice, Payment } from '~/types/finance'

/** docs/mockup-data-scenarios.md bagian 1-3. */
export const INVOICES: Invoice[] = [
  { id: 'INV-1011', projectId: 'PRJ-101', label: 'Invoice Manila Business Trip', amountIdr: 95_000_000, issuedAt: '2026-06-26', dueAt: '2026-07-10', status: 'paid' },

  { id: 'INV-1021', projectId: 'PRJ-102', label: 'Invoice Abu Dhabi (Termin Awal)', amountIdr: 310_000_000, issuedAt: '2026-06-21', dueAt: '2026-07-01', status: 'partially-paid' },
  { id: 'INV-1022', projectId: 'PRJ-102', label: 'Invoice Tambahan (Perubahan Kamar & Traveler)', amountIdr: 35_000_000, issuedAt: '2026-07-05', dueAt: '2026-07-20', status: 'unpaid' },

  { id: 'INV-1031', projectId: 'PRJ-103', label: 'Invoice Palu MICE (Termin 1)', amountIdr: 700_000_000, issuedAt: '2026-06-10', dueAt: '2026-06-20', status: 'paid' },
  { id: 'INV-1032', projectId: 'PRJ-103', label: 'Invoice Palu MICE (Termin 2)', amountIdr: 700_000_000, issuedAt: '2026-07-15', dueAt: '2026-08-05', status: 'unpaid' },
]

export const PAYMENTS: Payment[] = [
  { id: 'PAY-1011', invoiceId: 'INV-1011', amountIdr: 95_000_000, receivedAt: '2026-07-10' },
  { id: 'PAY-1021', invoiceId: 'INV-1021', amountIdr: 250_000_000, receivedAt: '2026-07-05' },
  { id: 'PAY-1031', invoiceId: 'INV-1031', amountIdr: 700_000_000, receivedAt: '2026-06-18' },
]
