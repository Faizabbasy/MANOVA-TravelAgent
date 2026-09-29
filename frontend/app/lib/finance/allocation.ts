import type { AllocationTarget } from './types'

/**
 * Suggested split of a payment over open invoices: the focused invoice first (when opened from it), then the
 * given order (oldest due first, as the API lists them); never more than an invoice still owes. What is left
 * stays unallocated (advance / deposit). A suggestion only — the server validates the final allocation.
 */
export function suggestAllocation (targets: AllocationTarget[], amountMinor: string, focusId?: string | null): Record<string, string> {
  let left = BigInt(amountMinor || '0')
  const ordered = focusId
    ? [...targets.filter(t => t.id === focusId), ...targets.filter(t => t.id !== focusId)]
    : targets
  const out: Record<string, string> = {}
  for (const t of ordered) {
    if (left <= 0n) { break }
    const owed = BigInt(t.outstandingMinor)
    const take = left < owed ? left : owed
    if (take > 0n) { out[t.id] = take.toString() }
    left -= take
  }
  return out
}
