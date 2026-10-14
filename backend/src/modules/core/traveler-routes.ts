import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext, SessionActor } from '../../auth/context'
import { assertIdParam, ID_PATTERN, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { businessDateOf } from '../../shared/dates'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { getProject } from './repository'
import { clientTraveler, forReader, readerScopeOf } from './client-scope'
import {
  cancelTraveler, createGroup, createRoom, createTraveler, deleteRoom, deleteTraveler, importTravelers, listRoomAssignments, replaceTraveler, setRoomTravelers, listTravelerGroups, listTravelers, setVerified, setVip, updateGroup, updateTraveler
} from './travelers'

/** Travelers, groups and rooming (S7a). Internal roles read everything; `project-order.manage-travelers` writes. */
export function travelerRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const CAP = 'project-order.manage-travelers' as const

  /** Internal roles read every party; a client only its own (S12a); vendors are refused. */
  const readScope = async (request: Request) => readerScopeOf(await auth.requireActor(request))

  async function visibleProject(actor: SessionActor, raw: string) {
    const id = assertIdParam(raw, 'Project')
    if (!(await getProject(db, actor, id))) throw errors.notFound('Project')
    return id
  }

  const projectQuery = (projectId?: string) => {
    if (projectId && !ID_PATTERN.test(projectId)) throw errors.validation({ projectId: ['ID tidak valid.'] })
    return projectId
  }

  async function travelerResponse(id: string) {
    const [tr] = await listTravelers(db, { id })
    if (!tr) throw errors.notFound('Traveler')
    return tr
  }

  async function groupResponse(id: string) {
    const g = (await listTravelerGroups(db)).find(x => x.id === id)
    if (!g) throw errors.notFound('Grup')
    return g
  }

  return new Elysia({ prefix: '/api/v1' })
    .get('/travelers', async ({ request, query }) => {
      const scope = await readScope(request)
      return ok(request, forReader(scope, await listTravelers(db, { projectId: projectQuery(query.projectId), partyId: scope.partyId }), clientTraveler))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
    .get('/travelers/:id', async ({ request, params }) => {
      const scope = await readScope(request)
      const [tr] = await listTravelers(db, { id: assertIdParam(params.id, 'Traveler'), partyId: scope.partyId })
      if (!tr) throw errors.notFound('Traveler')
      return ok(request, forReader(scope, [tr], clientTraveler)[0])
    })
    .post('/projects/:id/travelers', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, CAP)
      const projectId = await visibleProject(actor, params.id)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects/:id/travelers', key, body: { projectId, ...(body as object) } }, tx =>
        createTraveler(tx, actor, projectId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await travelerResponse(result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/travelers/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Traveler')
      await db.transaction(tx => updateTraveler(tx, actor, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await travelerResponse(id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .delete('/travelers/:id', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Traveler')
      await db.transaction(tx => deleteTraveler(tx, actor, id, requestIdOf(request)))
      return ok(request, { id, deleted: true })
    })
    .post('/travelers/:id/verify', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Traveler')
      await db.transaction(tx => setVerified(tx, actor, id, (body as Record<string, unknown> | undefined)?.verified, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await travelerResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/travelers/:id/vip', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Traveler')
      await db.transaction(tx => setVip(tx, actor, id, (body as Record<string, unknown> | undefined)?.isVip, requestIdOf(request)))
      return ok(request, await travelerResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .get('/traveler-groups', async ({ request, query }) => {
      const scope = await readScope(request)
      return ok(request, await listTravelerGroups(db, projectQuery(query.projectId), scope.partyId))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
    .post('/projects/:id/traveler-groups', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, CAP)
      const projectId = await visibleProject(actor, params.id)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects/:id/traveler-groups', key, body: { projectId, ...(body as object) } }, tx =>
        createGroup(tx, actor, projectId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await groupResponse(result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/traveler-groups/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Grup')
      await db.transaction(tx => updateGroup(tx, actor, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await groupResponse(id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/travelers/:id/cancel', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Traveler')
      await db.transaction(tx => cancelTraveler(tx, actor, id, (body as Record<string, unknown> | undefined)?.reason, requestIdOf(request)))
      return ok(request, await travelerResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/travelers/:id/replace', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Traveler')
      const result = await db.transaction(tx => replaceTraveler(tx, actor, id, (body ?? {}) as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await travelerResponse(result.id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/projects/:id/travelers/import', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, CAP)
      const projectId = await visibleProject(actor, params.id)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects/:id/travelers/import', key, body: { projectId, ...(body as object) } }, tx =>
        importTravelers(tx, actor, projectId, (body as Record<string, unknown>).rows, requestIdOf(request)))
      set.status = 201
      const all = await listTravelers(db, { projectId })
      return ok(request, { created: all.filter(x => result.data.created.includes(x.id)), rejected: result.data.rejected })
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/projects/:id/room-assignments', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, CAP)
      const projectId = await visibleProject(actor, params.id)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects/:id/room-assignments', key, body: { projectId, ...(body as object) } }, tx =>
        createRoom(tx, actor, projectId, body as Record<string, unknown>, requestIdOf(request)))
      set.status = 201
      return ok(request, (await listRoomAssignments(db, { id: result.data.id }))[0])
    }, { body: t.Record(t.String(), t.Unknown()) })
    .put('/room-assignments/:id/travelers', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Kamar')
      await db.transaction(tx => setRoomTravelers(tx, actor, id, (body as Record<string, unknown> | undefined)?.travelerIds, requestIdOf(request)))
      return ok(request, (await listRoomAssignments(db, { id }))[0])
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .delete('/room-assignments/:id', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Kamar')
      await db.transaction(tx => deleteRoom(tx, actor, id, requestIdOf(request)))
      return ok(request, { id, deleted: true })
    })
    .get('/room-assignments', async ({ request, query }) => {
      const scope = await readScope(request)
      return ok(request, await listRoomAssignments(db, { projectId: projectQuery(query.projectId), partyId: scope.partyId }))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
}
