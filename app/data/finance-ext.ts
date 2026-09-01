import { reactive } from 'vue'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { INVOICES, PAYMENTS, CREDIT_NOTES } from './finance'
import { PROJECTS, PROJECT_SERVICES } from './projects'
import { PARTIES } from './parties'
import { VENDORS } from './vendors'
import { SUPPLIER_INVOICES, SERVICE_ORDERS } from './procurement'
import type {
  OpexEntry,
  OpexCategoryKey,
  ProjectExpense,
  ProjectExpenseCategoryKey,
  PurchaseEntry,
  PurchaseCategoryKey,
  PurchaseStatus,
  LedgerAccount,
  LedgerAccountBalance,
  JournalEntry,
  JournalLine,
  AgingBucket,
  AgingBucketKey,
  ReceivableRow,
  PayableRow
} from '~/types/finance-ext'
import type { StatusOption } from '~/types/common'
import type { ServiceTypeKey } from '~/types/project'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'

/**
 * Finance & ACC — Opex, AR/AP, dan General Ledger (Revisi 9-Modul).
 *
 * Aturan yang dipegang: apa pun yang BISA diturunkan, diturunkan. Piutang berasal dari `Invoice` +
 * `Payment`, hutang dari `SupplierInvoice`, dan jurnal dari keduanya plus Opex. Satu-satunya data baru
 * yang benar-benar tersimpan adalah `OPEX_ENTRIES` — karena biaya operasional perusahaan memang tidak
 * punya representasi apa pun di model data sebelumnya (`revisi.md` #2).
 */

export const OPEX_CATEGORIES: StatusOption<OpexCategoryKey>[] = [
  { value: 'payroll', label: 'Gaji & Tunjangan', tone: 'purple', order: 1 },
  { value: 'office', label: 'Operasional Kantor', tone: 'neutral', order: 2 },
  { value: 'marketing', label: 'Marketing & Promosi', tone: 'primary', order: 3 },
  { value: 'technology', label: 'Teknologi & Langganan', tone: 'info', order: 4 },
  { value: 'travel', label: 'Perjalanan Dinas', tone: 'warning', order: 5 },
  { value: 'professional', label: 'Jasa Profesional', tone: 'info', order: 6 },
  { value: 'other', label: 'Lain-lain', tone: 'neutral', order: 7 }
]

export const OPEX_STATUSES: StatusOption<OpexEntry['status']>[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral', order: 1 },
  { value: 'submitted', label: 'Diajukan', tone: 'info', order: 2 },
  { value: 'approved', label: 'Disetujui', tone: 'primary', order: 3 },
  { value: 'paid', label: 'Dibayar', tone: 'success', order: 4 },
  { value: 'rejected', label: 'Ditolak', tone: 'destructive', order: 5 }
]

export const OPEX_ENTRIES: OpexEntry[] = reactive([
  { id: 'OPX-001', period: '2026-07', category: 'payroll', description: 'Gaji karyawan Juli 2026', amountIdr: 385_000_000, incurredAt: '2026-07-25', status: 'paid', submittedBy: 'USR-003', approvedBy: 'USR-003', approvedAt: '2026-07-24', paidAt: '2026-07-25' },
  { id: 'OPX-002', period: '2026-07', category: 'office', description: 'Sewa kantor & utilitas Juli', amountIdr: 62_500_000, incurredAt: '2026-07-05', status: 'paid', vendorName: 'PT Graha Sentosa', submittedBy: 'USR-008', approvedBy: 'USR-003', approvedAt: '2026-07-04', paidAt: '2026-07-05' },
  { id: 'OPX-003', period: '2026-07', category: 'marketing', description: 'Iklan digital Instagram & TikTok', amountIdr: 48_000_000, incurredAt: '2026-07-15', status: 'approved', vendorName: 'Meta Platforms', submittedBy: 'USR-001', approvedBy: 'USR-003', approvedAt: '2026-07-16' },
  { id: 'OPX-004', period: '2026-07', category: 'technology', description: 'Langganan sistem reservasi & lisensi software', amountIdr: 27_300_000, incurredAt: '2026-07-10', status: 'paid', vendorName: 'Amadeus IT Group', submittedBy: 'USR-008', approvedBy: 'USR-003', approvedAt: '2026-07-09', paidAt: '2026-07-10' },
  { id: 'OPX-005', period: '2026-07', category: 'travel', description: 'Site visit Abu Dhabi — survey venue', amountIdr: 34_800_000, incurredAt: '2026-07-14', status: 'approved', projectId: 'PRJ-102', submittedBy: 'USR-002', approvedBy: 'USR-003', approvedAt: '2026-07-15', note: 'Dialokasikan ke PRJ-102 karena survey khusus project tersebut.' },
  { id: 'OPX-006', period: '2026-07', category: 'professional', description: 'Jasa konsultan pajak kuartal III', amountIdr: 18_000_000, incurredAt: '2026-07-20', status: 'submitted', vendorName: 'KAP Wijaya & Rekan', submittedBy: 'USR-008' },
  { id: 'OPX-007', period: '2026-06', category: 'payroll', description: 'Gaji karyawan Juni 2026', amountIdr: 378_000_000, incurredAt: '2026-06-25', status: 'paid', submittedBy: 'USR-003', approvedBy: 'USR-003', approvedAt: '2026-06-24', paidAt: '2026-06-25' },
  { id: 'OPX-008', period: '2026-06', category: 'office', description: 'Sewa kantor & utilitas Juni', amountIdr: 62_500_000, incurredAt: '2026-06-05', status: 'paid', vendorName: 'PT Graha Sentosa', submittedBy: 'USR-008', approvedBy: 'USR-003', approvedAt: '2026-06-04', paidAt: '2026-06-05' },
  { id: 'OPX-009', period: '2026-06', category: 'marketing', description: 'Sponsorship pameran travel fair', amountIdr: 55_000_000, incurredAt: '2026-06-18', status: 'paid', vendorName: 'Panitia Travel Fair Nusantara', submittedBy: 'USR-001', approvedBy: 'USR-003', approvedAt: '2026-06-17', paidAt: '2026-06-20' },
  { id: 'OPX-010', period: '2026-06', category: 'technology', description: 'Langganan sistem reservasi & lisensi software', amountIdr: 27_300_000, incurredAt: '2026-06-10', status: 'paid', vendorName: 'Amadeus IT Group', submittedBy: 'USR-008', approvedBy: 'USR-003', approvedAt: '2026-06-09', paidAt: '2026-06-10' },
  { id: 'OPX-011', period: '2026-07', category: 'other', description: 'Biaya administrasi bank & materai', amountIdr: 3_200_000, incurredAt: '2026-07-28', status: 'draft', submittedBy: 'USR-008' }
])

export function getOpexEntries (period?: string): OpexEntry[] {
  const list = period ? OPEX_ENTRIES.filter(entry => entry.period === period) : OPEX_ENTRIES
  return [...list].sort((a, b) => b.incurredAt.localeCompare(a.incurredAt))
}

export function getOpexPeriods (): string[] {
  return [...new Set(OPEX_ENTRIES.map(entry => entry.period))].sort().reverse()
}

export function getOpexTotalIdr (period?: string, statuses: OpexEntry['status'][] = ['approved', 'paid']): number {
  return getOpexEntries(period).filter(entry => statuses.includes(entry.status)).reduce((sum, entry) => sum + entry.amountIdr, 0)
}

export function getOpexByCategory (period?: string): { category: StatusOption<OpexCategoryKey>; amountIdr: number }[] {
  const entries = getOpexEntries(period).filter(entry => entry.status !== 'rejected' && entry.status !== 'draft')
  return OPEX_CATEGORIES
    .map(category => ({
      category,
      amountIdr: entries.filter(entry => entry.category === category.value).reduce((sum, entry) => sum + entry.amountIdr, 0)
    }))
    .filter(row => row.amountIdr > 0)
    .sort((a, b) => b.amountIdr - a.amountIdr)
}

export function createOpexEntry (input: Omit<OpexEntry, 'id' | 'status'> & { status?: OpexEntry['status'] }): OpexEntry {
  const entry: OpexEntry = {
    ...input,
    id: `OPX-${String(OPEX_ENTRIES.length + 1).padStart(3, '0')}`,
    status: input.status ?? 'submitted'
  }
  OPEX_ENTRIES.push(entry)
  return entry
}

export function updateOpexStatus (opexId: string, status: OpexEntry['status'], actorId: string): OpexEntry | undefined {
  const entry = OPEX_ENTRIES.find(item => item.id === opexId)
  if (!entry) { return undefined }
  entry.status = status
  if (status === 'approved') {
    entry.approvedBy = actorId
    entry.approvedAt = DEMO_REFERENCE_DATE
  }
  if (status === 'paid') { entry.paidAt = DEMO_REFERENCE_DATE }
  return entry
}

/* ------------------------------------------------------------------ *
 * Purchases — pembelian barang/jasa non-vendor-service (office supplies, software subscription, dst),
 * lihat komentar `PurchaseEntry` (`app/types/finance-ext.ts`) untuk perbedaannya dengan Opex/SupplierInvoice.
 * ------------------------------------------------------------------ */

export const PURCHASE_CATEGORIES: StatusOption<PurchaseCategoryKey>[] = [
  { value: 'office-supplies', label: 'Office Supplies', tone: 'neutral', order: 1 },
  { value: 'software-subscription', label: 'Software Subscription', tone: 'info', order: 2 },
  { value: 'equipment', label: 'Peralatan Kantor', tone: 'purple', order: 3 },
  { value: 'other', label: 'Lain-lain', tone: 'neutral', order: 4 }
]

export const PURCHASE_STATUSES: StatusOption<PurchaseStatus>[] = [
  { value: 'requested', label: 'Diajukan', tone: 'neutral', order: 1 },
  { value: 'ordered', label: 'Dipesan', tone: 'info', order: 2 },
  { value: 'received', label: 'Diterima', tone: 'primary', order: 3 },
  { value: 'paid', label: 'Dibayar', tone: 'success', order: 4 }
]

const purchaseEntrySeed: PurchaseEntry[] = [
  { id: 'PUR-001', purchaseDate: '2026-07-03', category: 'software-subscription', description: 'Lisensi tahunan Canva Pro Team', amountIdr: 8_400_000, status: 'paid', createdBy: 'USR-008', vendorName: 'Canva Pty Ltd' },
  { id: 'PUR-002', purchaseDate: '2026-07-08', category: 'office-supplies', description: 'ATK dan consumables kantor Juli', amountIdr: 3_150_000, status: 'received', createdBy: 'USR-008', vendorName: 'Gramedia Office Supplies' },
  { id: 'PUR-003', purchaseDate: '2026-07-12', category: 'equipment', description: '2 unit laptop untuk tim Operations baru', amountIdr: 32_000_000, status: 'received', createdBy: 'USR-008', vendorName: 'PT Digital Solusi Prima' },
  { id: 'PUR-004', purchaseDate: '2026-07-18', category: 'software-subscription', description: 'Upgrade paket Zoom Business', amountIdr: 5_600_000, status: 'ordered', createdBy: 'USR-008', vendorName: 'Zoom Video Communications' },
  { id: 'PUR-005', purchaseDate: '2026-07-24', category: 'office-supplies', description: 'Isi ulang toner printer seluruh lantai', amountIdr: 1_850_000, status: 'requested', createdBy: 'USR-008' },
  { id: 'PUR-006', purchaseDate: '2026-07-27', category: 'other', description: 'Sewa proyektor untuk town hall bulanan', amountIdr: 1_200_000, status: 'requested', createdBy: 'USR-003' }
]
export const PURCHASE_ENTRIES: PurchaseEntry[] = reactive(purchaseEntrySeed)

export function getPurchaseEntries (): PurchaseEntry[] {
  return [...PURCHASE_ENTRIES].sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))
}

export function getPurchaseTotalIdr (statuses: PurchaseStatus[] = ['received', 'paid']): number {
  return PURCHASE_ENTRIES.filter(entry => statuses.includes(entry.status)).reduce((sum, entry) => sum + entry.amountIdr, 0)
}

export function createPurchaseEntry (input: Omit<PurchaseEntry, 'id' | 'status'> & { status?: PurchaseStatus }): PurchaseEntry {
  const entry: PurchaseEntry = {
    ...input,
    id: `PUR-${String(PURCHASE_ENTRIES.length + 1).padStart(3, '0')}`,
    status: input.status ?? 'requested'
  }
  PURCHASE_ENTRIES.push(entry)
  return entry
}

export function updatePurchaseStatus (purchaseId: string, status: PurchaseStatus): PurchaseEntry | undefined {
  const entry = PURCHASE_ENTRIES.find(item => item.id === purchaseId)
  if (!entry) { return undefined }
  entry.status = status
  return entry
}

/* ------------------------------------------------------------------ *
 * Project Expense — pengeluaran ad-hoc yang dicatat langsung di dalam satu Project (beda dari Opex/
 * SupplierInvoice, lihat komentar `ProjectExpense`, `app/types/finance-ext.ts`). Langsung tercatat, tanpa
 * status/approval berlapis — begitu dibuat, langsung ikut Actual Cost project dan jurnal (lihat bawah).
 * ------------------------------------------------------------------ */

export const PROJECT_EXPENSE_CATEGORIES: StatusOption<ProjectExpenseCategoryKey>[] = [
  { value: 'transportation', label: 'Transportasi', tone: 'info', order: 1 },
  { value: 'meals', label: 'Konsumsi', tone: 'success', order: 2 },
  { value: 'supplies', label: 'Perlengkapan', tone: 'warning', order: 3 },
  { value: 'accommodation', label: 'Akomodasi Tambahan', tone: 'purple', order: 4 },
  { value: 'emergency', label: 'Darurat', tone: 'destructive', order: 5 },
  { value: 'other', label: 'Lain-lain', tone: 'neutral', order: 6 }
]

export const PROJECT_EXPENSES: ProjectExpense[] = reactive([
  { id: 'PEX-001', projectId: 'PRJ-101', category: 'transportation', description: 'Taksi bandara ke hotel untuk rombongan', amountIdr: 850_000, incurredAt: '2026-08-20', recordedBy: 'USR-002' },
  { id: 'PEX-002', projectId: 'PRJ-101', category: 'meals', description: 'Makan siang tim selama meeting client', amountIdr: 1_450_000, incurredAt: '2026-08-21', recordedBy: 'USR-002' },
  { id: 'PEX-003', projectId: 'PRJ-103', category: 'supplies', description: 'Perlengkapan tambahan booth MICE (banner, ATK)', amountIdr: 3_200_000, incurredAt: '2026-08-10', recordedBy: 'USR-002' },
  { id: 'PEX-004', projectId: 'PRJ-103', category: 'emergency', description: 'Penggantian tiket transportasi darurat 1 peserta sakit', amountIdr: 1_100_000, incurredAt: '2026-08-11', recordedBy: 'USR-002', note: 'Sudah dikonfirmasi ke PM, tidak menunggu approval karena situasi darurat.' },
  { id: 'PEX-005', projectId: 'PRJ-205', category: 'supplies', description: 'Perlengkapan trekking & P3K rombongan', amountIdr: 750_000, incurredAt: '2026-08-05', recordedBy: 'USR-002' },
  { id: 'PEX-006', projectId: 'PRJ-205', category: 'meals', description: 'Konsumsi briefing peserta sebelum keberangkatan', amountIdr: 600_000, incurredAt: '2026-08-16', recordedBy: 'USR-002' }
])

export function getProjectExpenses (projectId: string): ProjectExpense[] {
  return PROJECT_EXPENSES.filter(expense => expense.projectId === projectId).sort((a, b) => b.incurredAt.localeCompare(a.incurredAt))
}

export function createProjectExpense (input: Omit<ProjectExpense, 'id'>): ProjectExpense | undefined {
  if (!(input.amountIdr > 0) || !input.description.trim()) { return undefined }
  const expense: ProjectExpense = { ...input, id: `PEX-${String(PROJECT_EXPENSES.length + 1).padStart(3, '0')}` }
  PROJECT_EXPENSES.push(expense)
  return expense
}

/* ------------------------------------------------------------------ *
 * Aging (dipakai bersama AR dan AP)
 * ------------------------------------------------------------------ */

const BUCKET_LABELS: Record<AgingBucketKey, string> = {
  current: 'Belum Jatuh Tempo',
  '1-30': '1–30 Hari',
  '31-60': '31–60 Hari',
  '61-90': '61–90 Hari',
  '90plus': '> 90 Hari'
}

function bucketFor (agingDays: number): AgingBucketKey {
  if (agingDays <= 0) { return 'current' }
  if (agingDays <= 30) { return '1-30' }
  if (agingDays <= 60) { return '31-60' }
  if (agingDays <= 90) { return '61-90' }
  return '90plus'
}

function summarize (rows: { bucket: AgingBucketKey; outstandingIdr: number }[]): AgingBucket[] {
  return (Object.keys(BUCKET_LABELS) as AgingBucketKey[]).map(key => ({
    key,
    label: BUCKET_LABELS[key],
    amountIdr: rows.filter(row => row.bucket === key).reduce((sum, row) => sum + row.outstandingIdr, 0),
    count: rows.filter(row => row.bucket === key).length
  }))
}

/* ------------------------------------------------------------------ *
 * Receivable (AR) — diturunkan dari Invoice + Payment
 * ------------------------------------------------------------------ */

export function getReceivables (referenceIso = DEMO_REFERENCE_DATE): ReceivableRow[] {
  return INVOICES
    .filter(invoice => invoice.status !== 'paid' && invoice.status !== 'void')
    .map((invoice) => {
      const paidIdr = PAYMENTS.filter(payment => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + payment.amountIdr, 0)
      const project = PROJECTS.find(item => item.id === invoice.projectId)
      const party = project ? PARTIES.find(item => item.id === project.partyId) : undefined
      const agingDays = differenceInCalendarDays(parseISO(referenceIso), parseISO(invoice.dueAt))

      return {
        invoiceId: invoice.id,
        projectId: invoice.projectId,
        projectName: project?.name ?? invoice.projectId,
        partyName: party?.name ?? '—',
        label: invoice.label,
        amountIdr: invoice.amountIdr,
        paidIdr,
        outstandingIdr: Math.max(0, invoice.amountIdr - paidIdr),
        dueAt: invoice.dueAt,
        agingDays,
        bucket: bucketFor(agingDays)
      }
    })
    .filter(row => row.outstandingIdr > 0)
    .sort((a, b) => b.agingDays - a.agingDays)
}

export function getReceivableAging (referenceIso = DEMO_REFERENCE_DATE): AgingBucket[] {
  return summarize(getReceivables(referenceIso))
}

/* ------------------------------------------------------------------ *
 * Payable (AP) — diturunkan dari SupplierInvoice
 * ------------------------------------------------------------------ */

/**
 * Fase 3.3 (Poros Project Order + Jurnal Finance, Penyederhanaan 7-Role/Menu) — `SupplierInvoiceStatus`
 * kini punya `'paid'` (lewat `paySupplierInvoice()`, `app/data/index.ts`). Ditolak DAN sudah lunas
 * sama-sama dianggap selesai — sisanya (termasuk yang sudah disetujui tapi belum dibayar) tetap terhutang.
 */
const SETTLED_SUPPLIER_STATUSES = ['rejected', 'paid']

export function getPayables (referenceIso = DEMO_REFERENCE_DATE): PayableRow[] {
  return SUPPLIER_INVOICES
    .filter(invoice => !SETTLED_SUPPLIER_STATUSES.includes(invoice.status))
    .map((invoice) => {
      const vendor = VENDORS.find(item => item.id === invoice.vendorId)
      const serviceOrder = SERVICE_ORDERS.find(item => item.id === invoice.serviceOrderId)
      const project = serviceOrder?.projectId ? PROJECTS.find(item => item.id === serviceOrder.projectId) : undefined
      /** Tanpa jadwal bayar, umur dihitung dari tanggal invoice masuk. */
      const anchor = invoice.paymentScheduleDate ?? invoice.submittedAt
      const agingDays = differenceInCalendarDays(parseISO(referenceIso), parseISO(anchor))

      return {
        supplierInvoiceId: invoice.id,
        vendorId: invoice.vendorId,
        vendorName: vendor?.name ?? invoice.vendorId,
        projectId: project?.id,
        projectName: project?.name,
        amountIdr: invoice.amountIdr,
        outstandingIdr: invoice.amountIdr,
        submittedAt: invoice.submittedAt,
        scheduleDate: invoice.paymentScheduleDate,
        agingDays,
        bucket: bucketFor(agingDays),
        status: invoice.status,
        matchStatus: invoice.matchStatus
      }
    })
    .sort((a, b) => b.agingDays - a.agingDays)
}

export function getPayableAging (referenceIso = DEMO_REFERENCE_DATE): AgingBucket[] {
  return summarize(getPayables(referenceIso))
}

/* ------------------------------------------------------------------ *
 * General Ledger
 * ------------------------------------------------------------------ */

export const LEDGER_ACCOUNTS: LedgerAccount[] = [
  { code: '1100', name: 'Kas & Bank', type: 'asset', normalBalance: 'debit' },
  { code: '1200', name: 'Piutang Usaha', type: 'asset', normalBalance: 'debit' },
  { code: '2100', name: 'Hutang Usaha', type: 'liability', normalBalance: 'credit' },
  { code: '4100', name: 'Pendapatan Jasa Perjalanan', type: 'revenue', normalBalance: 'credit' },
  { code: '5100', name: 'Beban Pokok Layanan', type: 'expense', normalBalance: 'debit' },
  { code: '6100', name: 'Beban Operasional (Opex)', type: 'expense', normalBalance: 'debit' }
]

export function getLedgerAccount (code: string): LedgerAccount | undefined {
  return LEDGER_ACCOUNTS.find(account => account.code === code)
}

function line (accountCode: string, debitIdr: number, creditIdr: number): JournalLine {
  return { accountCode, debitIdr, creditIdr }
}

/** `ServiceOrder.projectId` untuk satu `SupplierInvoice` — dipakai bareng oleh jurnal maupun `getProjectActualCostIdr`. */
function projectIdForSupplierInvoice (serviceOrderId: string): string | undefined {
  return SERVICE_ORDERS.find(so => so.id === serviceOrderId)?.projectId
}

/**
 * Jurnal DITURUNKAN dari transaksi existing, bukan diketik ulang. Konsekuensinya: buku besar tidak
 * mungkin menyimpang dari invoice/pembayaran/opex yang mendasarinya, dan setiap entri selalu balance
 * karena dibentuk berpasangan.
 *
 * Fase 3 (Poros Project Order + Jurnal Finance, Penyederhanaan 7-Role/Menu) — setiap entri kini membawa
 * `projectId` (dari sumbernya masing-masing) supaya buku besar bisa difilter per project dan P&L per
 * project bisa dibaca langsung dari jurnal, bukan angka statis terpisah. Ditambah 2 generator baru:
 * pelunasan Supplier Invoice (Dr 2100/Cr 1100) dan Credit Note (Dr 4100/Cr 1200) — sebelumnya hutang
 * vendor tidak pernah "lunas" di buku besar dan Credit Note tidak pernah tercatat sama sekali.
 */
export function getJournalEntries (): JournalEntry[] {
  const entries: JournalEntry[] = []

  for (const invoice of INVOICES.filter(item => item.status !== 'void')) {
    entries.push({
      id: `JRN-INV-${invoice.id}`,
      date: invoice.issuedAt,
      description: `Penerbitan invoice ${invoice.label}`,
      sourceType: 'invoice',
      sourceId: invoice.id,
      lines: [line('1200', invoice.amountIdr, 0), line('4100', 0, invoice.amountIdr)],
      projectId: invoice.projectId
    })
  }

  for (const payment of PAYMENTS) {
    const invoice = INVOICES.find(item => item.id === payment.invoiceId)
    entries.push({
      id: `JRN-PAY-${payment.id}`,
      date: payment.receivedAt,
      description: `Penerimaan pembayaran invoice ${payment.invoiceId}`,
      sourceType: 'payment',
      sourceId: payment.id,
      lines: [line('1100', payment.amountIdr, 0), line('1200', 0, payment.amountIdr)],
      projectId: invoice?.projectId
    })
  }

  /**
   * `rejected` dikecualikan — tagihan yang ditolak tidak pernah menjadi liabilitas/beban riil, konsisten
   * dengan `getProjectActualCostIdr()` di bawah ("sumber yang sama dengan jurnal" — keduanya HARUS memakai
   * filter status yang identik, kalau tidak Actual Cost di Project Order dan total akun 5100 di Buku Besar
   * bisa berbeda untuk project yang punya Supplier Invoice ditolak).
   */
  for (const supplierInvoice of SUPPLIER_INVOICES.filter(item => item.status !== 'rejected')) {
    entries.push({
      id: `JRN-SUP-${supplierInvoice.id}`,
      date: supplierInvoice.submittedAt,
      description: `Tagihan vendor ${supplierInvoice.id}`,
      sourceType: 'supplier-invoice',
      sourceId: supplierInvoice.id,
      lines: [line('5100', supplierInvoice.amountIdr, 0), line('2100', 0, supplierInvoice.amountIdr)],
      projectId: projectIdForSupplierInvoice(supplierInvoice.serviceOrderId)
    })
  }

  /** Generator ke-5 (Fase 3.3) — pelunasan Supplier Invoice lewat `paySupplierInvoice()`. Tanpa ini akun 2100 (Hutang Usaha) hanya bisa bertambah, tidak pernah berkurang. */
  for (const supplierInvoice of SUPPLIER_INVOICES.filter(item => item.status === 'paid' && item.paidAt)) {
    entries.push({
      id: `JRN-SUP-PAY-${supplierInvoice.id}`,
      date: supplierInvoice.paidAt!,
      description: `Pelunasan tagihan vendor ${supplierInvoice.id}`,
      sourceType: 'supplier-payment',
      sourceId: supplierInvoice.id,
      lines: [line('2100', supplierInvoice.amountIdr, 0), line('1100', 0, supplierInvoice.amountIdr)],
      projectId: projectIdForSupplierInvoice(supplierInvoice.serviceOrderId)
    })
  }

  /** Generator ke-6 (Fase 3.4) — Credit Note (`issueCreditNote`, `app/data/index.ts`) sebelumnya memengaruhi outstanding invoice tapi tidak pernah menghasilkan entri jurnal. `DebitNote` memang sengaja informatif dan TIDAK ikut dijurnal — lihat komentar `app/types/finance.ts`. */
  for (const creditNote of CREDIT_NOTES) {
    const invoice = INVOICES.find(item => item.id === creditNote.invoiceId)
    entries.push({
      id: `JRN-CN-${creditNote.id}`,
      date: creditNote.issuedAt,
      description: `Credit Note ${creditNote.id} untuk invoice ${creditNote.invoiceId}`,
      sourceType: 'credit-note',
      sourceId: creditNote.id,
      lines: [line('4100', creditNote.amountIdr, 0), line('1200', 0, creditNote.amountIdr)],
      projectId: invoice?.projectId
    })
  }

  for (const opex of OPEX_ENTRIES.filter(item => item.status === 'approved' || item.status === 'paid')) {
    entries.push({
      id: `JRN-OPX-${opex.id}`,
      date: opex.incurredAt,
      description: opex.description,
      sourceType: 'opex',
      sourceId: opex.id,
      lines: [line('6100', opex.amountIdr, 0), line(opex.status === 'paid' ? '1100' : '2100', 0, opex.amountIdr)],
      projectId: opex.projectId
    })
  }

  /** Generator ke-7 — Project Expense (`createProjectExpense`, di atas). Dianggap dibayar tunai langsung
   * (tidak ada tahap hutang terpisah seperti Supplier Invoice) — konsisten dengan sifatnya "langsung
   * tercatat" tanpa approval berlapis. */
  for (const expense of PROJECT_EXPENSES) {
    entries.push({
      id: `JRN-PEX-${expense.id}`,
      date: expense.incurredAt,
      description: expense.description,
      sourceType: 'project-expense',
      sourceId: expense.id,
      lines: [line('5100', expense.amountIdr, 0), line('1100', 0, expense.amountIdr)],
      projectId: expense.projectId
    })
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * Actual cost turunan per project (Fase 3.2) — Σ SupplierInvoice project itu (di luar `rejected`) + Σ Opex
 * ber-`projectId` yang sama (hanya status yang benar-benar dijurnal — `approved`/`paid`, pola sama
 * `getJournalEntries()`) + Σ ProjectExpense project itu (selalu ikut, tidak ada status untuk difilter —
 * lihat `ProjectExpense`, `app/types/finance-ext.ts`). Sumber DAN filter status-nya identik dengan generator
 * jurnal di atas, sehingga Actual Cost yang tampil di Project Order dan total akun 5100+6100 di Buku Besar
 * TIDAK PERNAH bisa berbeda. Field `Project.actualCostIdr` (`app/types/project.ts`) DIPERTAHANKAN sebagai
 * seed/override mock lama, tapi TIDAK pernah diperbarui mutator apa pun (selalu `0` untuk project baru) —
 * seluruh tampilan WAJIB memanggil selector ini, bukan field mentahnya.
 */
export function getProjectActualCostIdr (projectId: string): number {
  const supplierCostIdr = SUPPLIER_INVOICES
    .filter(invoice => invoice.status !== 'rejected' && projectIdForSupplierInvoice(invoice.serviceOrderId) === projectId)
    .reduce((sum, invoice) => sum + invoice.amountIdr, 0)
  const opexCostIdr = OPEX_ENTRIES
    .filter(entry => entry.projectId === projectId && (entry.status === 'approved' || entry.status === 'paid'))
    .reduce((sum, entry) => sum + entry.amountIdr, 0)
  const projectExpenseCostIdr = getProjectExpenses(projectId).reduce((sum, expense) => sum + expense.amountIdr, 0)
  return supplierCostIdr + opexCostIdr + projectExpenseCostIdr
}

/**
 * "Pengeluaran per Layanan" (tab Finance Project Order) — breakdown Actual Cost per `ServiceTypeKey`,
 * TERPISAH dari `getProjectActualCostIdr` di atas (yang juga mencakup Opex/ProjectExpense, dan tidak per
 * tipe). Traceability SupplierInvoice → tipe layanan lewat `ServiceOrder.serviceId` (opsional) →
 * `ProjectService.type` — hanya SupplierInvoice yang service order-nya benar-benar menaut ke satu
 * `ProjectService` yang ikut terhitung di sini. Konsekuensinya: total `actualIdr` seluruh baris breakdown ini
 * BISA lebih kecil dari `getProjectActualCostIdr(projectId)` (yang juga menghitung Opex/ProjectExpense/
 * SupplierInvoice tanpa `serviceId`) — ini bukan bug, murni keterbatasan traceability yang didokumentasikan,
 * bukan berpura-pura lengkap.
 */
export function getServiceTypeSpendBreakdown (projectId: string): { type: ServiceTypeKey; budgetIdr: number; actualIdr: number }[] {
  const services = PROJECT_SERVICES.filter(service => service.projectId === projectId)
  const types = [...new Set(services.map(service => service.type))]
  return types.map((type) => {
    const servicesOfType = services.filter(service => service.type === type)
    const budgetIdr = servicesOfType.reduce((sum, service) => sum + (service.budgetIdr ?? 0), 0)
    const serviceIds = new Set(servicesOfType.map(service => service.id))
    const actualIdr = SUPPLIER_INVOICES
      .filter((invoice) => {
        if (invoice.status === 'rejected') { return false }
        const serviceOrder = SERVICE_ORDERS.find(so => so.id === invoice.serviceOrderId)
        return !!serviceOrder && serviceOrder.projectId === projectId && !!serviceOrder.serviceId && serviceIds.has(serviceOrder.serviceId)
      })
      .reduce((sum, invoice) => sum + invoice.amountIdr, 0)
    return { type, budgetIdr, actualIdr }
  })
}

/** Jurnal milik satu project (Fase 3.1) — dipakai filter Buku Besar dan section "Jurnal" tab Finance Project Order. */
export function getJournalEntriesByProject (projectId: string): JournalEntry[] {
  return getJournalEntries().filter(entry => entry.projectId === projectId)
}

export function getLedgerBalances (): LedgerAccountBalance[] {
  const entries = getJournalEntries()
  return LEDGER_ACCOUNTS.map((account) => {
    let debitIdr = 0
    let creditIdr = 0
    for (const entry of entries) {
      for (const item of entry.lines) {
        if (item.accountCode !== account.code) { continue }
        debitIdr += item.debitIdr
        creditIdr += item.creditIdr
      }
    }
    return {
      account,
      debitIdr,
      creditIdr,
      balanceIdr: account.normalBalance === 'debit' ? debitIdr - creditIdr : creditIdr - debitIdr
    }
  })
}

/* ------------------------------------------------------------------ *
 * Revenue
 * ------------------------------------------------------------------ */

export interface RevenuePeriodRow {
  period: string
  revenueIdr: number
  collectedIdr: number
  directCostIdr: number
  opexIdr: number
  grossProfitIdr: number
  netProfitIdr: number
}

export function getRevenueByPeriod (): RevenuePeriodRow[] {
  const periods = new Set<string>()
  for (const invoice of INVOICES) { periods.add(invoice.issuedAt.slice(0, 7)) }
  for (const opex of OPEX_ENTRIES) { periods.add(opex.period) }

  return [...periods].sort().map((period) => {
    const periodInvoices = INVOICES.filter(invoice => invoice.status !== 'void' && invoice.issuedAt.startsWith(period))
    const revenueIdr = periodInvoices.reduce((sum, invoice) => sum + invoice.amountIdr, 0)
    const collectedIdr = PAYMENTS.filter(payment => payment.receivedAt.startsWith(period)).reduce((sum, payment) => sum + payment.amountIdr, 0)
    const directCostIdr = SUPPLIER_INVOICES.filter(invoice => invoice.submittedAt.startsWith(period)).reduce((sum, invoice) => sum + invoice.amountIdr, 0)
    const opexIdr = getOpexTotalIdr(period)
    const grossProfitIdr = revenueIdr - directCostIdr

    return {
      period,
      revenueIdr,
      collectedIdr,
      directCostIdr,
      opexIdr,
      grossProfitIdr,
      netProfitIdr: grossProfitIdr - opexIdr
    }
  })
}
