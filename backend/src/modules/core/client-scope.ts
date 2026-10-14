import type { Actor } from '../../auth/rbac'
import { errors } from '../../http/errors'
import { isPortalActor } from './scope'

/**
 * What a reader may see on the shared operational read routes (S12a). Internal roles see every party. A client sees
 * only its own party's projects (`partyId` narrows each list query) and a client view of each record — no item hidden
 * from the client, no vendor cost, no internal incident log. Vendors are refused here until their portal moves to the
 * server (S12d).
 */
export type ReaderScope = { partyId?: string }

export function readerScopeOf(actor: Actor): ReaderScope {
  if (!isPortalActor(actor)) return {}
  if (actor.role === 'client') {
    // A client login without a party sees nothing rather than everything.
    return { partyId: actor.partyId ?? '__no-party__' }
  }
  throw errors.forbidden()
}

export const isClientScope = (scope: ReaderScope) => scope.partyId !== undefined

/** Itinerary for a client: the vendor and what MANOVA pays it stay internal. */
export function clientItinerary<T extends { vendorId: string | null; vendorAmountMinor: string | null }>(item: T): T {
  return { ...item, vendorId: null, vendorAmountMinor: null }
}

/** Incident for a client: the internal communication log and the escalation stay internal. */
export function clientIncident<T extends { communicationLog: unknown[]; escalatedTo: string | null }>(incident: T): T {
  return { ...incident, communicationLog: [], escalatedTo: null }
}
