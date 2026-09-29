import { formatBusinessDate } from './dates'
import type {
  CashFlowCertainty, CashFlowExcludedCode, CashFlowHorizon, CashFlowItem, CashFlowProjection, CashFlowRow, CashFlowSource
} from '~/types/api'

/**
 * Words and small derivations for the Cash Flow screen. Every number comes from the API; this file only
 * labels and groups what the server computed.
 */

export const HORIZON_OPTIONS: { value: CashFlowHorizon; label: string; long: string }[] = [
  { value: '30d', label: '30 hari', long: '30 hari ke depan' },
  { value: '3m', label: '3 bulan', long: '3 bulan ke depan' },
  { value: '6m', label: '6 bulan', long: '6 bulan ke depan' },
  { value: '12m', label: '12 bulan', long: '12 bulan ke depan' }
]

const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const monthName = (iso: string) => MONTHS_LONG[Number(iso.slice(5, 7)) - 1]!

/** "Oktober 2026", "Sisa September (30 Sep)", "30 Sep – 6 Okt". */
export function periodLabel (row: Pick<CashFlowRow, 'startDate' | 'endDate' | 'kind'>, today: string): string {
  if (row.kind === 'month') { return `${monthName(row.startDate)} ${row.startDate.slice(0, 4)}` }
  const from = formatBusinessDate(row.startDate, { short: true, today })
  const to = formatBusinessDate(row.endDate, { short: true, today })
  if (row.kind === 'rest_of_month') { return row.startDate === row.endDate ? `Sisa ${monthName(row.startDate)} (${from})` : `Sisa ${monthName(row.startDate)}` }
  return row.startDate === row.endDate ? from : `${from} – ${to}`
}

/** Short axis label for the chart. */
export function periodShortLabel (row: Pick<CashFlowRow, 'startDate' | 'kind'>, today: string): string {
  if (row.kind === 'week') { return formatBusinessDate(row.startDate, { short: true, today }) }
  const short = monthName(row.startDate).slice(0, 3)
  return row.kind === 'rest_of_month' ? `Sisa ${short}` : `${short} ${row.startDate.slice(2, 4)}`
}

export const CERTAINTY: Record<CashFlowCertainty, { label: string; hint: string; tone: 'success' | 'info' | 'destructive' }> = {
  confirmed: { label: 'Sesuai jatuh tempo', hint: 'Nominal dan tanggal jatuh temponya sudah pasti.', tone: 'success' },
  expected: { label: 'Tanggal perkiraan', hint: 'Memakai tanggal perkiraan bayar yang dicatat Finance, bukan jatuh tempo.', tone: 'info' },
  overdue: { label: 'Terlambat', hint: 'Sudah lewat jatuh tempo dan belum lunas; dianggap terjadi di periode pertama.', tone: 'destructive' }
}

export const SOURCE_LABEL: Record<CashFlowSource, string> = {
  customer_invoice: 'Tagihan customer',
  vendor_invoice: 'Invoice vendor',
  refund: 'Refund ke customer'
}

export const EXCLUDED: Record<CashFlowExcludedCode, { title: string; detail: string; to: string }> = {
  draft_invoices: { title: 'Draft invoice customer', detail: 'Belum diterbitkan, jadi belum menjadi tagihan.', to: '/finance/receivables?tab=draft' },
  planned_billing: { title: 'Rencana tagihan', detail: 'Masuk ke perkiraan setelah invoice-nya diterbitkan.', to: '/finance/receivables?tab=plan' },
  vendor_invoices_in_review: { title: 'Invoice vendor menunggu review', detail: 'Baru dihitung sebagai utang setelah disetujui.', to: '/finance/payables?tab=review' },
  refunds_awaiting_decision: { title: 'Pembatalan menunggu keputusan', detail: 'Refund baru dihitung sebagai uang keluar setelah disetujui.', to: '/finance/refunds' },
  customer_advances: { title: 'Sisa uang muka customer', detail: 'Sudah ada di saldo, tapi customer-nya tidak punya tagihan terbuka untuk dikurangi.', to: '/finance/receivables' },
  vendor_deposits: { title: 'Deposit vendor belum dialokasikan', detail: 'Sudah keluar dari saldo. Tidak dikurangkan dari utang vendor agar perkiraan tetap hati-hati.', to: '/finance/payables' },
  incoming_after_horizon: { title: 'Tagihan setelah periode ini', detail: 'Jatuh tempo atau perkiraan bayarnya di luar rentang yang dipilih.', to: '/finance/receivables' },
  outgoing_after_horizon: { title: 'Utang setelah periode ini', detail: 'Jatuh tempo atau rencana bayarnya di luar rentang yang dipilih.', to: '/finance/payables' }
}

/** Where a drill-down row leads: the sheet of that invoice or refund case. */
export function itemKey (item: Pick<CashFlowItem, 'source' | 'id'>): string {
  return `${item.source}:${item.id}`
}

export function contributorItems (flow: CashFlowProjection, keys: string[]): CashFlowItem[] {
  const byKey = new Map(flow.items.map(i => [itemKey(i), i]))
  return keys.flatMap(k => byKey.get(k) ?? [])
}

/** Items of one period, money in first, then by date and size. */
export function itemsOfPeriod (flow: CashFlowProjection, index: number): CashFlowItem[] {
  return flow.items.filter(i => i.periodIndex === index)
}

/** The row with the lowest balance (for the headline "titik terendah"). */
export function lowestRow (rows: CashFlowRow[]): CashFlowRow | null {
  return rows.reduce<CashFlowRow | null>((m, r) => (!m || BigInt(r.lowestMinor) < BigInt(m.lowestMinor) ? r : m), null)
}
