import { shiftDate } from './dates'

/** What `buildBalanceTrend` needs from one account ledger (`GET /finance/accounts/:id/ledger`). */
export interface LedgerForTrend {
  period: { from: string; to: string }
  openingMinor: string
  items: { effectiveDate: string; balanceAfterMinor: string }[]
}

/**
 * Company balance at the end of each day, summed over accounts, using only the server's running balances
 * (`balanceAfterMinor`). An account contributes nothing before its books start (its ledger period may begin
 * after `from`). Items must be in ledger order (ascending), as the API returns them.
 */
export function buildBalanceTrend (ledgers: LedgerForTrend[], from: string, to: string): { dates: string[]; totals: bigint[] } {
  const dates: string[] = []
  for (let d = from; d <= to; d = shiftDate(d, 1)) { dates.push(d) }
  const totals = dates.map(() => 0n)
  for (const ledger of ledgers) {
    let balance: bigint | null = null
    let next = 0
    dates.forEach((day, i) => {
      if (day < ledger.period.from) { return }
      if (balance === null) { balance = BigInt(ledger.openingMinor) }
      while (next < ledger.items.length && ledger.items[next]!.effectiveDate <= day) {
        balance = BigInt(ledger.items[next]!.balanceAfterMinor)
        next++
      }
      totals[i]! += balance
    })
  }
  return { dates, totals }
}

/** Compact Rupiah for chart axes: 1.250.000.000 → "1,25 M", 850.000.000 → "850 jt". */
export function compactRupiah (value: number): string {
  const abs = Math.abs(value)
  const fmt = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n)
  if (abs >= 1e12) { return `${fmt(value / 1e12)} T` }
  if (abs >= 1e9) { return `${fmt(value / 1e9)} M` }
  if (abs >= 1e6) { return `${fmt(value / 1e6)} jt` }
  if (abs >= 1e3) { return `${fmt(value / 1e3)} rb` }
  return fmt(value)
}
