import { networkError, toApiError } from './errors'
import type { ApiList, ApiSuccess } from '~/types/api'

/**
 * Typed HTTP client for the MANOVA API. Framework-free on purpose: `useApi()` wires it into Nuxt, tests
 * drive it with a fake transport. It never computes business values — it only moves JSON and turns
 * failures into ApiError.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type QueryValue = string | number | boolean | null | undefined

export interface TransportRequest {
  method: HttpMethod
  url: string
  headers: Record<string, string>
  body?: string
  signal?: AbortSignal
}

export interface TransportResponse {
  status: number
  headers: { get (name: string): string | null }
  /** Parsed JSON when the response was JSON, otherwise the raw text (or null when empty). */
  body: unknown
}

/** Performs one HTTP exchange. Must resolve for every HTTP status and reject only on network failure. */
export type Transport = (request: TransportRequest) => Promise<TransportResponse>

export interface RequestOptions {
  query?: Record<string, QueryValue>
  body?: unknown
  /** Sent as `Idempotency-Key` so a retried financial command is applied once. */
  idempotencyKey?: string
  /** Sent as `If-Match` for optimistic concurrency on versioned records. */
  ifMatch?: string
  signal?: AbortSignal
}

export interface ApiClientOptions {
  /** e.g. `/api/v1` (proxied by Nuxt) or `https://api.example.com/api/v1`. */
  baseURL: string
  transport: Transport
  /** Extra headers per request (e.g. forwarded cookies during SSR). */
  headers?: () => Record<string, string>
}

export function buildUrl (baseURL: string, path: string, query?: Record<string, QueryValue>): string {
  const base = baseURL.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') { continue }
    params.append(key, String(value))
  }
  const qs = params.toString()
  return `${base}${suffix}${qs ? `?${qs}` : ''}`
}

export function newIdempotencyKey (): string {
  return globalThis.crypto.randomUUID()
}

export function createApiClient (options: ApiClientOptions) {
  async function request<T> (method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json', ...options.headers?.() }
    let body: string | undefined
    if (opts.body !== undefined) {
      headers['content-type'] = 'application/json'
      body = JSON.stringify(opts.body)
    }
    if (opts.idempotencyKey) { headers['idempotency-key'] = opts.idempotencyKey }
    if (opts.ifMatch) { headers['if-match'] = opts.ifMatch }

    let response: TransportResponse
    try {
      response = await options.transport({ method, url: buildUrl(options.baseURL, path, opts.query), headers, body, signal: opts.signal })
    } catch (cause) {
      if ((cause as { name?: string })?.name === 'AbortError') { throw cause }
      throw networkError(cause)
    }

    const requestId = response.headers.get('x-request-id')
    if (response.status < 200 || response.status >= 300) {
      throw toApiError(response.status, response.body, requestId)
    }
    const payload = response.body as { data?: unknown } | null
    if (!payload || typeof payload !== 'object' || !('data' in payload)) {
      throw toApiError(response.status, null, requestId)
    }
    return payload as T
  }

  return {
    request,
    get: <T>(path: string, opts?: Omit<RequestOptions, 'body'>) => request<ApiSuccess<T>>('GET', path, opts),
    getList: <T>(path: string, opts?: Omit<RequestOptions, 'body'>) => request<ApiList<T>>('GET', path, opts),
    post: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<ApiSuccess<T>>('POST', path, { ...opts, body }),
    put: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<ApiSuccess<T>>('PUT', path, { ...opts, body }),
    patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<ApiSuccess<T>>('PATCH', path, { ...opts, body }),
    delete: <T>(path: string, opts?: RequestOptions) => request<ApiSuccess<T>>('DELETE', path, opts)
  }
}

export type ApiClient = ReturnType<typeof createApiClient>

/** Transport over the Fetch API (browser, Node ≥18, tests). Sends cookies for the session. */
export function fetchTransport (fetchImpl: typeof fetch = globalThis.fetch): Transport {
  return async ({ method, url, headers, body, signal }) => {
    const res = await fetchImpl(url, { method, headers, body, signal, credentials: 'include' })
    const text = await res.text()
    let parsed: unknown = text || null
    if (text && (res.headers.get('content-type') ?? '').includes('json')) {
      try { parsed = JSON.parse(text) } catch { parsed = text }
    }
    return { status: res.status, headers: res.headers, body: parsed }
  }
}
