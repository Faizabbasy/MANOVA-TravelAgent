import type { CustomerInvoiceDto, IsoDate, ProjectFinanceSummaryDto } from '~/types/api'

/**
 * Figures for the V2 Project Detail hero ("Ringkasan Komersial"), taken only from the server project summary.
 * Admin gets the status view (label, no amounts); a missing summary (server down, project not on the server
 * yet) is `unavailable`, so the UI says so instead of showing Rp 0.
 */
export interface HeroNextPayment {
  invoiceLabel: string
  /** What is still open on that invoice, not its total. */
  amountMinor: string
  dueDate: IsoDate
  tone: 'overdue' | 'due-soon' | 'scheduled'
}

export type ProjectHeroFigures =
  | { kind: 'unavailable' }
  | { kind: 'status'; paymentLabel: string; hasOverdue: boolean }
  | {
      kind: 'full'
      contractMinor: string | null
      /** Issued invoices net of credit notes. */
      invoicedMinor: string
      receivedMinor: string
      outstandingMinor: string
      /** Contract value not yet invoiced; null without a contract value. */
      uninvoicedMinor: string | null
      /** Whole-number shares of the contract; paid + outstanding + remainder never exceed 100. */
      percent: { invoiced: number; paid: number; outstanding: number; remainder: number }
      overInvoiced: boolean
      nextPayment: HeroNextPayment | null
      hasAnyInvoice: boolean
      paymentLabel: string
      hasOverdue: boolean
    }

const DUE_SOON_DAYS = 7

/** Rounded percentage of `part` in `whole`, in bigint so large rupiah amounts stay exact. */
function percentOf (part: bigint, whole: bigint): number {
  if (whole <= 0n) { return 0 }
  return Number((part * 200n + whole) / (whole * 2n))
}

function daysBetween (from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

function nextPaymentOf (invoices: CustomerInvoiceDto[], today: IsoDate): HeroNextPayment | null {
  const open = invoices
    .filter(inv => inv.status === 'issued' && inv.dueDate && BigInt(inv.outstandingMinor) > 0n)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
  const first = open[0]
  if (!first) { return null }
  const tone = first.overdue || first.dueDate! < today ? 'overdue' : daysBetween(today, first.dueDate!) <= DUE_SOON_DAYS ? 'due-soon' : 'scheduled'
  return { invoiceLabel: first.number ?? first.id, amountMinor: first.outstandingMinor, dueDate: first.dueDate!, tone }
}

export function heroFigures (summary: ProjectFinanceSummaryDto | null, today: IsoDate): ProjectHeroFigures {
  if (!summary) { return { kind: 'unavailable' } }
  if (summary.view === 'status') { return { kind: 'status', paymentLabel: summary.label, hasOverdue: summary.hasOverdue } }

  const r = summary.receivable
  const invoiced = BigInt(r.invoicedMinor) - BigInt(r.creditedMinor)
  const contract = summary.contractValueMinor === null ? 0n : BigInt(summary.contractValueMinor)
  const paid = Math.min(100, percentOf(BigInt(r.receivedMinor), contract))
  const outstanding = Math.min(100 - paid, percentOf(BigInt(r.outstandingMinor), contract))
  const remainder = contract > 0n ? Math.max(0, 100 - paid - outstanding) : 0

  return {
    kind: 'full',
    contractMinor: summary.contractValueMinor,
    invoicedMinor: invoiced.toString(),
    receivedMinor: r.receivedMinor,
    outstandingMinor: r.outstandingMinor,
    uninvoicedMinor: r.uninvoicedMinor,
    percent: { invoiced: percentOf(invoiced, contract), paid, outstanding, remainder },
    overInvoiced: contract > 0n && invoiced > contract,
    nextPayment: nextPaymentOf(summary.invoices, today),
    hasAnyInvoice: r.invoiceCount > 0,
    paymentLabel: summary.label,
    hasOverdue: summary.hasOverdue
  }
}
