import type { ID } from './common'

/** "Overdue" is derived (dueAt lewat, status != paid), bukan status tersimpan — lihat app/utils/attention.ts */
export type InvoiceStatus = 'unpaid' | 'partially-paid' | 'paid'
export type PaymentStatus = 'pending' | 'received'

export interface Invoice {
  id: ID
  projectId: ID
  label: string
  amountIdr: number
  issuedAt: string
  dueAt: string
  status: InvoiceStatus
}

export interface Payment {
  id: ID
  invoiceId: ID
  amountIdr: number
  receivedAt: string
}
