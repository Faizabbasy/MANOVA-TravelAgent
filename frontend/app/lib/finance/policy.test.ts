import { describe, expect, it } from 'vitest'
import { thresholdProblems, thresholdsFromTiers, tierLabel, tiersFromThresholds } from './policy'

describe('policy editor helpers', () => {
  it('thresholds become contiguous tiers with both ends open', () => {
    expect(tiersFromThresholds([30, 14, 7, 1], [100, 50, 30, 0, 0])).toEqual([
      { minDays: 30, maxDays: null, refundBp: 10000 },
      { minDays: 14, maxDays: 30, refundBp: 5000 },
      { minDays: 7, maxDays: 14, refundBp: 3000 },
      { minDays: 1, maxDays: 7, refundBp: 0 },
      { minDays: null, maxDays: 1, refundBp: 0 }
    ])
  })

  it('round-trips through the API shape', () => {
    const tiers = tiersFromThresholds([30, 14, 7, 1], [100, 50, 30, 0, 0])
    expect(thresholdsFromTiers(tiers)).toEqual({ thresholds: [30, 14, 7, 1], refunds: [100, 50, 30, 0, 0] })
  })

  it('labels read like the rule a customer is told', () => {
    expect(tierLabel({ minDays: 30, maxDays: null })).toBe('H-30 atau lebih')
    expect(tierLabel({ minDays: 14, maxDays: 30 })).toBe('H-14 s/d H-29')
    expect(tierLabel({ minDays: 1, maxDays: 2 })).toBe('H-1')
    expect(tierLabel({ minDays: null, maxDays: 1 })).toBe('Hari keberangkatan & sesudahnya')
  })

  it('flags thresholds that are not strictly descending and percents out of range', () => {
    expect(thresholdProblems([14, 30], [100, 50, 0])).toHaveLength(1)
    expect(thresholdProblems([30, 14], [100, 150, 0])).toHaveLength(1)
    expect(thresholdProblems([30, 14, 7], [100, 50, 30, 0])).toEqual([])
  })
})
