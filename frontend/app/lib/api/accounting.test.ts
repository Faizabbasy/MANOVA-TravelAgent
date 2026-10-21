import { describe, expect, it } from 'vitest'
import { createApiClient, type TransportRequest } from './client'
import { createManovaApi } from './endpoints'
function jsonBody (request: TransportRequest) {
  if (typeof request.body !== 'string') { throw new TypeError('Accounting commands must use JSON') }
  return JSON.parse(request.body)
}

describe('accounting typed API boundary', () => {
  it('retains command identity for retry and sends business inputs, never browser journals', async () => {
    const calls: TransportRequest[] = []
    const api = createManovaApi(createApiClient({
      baseURL: '/api/v1',
      transport: (request) => {
        calls.push(request)
        return Promise.resolve({ status: 200, headers: { get: () => null }, body: { data: { mode: 'off' }, meta: { requestId: 'test-only' } } })
      }
    }))
    const input = { name: 'TEST_ONLY', purpose: 'production' as const, cutoverDate: '2026-09-01', timezone: 'Asia/Jakarta' }
    await api.accounting.createSetup(input, 'stable-accounting-key')
    await api.accounting.createSetup(input, 'stable-accounting-key')
    expect(calls[0]).toEqual(calls[1])
    expect(calls[0].headers['idempotency-key']).toBe('stable-accounting-key')
    expect(jsonBody(calls[0])).toEqual(input)
    await api.accounting.trialBalance('2026-10-21')
    expect(calls[2].url).toBe('/api/v1/accounting/trial-balance?asOf=2026-10-21')
    await api.accounting.sourceStatus('financial_transaction', 'TRX-123')
    expect(calls[3].url).toBe('/api/v1/accounting/sources/financial_transaction/TRX-123')
    await api.accounting.journals({ sourceId: 'TRX-123', cursor: 'next-page', limit: 25 })
    expect(calls[4].url).toContain('sourceId=TRX-123')
    expect(calls[4].url).toContain('cursor=next-page')
  })
})

describe('owner accounting source commands', () => {
  it('retains the identity and exact source facts of policy rehearsal and supplier matching requests', async () => {
    const calls:TransportRequest[] = []
    const api = createManovaApi(createApiClient({
      baseURL: '/api/v1',
      transport: (request) => {
        calls.push(request); return Promise.resolve({ status: 200, headers: { get: () => null }, body: { data: {}, meta: { requestId: 'TEST_ONLY' } } })
      }
    }))
    const proposal = { reason: 'TEST_ONLY isolated facts checked', confirm: true }
    await api.accounting.rehearsePolicy('APL-1', proposal, 'stable-policy-rehearsal')
    await api.accounting.rehearsePolicy('APL-1', proposal, 'stable-policy-rehearsal')
    expect(calls[0]).toEqual(calls[1]); expect(calls[0].url).toBe('/api/v1/accounting/policies/APL-1/rehearse')
    expect(jsonBody(calls[0])).toEqual(proposal)
    const match = { fulfillmentId: 'SFL-1', actualMinor: '123456789012345', closesReceipt: true, postingDate: '2026-10-02', reason: 'TEST_ONLY final source invoice' }
    await api.finance.matchSupplierReceipt('VIN-1', match, 'stable-supplier-match')
    await api.finance.matchSupplierReceipt('VIN-1', match, 'stable-supplier-match')
    expect(calls[2]).toEqual(calls[3]); expect(calls[2].headers['idempotency-key']).toBe('stable-supplier-match')
    expect(jsonBody(calls[2])).toEqual(match)
    await api.finance.voidSupplierReceiptMatch('VFM-1', 'TEST_ONLY corrected source', 'stable-match-void')
    expect(calls[4].url).toBe('/api/v1/finance/supplier-receipt-matches/VFM-1/void')
    expect(calls[4].headers['idempotency-key']).toBe('stable-match-void')
  })
  it('posts fulfillment/claim/vendor-refund facts on the Finance namespace with a stable idempotency key', async () => {
    const calls: TransportRequest[] = []
    const api = createManovaApi(createApiClient({
      baseURL: '/api/v1',
      transport: (request) => {
        calls.push(request)
        return Promise.resolve({ status: 200, headers: { get: () => null }, body: { data: {}, meta: { requestId: 'test-only' } } })
      }
    }))
    const fact = { side: 'customer' as const, projectId: 'PRJ-1', amountMinor: '9007199254740993', fulfilledOn: '2026-10-05', evidence: 'TEST_ONLY manifest' }
    await api.finance.recordFulfillment(fact, 'same-fact')
    await api.finance.recordFulfillment(fact, 'same-fact')
    expect(calls[0]).toEqual(calls[1])
    expect(calls[0].url).toBe('/api/v1/finance/fulfillments')
    expect(jsonBody(calls[0]).amountMinor).toBe('9007199254740993')
    await api.finance.fulfillments({ projectId: 'PRJ-1' })
    expect(calls[2].url).toBe('/api/v1/finance/fulfillments?projectId=PRJ-1')
    await api.finance.voidFulfillment('SFL-0001', 'TEST_ONLY wrong project', 'void-key')
    expect(calls[3].url).toBe('/api/v1/finance/fulfillments/SFL-0001/void')
    expect(calls[3].headers['idempotency-key']).toBe('void-key')
    await api.finance.createSupplierClaim({ vendorId: 'VND-1', basis: 'cost-recovery', amountMinor: '4', recognizedOn: '2026-10-15', reason: 'TEST_ONLY compensation' }, 'claim-key')
    await api.finance.postVendorRefund({ bankAccountId: 'BA-1', claimId: 'SCL-0001', amountMinor: '4', effectiveDate: '2026-10-16' }, 'refund-key')
    expect(calls[4].url).toBe('/api/v1/finance/supplier-claims')
    expect(calls[5].url).toBe('/api/v1/finance/vendor-refunds')
    expect(calls[5].headers['idempotency-key']).toBe('refund-key')
  })
})
