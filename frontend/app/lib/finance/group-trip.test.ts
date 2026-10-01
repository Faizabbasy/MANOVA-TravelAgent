import { describe, expect, it } from 'vitest'
import { groupTripOrderFigures, minimumDpMinor } from './group-trip'
import type { SalesOrderFinanceSummaryDto } from '~/types/api'

const full = (over: Partial<Extract<SalesOrderFinanceSummaryDto, { view: 'full' }>>) => ({
  view: 'full',
  salesOrderId: 'SLO-006',
  priceMinor: '7000000',
  invoicedMinor: '0',
  receivedMinor: '0',
  outstandingMinor: '7000000',
  invoiceId: null,
  paymentStatus: 'not_invoiced',
  label: 'Menunggu DP',
  ...over
}) as SalesOrderFinanceSummaryDto

describe('groupTripOrderFigures (Bookings / Payments tabs)', () => {
  it('missing summary (server down, order not on the server) is unavailable', () => {
    expect(groupTripOrderFigures(null)).toEqual({ kind: 'unavailable' })
  })

  it('Admin status view: label only, cannot confirm, no amounts', () => {
    const f = groupTripOrderFigures({ view: 'status', salesOrderId: 'SLO-006', paymentStatus: 'dp_received', label: 'DP diterima' })
    expect(f).toEqual({ kind: 'status', label: 'DP diterima', canConfirm: false })
    expect(JSON.stringify(f)).not.toMatch(/Minor/)
  })

  it('Finance: an order with no invoice yet can be confirmed', () => {
    expect(groupTripOrderFigures(full({}))).toEqual({ kind: 'full', label: 'Menunggu DP', priceMinor: '7000000', receivedMinor: '0', outstandingMinor: '7000000', canConfirm: true })
  })

  it('Finance: once invoiced (DP received or paid) it cannot be confirmed again', () => {
    expect(groupTripOrderFigures(full({ paymentStatus: 'dp_received', invoiceId: 'CINV-1', receivedMinor: '2100000', outstandingMinor: '4900000' })))
      .toMatchObject({ kind: 'full', canConfirm: false, outstandingMinor: '4900000' })
    expect(groupTripOrderFigures(full({ paymentStatus: 'paid', invoiceId: 'CINV-1', receivedMinor: '7000000', outstandingMinor: '0' })))
      .toMatchObject({ kind: 'full', canConfirm: false })
  })
})

describe('minimumDpMinor (same rule as the server: 30%, rounded up)', () => {
  it('rounds up to the next rupiah', () => {
    expect(minimumDpMinor('7000000')).toBe('2100000')
    expect(minimumDpMinor('1000001')).toBe('300001')
    expect(minimumDpMinor('1')).toBe('1')
  })
})
