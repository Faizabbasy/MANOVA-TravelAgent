import type { SalesOrderFinanceSummaryDto } from '~/types/api'

/**
 * Figures for one Group Trip participant booking (V2 Bookings / Payments tabs), from the server summary only.
 * Admin gets the status label; a missing summary is `unavailable` instead of a made-up zero.
 */
export type GroupTripOrderFigures =
  | { kind: 'unavailable' }
  | { kind: 'status'; label: string; canConfirm: false }
  | { kind: 'full'; label: string; priceMinor: string; receivedMinor: string; outstandingMinor: string; canConfirm: boolean }

export function groupTripOrderFigures (s: SalesOrderFinanceSummaryDto | null): GroupTripOrderFigures {
  if (!s) { return { kind: 'unavailable' } }
  if (s.view === 'status') { return { kind: 'status', label: s.label, canConfirm: false } }
  return {
    kind: 'full',
    label: s.label,
    priceMinor: s.priceMinor,
    receivedMinor: s.receivedMinor,
    outstandingMinor: s.outstandingMinor,
    canConfirm: s.paymentStatus === 'not_invoiced'
  }
}

/** Minimum DP — the server's rule (30% of the price, rounded up to the rupiah). */
export function minimumDpMinor (priceMinor: string): string {
  return ((BigInt(priceMinor) * 30n + 99n) / 100n).toString()
}
