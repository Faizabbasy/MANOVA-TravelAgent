import { describe, expect, it } from 'vitest'
import { vendorPaymentState } from './vendor-payment-state'
import type { VendorInvoiceDto } from '~/types/api'

const inv = (over: Partial<VendorInvoiceDto>): VendorInvoiceDto => ({
  id: 'VINV-1', vendor: { id: 'VND-1', name: 'Hotel A' }, status: 'approved', settlement: 'open', outstandingMinor: '100', ...over
} as VendorInvoiceDto)

describe('vendorPaymentState (Vendors tab, from the server project summary)', () => {
  it('no approved invoice from this vendor: nothing to pay yet', () => {
    expect(vendorPaymentState([], 'VND-1')).toBe('none')
    expect(vendorPaymentState([inv({ status: 'under_review' })], 'VND-1')).toBe('none')
    expect(vendorPaymentState([inv({ vendor: { id: 'VND-2', name: 'B' } })], 'VND-1')).toBe('none')
    expect(vendorPaymentState([inv({ status: 'void' })], 'VND-1')).toBe('none')
  })

  it('any approved invoice with money still owed: open', () => {
    expect(vendorPaymentState([inv({ settlement: 'paid', outstandingMinor: '0' }), inv({ id: 'VINV-2', settlement: 'partial', outstandingMinor: '40' })], 'VND-1')).toBe('open')
  })

  it('every approved invoice settled: paid', () => {
    expect(vendorPaymentState([inv({ settlement: 'paid', outstandingMinor: '0' }), inv({ id: 'VINV-3', settlement: 'credited', outstandingMinor: '0' })], 'VND-1')).toBe('paid')
  })

  it('no vendor on the service: none', () => {
    expect(vendorPaymentState([inv({})], undefined)).toBe('none')
  })
})
