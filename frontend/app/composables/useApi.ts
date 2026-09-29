import { createApiClient, fetchTransport } from '~/lib/api/client'
import { createManovaApi, type ManovaApi } from '~/lib/api/endpoints'

/**
 * The MANOVA API, typed. In the browser calls go to `/api/v1/**` on the Nuxt origin, which proxies to the
 * backend (nuxt.config.ts routeRules) so the HttpOnly session cookie stays first-party. During SSR the call
 * goes straight to the backend with the incoming request's cookie forwarded.
 *
 * Phase 1: skeleton only — no screen uses it yet; the finance UI (Phase 4+) will.
 */
export function useApi (): ManovaApi {
  const config = useRuntimeConfig()
  const apiBase = String(config.public.apiBase || '/api/v1')
  const isAbsolute = /^https?:\/\//.test(apiBase)

  if (import.meta.server) {
    const forwarded = useRequestHeaders(['cookie'])
    const baseURL = isAbsolute ? apiBase : `${String(config.apiProxyTarget).replace(/\/+$/, '')}${apiBase}`
    return createManovaApi(createApiClient({ baseURL, transport: fetchTransport(), headers: () => ({ ...forwarded }) }))
  }

  return createManovaApi(createApiClient({ baseURL: apiBase, transport: fetchTransport() }))
}
