import type { ID } from './common'

/**
 * Project Finance (Section 20 — roadmap Section 00–24 baru, D-077). `Invoice`/`Payment` diperluas ADITIF
 * (field baru saja, tidak ada field lama yang diubah/dihapus) — `'void'` ditambahkan ke `InvoiceStatus`
 * sebagai transisi terminal baru (`voidInvoice`, `app/data/index.ts`), dan seluruh selektor yang sebelumnya
 * memeriksa `status !== 'paid'` sebagai proksi "outstanding" (Section 15 lama) diperbarui agar turut
 * mengecualikan `'void'` (lihat `app/utils/attention.ts` `isInvoiceOverdue`, `app/data/index.ts`
 * `getInvoiceOutstandingIdr`/`getOutstandingInvoices`/`getDepartureReadiness`). `CreditNote`/`DebitNote`
 * BARU — entitas terpisah yang menautkan ID ke `Invoice` (pola sama D-070 dst.), TIDAK PERNAH menulis ulang
 * `Invoice.amountIdr` (histori invoice tetap utuh) — `getInvoiceOutstandingIdr` mengurangi outstanding
 * dengan total `CreditNote` berstatus `issued`/`applied` milik invoice tsb secara on-the-fly.
 */

/** "Overdue" is derived (dueAt lewat, status != paid/void), bukan status tersimpan — lihat app/utils/attention.ts */
export type InvoiceStatus = 'unpaid' | 'partially-paid' | 'paid' | 'void'
export type PaymentStatus = 'pending' | 'received'

/** Multi-currency display (Section 20, Wajib) — `amountIdr` TETAP satu-satunya ledger/source of truth (nilai IDR), `currency`/`exchangeRateSnapshot` murni untuk tampilan asal invoice. */
export type InvoiceCurrency = 'IDR' | 'USD' | 'SGD' | 'EUR'

/** Termin/tipe invoice (Section 20, Wajib "Client invoice, DP"). */
export type InvoiceType = 'dp' | 'progress' | 'final'

/** Exchange-rate snapshot MOCK (Section 20, Wajib) — dicatat pada saat invoice diterbitkan, TIDAK pernah diperbarui otomatis mengikuti kurs pasar nyata (D-006, no real integration). Hanya relevan bila `currency !== 'IDR'`. */
export interface ExchangeRateSnapshot {
  /** 1 unit `Invoice.currency` = `rate` IDR. */
  rate: number
  baseCurrency: 'IDR'
  capturedAt: string
}

export interface Invoice {
  id: ID
  projectId: ID
  label: string
  amountIdr: number
  issuedAt: string
  dueAt: string
  status: InvoiceStatus
  currency: InvoiceCurrency
  exchangeRateSnapshot?: ExchangeRateSnapshot
  invoiceType: InvoiceType
  /** Diisi oleh `voidInvoice` (Section 20) — alasan wajib, transisi terminal (pola sama section lain). */
  voidedAt?: string
  voidReason?: string
}

export interface Payment {
  id: ID
  invoiceId: ID
  amountIdr: number
  receivedAt: string
  method?: string
  /** Reuse `User.id` — wajib diisi sejak Section 20 (backfill fixture existing dengan user Finance yang plausible). */
  recordedBy: ID
}

/** `CreditNote` — mengurangi outstanding invoice terkait tanpa menulis ulang `Invoice.amountIdr`. `refundRequestId` opsional menautkan ke `RefundRequest` (Section 19, `app/types/change-incident.ts`) — loose reference, tidak memutasi entitas itu. */
export type CreditNoteStatus = 'issued' | 'applied'
export interface CreditNote {
  id: ID
  invoiceId: ID
  refundRequestId?: ID
  amountIdr: number
  issuedAt: string
  reason: string
  status: CreditNoteStatus
}

/** `DebitNote` — tagihan tambahan murni informasional (Wajib), TIDAK secara otomatis menambah `Invoice.amountIdr` atau mempengaruhi kalkulasi outstanding mana pun (histori invoice/CreditNote tetap satu-satunya yang dihitung). */
export type DebitNoteStatus = 'issued' | 'settled'
export interface DebitNote {
  id: ID
  invoiceId?: ID
  projectId: ID
  amountIdr: number
  issuedAt: string
  reason: string
  status: DebitNoteStatus
}
