import { describe, expect, it } from 'vitest'
import { buildUrl, createApiClient, fetchTransport, type Transport, type TransportRequest } from './client'
import { createManovaApi } from './endpoints'
import { ApiError, isApiError } from './errors'

function headers (values: Record<string, string> = {}) {
  return { get: (name: string) => values[name.toLowerCase()] ?? null }
}

function fakeTransport (status: number, body: unknown, responseHeaders: Record<string, string> = {}) {
  const calls: TransportRequest[] = []
  const transport: Transport = (req) => {
    calls.push(req)
    return Promise.resolve({ status, headers: headers(responseHeaders), body })
  }
  return { calls, transport }
}

describe('buildUrl', () => {
  it('joins base and path and drops empty query values', () => {
    expect(buildUrl('/api/v1/', '/projects', { limit: 3, cursor: null, status: undefined, partyId: '' })).toBe('/api/v1/projects?limit=3')
    expect(buildUrl('https://api.x.id/api/v1', 'projects', { q: 'a b&c' })).toBe('https://api.x.id/api/v1/projects?q=a+b%26c')
  })
})

describe('createApiClient', () => {
  it('returns the success envelope and sends JSON with idempotency and version headers', async () => {
    const { calls, transport } = fakeTransport(200, { data: { ok: true }, meta: { requestId: 'req_1' } })
    const client = createApiClient({ baseURL: '/api/v1', transport })
    const res = await client.post<{ ok: boolean }>('/finance/receipts', { amountMinor: '30000000' }, { idempotencyKey: 'key-1', ifMatch: '"3"' })
    expect(res).toEqual({ data: { ok: true }, meta: { requestId: 'req_1' } })
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: '/api/v1/finance/receipts',
      body: '{"amountMinor":"30000000"}',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'idempotency-key': 'key-1', 'if-match': '"3"' }
    })
  })

  it('turns the server error envelope into ApiError with field errors and request ID', async () => {
    const { transport } = fakeTransport(400, {
      error: { code: 'VALIDATION_FAILED', message: 'Beberapa isian belum valid.', fieldErrors: { email: ['Format email tidak valid.'] } },
      meta: { requestId: 'req_2' }
    })
    const client = createApiClient({ baseURL: '/api/v1', transport })
    const error = await client.post('/auth/login', {}).catch(e => e)
    expect(isApiError(error)).toBe(true)
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_FAILED', requestId: 'req_2', message: 'Beberapa isian belum valid.' })
    expect((error as ApiError).isValidation).toBe(true)
    expect((error as ApiError).fieldError('email')).toBe('Format email tidak valid.')
  })

  it('classifies 401/403/404/409 and retryable failures', async () => {
    const make = async (status: number) => {
      const { transport } = fakeTransport(status, { error: { code: 'X', message: 'm' }, meta: { requestId: 'r' } })
      return await createApiClient({ baseURL: '', transport }).get('/x').catch(e => e as ApiError)
    }
    expect((await make(401)).isUnauthenticated).toBe(true)
    expect((await make(403)).isForbidden).toBe(true)
    expect((await make(404)).isNotFound).toBe(true)
    expect((await make(409)).isConflict).toBe(true)
    expect((await make(503)).isRetryable).toBe(true)
    expect((await make(422)).isRetryable).toBe(false)
  })

  it('handles non-envelope responses (e.g. a proxy HTML 502) without leaking raw bodies', async () => {
    const { transport } = fakeTransport(502, '<html>Bad gateway</html>', { 'x-request-id': 'req_proxy' })
    const error = await createApiClient({ baseURL: '', transport }).get('/x').catch(e => e as ApiError)
    expect(error).toMatchObject({ status: 502, code: 'UNEXPECTED_RESPONSE', requestId: 'req_proxy' })
    expect(error.message).not.toContain('html')
  })

  it('reports a 200 without a data envelope as unexpected', async () => {
    const { transport } = fakeTransport(200, { hello: 'world' })
    const error = await createApiClient({ baseURL: '', transport }).get('/x').catch(e => e as ApiError)
    expect(error.code).toBe('UNEXPECTED_RESPONSE')
  })

  it('maps network failures to NETWORK_ERROR but lets aborts through', async () => {
    const failing: Transport = () => Promise.reject(new TypeError('fetch failed'))
    const error = await createApiClient({ baseURL: '', transport: failing }).get('/x').catch(e => e as ApiError)
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR', isRetryable: true })

    const aborted: Transport = () => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    await expect(createApiClient({ baseURL: '', transport: aborted }).get('/x')).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('adds per-request headers (SSR cookie forwarding)', async () => {
    const { calls, transport } = fakeTransport(200, { data: null, meta: { requestId: 'r' } })
    await createApiClient({ baseURL: '', transport, headers: () => ({ cookie: 'manova_session=abc' }) }).get('/auth/me')
    expect(calls[0]!.headers.cookie).toBe('manova_session=abc')
  })
})

describe('fetchTransport', () => {
  it('always sends credentials and parses JSON bodies', async () => {
    let init: RequestInit | undefined
    const fakeFetch = ((_url: string, i: RequestInit) => {
      init = i
      return Promise.resolve(new Response('{"data":1,"meta":{"requestId":"r"}}', { status: 200, headers: { 'content-type': 'application/json' } }))
    }) as unknown as typeof fetch
    const res = await fetchTransport(fakeFetch)({ method: 'GET', url: '/x', headers: {} })
    expect(init?.credentials).toBe('include')
    expect(res.body).toEqual({ data: 1, meta: { requestId: 'r' } })
  })
})

describe('createManovaApi — finance', () => {
  it('sends an Idempotency-Key on every money-moving command and reuses a caller-supplied one', async () => {
    const { calls, transport } = fakeTransport(201, { data: {}, meta: { requestId: 'r' } })
    const api = createManovaApi(createApiClient({ baseURL: '/api/v1', transport }))
    await api.finance.postTransaction({ bankAccountId: 'BA-001', kind: 'expense', category: 'office', amountMinor: '5000', effectiveDate: '2026-09-29' }, 'key-retry-12345')
    await api.finance.postTransaction({ bankAccountId: 'BA-001', kind: 'expense', category: 'office', amountMinor: '5000', effectiveDate: '2026-09-29' }, 'key-retry-12345')
    await api.finance.postTransfer({ fromAccountId: 'BA-001', toAccountId: 'BA-002', amountMinor: '1000', effectiveDate: '2026-09-29' })
    await api.finance.reverseTransaction('TRX-000001', 'Salah input')
    expect(calls.map(c => c.headers['idempotency-key'])).toEqual(['key-retry-12345', 'key-retry-12345', expect.any(String), expect.any(String)])
    expect(calls[2]!.headers['idempotency-key']).not.toBe(calls[3]!.headers['idempotency-key'])
    expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([
      'POST /api/v1/finance/transactions',
      'POST /api/v1/finance/transactions',
      'POST /api/v1/finance/transfers',
      'POST /api/v1/finance/transactions/TRX-000001/reverse'
    ])
  })

  it('maps reads with their filters', async () => {
    const { calls, transport } = fakeTransport(200, { data: [], meta: { requestId: 'r', pagination: { limit: 50, nextCursor: null } } })
    const api = createManovaApi(createApiClient({ baseURL: '/api/v1', transport }))
    await api.finance.statement({ from: '2026-09-01', to: '2026-09-29', accountId: 'BA-001', includeTransfers: false })
    await api.finance.accountLedger('BA-001', { from: '2026-09-01' })
    await api.finance.verifyOpening('BA-001', { balanceMinor: '100000000', openingDate: '2026-09-01' })
    expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([
      'GET /api/v1/finance/statement?from=2026-09-01&to=2026-09-29&accountId=BA-001&includeTransfers=false',
      'GET /api/v1/finance/accounts/BA-001/ledger?from=2026-09-01',
      'POST /api/v1/finance/accounts/BA-001/opening/verify'
    ])
  })
})

describe('createManovaApi — receivables & payables', () => {
  it('money commands carry idempotency keys; document commands do not need one', async () => {
    const { calls, transport } = fakeTransport(201, { data: {}, meta: { requestId: 'r' } })
    const api = createManovaApi(createApiClient({ baseURL: '/api/v1', transport }))
    await api.finance.postReceipt({ bankAccountId: 'BA-001', amountMinor: '200000000', effectiveDate: '2026-09-29', partyId: 'PTY-005', allocations: [{ invoiceId: 'CINV-00001', amountMinor: '200000000' }] })
    await api.finance.allocateReceipt('TRX-000002', [{ invoiceId: 'CINV-00002', amountMinor: '6000000' }], 'retry-key-123')
    await api.finance.postVendorPayment({ bankAccountId: 'BA-001', amountMinor: '5000000', effectiveDate: '2026-09-29', vendorId: 'VND-006' })
    await api.finance.issueInvoice('CINV-00001', { dueDate: '2026-10-06' })
    await api.finance.reviewVendorInvoice('VINV-00001', { action: 'approve', matchStatus: 'matched' })
    expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([
      'POST /api/v1/finance/receipts',
      'POST /api/v1/finance/receipts/TRX-000002/allocations',
      'POST /api/v1/finance/vendor-payments',
      'POST /api/v1/finance/customer-invoices/CINV-00001/issue',
      'POST /api/v1/finance/vendor-invoices/VINV-00001/review'
    ])
    expect(calls[0]!.headers['idempotency-key']).toEqual(expect.any(String))
    expect(calls[1]!.headers['idempotency-key']).toBe('retry-key-123')
    expect(calls[2]!.headers['idempotency-key']).toEqual(expect.any(String))
    expect(calls[3]!.headers['idempotency-key']).toBeUndefined()
    expect(calls[3]!.body).toBe('{"dueDate":"2026-10-06"}')
  })

  it('maps worklists and context summaries', async () => {
    const { calls, transport } = fakeTransport(200, { data: [], meta: { requestId: 'r', pagination: { limit: 50, nextCursor: null } } })
    const api = createManovaApi(createApiClient({ baseURL: '/api/v1', transport }))
    await api.finance.receivables({ settlement: 'overdue', partyId: 'PTY-005' })
    await api.finance.payables({ view: 'review' })
    await api.finance.projectSummary('PRJ-201')
    await api.finance.bookingSummary('flight', 'FLT-1011')
    await api.finance.deleteInvoiceDraft('CINV-00009')
    expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([
      'GET /api/v1/finance/receivables?settlement=overdue&partyId=PTY-005',
      'GET /api/v1/finance/payables?view=review',
      'GET /api/v1/projects/PRJ-201/finance-summary',
      'GET /api/v1/bookings/flight/FLT-1011/finance-summary',
      'DELETE /api/v1/finance/customer-invoices/CINV-00009'
    ])
  })

  it('group trip: sales order summary and DP confirmation (with idempotency key)', async () => {
    const { calls, transport } = fakeTransport(200, { data: {}, meta: { requestId: 'r' } })
    const api = createManovaApi(createApiClient({ baseURL: '/api/v1', transport }))
    await api.finance.salesOrderSummary('SLO-006')
    await api.finance.confirmGroupTripDp('SLO-006', { bankAccountId: 'BA-1', dpAmountMinor: '2100000', effectiveDate: '2026-10-01', dueDate: '2026-10-20' }, 'key-dp-123456')
    expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([
      'GET /api/v1/sales-orders/SLO-006/finance-summary',
      'POST /api/v1/finance/sales-orders/SLO-006/confirm-dp'
    ])
    expect(calls[1]!.headers['idempotency-key']).toBe('key-dp-123456')
  })

  it('debit note is issued from an invoice', async () => {
    const { calls, transport } = fakeTransport(200, { data: {}, meta: { requestId: 'r' } })
    const api = createManovaApi(createApiClient({ baseURL: '/api/v1', transport }))
    await api.finance.issueDebitNote('CINV-00001', { amountMinor: '250000', reason: 'Tambahan kamar', dueDate: '2026-10-20' })
    expect(calls.map(c => `${c.method} ${c.url}`)).toEqual(['POST /api/v1/finance/customer-invoices/CINV-00001/debit-notes'])
    expect(calls[0]!.body).toBe('{"amountMinor":"250000","reason":"Tambahan kamar","dueDate":"2026-10-20"}')
  })

  it('monthly report takes a month count or a date range', async () => {
    const { calls, transport } = fakeTransport(200, { data: {}, meta: { requestId: 'r' } })
    const api = createManovaApi(createApiClient({ baseURL: '/api/v1', transport }))
    await api.finance.monthlyReport({ months: '6' })
    await api.finance.monthlyReport({ from: '2026-07-01', to: '2026-09-30' })
    expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([
      'GET /api/v1/finance/reports/monthly?months=6',
      'GET /api/v1/finance/reports/monthly?from=2026-07-01&to=2026-09-30'
    ])
  })
})

describe('createManovaApi', () => {
  it('maps typed calls to the backend routes, encoding path segments', async () => {
    const { calls, transport } = fakeTransport(200, { data: {}, meta: { requestId: 'r', pagination: { limit: 25, nextCursor: null } } })
    const api = createManovaApi(createApiClient({ baseURL: '/api/v1', transport }))
    await api.core.listProjects({ limit: 10, status: 'confirmed' })
    await api.core.getBookingRef('transport', 'TRN-1034')
    await api.core.getProject('PRJ/../x')
    await api.auth.login('budi.santoso@manova.id', 'secret')
    expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([
      'GET /api/v1/projects?limit=10&status=confirmed',
      'GET /api/v1/bookings/transport/TRN-1034',
      'GET /api/v1/projects/PRJ%2F..%2Fx',
      'POST /api/v1/auth/login'
    ])
  })
})
