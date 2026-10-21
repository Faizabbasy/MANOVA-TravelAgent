import { describe, expect, it } from 'vitest'
import { buildFulfillmentInput, exceedsContractRight, fulfillmentConsequence, fulfillmentPrefill, fulfillmentSources, needsVendorChoice, WHOLE_SOURCE } from './fulfillment'
import type { FulfillmentOverviewDto } from '~/types/api'

const overview: FulfillmentOverviewDto = {
  contract: { limitMinor: '100000000', recognizedMinor: '40000000', remainingMinor: '60000000' },
  supplierReceivedMinor: '0',
  items: [],
  bookingPrefills: [
    { booking: { type: 'hotel', id: 'HTL-001' }, status: 'completed', serviceId: 'SVC-1', sellAmountMinor: '25000000', netCostMinor: '20000000', vendorId: 'VND-001', vendorName: 'Hotel A', operationallyDone: true },
    { booking: { type: 'flight', id: 'FLT-001' }, status: 'requested', serviceId: null, sellAmountMinor: null, netCostMinor: null, vendorId: null, vendorName: null, operationallyDone: false }
  ],
  serviceOrderPrefills: [
    { serviceOrderId: 'SO-001', vendorId: 'VND-001', vendorName: 'Hotel A', serviceId: 'SVC-1', status: 'acknowledged', netCostMinor: '20000000', receivedMinor: '5000000', remainingMinor: '15000000' },
    { serviceOrderId: 'SO-002', vendorId: 'VND-002', vendorName: 'Bus B', serviceId: 'SVC-2', status: 'draft', netCostMinor: null, receivedMinor: '0', remainingMinor: null }
  ]
}

describe('fulfillment form decisions (no debit/credit in the browser)', () => {
  it('prefills from existing bookings/SOs and never turns an unknown value into zero', () => {
    expect(fulfillmentSources(overview, 'customer').map(o => o.value)).toEqual([WHOLE_SOURCE, 'booking:hotel:HTL-001', 'booking:flight:FLT-001'])
    expect(fulfillmentPrefill(overview, 'customer', WHOLE_SOURCE).amountMinor).toBe('60000000')
    expect(fulfillmentPrefill(overview, 'customer', 'booking:hotel:HTL-001').amountMinor).toBe('25000000')
    expect(fulfillmentPrefill(overview, 'customer', 'booking:flight:FLT-001').amountMinor).toBe('')
    expect(fulfillmentPrefill(overview, 'supplier', 'so:SO-001')).toEqual({ amountMinor: '15000000', vendorId: 'VND-001' })
    expect(fulfillmentPrefill(overview, 'supplier', 'so:SO-002').amountMinor).toBe('')
    expect(fulfillmentPrefill({ ...overview, contract: { ...overview.contract, remainingMinor: '0' } }, 'customer', WHOLE_SOURCE).amountMinor).toBe('')
  })
  it('warns beyond the contractual right using exact bigint comparison', () => {
    expect(exceedsContractRight(overview, 'customer', '60000000')).toBe(false)
    expect(exceedsContractRight(overview, 'customer', '60000001')).toBe(true)
    expect(exceedsContractRight(overview, 'supplier', '999999999999')).toBe(false)
    expect(exceedsContractRight({ ...overview, contract: { ...overview.contract, remainingMinor: '9007199254740993' } }, 'customer', '9007199254740994')).toBe(true)
  })
  it('sends one business fact with its source link; vendor only when no SO identifies it', () => {
    const base = { vendorId: 'VND-009', amountMinor: '15000000', date: '2026-10-05', basis: 'estimate' as const, isFinal: true, evidence: '  BAST hotel  ' }
    expect(buildFulfillmentInput('supplier', 'PRJ-1', { ...base, source: 'so:SO-001' })).toEqual({
      side: 'supplier', projectId: 'PRJ-1', serviceOrderId: 'SO-001', amountMinor: '15000000', fulfilledOn: '2026-10-05', basis: 'estimate', isFinal: true, evidence: 'BAST hotel'
    })
    expect(needsVendorChoice('supplier', WHOLE_SOURCE)).toBe(true)
    expect(buildFulfillmentInput('supplier', 'PRJ-1', { ...base, source: WHOLE_SOURCE }).vendorId).toBe('VND-009')
    const customer = buildFulfillmentInput('customer', 'PRJ-1', { ...base, source: 'booking:hotel:HTL-001' })
    expect(customer).toEqual({ side: 'customer', projectId: 'PRJ-1', booking: { type: 'hotel', id: 'HTL-001' }, amountMinor: '15000000', fulfilledOn: '2026-10-05', evidence: 'BAST hotel' })
    expect(Object.keys(customer)).not.toContain('debitMinor')
  })
  it('explains consequences in business language: no money moved, no paid status', () => {
    expect(fulfillmentConsequence('customer', 'actual')).toContain('Tidak memindahkan uang')
    expect(fulfillmentConsequence('supplier', 'estimate')).toContain('tanpa biaya ganda')
  })
  it('uses the real retail order as the sole source context and preserves a large money string', () => {
    const input = buildFulfillmentInput('supplier', undefined, { source: WHOLE_SOURCE, vendorId: 'VND-1', amountMinor: '999999999999999', date: '2026-10-21', basis: 'estimate', isFinal: true, evidence: 'BAST retail' }, 'SLO-1')
    expect(input.salesOrderId).toBe('SLO-1')
    expect(input).not.toHaveProperty('projectId')
    expect(input.amountMinor).toBe('999999999999999')
    expect(input.vendorId).toBe('VND-1')
  })
})
