import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext, SessionActor } from '../../auth/context'
import { assertIdParam, ok, requestIdOf } from '../../http/envelope'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { fundingOverview, postOwnerFunds, purchaseAsset, receiveLoan, repayLoan, runDepreciation } from './funding'
import { prepaidRoutes } from './routes-prepaid'
import { companyExpenseRoutes } from './routes-company-expenses'
import { changeBillingRoutes } from './routes-change-billing'
import { supplierMatchingRoutes } from './routes-supplier-matching'

/**
 * Aset, pinjaman & modal (owner accounting F6). Reads = finance.view-cash · money (Beli Aset, pinjaman, cicilan, dana owner)
 * = finance.post-cash · monthly depreciation = finance.close-period. All commands take an Idempotency-Key.
 */
const text = t.String({ maxLength: 1000 })
const amount = t.String({ maxLength: 20 })

export function fundingRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  async function idempotent<T>(request: Request, set: { headers: Record<string, string | number> }, actor: SessionActor, route: string, body: unknown, fn: Parameters<typeof withIdempotency<T>>[2]) {
    const result = await withIdempotency<T>(db, { actorUserId: actor.userId, route, key: requireIdempotencyKey(request), body }, fn)
    if (result.replayed) set.headers['idempotent-replayed'] = 'true'
    return ok(request, result.data)
  }
  const ownerBody = t.Object({ bankAccountId: text, amountMinor: amount, effectiveDate: text, memo: t.Optional(text), reference: t.Optional(text) }, { additionalProperties: false })
  const sources = new Elysia().use(prepaidRoutes(deps, auth)).use(companyExpenseRoutes(deps, auth)).use(changeBillingRoutes(deps,auth)).use(supplierMatchingRoutes(deps,auth))
  return sources.use(new Elysia({ prefix: '/api/v1/finance' })
    .get('/funding', async ({ request }) => {
      await auth.requireCapability(request, 'finance.view-cash')
      return ok(request, await fundingOverview(db))
    })
    .post('/assets/:id/purchase', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.post-cash')
      const id = assertIdParam(params.id, 'Aset')
      set.status = 201
      return idempotent(request, set, actor, `POST /finance/assets/${id}/purchase`, body, tx => purchaseAsset(tx, actor, { ...body, assetId: id }, requestIdOf(request)))
    }, { body: t.Object({ bankAccountId: text, costMinor: amount, acquiredOn: text, inServiceOn: t.Optional(text), usefulLifeMonths: t.Integer(),
      residualMinor: t.Optional(amount), reference: t.Optional(text) }, { additionalProperties: false }) })
    .post('/depreciation-runs', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.close-period')
      return idempotent(request, set, actor, 'POST /finance/depreciation-runs', body, tx => runDepreciation(tx, actor, body, requestIdOf(request)))
    }, { body: t.Object({ throughPeriod: text }, { additionalProperties: false }) })
    .post('/loans', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.post-cash')
      set.status = 201
      return idempotent(request, set, actor, 'POST /finance/loans', body, tx => receiveLoan(tx, actor, body, requestIdOf(request)))
    }, { body: t.Object({ lender: text, principalMinor: amount, receivedOn: text, terms: text, bankAccountId: text, reference: t.Optional(text) }, { additionalProperties: false }) })
    .post('/loans/:id/repayments', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.post-cash')
      const id = assertIdParam(params.id, 'Pinjaman')
      set.status = 201
      return idempotent(request, set, actor, `POST /finance/loans/${id}/repayments`, body, tx => repayLoan(tx, actor, { ...body, loanId: id }, requestIdOf(request)))
    }, { body: t.Object({ bankAccountId: text, principalMinor: amount, interestMinor: amount, effectiveDate: text, reference: t.Optional(text) }, { additionalProperties: false }) })
    .post('/owner-funds/contributions', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.post-cash')
      set.status = 201
      return idempotent(request, set, actor, 'POST /finance/owner-funds/contributions', body, tx => postOwnerFunds(tx, actor, 'owner_contribution', body, requestIdOf(request)))
    }, { body: ownerBody })
    .post('/owner-funds/withdrawals', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.post-cash')
      set.status = 201
      return idempotent(request, set, actor, 'POST /finance/owner-funds/withdrawals', body, tx => postOwnerFunds(tx, actor, 'owner_withdrawal', body, requestIdOf(request)))
    }, { body: ownerBody }))
}
