import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ID_PATTERN, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { createItineraryItem, deleteItineraryItem, listItineraryItems, updateItineraryItem } from './itinerary'
import { getProject } from './repository'
import { isPortalActor } from './scope'

/** Daily itinerary items (S7b). Internal roles read; `project-order.manage-operations` writes. */
export function itineraryRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const CAP = 'project-order.manage-operations' as const

  async function itemResponse(id: string) {
    const [item] = await listItineraryItems(db, { id })
    if (!item) throw errors.notFound('Item itinerary')
    return item
  }

  return new Elysia({ prefix: '/api/v1' })
    .get('/itinerary-items', async ({ request, query }) => {
      const actor = await auth.requireActor(request)
      if (isPortalActor(actor)) throw errors.forbidden()
      if (query.projectId && !ID_PATTERN.test(query.projectId)) throw errors.validation({ projectId: ['ID tidak valid.'] })
      return ok(request, await listItineraryItems(db, { projectId: query.projectId }))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
    .post('/projects/:id/itinerary-items', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, CAP)
      const projectId = assertIdParam(params.id, 'Project')
      if (!(await getProject(db, actor, projectId))) throw errors.notFound('Project')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects/:id/itinerary-items', key, body: { projectId, ...(body as object) } }, tx =>
        createItineraryItem(tx, actor, projectId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await itemResponse(result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/itinerary-items/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Item itinerary')
      await db.transaction(tx => updateItineraryItem(tx, actor, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await itemResponse(id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .delete('/itinerary-items/:id', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Item itinerary')
      await db.transaction(tx => deleteItineraryItem(tx, actor, id, requestIdOf(request)))
      return ok(request, { id, deleted: true })
    })
}
