import { describe, expect, it } from 'vitest'
import { basisPointsToPercent, describeFee, feeRuleState, percentToBasisPoints } from './fee-rules'

describe('transfer fee rule helpers', () => {
  it('reads a percent typed either way into basis points', () => {
    expect(percentToBasisPoints('0,1')).toBe(10)
    expect(percentToBasisPoints('0.1')).toBe(10)
    expect(percentToBasisPoints('1')).toBe(100)
    expect(percentToBasisPoints('2,55')).toBe(255)
    expect(percentToBasisPoints('100')).toBe(10_000)
    expect(percentToBasisPoints(' 0,01 ')).toBe(1)
  })

  it('rejects what the server would reject', () => {
    for (const bad of ['', '0', '0,001', '100,01', '101', 'abc', '1,2,3', '-1']) {
      expect(percentToBasisPoints(bad), bad).toBeNull()
    }
  })

  it('describes a rule in words', () => {
    expect(basisPointsToPercent(10)).toBe('0,1')
    expect(describeFee({ feeType: 'fixed', fixedMinor: '6500', percentBasisPoints: null, minMinor: null, maxMinor: null })).toMatch(/^Rp\s?6\.500 per transfer$/)
    const pct = describeFee({ feeType: 'percent', fixedMinor: null, percentBasisPoints: 10, minMinor: '2500', maxMinor: '25000' })
    expect(pct).toMatch(/^0,1% dari nominal, min Rp\s?2\.500, maks Rp\s?25\.000$/)
    expect(describeFee({ feeType: 'percent', fixedMinor: null, percentBasisPoints: 250, minMinor: null, maxMinor: null })).toBe('2,5% dari nominal')
  })

  it('knows whether a rule applies today', () => {
    const today = '2026-09-30'
    const r = (effectiveFrom: string, effectiveTo: string | null, isActive = true) => feeRuleState({ effectiveFrom, effectiveTo, isActive }, today)
    expect(r('2026-09-01', null)).toBe('active')
    expect(r('2026-09-30', '2026-09-30')).toBe('active')
    expect(r('2026-10-01', null)).toBe('upcoming')
    expect(r('2026-01-01', '2026-09-29')).toBe('ended')
    expect(r('2026-09-01', null, false)).toBe('inactive')
  })
})
