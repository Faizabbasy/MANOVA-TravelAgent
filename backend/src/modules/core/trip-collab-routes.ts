import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { hasModuleLevel } from '../../auth/rbac'
import { assertIdParam, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { isPortalActor } from './scope'
import {
  clientAnnouncement, clientDecideItineraryVersion, clientItineraryVersion, confirmAnnouncement, listAnnouncements, listItineraryVersions,
  publishAnnouncement, publishItineraryVersion
} from './trip-collab'

/** S12c-4: itinerary versions (staff publish, client decides) and trip announcements (staff publish, client confirms). */
export function tripCollabRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const CAP = 'project-order.manage-operations' as const
  const anyBody = { body: t.Optional(t.Record(t.String(), t.Unknown())) }
  const field = (b: unknown, key: string) => (b as Record<string, unknown> | undefined)?.[key]

  async function clientActor(request: Request) {
    const actor = await auth.requireActor(request)
    if (actor.role !== 'client') throw errors.forbidden()
    return { actor, partyId: actor.partyId ?? '__no-party__' }
  }
  async function staffReader(request: Request) {
    const actor = await auth.requireActor(request)
    if (isPortalActor(actor) || !hasModuleLevel(actor.role, 'operations', 'VIEW')) throw errors.forbidden()
    return actor
  }

  const client = new Elysia({ prefix: '/api/v1/client' })
    .get('/itinerary-versions', async ({ request }) => {
      const { partyId } = await clientActor(request)
      return ok(request, (await listItineraryVersions(db, { partyId })).map(clientItineraryVersion))
    })
    .post('/itinerary-versions/:id/:decision', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Versi itinerary')
      const decision = ({ approve: 'approved', 'request-revision': 'revision-requested' } as const)[params.decision as 'approve']
      if (!decision) throw errors.notFound('Route')
      await db.transaction(tx => clientDecideItineraryVersion(tx, actor, partyId, id, decision, field(body, 'comment'), requestIdOf(request)))
      return ok(request, clientItineraryVersion((await listItineraryVersions(db, { id }))[0]!))
    }, anyBody)
    .get('/announcements', async ({ request }) => {
      const { actor, partyId } = await clientActor(request)
      return ok(request, (await listAnnouncements(db, { partyId })).map(a => clientAnnouncement(a, actor.userId)))
    })
    .post('/announcements/:id/confirm', async ({ request, params }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Pengumuman')
      await db.transaction(tx => confirmAnnouncement(tx, actor, partyId, id, requestIdOf(request)))
      return ok(request, clientAnnouncement((await listAnnouncements(db, { id }))[0]!, actor.userId))
    }, anyBody)

  const staff = new Elysia({ prefix: '/api/v1' })
    .get('/itinerary-versions', async ({ request, query }) => {
      await staffReader(request)
      return ok(request, await listItineraryVersions(db, { projectId: query.projectId }))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
    .post('/projects/:id/itinerary-versions', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, CAP)
      const projectId = assertIdParam(params.id, 'Project')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects/:id/itinerary-versions', key, body: { projectId, ...(body ?? {}) } }, tx =>
        publishItineraryVersion(tx, actor, projectId, field(body, 'note'), requestIdOf(request)))
      set.status = 201
      return ok(request, (await listItineraryVersions(db, { id: result.data.id }))[0]!)
    }, anyBody)
    .get('/announcements', async ({ request, query }) => {
      await staffReader(request)
      return ok(request, await listAnnouncements(db, { projectId: query.projectId }))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
    .post('/projects/:id/announcements', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, CAP)
      const projectId = assertIdParam(params.id, 'Project')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects/:id/announcements', key, body: { projectId, ...(body ?? {}) } }, tx =>
        publishAnnouncement(tx, actor, projectId, (body ?? {}) as Record<string, unknown>, requestIdOf(request)))
      set.status = 201
      return ok(request, (await listAnnouncements(db, { id: result.data.id }))[0]!)
    }, anyBody)

  return new Elysia().use(client).use(staff)
}
