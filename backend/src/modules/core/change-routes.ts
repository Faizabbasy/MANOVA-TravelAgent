import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ID_PATTERN, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { createChangeRequest, decideChangeRequest, implementChangeRequest, listChangeRequests, reviewChangeRequest } from './change-requests'
import { addIncidentCommunication, changeIncidentStatus, createIncident, escalateIncident, listIncidents, resolveIncident } from './incidents'
import { getProject } from './repository'
import { isPortalActor } from './scope'

/**
 * Change requests, incidents and non-Finance cancellations (S8). Internal roles read; `log-change` logs and works
 * incidents; `review-change` reviews and decides change requests.
 */
export function changeRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const LOG = 'project-order.log-change' as const
  const REVIEW = 'project-order.review-change' as const
  const anyBody = { body: t.Optional(t.Record(t.String(), t.Unknown())) }
  const projectQuery = { query: t.Object({ projectId: t.Optional(t.String()) }) }

  async function readActor(request: Request) {
    const actor = await auth.requireActor(request)
    if (isPortalActor(actor)) throw errors.forbidden()
    return actor
  }
  const checkProjectQuery = (projectId?: string) => {
    if (projectId && !ID_PATTERN.test(projectId)) throw errors.validation({ projectId: ['ID tidak valid.'] })
    return projectId
  }
  async function visibleProject(actor: Awaited<ReturnType<typeof readActor>>, raw: string) {
    const id = assertIdParam(raw, 'Project')
    if (!(await getProject(db, actor, id))) throw errors.notFound('Project')
    return id
  }
  async function incidentResponse(id: string) {
    const [inc] = await listIncidents(db, { id })
    if (!inc) throw errors.notFound('Insiden')
    return inc
  }
  async function requestResponse(id: string) {
    const [cr] = await listChangeRequests(db, { id })
    if (!cr) throw errors.notFound('Change request')
    return cr
  }

  return new Elysia({ prefix: '/api/v1' })
    .get('/change-requests', async ({ request, query }) => {
      await readActor(request)
      return ok(request, await listChangeRequests(db, { projectId: checkProjectQuery(query.projectId) }))
    }, projectQuery)
    .post('/projects/:id/change-requests', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, LOG)
      const projectId = await visibleProject(actor, params.id)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects/:id/change-requests', key, body: { projectId, ...(body as object) } }, tx =>
        createChangeRequest(tx, actor, projectId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await requestResponse(result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/change-requests/:id/review', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, REVIEW)
      const id = assertIdParam(params.id, 'Change request')
      await db.transaction(tx => reviewChangeRequest(tx, actor, id, requestIdOf(request)))
      return ok(request, await requestResponse(id))
    }, anyBody)
    .post('/change-requests/:id/approve', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, REVIEW)
      const id = assertIdParam(params.id, 'Change request')
      await db.transaction(tx => decideChangeRequest(tx, actor, id, 'approved', null, requestIdOf(request)))
      return ok(request, await requestResponse(id))
    }, anyBody)
    .post('/change-requests/:id/reject', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, REVIEW)
      const id = assertIdParam(params.id, 'Change request')
      await db.transaction(tx => decideChangeRequest(tx, actor, id, 'rejected', (body as Record<string, unknown> | undefined)?.reason, requestIdOf(request)))
      return ok(request, await requestResponse(id))
    }, anyBody)
    .post('/change-requests/:id/implement', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, LOG)
      const id = assertIdParam(params.id, 'Change request')
      await db.transaction(tx => implementChangeRequest(tx, actor, id, requestIdOf(request)))
      return ok(request, await requestResponse(id))
    }, anyBody)
    .get('/incidents', async ({ request, query }) => {
      await readActor(request)
      return ok(request, await listIncidents(db, { projectId: checkProjectQuery(query.projectId) }))
    }, projectQuery)
    .post('/projects/:id/incidents', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, LOG)
      const projectId = await visibleProject(actor, params.id)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects/:id/incidents', key, body: { projectId, ...(body as object) } }, tx =>
        createIncident(tx, actor, projectId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await incidentResponse(result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/incidents/:id/status', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, LOG)
      const id = assertIdParam(params.id, 'Insiden')
      const b = (body ?? {}) as Record<string, unknown>
      await db.transaction(tx => changeIncidentStatus(tx, actor, id, b.to, requestIdOf(request)))
      return ok(request, await incidentResponse(id))
    }, anyBody)
    .post('/incidents/:id/escalate', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, LOG)
      const id = assertIdParam(params.id, 'Insiden')
      const b = (body ?? {}) as Record<string, unknown>
      await db.transaction(tx => escalateIncident(tx, actor, id, b, requestIdOf(request)))
      return ok(request, await incidentResponse(id))
    }, anyBody)
    .post('/incidents/:id/communications', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, LOG)
      const id = assertIdParam(params.id, 'Insiden')
      const b = (body ?? {}) as Record<string, unknown>
      await db.transaction(tx => addIncidentCommunication(tx, actor, id, b.message, requestIdOf(request)))
      return ok(request, await incidentResponse(id))
    }, anyBody)
    .post('/incidents/:id/resolve', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, LOG)
      const id = assertIdParam(params.id, 'Insiden')
      const b = (body ?? {}) as Record<string, unknown>
      await db.transaction(tx => resolveIncident(tx, actor, id, b.note, requestIdOf(request)))
      return ok(request, await incidentResponse(id))
    }, anyBody)
}
