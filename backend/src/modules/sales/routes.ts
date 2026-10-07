import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext, SessionActor } from '../../auth/context'
import { assertIdParam, ID_PATTERN, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { businessDateOf } from '../../shared/dates'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { isPortalActor } from '../core/scope'
import { addLeadActivity, archiveLead, completeLeadActivity, createLead, mergeLead, reopenLead, unqualifyLead, updateLead } from './lead-writes'
import { listLeads, listSalesQuotations } from './repository'

/** Sales (S6a): leads, client quotations and Won. Internal roles read; Sales (admin) writes; portals never see leads. */
export function salesRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps

  async function readActor(request: Request): Promise<SessionActor> {
    const actor = await auth.requireActor(request)
    if (isPortalActor(actor)) throw errors.forbidden()
    return actor
  }

  async function leadResponse(id: string) {
    const [lead] = await listLeads(db, { id })
    if (!lead) throw errors.notFound('Lead')
    return lead
  }

  async function quotationResponse(id: string) {
    const [q] = await listSalesQuotations(db, { id })
    if (!q) throw errors.notFound('Quotation')
    return q
  }

  return new Elysia({ prefix: '/api/v1' })
    .get('/leads', async ({ request }) => {
      await readActor(request)
      return ok(request, await listLeads(db))
    })
    .get('/leads/:id', async ({ request, params }) => {
      await readActor(request)
      return ok(request, await leadResponse(assertIdParam(params.id, 'Lead')))
    })
    .post('/leads', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /leads', key, body }, tx =>
        createLead(tx, actor, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await leadResponse(result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/leads/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Lead')
      await db.transaction(tx => updateLead(tx, actor, id, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await leadResponse(id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/leads/:id/archive', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Lead')
      await db.transaction(tx => archiveLead(tx, actor, id, (body as Record<string, unknown> | undefined)?.reason, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await leadResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/leads/:id/reopen', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Lead')
      await db.transaction(tx => reopenLead(tx, actor, id, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await leadResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/leads/:id/unqualify', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Lead')
      await db.transaction(tx => unqualifyLead(tx, actor, id, (body as Record<string, unknown> | undefined)?.reason, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await leadResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/leads/:id/merge', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Lead')
      await db.transaction(tx => mergeLead(tx, actor, id, (body as Record<string, unknown> | undefined)?.intoLeadId, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await leadResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/leads/:id/activities', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'crm.manage-follow-up')
      const id = assertIdParam(params.id, 'Lead')
      await db.transaction(tx => addLeadActivity(tx, actor, id, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      set.status = 201
      return ok(request, await leadResponse(id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/leads/:id/activities/:activityId/done', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'crm.manage-follow-up')
      const id = assertIdParam(params.id, 'Lead')
      const activityId = assertIdParam(params.activityId, 'Aktivitas')
      await db.transaction(tx => completeLeadActivity(tx, actor, id, activityId, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await leadResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .get('/quotations', async ({ request, query }) => {
      await readActor(request)
      if (query.leadId && !ID_PATTERN.test(query.leadId)) throw errors.validation({ leadId: ['ID tidak valid.'] })
      return ok(request, await listSalesQuotations(db, { leadId: query.leadId }))
    }, { query: t.Object({ leadId: t.Optional(t.String()) }) })
    .get('/quotations/:id', async ({ request, params }) => {
      await readActor(request)
      return ok(request, await quotationResponse(assertIdParam(params.id, 'Quotation')))
    })
}
