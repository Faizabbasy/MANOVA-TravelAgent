import type { ID } from './common'

/**
 * Perluasan Finance & ACC (Revisi 9-Modul) — Opex terpisah dari invoice, General Ledger, dan Payable.
 *
 * `revisi.md` #1 dan #2 secara eksplisit meminta "tambah payable dan achievable" (piutang) serta "tambah
 * opex yang terpisah dengan invoice". Piutang (AR) dan sebagian besar Payable TIDAK butuh entitas baru —
 * keduanya diturunkan dari `Invoice` dan `SupplierInvoice` yang sudah ada. Yang benar-benar baru hanya
 * Opex dan jurnal General Ledger.
 */

export type OpexCategoryKey =
  | 'payroll'
  | 'office'
  | 'marketing'
  | 'technology'
  | 'travel'
  | 'professional'
  | 'other'

export type OpexStatus = 'draft' | 'submitted' | 'approved' | 'paid' | 'rejected'

export interface OpexEntry {
  id: ID
  /** Periode akuntansi `YYYY-MM` — Opex bersifat periodik, bukan per-project. */
  period: string
  category: OpexCategoryKey
  description: string
  amountIdr: number
  incurredAt: string
  status: OpexStatus
  vendorName?: string
  /**
   * Opex umumnya biaya operasional perusahaan, TIDAK dibebankan ke project. Diisi hanya untuk kasus
   * langka biaya operasional yang memang dialokasikan ke satu project tertentu.
   */
  projectId?: ID
  submittedBy?: ID
  approvedBy?: ID
  approvedAt?: string
  paidAt?: string
  note?: string
}

export type LedgerAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface LedgerAccount {
  code: string
  name: string
  type: LedgerAccountType
  normalBalance: 'debit' | 'credit'
}

export interface JournalLine {
  accountCode: string
  debitIdr: number
  creditIdr: number
}

export type JournalSourceType = 'invoice' | 'payment' | 'supplier-invoice' | 'opex' | 'manual'

/** Jurnal DITURUNKAN dari transaksi yang sudah ada — bukan entri yang diketik ulang secara terpisah. */
export interface JournalEntry {
  id: ID
  date: string
  description: string
  sourceType: JournalSourceType
  sourceId: ID
  lines: JournalLine[]
}

export interface LedgerAccountBalance {
  account: LedgerAccount
  debitIdr: number
  creditIdr: number
  balanceIdr: number
}

export type AgingBucketKey = 'current' | '1-30' | '31-60' | '61-90' | '90plus'

export interface AgingBucket {
  key: AgingBucketKey
  label: string
  amountIdr: number
  count: number
}

export interface ReceivableRow {
  invoiceId: ID
  projectId: ID
  projectName: string
  partyName: string
  label: string
  amountIdr: number
  paidIdr: number
  outstandingIdr: number
  dueAt: string
  agingDays: number
  bucket: AgingBucketKey
}

export interface PayableRow {
  supplierInvoiceId: ID
  vendorId: ID
  vendorName: string
  projectId?: ID
  projectName?: string
  amountIdr: number
  /** Sama dengan `amountIdr` selama pembayaran parsial ke vendor belum dimodelkan — dipertahankan agar bentuknya seragam dengan `ReceivableRow` untuk perhitungan aging bersama. */
  outstandingIdr: number
  submittedAt: string
  scheduleDate?: string
  agingDays: number
  bucket: AgingBucketKey
  status: string
  matchStatus?: string
}
