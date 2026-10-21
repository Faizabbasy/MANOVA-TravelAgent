import { describe, expect, it } from 'vitest'
import { invoiceSubjectLabel } from './labels'

describe('invoice subject', () => {
  it('names the project, or the B2C order itself — never a dummy project', () => {
    expect(invoiceSubjectLabel({ project: { name: 'Bali Incentive' }, salesOrderId: null })).toBe('Bali Incentive')
    expect(invoiceSubjectLabel({ project: null, salesOrderId: 'SLO-001' })).toBe('Order SLO-001')
    expect(invoiceSubjectLabel({ project: null })).toBe('Tanpa project')
  })
})
