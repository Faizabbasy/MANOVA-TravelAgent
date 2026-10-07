import { describe, expect, it } from 'vitest'
import { RFQS, RFQ_RESPONSES } from './procurement'
import { createServiceOrderFromRfq } from './index'

describe('service order from an RFQ', () => {
  it('carries the winning response total as the net cost (what MANOVA pays the vendor), never as the sell price', () => {
    const rfq = RFQS.find(r => r.selectedVendorId)!
    const winning = RFQ_RESPONSES.find(r => r.rfqId === rfq.id && r.vendorId === rfq.selectedVendorId)!
    const order = createServiceOrderFromRfq(rfq.id)!
    expect(order).toMatchObject({ rfqId: rfq.id, vendorId: rfq.selectedVendorId, netCostIdr: winning.totalAmountIdr })
    expect(order.sellPriceIdr).toBeUndefined()
    expect(order.id).toMatch(/^SO-L\d+$/)
  })

  it('needs a selected vendor', () => {
    const open = RFQS.find(r => !r.selectedVendorId)!
    expect(createServiceOrderFromRfq(open.id)).toBeUndefined()
  })
})
