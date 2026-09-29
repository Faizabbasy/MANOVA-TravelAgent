import type { AppDeps } from '../app-deps'
import { errors } from '../http/errors'
import type { Actor, CapabilityKey } from './rbac'
import { hasCapability } from './rbac'
import { readCookie, resolveSession, sessionCookieName } from './sessions'

export type SessionActor = Actor & { expiresAt: Date }

export interface AuthContext {
  cookieName: string
  /** The signed-in caller, or null. Resolved at most once per request. */
  actorOf(request: Request): Promise<SessionActor | null>
  /** Throws 401 when there is no valid session. */
  requireActor(request: Request): Promise<SessionActor>
  /** Throws 401 without a session and 403 without the capability. */
  requireCapability(request: Request, capability: CapabilityKey): Promise<SessionActor>
}

export function createAuthContext(deps: AppDeps): AuthContext {
  const cookieName = sessionCookieName(deps.config.cookieSecure)
  const resolved = new WeakMap<Request, Promise<SessionActor | null>>()

  const actorOf = (request: Request) => {
    let pending = resolved.get(request)
    if (!pending) {
      pending = resolveSession(deps.db, readCookie(request.headers.get('cookie'), cookieName), { portalLogin: deps.config.portalLogin })
      resolved.set(request, pending)
    }
    return pending
  }

  const requireActor = async (request: Request) => {
    const actor = await actorOf(request)
    if (!actor) throw errors.unauthenticated()
    return actor
  }

  const requireCapability = async (request: Request, capability: CapabilityKey) => {
    const actor = await requireActor(request)
    if (!hasCapability(actor.role, capability)) throw errors.forbidden()
    return actor
  }

  return { cookieName, actorOf, requireActor, requireCapability }
}
