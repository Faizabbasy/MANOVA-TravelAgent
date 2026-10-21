import type { FulfillmentInput, FulfillmentOverviewDto, FulfillmentSide } from '~/types/api'
import type { FinanceOption } from '~/lib/finance/types'
import { formatMoneyMinor } from '~/lib/money'

/**
 * Pure decisions of the "Jasa diberikan / diterima" form: which existing records can prefill it, what amount
 * they suggest, and the exact business input sent to the server. No accounts, no debit/credit — the server
 * derives the ledger from this fact.
 */
export const WHOLE_SOURCE = '__whole__'

export function fulfillmentSources (overview: FulfillmentOverviewDto | null, side: FulfillmentSide): FinanceOption[] {
  if (!overview) { return [] }
  if (side === 'customer') {
    return [{ value: WHOLE_SOURCE, label: 'Seluruh paket project' }, ...overview.bookingPrefills.map(b => ({
      value: `booking:${b.booking.type}:${b.booking.id}`,
      label: `${b.booking.type} ${b.booking.id}`,
      hint: `${b.status}${b.sellAmountMinor ? ` · jual ${formatMoneyMinor(b.sellAmountMinor)}` : ''}`
    }))]
  }
  return [{ value: WHOLE_SOURCE, label: 'Supplier lain (pilih vendor)' }, ...overview.serviceOrderPrefills.map(s => ({
    value: `so:${s.serviceOrderId}`,
    label: `${s.serviceOrderId} · ${s.vendorName}`,
    hint: s.remainingMinor === null ? s.status : `sisa ${formatMoneyMinor(s.remainingMinor)}`
  }))]
}

const positive = (v: string | null | undefined) => (v && BigInt(v) > 0n ? v : '')

/** Suggested amount (and vendor) for a source; the owner confirms or corrects it. Unknown stays empty, never 0. */
export function fulfillmentPrefill (overview: FulfillmentOverviewDto, side: FulfillmentSide, source: string | null): { amountMinor: string; vendorId: string | null } {
  const [kind, a, b] = (source ?? WHOLE_SOURCE).split(':')
  if (side === 'customer') {
    const booking = kind === 'booking' ? overview.bookingPrefills.find(x => x.booking.type === a && x.booking.id === b) : undefined
    return { amountMinor: positive(booking ? booking.sellAmountMinor : overview.contract.remainingMinor), vendorId: null }
  }
  if (kind === 'so') {
    const so = overview.serviceOrderPrefills.find(x => x.serviceOrderId === a)
    return { amountMinor: positive(so?.remainingMinor), vendorId: so?.vendorId ?? null }
  }
  return { amountMinor: '', vendorId: null }
}

export function needsVendorChoice (side: FulfillmentSide, source: string | null): boolean {
  return side === 'supplier' && (source ?? WHOLE_SOURCE) === WHOLE_SOURCE
}

/** Recognition beyond the contractual right is refused by the server too; the form warns before sending. */
export function exceedsContractRight (overview: FulfillmentOverviewDto | null, side: FulfillmentSide, amountMinor: string): boolean {
  return side === 'customer' && !!overview && !!amountMinor && BigInt(amountMinor) > BigInt(overview.contract.remainingMinor)
}

export interface FulfillmentForm {
  source: string | null; vendorId: string | null; amountMinor: string; date: string; basis: 'actual' | 'estimate'; isFinal: boolean; evidence: string
}

export function buildFulfillmentInput (side: FulfillmentSide, projectId: string | undefined, form: FulfillmentForm, salesOrderId?:string): FulfillmentInput {
  const [kind, a, b] = (form.source ?? WHOLE_SOURCE).split(':')
  return {
    side,
    ...(projectId ? { projectId } : {}),
    ...(salesOrderId ? { salesOrderId } : {}),
    ...(kind === 'booking' ? { booking: { type: a!, id: b! } } : {}),
    ...(kind === 'so' ? { serviceOrderId: a } : {}),
    ...(needsVendorChoice(side, form.source) && form.vendorId ? { vendorId: form.vendorId } : {}),
    amountMinor: form.amountMinor,
    fulfilledOn: form.date,
    ...(side === 'supplier' ? { basis: form.basis, isFinal: form.isFinal } : {}),
    evidence: form.evidence.trim()
  }
}

/** Plain-language consequence shown before the owner confirms. */
export function fulfillmentConsequence (side: FulfillmentSide, basis: 'actual' | 'estimate'): string {
  if (side === 'customer') { return 'Mengakui pendapatan dari jasa yang sudah diberikan. Tidak memindahkan uang dan tidak menandai tagihan lunas.' }
  return basis === 'estimate'
    ? 'Mencatat biaya yang sudah terjadi sebagai utang belum ditagih. Saat invoice supplier datang, estimasi ini diganti tanpa biaya ganda.'
    : 'Mengakui biaya jasa supplier yang sudah diterima. Pembayaran ke supplier tetap dicatat terpisah.'
}

export const ACCOUNTING_STATUS_NOTE: Record<string, string> = {
  posted: 'Jurnal accounting terbentuk otomatis.',
  pending: 'Tercatat; accounting menunggu kebijakan yang lengkap (lihat antrean pengecualian).',
  off: 'Tercatat. Accounting belum aktif.',
  'before-cutover': 'Tercatat sebelum tanggal cutover buku.'
}
