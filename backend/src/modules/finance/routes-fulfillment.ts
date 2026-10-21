import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext, SessionActor } from '../../auth/context'
import { hasCapability } from '../../auth/rbac'
import { assertIdParam, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import {
  createSupplierClaim, fulfillmentOverview, listSupplierClaims, postVendorRefund, recordFulfillment, voidFulfillment, voidSupplierClaim
} from './fulfillments'

/**
 * Owner accounting source actions on the Finance namespace (F2/F3):
 *  - "Jasa diberikan" (customer fulfillment) = finance.manage-receivables · "Jasa supplier diterima" = finance.manage-payables
 *  - supplier recovery claims = finance.manage-payables · money back from a supplier = finance.post-cash
 *  - reads = finance.view-project-finance (amounts; Admin has no access)
 * Every command takes an Idempotency-Key; derived journals are written in the same transaction.
 */

const text = t.String({ maxLength: 500 })
const amount = t.String({ maxLength: 20 })

export function fulfillmentRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps

  async function idempotent<T>(request: Request, set: { headers: Record<string, string | number> }, actor: SessionActor, route: string, body: unknown, fn: Parameters<typeof withIdempotency<T>>[2]) {
    const key = requireIdempotencyKey(request)
    const result = await withIdempotency<T>(db, { actorUserId: actor.userId, route, key, body }, fn)
    if (result.replayed) set.headers['idempotent-replayed'] = 'true'
    return ok(request, result.data)
  }

  return new Elysia({ prefix: '/api/v1/finance' })
    .get('/fulfillments', async ({ request, query }) => {
      await auth.requireCapability(request, 'finance.view-project-finance')
      return ok(request, await fulfillmentOverview(db, query))
    }, { query: t.Object({ projectId: t.Optional(text), salesOrderId: t.Optional(text) }) })
    .post('/fulfillments', async ({ request, body, set }) => {
      const actor = await auth.requireActor(request)
      const capability = body.side === 'supplier' ? 'finance.manage-payables' : 'finance.manage-receivables'
      if (!hasCapability(actor.role, capability)) throw errors.forbidden()
      set.status = 201
      return idempotent(request, set, actor, 'POST /finance/fulfillments', body, tx => recordFulfillment(tx, actor, body, requestIdOf(request)))
    }, { body: t.Object({
      side: text, projectId: t.Optional(text), salesOrderId: t.Optional(text), serviceId: t.Optional(text),
      booking: t.Optional(t.Object({ type: text, id: text })), serviceOrderId: t.Optional(text), vendorId: t.Optional(text),
      amountMinor: amount, fulfilledOn: text, basis: t.Optional(text), isFinal: t.Optional(t.Boolean()), evidence: text
    }, { additionalProperties: false }) })
    .post('/fulfillments/:id/void', async ({ request, params, body, set }) => {
      const actor = await auth.requireActor(request)
      if (!hasCapability(actor.role, 'finance.manage-receivables') && !hasCapability(actor.role, 'finance.manage-payables')) throw errors.forbidden()
      const id = assertIdParam(params.id, 'Pemenuhan jasa')
      return idempotent(request, set, actor, `POST /finance/fulfillments/${id}/void`, body, tx => voidFulfillment(tx, actor, id, body.reason, requestIdOf(request)))
    }, { body: t.Object({ reason: text }, { additionalProperties: false }) })
    .get('/supplier-claims', async ({ request, query }) => {
      await auth.requireCapability(request, 'finance.view-project-finance')
      return ok(request, await listSupplierClaims(db, query))
    }, { query: t.Object({ vendorId: t.Optional(text), projectId: t.Optional(text),salesOrderId:t.Optional(text) }) })
    .post('/supplier-claims', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-payables')
      set.status = 201
      return idempotent(request, set, actor, 'POST /finance/supplier-claims', body, tx => createSupplierClaim(tx, actor, body, requestIdOf(request)))
    }, { body: t.Object({
      vendorId: text, projectId: t.Optional(text), salesOrderId:t.Optional(text),basis: text, sourcePaymentId: t.Optional(text), amountMinor: amount, recognizedOn: text, reason: text
    }, { additionalProperties: false }) })
    .post('/supplier-claims/:id/void', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-payables')
      const id = assertIdParam(params.id, 'Klaim supplier')
      return idempotent(request, set, actor, `POST /finance/supplier-claims/${id}/void`, body, tx => voidSupplierClaim(tx, actor, id, body.reason, requestIdOf(request)))
    }, { body: t.Object({ reason: text }, { additionalProperties: false }) })
    .post('/vendor-refunds', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.post-cash')
      set.status = 201
      return idempotent(request, set, actor, 'POST /finance/vendor-refunds', body, tx => postVendorRefund(tx, actor, body, requestIdOf(request)))
    }, { body: t.Object({
      bankAccountId: text, claimId: text, amountMinor: amount, effectiveDate: text, reference: t.Optional(text), memo: t.Optional(text)
    }, { additionalProperties: false }) })
}
