import { CAPABILITY_KEYS, hasCapability, type RoleId } from '../../auth/rbac'

/**
 * Coarse gate for every Finance route, run before the request body is validated (Elysia validates before
 * `beforeHandle` and the handler). Without it an anonymous or Admin request with an invalid body got a 400
 * listing field names instead of 401/403. Handlers still check the exact capability; this only decides who
 * may reach a Finance route at all.
 */

/** Finance route, or a finance summary hanging off another resource (/projects/:id/finance-summary, …). */
export function isFinancePath(pathname: string): boolean {
  return pathname.startsWith('/api/v1/finance/') || pathname === '/api/v1/finance' || /^\/api\/v1\/[^/]+\/[^/]+\/finance-summary$/.test(pathname)
    || /^\/api\/v1\/bookings\/[^/]+\/[^/]+\/finance-summary$/.test(pathname)
}

/**
 * Routes that roles without any finance.* capability (Admin) use by design: status-only views (ADR-006),
 * reading cancellation policies, and requesting a cancellation. Keep in step with routes-ar-ap.ts and
 * routes-refunds.ts, where each of these narrows the response for such roles.
 */
const SHARED: [method: string, pattern: RegExp][] = [
  ['GET', /^\/api\/v1\/finance\/overview$/],
  ['GET', /\/finance-summary$/],
  ['GET', /^\/api\/v1\/finance\/policies(\/[^/]+)?$/],
  ['GET', /^\/api\/v1\/finance\/cancellation-policy\/[^/]+\/[^/]+$/],
  ['GET', /^\/api\/v1\/finance\/refunds(\/[^/]+)?$/],
  ['POST', /^\/api\/v1\/finance\/cancellations(\/preview)?$/]
]

const FINANCE_CAPABILITIES = CAPABILITY_KEYS.filter(c => c.startsWith('finance.'))

export function mayReachFinanceRoute(role: RoleId, method: string, pathname: string): boolean {
  if (FINANCE_CAPABILITIES.some(c => hasCapability(role, c))) return true
  return SHARED.some(([m, pattern]) => m === method && pattern.test(pathname))
}
