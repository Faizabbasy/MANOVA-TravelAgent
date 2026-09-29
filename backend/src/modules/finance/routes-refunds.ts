import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext, SessionActor } from '../../auth/context'
import { hasCapability } from '../../auth/rbac'
import { assertIdParam, MAX_PAGE_LIMIT, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import {
  assignablePolicies, assignPolicy, createPolicy, deactivatePolicy, deletePolicyDraft, effectiveAssignment, getPolicy, listPolicies,
  newPolicyVersion, parseSubjectType, publishPolicy, resolveSubject, updatePolicyDraft
} from './policies'
import { approveRefund, createCancellation, getRefund, listRefunds, previewCancellation, rejectRefund, settleRefund } from './refunds'

/**
 * Finance Phase 5 API — cancellation policies, cancellation cases and refunds.
 * Capabilities:
 *  - policies (manage) = finance.manage-policy · read = finance.view-cash or project-order.request-cancellation
 *  - preview / record a cancellation = project-order.request-cancellation (Admin + Finance); amounts only with
 *    finance.view-project-finance (Admin gets the status view: policy, H-x, tier — no money)
 *  - approve / reject = finance.approve-refund · settle (money out, Idempotency-Key) = finance.settle-refund
 */

const tier = t.Object({ minDays: t.Union([t.Number(), t.Null()]), maxDays: t.Union([t.Number(), t.Null()]), refundBp: t.Number() })
const policyBody = {
  code: t.Optional(t.String({ maxLength: 40 })),
  name: t.Optional(t.String({ maxLength: 120 })),
  description: t.Optional(t.Union([t.String({ maxLength: 1000 }), t.Null()])),
  bookingType: t.Optional(t.Union([t.String(), t.Null()])),
  effectiveFrom: t.Optional(t.String()),
  effectiveTo: t.Optional(t.Union([t.String(), t.Null()])),
  tiers: t.Optional(t.Array(tier, { maxItems: 20 }))
}

function parseLimit(raw: string | undefined): number {
  if (raw === undefined) return 50
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE_LIMIT) throw errors.validation({ limit: [`Harus bilangan bulat 1–${MAX_PAGE_LIMIT}.`] })
  return n
}

export function refundRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const inTx = <T>(fn: Parameters<typeof db.transaction<T>>[0]) => db.transaction(fn)

  async function idempotent<T>(request: Request, set: { headers: Record<string, string | number> }, actor: SessionActor, route: string, body: unknown, fn: Parameters<typeof withIdempotency<T>>[2]) {
    const key = requireIdempotencyKey(request)
    const result = await withIdempotency<T>(db, { actorUserId: actor.userId, route, key, body }, fn)
    if (result.replayed) set.headers['idempotent-replayed'] = 'true'
    return ok(request, result.data)
  }

  /** Who may read policies / assignments: Finance, or anyone who may request a cancellation (Admin). */
  async function policyReader(request: Request) {
    const actor = await auth.requireActor(request)
    if (hasCapability(actor.role, 'finance.view-cash') || hasCapability(actor.role, 'project-order.request-cancellation')) return actor
    throw errors.forbidden()
  }

  async function canceller(request: Request) {
    const actor = await auth.requireCapability(request, 'project-order.request-cancellation')
    return { actor, full: hasCapability(actor.role, 'finance.view-project-finance') }
  }

  return new Elysia({ prefix: '/api/v1' })
    // ── Policies ──────────────────────────────────────────────────────────────────────────────────────
    .get('/finance/policies', async ({ request, query }) => {
      await policyReader(request)
      return ok(request, await listPolicies(db, query))
    }, { query: t.Object({ status: t.Optional(t.String()) }) })
    .get('/finance/policies/:id', async ({ request, params }) => {
      await policyReader(request)
      return ok(request, await getPolicy(db, params.id))
    })
    .post('/finance/policies', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-policy')
      set.status = 201
      return ok(request, await inTx(tx => createPolicy(tx, actor, body, requestIdOf(request))))
    }, { body: t.Object(policyBody) })
    .patch('/finance/policies/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-policy')
      const id = assertIdParam(params.id, 'Kebijakan')
      return ok(request, await inTx(tx => updatePolicyDraft(tx, actor, id, body, requestIdOf(request))))
    }, { body: t.Object(policyBody) })
    .delete('/finance/policies/:id', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-policy')
      const id = assertIdParam(params.id, 'Kebijakan')
      return ok(request, await inTx(tx => deletePolicyDraft(tx, actor, id, requestIdOf(request))))
    })
    .post('/finance/policies/:id/publish', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-policy')
      const id = assertIdParam(params.id, 'Kebijakan')
      return ok(request, await inTx(tx => publishPolicy(tx, actor, id, requestIdOf(request))))
    })
    .post('/finance/policies/:id/deactivate', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-policy')
      const id = assertIdParam(params.id, 'Kebijakan')
      return ok(request, await inTx(tx => deactivatePolicy(tx, actor, id, body.reason, requestIdOf(request))))
    }, { body: t.Object({ reason: t.String({ error: 'Alasan wajib diisi.' }) }) })
    .post('/finance/policies/:id/new-version', async ({ request, params, set }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-policy')
      const id = assertIdParam(params.id, 'Kebijakan')
      set.status = 201
      return ok(request, await inTx(tx => newPolicyVersion(tx, actor, id, requestIdOf(request))))
    })

    // ── Policy per booking / project ─────────────────────────────────────────────────────────────────
    .get('/finance/cancellation-policy/:subjectType/:subjectId', async ({ request, params }) => {
      await policyReader(request)
      const subject = await resolveSubject(db, parseSubjectType(params.subjectType), assertIdParam(params.subjectId, 'Subjek'))
      const { assignment, inherited } = await effectiveAssignment(db, subject)
      return ok(request, { assignment, inherited, assignable: await assignablePolicies(db, subject) })
    })
    .put('/finance/cancellation-policy/:subjectType/:subjectId', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-policy')
      const subject = await resolveSubject(db, parseSubjectType(params.subjectType), assertIdParam(params.subjectId, 'Subjek'))
      return ok(request, await inTx(tx => assignPolicy(tx, actor, subject, body, requestIdOf(request))))
    }, { body: t.Object({ policyId: t.String({ error: 'Pilih kebijakan.' }), note: t.Optional(t.String({ maxLength: 500 })) }) })

    // ── Cancellation ─────────────────────────────────────────────────────────────────────────────────
    .post('/finance/cancellations/preview', async ({ request, body }) => {
      const { full } = await canceller(request)
      return ok(request, await previewCancellation(db, { subjectType: parseSubjectType(body.subjectType), subjectId: body.subjectId, cancelDate: body.cancelDate }, full))
    }, { body: t.Object({ subjectType: t.String(), subjectId: t.String(), cancelDate: t.Optional(t.String()) }) })
    .post('/finance/cancellations', async ({ request, body, set }) => {
      const { actor, full } = await canceller(request)
      set.status = 201
      return idempotent(request, set, actor, 'POST /finance/cancellations', body, tx =>
        createCancellation(tx, actor, { ...body, subjectType: parseSubjectType(body.subjectType) }, full, requestIdOf(request)))
    }, {
      body: t.Object({
        subjectType: t.String(), subjectId: t.String(), cancelDate: t.Optional(t.String()),
        reason: t.String({ error: 'Alasan pembatalan wajib diisi.' }), calculation: t.Optional(t.Union([t.Literal('policy'), t.Literal('manual')])),
        additionalRefundMinor: t.Optional(t.String()), additionalReason: t.Optional(t.String({ maxLength: 500 })),
        proposedRefundMinor: t.Optional(t.String())
      })
    })

    // ── Refund cases ─────────────────────────────────────────────────────────────────────────────────
    .get('/finance/refunds', async ({ request, query }) => {
      // Finance: full worklist. Roles that may cancel (Admin): the same cases, status only (no amounts).
      const actor = await auth.requireActor(request)
      const full = hasCapability(actor.role, 'finance.view-cash')
      if (!full && !hasCapability(actor.role, 'project-order.request-cancellation')) throw errors.forbidden()
      const result = await listRefunds(db, { ...query, limit: parseLimit(query.limit) }, full)
      return { data: result.items, meta: { requestId: requestIdOf(request), pagination: result.pagination, summary: result.summary } }
    }, {
      query: t.Object({ view: t.Optional(t.String()), projectId: t.Optional(t.String()), partyId: t.Optional(t.String()), cursor: t.Optional(t.String()), limit: t.Optional(t.String()) })
    })
    .get('/finance/refunds/:id', async ({ request, params }) => {
      const { full } = await canceller(request).catch(async () => ({ actor: await auth.requireCapability(request, 'finance.view-cash'), full: true }))
      return ok(request, await getRefund(db, params.id, full))
    })
    .post('/finance/refunds/:id/approve', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.approve-refund')
      const id = assertIdParam(params.id, 'Kasus refund')
      return ok(request, await inTx(tx => approveRefund(tx, actor, id, body ?? {}, requestIdOf(request))))
    }, { body: t.Optional(t.Object({ refundMinor: t.Optional(t.String()), note: t.Optional(t.String({ maxLength: 500 })) })) })
    .post('/finance/refunds/:id/reject', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.approve-refund')
      const id = assertIdParam(params.id, 'Kasus refund')
      return ok(request, await inTx(tx => rejectRefund(tx, actor, id, body.reason, requestIdOf(request))))
    }, { body: t.Object({ reason: t.String({ error: 'Alasan wajib diisi.' }) }) })
    .post('/finance/refunds/:id/settlements', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.settle-refund')
      const id = assertIdParam(params.id, 'Kasus refund')
      set.status = 201
      return idempotent(request, set, actor, `POST /finance/refunds/${id}/settlements`, body, tx => settleRefund(tx, actor, id, body, requestIdOf(request)))
    }, {
      body: t.Object({
        bankAccountId: t.String({ error: 'Pilih rekening.' }), amountMinor: t.String({ error: 'Nominal wajib diisi.' }),
        effectiveDate: t.String({ error: 'Tanggal wajib diisi.' }), recipient: t.Optional(t.String({ maxLength: 200 })),
        reference: t.Optional(t.String({ maxLength: 120 })), memo: t.Optional(t.String({ maxLength: 500 }))
      })
    })
}
