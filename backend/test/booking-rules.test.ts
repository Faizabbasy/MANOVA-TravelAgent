import { describe, expect, test } from 'bun:test'
import type { FieldErrors } from '../src/http/errors'
import { BOOKING_TRANSITIONS, cleanDetails, departureDateOf, miceTotals, serviceStatusFor, serviceTypeOf } from '../src/modules/core/booking-rules'

describe('booking rules', () => {
  test('transitions match the frontend maps', () => {
    expect(BOOKING_TRANSITIONS.flight.requested).toEqual(['hold', 'confirmed', 'cancelled'])
    expect(BOOKING_TRANSITIONS.flight.cancelled).toEqual(['refunded'])
    expect(BOOKING_TRANSITIONS.hotel.confirmed).toEqual(['amended', 'completed', 'cancelled', 'no-show'])
    expect(BOOKING_TRANSITIONS.transport.quoted).toEqual(['assigned', 'cancelled'])
    expect(BOOKING_TRANSITIONS.mice['in-progress']).toEqual(['completed', 'cancelled'])
  })

  test('service status follows the booking status', () => {
    expect(serviceStatusFor('flight', 'issued')).toBe('confirmed')
    expect(serviceStatusFor('flight', 'reissued')).toBe('changed')
    expect(serviceStatusFor('flight', 'hold')).toBe('pending-confirmation')
    expect(serviceStatusFor('hotel', 'quoted')).toBe('quoted')
    expect(serviceStatusFor('hotel', 'no-show')).toBe('cancelled')
    expect(serviceStatusFor('transport', 'assigned')).toBe('pending-confirmation')
    expect(serviceStatusFor('mice', 'in-progress')).toBe('confirmed')
    expect(serviceTypeOf('transport')).toBe('transportation')
  })

  test('details: object only, core keys dropped, typed arrays, size limit', () => {
    const p: FieldErrors = {}
    const clean = cleanDetails('flight', { status: 'issued', sellPriceIdr: 1, id: 'X', pnr: 'ABC', segments: [{ origin: 'CGK', destination: 'MNL', departureAt: '2026-08-20T08:00' }], fareRules: 'NR' }, p)
    expect(p).toEqual({})
    expect(clean).toEqual({ segments: [{ origin: 'CGK', destination: 'MNL', departureAt: '2026-08-20T08:00' }], fareRules: 'NR' })
    for (const bad of [null, [], 'x', { segments: 'no' }, { segments: [{ departureAt: 5 }] }, { x: 'a'.repeat(70_000) }]) {
      const q: FieldErrors = {}
      cleanDetails('flight', bad, q)
      expect(Object.keys(q), JSON.stringify(bad).slice(0, 40)).toEqual(['details'])
    }
    const m: FieldErrors = {}
    cleanDetails('mice', { boqItems: [{ description: 'Sound', sellPriceIdr: -1 }] }, m)
    expect(m.details).toBeDefined()
    // A price field emptied in the BOQ form arrives as null: an unpriced line, not an error.
    const cleared: FieldErrors = {}
    expect(cleanDetails('mice', { boqItems: [{ description: 'Sound', sellPriceIdr: null, netCostIdr: null }] }, cleared)).toBeDefined()
    expect(cleared).toEqual({})
    expect(miceTotals({ boqItems: [{ sellPriceIdr: null }, { sellPriceIdr: 500 }] })).toEqual({ sellMinor: '500', netMinor: null })
  })

  test('departure date and MICE totals are derived from details', () => {
    expect(departureDateOf('flight', { segments: [{ departureAt: '2026-08-22T10:00' }, { departureAt: '2026-08-20T08:00' }] })).toBe('2026-08-20')
    expect(departureDateOf('hotel', { checkInDate: '2026-08-10' })).toBe('2026-08-10')
    expect(departureDateOf('transport', { legs: [] })).toBeNull()
    expect(departureDateOf('mice', { sessions: [{ startAt: '2026-09-01T09:00' }] })).toBe('2026-09-01')
    expect(miceTotals({ boqItems: [{ sellPriceIdr: 1000, netCostIdr: 800 }, { sellPriceIdr: 500 }, { description: 'x' }] })).toEqual({ sellMinor: '1500', netMinor: '800' })
    expect(miceTotals({ boqItems: [] })).toEqual({ sellMinor: null, netMinor: null })
  })
})
