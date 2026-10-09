import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ID_PATTERN, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { businessDateOf } from '../../shared/dates'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { addDeliverable, completeMilestone, createMilestone, listMilestones, removeDeliverable, replaceMilestones, setDeliverableDone, updateMilestone } from './milestones'
import { getProject } from './repository'
import { isPortalActor } from './scope'
import { blockTask, createTask, listTasks, unblockTask, updateTask } from './tasks'

/** Project tasks and milestones (S7c). Internal roles read; `project-order.manage-operations` writes. */
export function workItemRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const CAP = 'project-order.manage-operations' as const
  const anyBody = { body: t.Optional(t.Record(t.String(), t.Unknown())) }

  async function readActor(request: Request) {
    const actor = await auth.requireActor(request)
    if (isPortalActor(actor)) throw errors.forbidden()
    return actor
  }

  const projectQuery = (projectId?: string) => {
    if (projectId && !ID_PATTERN.test(projectId)) throw errors.validation({ projectId: ['ID tidak valid.'] })
    return projectId
  }

  async function visibleProject(actor: Awaited<ReturnType<typeof readActor>>, raw: string) {
    const id = assertIdParam(raw, 'Project')
    if (!(await getProject(db, actor, id))) throw errors.notFound('Project')
    return id
  }

  async function milestoneResponse(id: string) {
    const [milestone] = await listMilestones(db, { id })
    if (!milestone) throw errors.notFound('Milestone')
    return milestone
  }

  async function taskResponse(id: string) {
    const [task] = await listTasks(db, { id })
    if (!task) throw errors.notFound('Task')
    return task
  }

  return new Elysia({ prefix: '/api/v1' })
    .get('/tasks', async ({ request, query }) => {
      await readActor(request)
      return ok(request, await listTasks(db, { projectId: projectQuery(query.projectId) }))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
    .post('/tasks', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, CAP)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /tasks', key, body }, tx =>
        createTask(tx, actor, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await taskResponse(result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/tasks/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Task')
      await db.transaction(tx => updateTask(tx, actor, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await taskResponse(id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/tasks/:id/block', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Task')
      await db.transaction(tx => blockTask(tx, actor, id, (body as Record<string, unknown> | undefined)?.reason, requestIdOf(request)))
      return ok(request, await taskResponse(id))
    }, anyBody)
    .post('/tasks/:id/unblock', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Task')
      await db.transaction(tx => unblockTask(tx, actor, id, requestIdOf(request)))
      return ok(request, await taskResponse(id))
    }, anyBody)
    .get('/milestones', async ({ request, query }) => {
      await readActor(request)
      return ok(request, await listMilestones(db, { projectId: projectQuery(query.projectId) }))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
    .post('/projects/:id/milestones', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, CAP)
      const projectId = await visibleProject(actor, params.id)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects/:id/milestones', key, body: { projectId, ...(body as object) } }, tx =>
        createMilestone(tx, actor, projectId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await milestoneResponse(result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/projects/:id/milestones/replace', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const projectId = await visibleProject(actor, params.id)
      await db.transaction(tx => replaceMilestones(tx, actor, projectId, (body as Record<string, unknown> | undefined)?.milestones, requestIdOf(request)))
      return ok(request, await listMilestones(db, { projectId }))
    }, anyBody)
    .patch('/milestones/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Milestone')
      await db.transaction(tx => updateMilestone(tx, actor, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await milestoneResponse(id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/milestones/:id/complete', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Milestone')
      await db.transaction(tx => completeMilestone(tx, actor, id, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await milestoneResponse(id))
    }, anyBody)
    .post('/milestones/:id/deliverables', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Milestone')
      await db.transaction(tx => addDeliverable(tx, actor, id, (body as Record<string, unknown> | undefined)?.label, requestIdOf(request)))
      return ok(request, await milestoneResponse(id))
    }, anyBody)
    .patch('/milestones/:id/deliverables/:deliverableId', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Milestone')
      await db.transaction(tx => setDeliverableDone(tx, actor, id, params.deliverableId, (body as Record<string, unknown> | undefined)?.done, requestIdOf(request)))
      return ok(request, await milestoneResponse(id))
    }, anyBody)
    .delete('/milestones/:id/deliverables/:deliverableId', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Milestone')
      await db.transaction(tx => removeDeliverable(tx, actor, id, params.deliverableId, requestIdOf(request)))
      return ok(request, await milestoneResponse(id))
    })
}
