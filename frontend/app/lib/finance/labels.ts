import type {
  ApiExpenseCategory,
  ApiInvoiceType,
  ApiPaymentStatus,
  ApiSettlement,
  ApiTransactionKind,
  CustomerInvoiceDto,
  MovementDto,
  VendorInvoiceDto
} from '~/types/api'
import type { BadgeTone } from '~/types/common'

/**
 * Plain-Indonesian wording for the finance screens (docs/.../06: "Uang masuk", "Sisa tagihan", …). One place,
 * so every screen, panel and dialog says the same thing for the same state. Display only — no business rule
 * is decided here; the server computes every status and amount.
 */

export const KIND_LABEL: Record<ApiTransactionKind, string> = {
  customer_receipt: 'Pembayaran customer',
  vendor_refund: 'Refund dari vendor',
  other_income: 'Pemasukan lain',
  transfer_in: 'Transfer masuk',
  vendor_payment: 'Pembayaran vendor',
  refund_settlement: 'Refund ke customer',
  expense: 'Pengeluaran operasional',
  transfer_out: 'Transfer keluar',
  transfer_fee: 'Biaya transfer'
}

export const CATEGORY_LABEL: Record<ApiExpenseCategory, string> = {
  payroll: 'Gaji & tunjangan',
  office: 'Kantor & sewa',
  marketing: 'Marketing',
  technology: 'Software & teknologi',
  travel: 'Perjalanan dinas',
  professional: 'Jasa profesional',
  bank_fee: 'Biaya bank',
  tax: 'Pajak',
  other: 'Lainnya'
}

export const INVOICE_TYPE_LABEL: Record<ApiInvoiceType, string> = {
  dp: 'DP',
  progress: 'Termin',
  final: 'Pelunasan',
  other: 'Lainnya'
}

interface Tag { label: string; tone: BadgeTone }

/** Status of a customer invoice as one badge: draft/void first, then overdue, then settlement. */
export function customerInvoiceTag (inv: Pick<CustomerInvoiceDto, 'status' | 'settlement' | 'overdue' | 'isDisputed'>): Tag {
  if (inv.status === 'draft') { return { label: 'Draft', tone: 'neutral' } }
  if (inv.status === 'void') { return { label: 'Dibatalkan', tone: 'neutral' } }
  if (inv.settlement === 'paid') { return { label: 'Lunas', tone: 'success' } }
  if (inv.settlement === 'credited') { return { label: 'Nol (credit note)', tone: 'neutral' } }
  if (inv.isDisputed) { return { label: 'Sengketa', tone: 'purple' } }
  if (inv.overdue) { return { label: 'Terlambat', tone: 'destructive' } }
  if (inv.settlement === 'partial') { return { label: 'Dibayar sebagian', tone: 'warning' } }
  return { label: 'Menunggu bayar', tone: 'primary' }
}

export const VENDOR_STATUS_LABEL: Record<VendorInvoiceDto['status'], string> = {
  submitted: 'Baru masuk',
  under_review: 'Sedang direview',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  void: 'Dibatalkan'
}

export function vendorInvoiceTag (inv: Pick<VendorInvoiceDto, 'status' | 'settlement' | 'overdue'>): Tag {
  if (inv.status === 'submitted') { return { label: 'Perlu direview', tone: 'info' } }
  if (inv.status === 'under_review') { return { label: 'Sedang direview', tone: 'info' } }
  if (inv.status === 'rejected') { return { label: 'Ditolak', tone: 'neutral' } }
  if (inv.status === 'void') { return { label: 'Dibatalkan', tone: 'neutral' } }
  if (inv.settlement === 'paid') { return { label: 'Lunas', tone: 'success' } }
  if (inv.overdue) { return { label: 'Terlambat', tone: 'destructive' } }
  if (inv.settlement === 'partial') { return { label: 'Dibayar sebagian', tone: 'warning' } }
  return { label: 'Siap dibayar', tone: 'primary' }
}

export const MATCH_LABEL: Record<NonNullable<VendorInvoiceDto['matchStatus']>, string> = {
  matched: 'Cocok dengan order',
  unmatched: 'Belum dicocokkan',
  disputed: 'Tidak cocok / dipersoalkan'
}

/** What Admin sees (status only) and what Finance sees on context panels. */
export const PAYMENT_STATUS_TONE: Record<ApiPaymentStatus, BadgeTone> = {
  not_invoiced: 'neutral',
  awaiting_payment: 'primary',
  dp_received: 'info',
  partially_paid: 'warning',
  up_to_date: 'info',
  paid: 'success',
  overdue: 'destructive',
  cancelled: 'neutral'
}

export const SETTLEMENT_LABEL: Record<ApiSettlement, string> = {
  open: 'Belum dibayar',
  partial: 'Dibayar sebagian',
  paid: 'Lunas',
  credited: 'Nol karena credit note'
}

/** Who/what a movement is about, in one short line. */
export function movementTitle (m: MovementDto): string {
  if (m.isInternalTransfer) { return m.kind === 'transfer_fee' ? 'Biaya transfer antar rekening' : 'Transfer antar rekening' }
  return m.party?.name ?? m.vendor?.name ?? m.counterparty ?? KIND_LABEL[m.kind]
}

export function movementSubtitle (m: MovementDto): string {
  const parts: string[] = [m.category ? CATEGORY_LABEL[m.category] : KIND_LABEL[m.kind]]
  if (m.project) { parts.push(m.project.name ?? m.project.id) }
  if (m.memo) { parts.push(m.memo) }
  return parts.join(' · ')
}
