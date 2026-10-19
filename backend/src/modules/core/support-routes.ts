import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ID_PATTERN, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import {
  listSupportTickets, staffAssignTicket, staffCloseTicket, staffReplyTicket, staffResolveTicket, staffSetTicketStatus
} from './support-tickets'

/** The staff side of client support tickets (S12c-2): `support.manage-ticket` (Admin; the Super Admin passes). */
export function supportRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const CAP = 'support.manage-ticket' as const
  const anyBody = { body: t.Optional(t.Record(t.String(), t.Unknown())) }
  const view = async (id: string) => {
    const [ticket] = await listSupportTickets(db, { id })
    if (!ticket) throw errors.notFound('Tiket')
    return ticket
  }
  const field = (body: unknown, key: string) => (body as Record<string, unknown> | undefined)?.[key]

  return new Elysia({ prefix: '/api/v1' })
    .get('/support-tickets', async ({ request, query }) => {
      await auth.requireCapability(request, CAP)
      for (const k of ['partyId', 'assignedTo'] as const) {
        if (query[k] && !ID_PATTERN.test(query[k]!)) throw errors.validation({ [k]: ['ID tidak valid.'] })
      }
      return ok(request, await listSupportTickets(db, { status: query.status, partyId: query.partyId, assignedTo: query.assignedTo }))
    }, { query: t.Object({ status: t.Optional(t.String()), partyId: t.Optional(t.String()), assignedTo: t.Optional(t.String()) }) })
    .get('/support-tickets/:id', async ({ request, params }) => {
      await auth.requireCapability(request, CAP)
      return ok(request, await view(assertIdParam(params.id, 'Tiket')))
    })
    .post('/support-tickets/:id/assign', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Tiket')
      await db.transaction(tx => staffAssignTicket(tx, actor, id, field(body, 'userId'), requestIdOf(request)))
      return ok(request, await view(id))
    }, anyBody)
    .post('/support-tickets/:id/status', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Tiket')
      await db.transaction(tx => staffSetTicketStatus(tx, actor, id, field(body, 'to'), requestIdOf(request)))
      return ok(request, await view(id))
    }, anyBody)
    .post('/support-tickets/:id/replies', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Tiket')
      const key = requireIdempotencyKey(request)
      await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /support-tickets/:id/replies', key, body: { id, ...(body as object) } }, tx =>
        staffReplyTicket(tx, actor, id, (body ?? {}) as Record<string, unknown>, requestIdOf(request)))
      set.status = 201
      return ok(request, await view(id))
    }, anyBody)
    .post('/support-tickets/:id/resolve', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Tiket')
      await db.transaction(tx => staffResolveTicket(tx, actor, id, field(body, 'note'), requestIdOf(request)))
      return ok(request, await view(id))
    }, anyBody)
    .post('/support-tickets/:id/close', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Tiket')
      await db.transaction(tx => staffCloseTicket(tx, actor, id, requestIdOf(request)))
      return ok(request, await view(id))
    }, anyBody)
}
