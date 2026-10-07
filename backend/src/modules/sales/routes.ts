import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext, SessionActor } from '../../auth/context'
import { assertIdParam, ID_PATTERN, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { businessDateOf } from '../../shared/dates'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { getProject } from '../core/repository'
import { isPortalActor } from '../core/scope'
import { addLeadActivity, archiveLead, completeLeadActivity, createLead, mergeLead, reopenLead, unqualifyLead, updateLead } from './lead-writes'
import { qualifyGroupTrip, qualifyLead } from './qualify'
import { createQuotation, decideQuotation, reviseQuotation, sendQuotation, submitQuotation, updateQuotation, withdrawQuotation } from './quotation-writes'
import { listLeads, listSalesQuotations } from './repository'
import { changeSalesOrderStatus, createSalesOrder, listSalesOrders, projectSeats } from './sales-orders'
import { markLeadWon } from './won'

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

  async function salesOrderResponse(id: string) {
    const [so] = await listSalesOrders(db, { id })
    if (!so) throw errors.notFound('Sales order')
    return so
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
    .post('/leads/:id/qualify', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Lead')
      const b = (body ?? {}) as Record<string, unknown>
      await db.transaction(tx => qualifyLead(tx, actor, id, { customerKind: b.customerKind, partyId: b.partyId, priceMinor: b.priceMinor, travelerCount: b.travelerCount }, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await leadResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/leads/:id/group-trip', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Lead')
      const result = await db.transaction(tx => qualifyGroupTrip(tx, actor, id, (body ?? {}) as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, { outcome: result.outcome, lead: await leadResponse(id), salesOrder: result.salesOrderId ? await salesOrderResponse(result.salesOrderId) : null })
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/leads/:id/won', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'sales.mark-won')
      const leadId = assertIdParam(params.id, 'Lead')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /leads/:id/won', key, body: { leadId, ...((body ?? {}) as object) } }, tx =>
        markLeadWon(tx, actor, leadId, businessDateOf(new Date()), requestIdOf(request)))
      set.status = result.data.created && !result.replayed ? 201 : 200
      return ok(request, { project: await getProject(db, actor, result.data.projectId), lead: await leadResponse(leadId) })
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
    .post('/leads/:id/quotation', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const leadId = assertIdParam(params.id, 'Lead')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /leads/:id/quotation', key, body: { leadId, ...(body as object) } }, tx =>
        createQuotation(tx, actor, leadId, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await quotationResponse(result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/quotations/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Quotation')
      await db.transaction(tx => updateQuotation(tx, actor, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await quotationResponse(id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/quotations/:id/:action', async ({ request, params, body }) => {
      const decision = params.action === 'approve' || params.action === 'reject'
      const actor = await auth.requireCapability(request, decision ? 'sales.approve-quotation' : 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Quotation')
      const b = (body ?? {}) as Record<string, unknown>
      const today = businessDateOf(new Date())
      const rid = requestIdOf(request)
      switch (params.action) {
        case 'revise': await db.transaction(tx => reviseQuotation(tx, actor, id, b, today, rid)); break
        case 'submit': await db.transaction(tx => submitQuotation(tx, actor, id, today, rid)); break
        case 'withdraw': await db.transaction(tx => withdrawQuotation(tx, actor, id, rid)); break
        case 'approve': await db.transaction(tx => decideQuotation(tx, actor, id, 'approve', b.note, today, rid)); break
        case 'reject': await db.transaction(tx => decideQuotation(tx, actor, id, 'reject', b.note, today, rid)); break
        case 'send': await db.transaction(tx => sendQuotation(tx, actor, id, today, rid)); break
        default: throw errors.notFound('Aksi')
      }
      return ok(request, await quotationResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .get('/sales-orders', async ({ request, query }) => {
      await readActor(request)
      if (query.projectId && !ID_PATTERN.test(query.projectId)) throw errors.validation({ projectId: ['ID tidak valid.'] })
      return ok(request, await listSalesOrders(db, { projectId: query.projectId }))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
    .get('/sales-orders/:id', async ({ request, params }) => {
      await readActor(request)
      return ok(request, await salesOrderResponse(assertIdParam(params.id, 'Sales order')))
    })
    .post('/sales-orders', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /sales-orders', key, body }, tx =>
        createSalesOrder(tx, actor, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await salesOrderResponse(result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/sales-orders/:id/status', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'sales.manage-lead')
      const id = assertIdParam(params.id, 'Sales order')
      const b = (body ?? {}) as Record<string, unknown>
      await db.transaction(tx => changeSalesOrderStatus(tx, actor, id, b.to, b.reason, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, await salesOrderResponse(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .get('/projects/:id/seats', async ({ request, params }) => {
      await readActor(request)
      return ok(request, await projectSeats(db, assertIdParam(params.id, 'Project')))
    })
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
