import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { hasModuleLevel } from '../../auth/rbac'
import { assertIdParam, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { businessDateOf } from '../../shared/dates'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { isPortalActor } from './scope'
import {
  clientAnswerClarification, clientApprovalView, clientCancelTravelRequest, clientCreateTravelRequest, clientDecideApproval, clientDuplicateTravelRequest,
  clientSubmitTravelRequest, clientTravelRequest, clientUpdateTravelRequest, listClientApprovals, listTravelRequests, staffAskClarification,
  staffCloseTravelRequest, staffConvertTravelRequest, staffRequestApproval, staffReviewTravelRequest
} from './travel-requests'

/** S12c-3: travel requests (client ⇄ sales) and client approvals (staff ask, the client decides). */
export function travelRequestRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const body = { body: t.Record(t.String(), t.Unknown()) }
  const anyBody = { body: t.Optional(t.Record(t.String(), t.Unknown())) }
  const field = (b: unknown, key: string) => (b as Record<string, unknown> | undefined)?.[key]

  async function clientActor(request: Request) {
    const actor = await auth.requireActor(request)
    if (actor.role !== 'client') throw errors.forbidden()
    return { actor, partyId: actor.partyId ?? '__no-party__' }
  }
  const clientView = async (partyId: string, id: string) => clientTravelRequest((await listTravelRequests(db, { id, partyId }))[0]!)
  const staffView = async (id: string) => {
    const [r] = await listTravelRequests(db, { id, staff: true })
    if (!r) throw errors.notFound('Travel request')
    return r
  }
  const approvalView = async (id: string) => (await listClientApprovals(db, { id }))[0]!

  const client = new Elysia({ prefix: '/api/v1/client' })
    .get('/travel-requests', async ({ request }) => {
      const { partyId } = await clientActor(request)
      return ok(request, (await listTravelRequests(db, { partyId })).map(clientTravelRequest))
    })
    .post('/travel-requests', async ({ request, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/travel-requests', key, body }, tx =>
        clientCreateTravelRequest(tx, actor, partyId, body as Record<string, unknown>, requestIdOf(request)))
      set.status = 201
      return ok(request, await clientView(partyId, result.data.id))
    }, body)
    .patch('/travel-requests/:id', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Travel request')
      await db.transaction(tx => clientUpdateTravelRequest(tx, actor, partyId, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await clientView(partyId, id))
    }, body)
    .post('/travel-requests/:id/duplicate', async ({ request, params, set }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Travel request')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/travel-requests/:id/duplicate', key, body: { id } }, tx =>
        clientDuplicateTravelRequest(tx, actor, partyId, id, requestIdOf(request)))
      set.status = 201
      return ok(request, await clientView(partyId, result.data.id))
    }, anyBody)
    .post('/travel-requests/:id/cancel', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Travel request')
      await db.transaction(tx => clientCancelTravelRequest(tx, actor, partyId, id, field(body, 'reason'), requestIdOf(request)))
      return ok(request, await clientView(partyId, id))
    }, anyBody)
    .post('/travel-requests/:id/submit', async ({ request, params }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Travel request')
      await db.transaction(tx => clientSubmitTravelRequest(tx, actor, partyId, id, requestIdOf(request)))
      return ok(request, await clientView(partyId, id))
    }, anyBody)
    .post('/travel-requests/:id/clarification', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Travel request')
      await db.transaction(tx => clientAnswerClarification(tx, actor, partyId, id, field(body, 'message'), requestIdOf(request)))
      return ok(request, await clientView(partyId, id))
    }, anyBody)
    .get('/approvals', async ({ request }) => {
      const { partyId } = await clientActor(request)
      return ok(request, (await listClientApprovals(db, { partyId })).map(clientApprovalView))
    })
    .post('/approvals/:id/:decision', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Persetujuan')
      const decision = ({ approve: 'approved', reject: 'rejected', 'request-revision': 'revision-requested' } as const)[params.decision as 'approve']
      if (!decision) throw errors.notFound('Route')
      await db.transaction(tx => clientDecideApproval(tx, actor, partyId, id, decision, (body ?? {}) as Record<string, unknown>, requestIdOf(request)))
      return ok(request, clientApprovalView(await approvalView(id)))
    }, anyBody)

  const staff = new Elysia({ prefix: '/api/v1' })
    .get('/travel-requests', async ({ request, query }) => {
      const actor = await auth.requireActor(request)
      if (isPortalActor(actor) || !hasModuleLevel(actor.role, 'sales', 'VIEW')) throw errors.forbidden()
      return ok(request, await listTravelRequests(db, { status: query.status, staff: true }))
    }, { query: t.Object({ status: t.Optional(t.String()) }) })
    .get('/travel-requests/:id', async ({ request, params }) => {
      const actor = await auth.requireActor(request)
      if (isPortalActor(actor) || !hasModuleLevel(actor.role, 'sales', 'VIEW')) throw errors.forbidden()
      return ok(request, await staffView(assertIdParam(params.id, 'Travel request')))
    })
    .post('/travel-requests/:id/review', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Travel request')
      await db.transaction(tx => staffReviewTravelRequest(tx, actor, id, requestIdOf(request)))
      return ok(request, await staffView(id))
    }, anyBody)
    .post('/travel-requests/:id/clarify', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Travel request')
      await db.transaction(tx => staffAskClarification(tx, actor, id, field(body, 'note'), requestIdOf(request)))
      return ok(request, await staffView(id))
    }, anyBody)
    .post('/travel-requests/:id/convert', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Travel request')
      await db.transaction(tx => staffConvertTravelRequest(tx, actor, id, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await staffView(id))
    }, anyBody)
    .post('/travel-requests/:id/close', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Travel request')
      await db.transaction(tx => staffCloseTravelRequest(tx, actor, id, field(body, 'reason'), requestIdOf(request)))
      return ok(request, await staffView(id))
    }, anyBody)
    .get('/client-approvals', async ({ request, query }) => {
      const actor = await auth.requireActor(request)
      if (isPortalActor(actor) || !hasModuleLevel(actor.role, 'operations', 'VIEW')) throw errors.forbidden()
      return ok(request, await listClientApprovals(db, { projectId: query.projectId }))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
    .post('/projects/:id/client-approvals', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'project-order.manage-operations')
      const projectId = assertIdParam(params.id, 'Project')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects/:id/client-approvals', key, body: { projectId, ...(body as object) } }, tx =>
        staffRequestApproval(tx, actor, projectId, body as Record<string, unknown>, requestIdOf(request)))
      set.status = 201
      return ok(request, await approvalView(result.data.id))
    }, body)

  return new Elysia().use(client).use(staff)
}
