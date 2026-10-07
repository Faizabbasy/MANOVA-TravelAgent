import { describe, expect, it } from 'vitest'
import { SALES_ORDERS } from './sales-orders'
import { INVOICES, PAYMENTS } from './finance'
import { getTravelers, markGroupTripOrderPaid } from './index'

/**
 * After Finance confirms a participant's DP on the server, the server marks the booking paid (S6b); the client
 * only follows operationally: its travelers appear. No client-side status change, invoice or payment.
 */
describe('markGroupTripOrderPaid', () => {
  it('creates one traveler per pax for a group-trip order the server marked paid, without touching status or mock money', () => {
    const order = SALES_ORDERS.find(o => o.projectId && o.status === 'draft')!
    order.status = 'paid' // as reloaded from the server after the DP confirmation
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
    markGroupTripOrderPaid(order.id)
    const travelers = getTravelers(order.projectId!).filter(t => t.salesOrderId === order.id).length
    markGroupTripOrderPaid(order.id)
    expect(getTravelers(order.projectId!).filter(t => t.salesOrderId === order.id).length).toBe(travelers)
  })

  it('refuses drafts (no DP yet), standalone orders and unknown ids', () => {
    const draft = SALES_ORDERS.find(o => o.projectId && o.status === 'draft')
    if (draft) { expect(markGroupTripOrderPaid(draft.id)).toBeUndefined() }
    const standalone = SALES_ORDERS.find(o => !o.projectId)
    if (standalone) { expect(markGroupTripOrderPaid(standalone.id)).toBeUndefined() }
    expect(markGroupTripOrderPaid('SLO-NOPE')).toBeUndefined()
  })
})
