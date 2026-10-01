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

/**
 * "Overdue" is derived (dueAt lewat, status != paid/void), bukan status tersimpan — lihat app/utils/attention.ts.
 * `'waiting-verification'`/`'disputed'` (Repair Phase Section 6 — Finance & Collaboration, Master Prompt
 * bagian A "Status") ditambahkan ADITIF — 4 nilai lama (LOCKED, Section 20) tidak berubah maknanya, seluruh
 * selektor existing (`getInvoiceOutstandingIdr`/`getProjectOutstandingIdr`/`isInvoiceOverdue`) tetap
 * memperlakukan 2 nilai baru sebagai "belum lunas" secara otomatis (hanya `status === 'paid'`/`'void'` yang
 * dikecualikan di seluruh selektor tsb, tidak berubah). "Draft"/"Issued"/"Viewed"/"Overdue"/"Cancelled"/
 * "Refunded" (6 nilai lain Master Prompt) SENGAJA tidak ditambahkan sebagai status tersimpan — derivasi dari
 * field lain (`viewedAt`, `isInvoiceOverdue`, `status: 'void'` sudah memenuhi "Cancelled") agar tidak ada dua
 * representasi status yang bisa berbeda (LOCKED `void` tetap satu-satunya representasi "dibatalkan").
 */
export type InvoiceStatus = 'unpaid' | 'partially-paid' | 'paid' | 'void' | 'waiting-verification' | 'disputed'
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

/**
 * Breakdown termin (Down Payment/Termin/Final) di dalam satu Invoice — dibuat langsung dari Project Detail
 * (tab Finance, tombol "+ Buat Invoice") supaya client tidak perlu ke modul Finance terpisah hanya untuk
 * menerbitkan invoice bertermin. Opsional/aditif — invoice lama (dibuat lewat `/finance/invoices`, tanpa
 * milestone) tetap berupa satu `amountIdr` flat seperti biasa. Saat `milestones` terisi, `sum(amountIdr)`
 * SELALU sama dengan `Invoice.amountIdr` induknya (dihitung sekali saat `createInvoice`, tidak pernah ditulis
 * ulang — konsisten prinsip "amountIdr tidak berubah" yang sudah dipakai `CreditNote`/`DebitNote`). Milestone
 * TIDAK bisa diedit/dihapus setelah invoice terbit — koreksi lewat Void/Credit Note seperti invoice lain.
 */
export interface InvoiceMilestone {
  id: ID
  label: string
  /** 0-100, porsi dari `amountIdr` invoice induk. */
  percent: number
  amountIdr: number
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
  /** Breakdown termin, diisi `createInvoice` bila dibuat dari Project Detail dengan template milestone. */
  milestones?: InvoiceMilestone[]
  /** Catatan bebas invoice (mis. rujukan PO/kontrak) — diisi saat `createInvoice`, ditampilkan di footer card. */
  notes?: string
  /** Diisi oleh `voidInvoice` (Section 20) — alasan wajib, transisi terminal (pola sama section lain). */
  voidedAt?: string
  voidReason?: string
  /** Diisi otomatis saat DP Group Trip B2C dikonfirmasi (`confirmGroupTripDp`, `app/data/index.ts`) —
   * jejak balik ke `SalesOrder` asal, dipakai `getSalesOrderOutstandingIdr` (outstanding per-booking, beda
   * dari `getProjectOutstandingIdr` yang per-project). Kosong untuk Invoice B2B biasa. */
  salesOrderId?: ID

  /**
   * Repair Phase Section 6 — Finance & Collaboration (Master Prompt bagian A). Seluruhnya opsional/aditif.
   * `viewedAt` — "Viewed" (Wajib), diisi `markInvoiceViewed` saat Client pertama kali membuka detail invoice.
   * `paymentProof*` — "Upload payment proof"/"Payment reference"/"Submit payment confirmation" (Wajib),
   * diisi `submitPaymentProof`. `dispute*` — "Raise dispute" (Wajib), diisi `raiseInvoiceDispute`.
   */
  viewedAt?: string
  paymentProofUploadedAt?: string
  paymentProofSubmittedBy?: ID
  paymentProofReference?: string
  paymentProofNote?: string
  paymentProofAmountIdr?: number
  disputeReason?: string
  disputedAt?: string
}

export interface Payment {
  id: ID
  invoiceId: ID
  amountIdr: number
  receivedAt: string
  method?: string
  /** Reuse `User.id` — wajib diisi sejak Section 20 (backfill fixture existing dengan user Finance yang plausible). */
  recordedBy: ID
  /** Menautkan payment ke satu `InvoiceMilestone` spesifik (bila invoice induknya punya milestone) — opsional, invoice flat lama tetap kosong. */
  milestoneId?: ID
  /** Free text dari form Record Payment (mis. ID transfer/no. kuitansi) — opsional. */
  reference?: string
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
