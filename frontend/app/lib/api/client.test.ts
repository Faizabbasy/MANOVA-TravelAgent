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
