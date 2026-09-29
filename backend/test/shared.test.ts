import { describe, expect, test } from 'bun:test'
import { LoginThrottle } from '../src/auth/login-throttle'
import { clientInfo } from '../src/http/client-info'
import { AppError } from '../src/http/errors'
import { businessDateOf, isIsoDate } from '../src/shared/dates'
import { parseAmountMinor, percentOfHalfUp, PG_BIGINT_MAX, toAmountMinor } from '../src/shared/money'

describe('money', () => {
  test('parses integer minor-unit strings without precision loss', () => {
    expect(parseAmountMinor('30000000')).toBe(30_000_000n)
    expect(parseAmountMinor('9007199254740993')).toBe(9_007_199_254_740_993n) // beyond Number.MAX_SAFE_INTEGER
    expect(parseAmountMinor(PG_BIGINT_MAX.toString())).toBe(PG_BIGINT_MAX)
  })

  test('rejects numbers, decimals, separators, negatives, leading zeros and zero', () => {
    for (const bad of [30000000, '30.000.000', '300000.5', '-5', '007', '', ' 1', '1e6', '9223372036854775808']) {
      expect(() => parseAmountMinor(bad)).toThrow(AppError)
    }
    expect(() => parseAmountMinor('0')).toThrow(AppError)
    expect(parseAmountMinor('0', 'amountMinor', { allowZero: true })).toBe(0n)
  })

  test('reports the offending field name', () => {
    try {
      parseAmountMinor('1.5', 'allocations.0.amountMinor')
    } catch (err) {
      expect((err as AppError).extra.fieldErrors).toHaveProperty(['allocations.0.amountMinor'])
    }
  })

  test('percent in basis points rounds half-up to whole rupiah', () => {
    expect(percentOfHalfUp(20_000_000n, 3_000n)).toBe(6_000_000n) // 30% of Rp20 jt (H-7 refund example)
    expect(percentOfHalfUp(5n, 5_000n)).toBe(3n) // 2.5 → 3
    expect(percentOfHalfUp(3n, 5_000n)).toBe(2n) // 1.5 → 2
    expect(percentOfHalfUp(1n, 4_999n)).toBe(0n) // 0.4999 → 0
  })

  test('serialises as a plain decimal string and refuses negatives', () => {
    expect(toAmountMinor(1_500_000n)).toBe('1500000')
    expect(() => toAmountMinor(-1n)).toThrow(RangeError)
  })
})

describe('dates', () => {
  test('validates real calendar dates only', () => {
    expect(isIsoDate('2026-10-05')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2026-02-29')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('05-10-2026')).toBe(false)
  })

  test('business date follows Asia/Jakarta (UTC+7), not UTC', () => {
    expect(businessDateOf(new Date('2026-09-30T16:59:59Z'))).toBe('2026-09-30')
    expect(businessDateOf(new Date('2026-09-30T17:00:00Z'))).toBe('2026-10-01')
  })
})

describe('LoginThrottle', () => {
  test('counts attempts before verification: the 6th attempt for the same ip+email is blocked', () => {
    let now = 0
    const throttle = new LoginThrottle(5, 60_000, () => now)
    for (let i = 0; i < 5; i++) expect(throttle.consume('1.1.1.1', i % 2 ? 'A@x.id' : 'a@x.id')).toBe(0)
    expect(throttle.consume('1.1.1.1', 'a@x.id')).toBe(60)
    expect(throttle.consume('2.2.2.2', 'a@x.id')).toBe(0) // another ip still has its own pair budget
    now = 60_001
    expect(throttle.consume('1.1.1.1', 'a@x.id')).toBe(0)
  })

  test('per-email limit holds even when the ip changes on every attempt', () => {
    const throttle = new LoginThrottle(5, 60_000, () => 0, 20)
    for (let i = 0; i < 20; i++) expect(throttle.consume(`10.0.0.${i}`, 'a@x.id')).toBe(0)
    expect(throttle.consume('10.0.1.99', 'a@x.id')).toBeGreaterThan(0)
    expect(throttle.consume('10.0.1.99', 'b@x.id')).toBe(0)
  })

  test('a successful login resets both counters', () => {
    const throttle = new LoginThrottle(2, 60_000, () => 0)
    throttle.consume(null, 'a@x.id')
    throttle.consume(null, 'a@x.id')
    throttle.reset(null, 'a@x.id')
    expect(throttle.consume(null, 'a@x.id')).toBe(0)
  })
})

describe('clientInfo', () => {
  const req = (xff?: string) => new Request('http://x/', { headers: xff ? { 'x-forwarded-for': xff } : {} })

  test('ignores X-Forwarded-For unless TRUST_PROXY', () => {
    expect(clientInfo(req('6.6.6.6'), null, false).ip).toBeNull()
  })

  test('behind our proxy, takes the rightmost hop (the one the proxy wrote), not the client-forgeable leftmost', () => {
    expect(clientInfo(req('6.6.6.6, 203.0.113.9'), null, true).ip).toBe('203.0.113.9')
    expect(clientInfo(req('203.0.113.9'), null, true).ip).toBe('203.0.113.9')
  })
})
