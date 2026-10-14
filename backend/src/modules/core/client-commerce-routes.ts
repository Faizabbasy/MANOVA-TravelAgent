import { Elysia } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ok } from '../../http/envelope'
import { errors } from '../../http/errors'
import { getClientInvoice, listClientInvoices, listClientQuotations, listClientReservations } from './client-commerce'

/**
 * Client portal commercial reads (S12a-2): only a client may call these, and only for its own party (taken from the
 * session, never from the request). Internal roles use the internal routes; vendors are refused.
 */
export function clientCommerceRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps

  async function clientParty(request: Request): Promise<string> {
    const actor = await auth.requireActor(request)
    if (actor.role !== 'client') throw errors.forbidden()
    return actor.partyId ?? '__no-party__'
  }

  return new Elysia({ prefix: '/api/v1/client' })
    .get('/quotations', async ({ request }) => ok(request, await listClientQuotations(db, await clientParty(request))))
    .get('/reservations', async ({ request }) => ok(request, await listClientReservations(db, await clientParty(request))))
    .get('/invoices', async ({ request }) => ok(request, await listClientInvoices(db, await clientParty(request))))
    .get('/invoices/:id', async ({ request, params }) => {
      const partyId = await clientParty(request)
      return ok(request, await getClientInvoice(db, partyId, assertIdParam(params.id, 'Invoice')))
    })
}
