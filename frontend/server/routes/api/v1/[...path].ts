import { defineEventHandler, getRequestIP, proxyRequest } from 'h3'

/**
 * First-party proxy to the backend API (backend/, Elysia): browser → Nuxt `/api/v1/**` → `apiProxyTarget`.
 * Keeps the HttpOnly session cookie same-origin (no cross-site CORS/cookies).
 *
 * `X-Forwarded-For` is OVERWRITTEN with the socket address this server saw, never passed through: the
 * backend (TRUST_PROXY=true) reads the rightmost hop for login throttling and audit, so a client-supplied
 * value must not survive. Target is read at runtime (NUXT_API_PROXY_TARGET).
 */
export default defineEventHandler((event) => {
  const target = String(useRuntimeConfig(event).apiProxyTarget || 'http://localhost:3000').replace(/\/+$/, '')
  return proxyRequest(event, `${target}${event.path}`, {
    headers: { 'x-forwarded-for': getRequestIP(event) ?? 'unknown' }
  })
})
