import { describe, expect, it } from 'vitest'
import { buildBalanceTrend, compactRupiah } from './trend'

describe('buildBalanceTrend', () => {
  it('carries each account balance forward and sums accounts per day', () => {
    const a = {
      period: { from: '2026-09-01', to: '2026-09-04' },
      openingMinor: '100',
      items: [
        { effectiveDate: '2026-09-02', balanceAfterMinor: '150' },
        { effectiveDate: '2026-09-02', balanceAfterMinor: '140' }, // same day: last one is the day's closing
        { effectiveDate: '2026-09-04', balanceAfterMinor: '40' }
      ]
    }
    const b = { period: { from: '2026-09-03', to: '2026-09-04' }, openingMinor: '1000', items: [] } // books start on the 3rd
    const { dates, totals } = buildBalanceTrend([a, b], '2026-09-01', '2026-09-04')
    expect(dates).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'])
    expect(totals).toEqual([100n, 140n, 1140n, 1040n])
  })

  it('stays exact beyond Number precision', () => {
    const big = { period: { from: '2026-09-01', to: '2026-09-01' }, openingMinor: '900719925474099312', items: [] }
    expect(buildBalanceTrend([big, big], '2026-09-01', '2026-09-01').totals).toEqual([1801439850948198624n])
  })
})

describe('compactRupiah', () => {
  it('uses Indonesian units', () => {
    expect(compactRupiah(1_250_000_000)).toBe('1,25 M')
    expect(compactRupiah(850_000_000)).toBe('850 jt')
    expect(compactRupiah(12_500)).toBe('12,5 rb')
    expect(compactRupiah(-3_000_000)).toBe('-3 jt')
  })
})
