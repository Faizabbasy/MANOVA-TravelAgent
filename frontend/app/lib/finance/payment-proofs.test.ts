import { describe, expect, it } from 'vitest'
import { proofVerifyDefaults } from './payment-proofs'

describe('payment proof verify defaults (S12c-1)', () => {
  it('prefills the receipt from the proof; Finance can still change it', () => {
    expect(proofVerifyDefaults({ amountMinor: '4000000', transferDate: '2026-10-18', reference: 'TRF-001' }, '2026-10-19')).toEqual({ amount: '4000000', date: '2026-10-18', reference: 'TRF-001' })
  })
  it('a transfer date in the future (clock skew) falls back to today', () => {
    expect(proofVerifyDefaults({ amountMinor: '1', transferDate: '2026-12-01', reference: 'X' }, '2026-10-19').date).toBe('2026-10-19')
  })
})
