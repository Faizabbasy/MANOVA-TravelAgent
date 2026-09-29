import type { ApiSubjectType, PolicyTier, PolicyTierInput } from '~/types/api'

/**
 * Cancellation-policy helpers for the UI. Tiers are half-open intervals of days before departure
 * (minDays ≤ H < maxDays). The editor works with "thresholds" instead, which cannot produce gaps or overlaps:
 * thresholds [30, 14, 7, 1] + refunds [100, 50, 30, 0, 0] → H≥30, 14–29, 7–13, 1–6, below 1.
 */

/** Plain-language label: "H-30 atau lebih", "H-14 s/d H-29", "Hari keberangkatan & sesudahnya". */
export function tierLabel (t: Pick<PolicyTier, 'minDays' | 'maxDays'>): string {
  const min = t.minDays
  const max = t.maxDays
  if (min !== null && max === null) { return min <= 0 ? `Sejak H${min === 0 ? '' : `+${-min}`} (sesudah berangkat)` : `H-${min} atau lebih` }
  if (min === null && max !== null) {
    if (max === 1) { return 'Hari keberangkatan & sesudahnya' }
    if (max <= 0) { return `Sesudah H${max === 0 ? '-0' : `+${-max}`}` }
    return `Kurang dari H-${max} (termasuk hari keberangkatan)`
  }
  if (min !== null && max !== null) {
    if (max - min === 1) { return min === 0 ? 'Hari keberangkatan' : `H-${min}` }
    return `H-${min} s/d H-${max - 1}`
  }
  return 'Semua waktu'
}

/** Thresholds (strictly descending) + refund percents (one more than thresholds) → API tiers. */
export function tiersFromThresholds (thresholds: number[], refundPercents: number[]): PolicyTierInput[] {
  if (refundPercents.length !== thresholds.length + 1) { throw new Error('need one refund per band') }
  const toBp = (p: number) => Math.round(p * 100)
  const tiers: PolicyTierInput[] = []
  tiers.push({ minDays: thresholds[0] ?? null, maxDays: null, refundBp: toBp(refundPercents[0]!) })
  for (let i = 1; i < thresholds.length; i++) {
    tiers.push({ minDays: thresholds[i]!, maxDays: thresholds[i - 1]!, refundBp: toBp(refundPercents[i]!) })
  }
  if (thresholds.length) { tiers.push({ minDays: null, maxDays: thresholds[thresholds.length - 1]!, refundBp: toBp(refundPercents[thresholds.length]!) }) }
  return tiers
}

/** API tiers → thresholds + refund percents (for editing an existing draft). */
export function thresholdsFromTiers (tiers: Pick<PolicyTier, 'minDays' | 'maxDays' | 'refundBp'>[]): { thresholds: number[]; refunds: number[] } {
  const ordered = [...tiers].sort((a, b) => (b.minDays ?? -Infinity) - (a.minDays ?? -Infinity))
  return {
    thresholds: ordered.filter(t => t.minDays !== null).map(t => t.minDays as number),
    refunds: ordered.map(t => t.refundBp / 100)
  }
}

/** Problems a person can fix in the editor, in words (the server validates again). */
export function thresholdProblems (thresholds: number[], refundPercents: number[]): string[] {
  const out: string[] = []
  for (let i = 1; i < thresholds.length; i++) {
    if (!(thresholds[i]! < thresholds[i - 1]!)) { out.push(`Batas hari harus makin kecil ke bawah (baris ${i + 1}).`) }
  }
  if (thresholds.some(t => !Number.isInteger(t))) { out.push('Batas hari harus bilangan bulat.') }
  if (refundPercents.some(p => !(p >= 0 && p <= 100))) { out.push('Persentase refund harus 0–100%.') }
  return out
}

export const SUBJECT_LABEL: Record<ApiSubjectType, string> = {
  project: 'Project',
  flight: 'Tiket pesawat',
  hotel: 'Hotel',
  transport: 'Transportasi',
  mice: 'MICE'
}
