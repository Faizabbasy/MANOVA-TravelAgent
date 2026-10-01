import { describe, expect, it } from 'vitest'
import { SALES_ORDERS } from './sales-orders'
import { INVOICES, PAYMENTS } from './finance'
import { getTravelers, markGroupTripOrderPaid } from './index'

/**
 * After Finance confirms a participant's DP on the server, the client-side Group Trip booking only follows
 * operationally: the order becomes `paid` and its travelers appear. No client-side invoice or payment.
 */
describe('markGroupTripOrderPaid', () => {
  const draft = () => SALES_ORDERS.find(o => o.projectId && o.status === 'draft')!

  it('marks a draft group-trip order paid and creates one traveler per pax, without mock money', () => {
    const order = draft()
    const invoicesBefore = INVOICES.length
    const paymentsBefore = PAYMENTS.length
    const travelersBefore = getTravelers(order.projectId!).filter(t => t.salesOrderId === order.id).length
    expect(markGroupTripOrderPaid(order.id)?.status).toBe('paid')
    expect(getTravelers(order.projectId!).filter(t => t.salesOrderId === order.id).length).toBe(travelersBefore + order.travelerCount)
    expect(INVOICES.length).toBe(invoicesBefore)
    expect(PAYMENTS.length).toBe(paymentsBefore)
  })

  it('is idempotent: a second call creates no more travelers', () => {
    const order = SALES_ORDERS.find(o => o.projectId && o.status === 'paid')!
    const travelers = getTravelers(order.projectId!).filter(t => t.salesOrderId === order.id).length
    expect(markGroupTripOrderPaid(order.id)).toBeUndefined()
    expect(getTravelers(order.projectId!).filter(t => t.salesOrderId === order.id).length).toBe(travelers)
  })

  it('refuses standalone orders and unknown ids', () => {
    const standalone = SALES_ORDERS.find(o => !o.projectId)
    if (standalone) { expect(markGroupTripOrderPaid(standalone.id)).toBeUndefined() }
    expect(markGroupTripOrderPaid('SLO-NOPE')).toBeUndefined()
  })
})
