import type { Server } from 'bun'

export interface ClientInfo {
  ip: string | null
  userAgent: string | null
}

/**
 * Caller IP for audit and login throttling.
 *
 * With TRUST_PROXY=true the API must sit behind exactly one proxy we control (the Nuxt `/api/v1` proxy,
 * which overwrites `X-Forwarded-For` with the socket address it saw) and must not be reachable directly.
 * We take the RIGHTMOST entry — the one our proxy wrote — never the leftmost, which a client can forge.
 * Without TRUST_PROXY the header is ignored and the socket address is used.
 */
export function clientInfo(request: Request, server: Server<unknown> | null, trustProxy: boolean): ClientInfo {
  let ip: string | null = null
  if (trustProxy) {
    const hops = request.headers.get('x-forwarded-for')?.split(',').map(h => h.trim()).filter(Boolean) ?? []
    ip = hops.at(-1) ?? null
  }
  ip ??= server?.requestIP(request)?.address ?? null
  return { ip, userAgent: request.headers.get('user-agent') }
}
