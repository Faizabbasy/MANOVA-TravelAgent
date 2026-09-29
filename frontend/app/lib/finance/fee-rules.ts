import { formatMoneyMinor } from '~/lib/money'
import type { BadgeTone } from '~/types/common'
import type { TransferFeeRuleDto, TransferFeeRuleShape } from '~/types/api'

/**
 * Display helpers for directional transfer fee rules. The server computes every fee (quote and posting);
 * these only turn a rule into words and a percent field into basis points.
 */

/** "0,1" / "0.1" / "1" (percent) → basis points (10 / 10 / 100). Null when not a percent in 0,01–100. */
export function percentToBasisPoints (input: string): number | null {
  const text = input.trim().replace(',', '.')
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) { return null }
  const bp = Math.round(Number(text) * 100)
  return bp >= 1 && bp <= 10_000 ? bp : null
}

export function basisPointsToPercent (bp: number): string {
  return (bp / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

/** "Rp 6.500 per transfer" · "0,1% dari nominal, min Rp 2.500, maks Rp 25.000" */
export function describeFee (rule: TransferFeeRuleShape): string {
  if (rule.feeType === 'fixed') { return `${formatMoneyMinor(rule.fixedMinor ?? '0')} per transfer` }
  const parts = [`${basisPointsToPercent(rule.percentBasisPoints ?? 0)}% dari nominal`]
  if (rule.minMinor) { parts.push(`min ${formatMoneyMinor(rule.minMinor)}`) }
  if (rule.maxMinor) { parts.push(`maks ${formatMoneyMinor(rule.maxMinor)}`) }
  return parts.join(', ')
}

export type FeeRuleState = 'active' | 'upcoming' | 'ended' | 'inactive'

export function feeRuleState (rule: Pick<TransferFeeRuleDto, 'isActive' | 'effectiveFrom' | 'effectiveTo'>, today: string): FeeRuleState {
  if (!rule.isActive) { return 'inactive' }
  if (rule.effectiveFrom > today) { return 'upcoming' }
  if (rule.effectiveTo && rule.effectiveTo < today) { return 'ended' }
  return 'active'
}

export const FEE_RULE_STATE: Record<FeeRuleState, { label: string; tone: BadgeTone }> = {
  active: { label: 'Berlaku', tone: 'success' },
  upcoming: { label: 'Mulai nanti', tone: 'info' },
  ended: { label: 'Berakhir', tone: 'neutral' },
  inactive: { label: 'Nonaktif', tone: 'neutral' }
}
