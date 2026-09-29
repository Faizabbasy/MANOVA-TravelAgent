import { describe, expect, it } from 'vitest'
import { formatMoneyMinor, isMoneyMinor, minorUnitsOf, toBigIntMinor } from './money'

describe('money display helpers', () => {
  it('formats IDR minor units with Indonesian grouping and no decimals', () => {
    expect(formatMoneyMinor('30000000')).toBe('Rp 30.000.000')
    expect(formatMoneyMinor('0')).toBe('Rp 0')
  })

  it('keeps amounts beyond Number.MAX_SAFE_INTEGER exact', () => {
    expect(formatMoneyMinor('9007199254740993', 'IDR', { plain: true })).toBe('9.007.199.254.740.993')
  })

  it('formats two-decimal currencies from minor units without float math', () => {
    expect(formatMoneyMinor('123456', 'USD', { plain: true })).toBe('1.234,56')
    expect(formatMoneyMinor('5', 'USD', { plain: true })).toBe('0,05')
    expect(minorUnitsOf('idr')).toBe(0)
  })

  it('can show an explicit sign for money in/out', () => {
    expect(formatMoneyMinor('1500000', 'IDR', { signed: true })).toBe('+Rp 1.500.000')
    expect(formatMoneyMinor('-1500000', 'IDR', { signed: true })).toBe('-Rp 1.500.000')
  })

  it('rejects anything that is not an integer string', () => {
    expect(isMoneyMinor('30000000')).toBe(true)
    for (const bad of ['30.000', '1e6', '', ' 1', 30000000, null]) {
      expect(isMoneyMinor(bad)).toBe(false)
    }
    expect(() => toBigIntMinor('12.5')).toThrow(TypeError)
  })
})
