import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ID_PATTERN, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { decideChange, listActivities, logChange, markReviewed } from './activities'
import { getProject } from './repository'
import { isPortalActor } from './scope'

/** Project activity log (S7d). Internal roles read; `log-change` logs a change; `review-change` decides and reviews. */
export function activityRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const anyBody = { body: t.Optional(t.Record(t.String(), t.Unknown())) }

  async function activityResponse(id: string) {
    const [a] = await listActivities(db, { id })
    if (!a) throw errors.notFound('Aktivitas')
    return a
  }

  return new Elysia({ prefix: '/api/v1' })
    .get('/project-activities', async ({ request, query }) => {
      const actor = await auth.requireActor(request)
      if (isPortalActor(actor)) throw errors.forbidden()
      if (query.projectId && !ID_PATTERN.test(query.projectId)) throw errors.validation({ projectId: ['ID tidak valid.'] })
      return ok(request, await listActivities(db, { projectId: query.projectId }))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
    .post('/projects/:id/changes', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'project-order.log-change')
      const projectId = assertIdParam(params.id, 'Project')
      if (!(await getProject(db, actor, projectId))) throw errors.notFound('Project')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects/:id/changes', key, body: { projectId, ...(body as object) } }, tx =>
        logChange(tx, actor, projectId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await activityResponse(result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/project-activities/:id/approve', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'project-order.review-change')
      const id = assertIdParam(params.id, 'Aktivitas')
      await db.transaction(tx => decideChange(tx, actor, id, 'approved', requestIdOf(request)))
      return ok(request, await activityResponse(id))
    }, anyBody)
    .post('/project-activities/:id/reject', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'project-order.review-change')
      const id = assertIdParam(params.id, 'Aktivitas')
      await db.transaction(tx => decideChange(tx, actor, id, 'rejected', requestIdOf(request)))
      return ok(request, await activityResponse(id))
    }, anyBody)
    .post('/project-activities/:id/review', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'project-order.review-change')
      const id = assertIdParam(params.id, 'Aktivitas')
      await db.transaction(tx => markReviewed(tx, actor, id, requestIdOf(request)))
      return ok(request, await activityResponse(id))
    }, anyBody)
}
