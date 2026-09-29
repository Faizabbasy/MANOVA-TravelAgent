import { Elysia } from 'elysia'
import type { AppDeps } from './app-deps'
import { createAuthContext } from './auth/context'
import { authRoutes } from './auth/routes'
import { assignRequestId, requestIdOf } from './http/envelope'
import { AppError, errorBody, type FieldErrors } from './http/errors'
import { coreRoutes } from './modules/core/routes'
import { financeRoutes } from './modules/finance/routes'
import { arApRoutes } from './modules/finance/routes-ar-ap'
import { refundRoutes } from './modules/finance/routes-refunds'
import { healthRoutes } from './modules/health/routes'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const ALLOWED_HEADERS = 'content-type, idempotency-key, if-match, x-request-id'
const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } })
}

interface ValidationIssue {
  path?: string
  message?: string
  schema?: { error?: unknown }
}

/** Plain-language message: the schema's own `error` text when it has one, else a translated TypeBox message. */
function issueMessage(issue: ValidationIssue): string {
  if (typeof issue.schema?.error === 'string') return issue.schema.error
  const raw = issue.message ?? ''
  if (/^Expected required property/.test(raw) || raw === 'Expected string' || raw === 'Expected number') return 'Wajib diisi.'
  const min = /^Expected string length greater or equal to (\d+)/.exec(raw)
  if (min) return `Minimal ${min[1]} karakter.`
  const max = /^Expected string length less or equal to (\d+)/.exec(raw)
  if (max) return `Maksimal ${max[1]} karakter.`
  return 'Format tidak valid.'
}

/** Elysia/TypeBox validation issue paths look like "/email" or "/items/0/amount". */
function toFieldErrors(issues: ValidationIssue[]): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of issues) {
    const field = (issue.path ?? '').replace(/^\//, '').replace(/\//g, '.') || '_'
    const message = issueMessage(issue)
    const list = (out[field] ??= [])
    if (!list.includes(message)) list.push(message)
  }
  return out
}

export function createApp(deps: AppDeps) {
  const auth = createAuthContext(deps)
  const allowedOrigins = new Set(deps.config.allowedOrigins)
  const log = deps.log ?? (deps.config.appEnv === 'test' ? () => {} : (line: Record<string, unknown>) => console.log(JSON.stringify(line)))
  const startedAt = new WeakMap<Request, number>()

  return new Elysia()
    .onRequest(({ request, set }) => {
      startedAt.set(request, performance.now())
      const requestId = assignRequestId(request)
      const origin = request.headers.get('origin')
      const originAllowed = origin !== null && allowedOrigins.has(origin)

      const baseHeaders: Record<string, string> = {
        'x-request-id': requestId,
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'x-frame-options': 'DENY'
      }
      if (originAllowed) {
        Object.assign(baseHeaders, {
          'access-control-allow-origin': origin,
          'access-control-allow-credentials': 'true',
          'access-control-expose-headers': 'x-request-id, retry-after',
          vary: 'Origin'
        })
      }
      Object.assign(set.headers, baseHeaders)

      if (request.method === 'OPTIONS') {
        if (!originAllowed) return new Response(null, { status: 403, headers: baseHeaders })
        return new Response(null, {
          status: 204,
          headers: { ...baseHeaders, 'access-control-allow-methods': ALLOWED_METHODS, 'access-control-allow-headers': ALLOWED_HEADERS, 'access-control-max-age': '600' }
        })
      }

      // CSRF: the session cookie is SameSite=Lax, and state-changing requests must additionally come from
      // an allowed origin. Non-browser clients (no Origin, no Sec-Fetch-Site) are not affected.
      if (!SAFE_METHODS.has(request.method)) {
        const crossSite = request.headers.get('sec-fetch-site') === 'cross-site'
        if ((origin !== null && !originAllowed) || (origin === null && crossSite)) {
          const err = new AppError(403, 'CSRF_ORIGIN_REJECTED', 'Permintaan ditolak karena berasal dari situs yang tidak dikenal.')
          return jsonResponse(errorBody(err, requestId), 403, baseHeaders)
        }
      }
    })
    .onError({ as: 'global' }, ({ code, error, request, set }) => {
      const requestId = requestIdOf(request)
      if (error instanceof AppError) {
        set.status = error.status
        if (error.extra.headers) Object.assign(set.headers, error.extra.headers)
        return errorBody(error, requestId)
      }
      if (code === 'VALIDATION') {
        set.status = 400
        return errorBody(new AppError(400, 'VALIDATION_FAILED', 'Beberapa isian belum valid.', { fieldErrors: toFieldErrors(error.all as never) }), requestId)
      }
      if (code === 'PARSE') {
        set.status = 400
        return errorBody(new AppError(400, 'INVALID_JSON', 'Isi permintaan bukan JSON yang valid.'), requestId)
      }
      if (code === 'NOT_FOUND') {
        set.status = 404
        return errorBody(new AppError(404, 'ROUTE_NOT_FOUND', 'Endpoint tidak ditemukan.'), requestId)
      }
      // Unknown failure: log the detail server-side, never return it.
      log({ level: 'error', time: new Date().toISOString(), requestId, code, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined })
      set.status = 500
      return errorBody(new AppError(500, 'INTERNAL', 'Terjadi kesalahan pada server. Sebutkan request ID ini saat melapor.'), requestId)
    })
    .onAfterResponse({ as: 'global' }, ({ request, set }) => {
      const started = startedAt.get(request)
      log({
        level: 'info',
        time: new Date().toISOString(),
        requestId: requestIdOf(request),
        method: request.method,
        path: new URL(request.url).pathname,
        status: set.status,
        durationMs: started === undefined ? undefined : Math.round(performance.now() - started)
      })
    })
    .use(healthRoutes(deps))
    .use(authRoutes(deps, auth))
    .use(coreRoutes(deps, auth))
    .use(financeRoutes(deps, auth))
    .use(arApRoutes(deps, auth))
    .use(refundRoutes(deps, auth))
}

export type App = ReturnType<typeof createApp>
