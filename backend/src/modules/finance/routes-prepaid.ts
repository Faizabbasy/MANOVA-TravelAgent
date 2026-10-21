import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { ok, requestIdOf } from '../../http/envelope'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { listPrepaidExpenses, payPrepaidExpense, runPrepaidAmortization } from './prepaid-expenses'
import { todayBusinessDate } from './common'

const text = t.String({ maxLength: 200 })
export function prepaidRoutes({ db }: AppDeps, auth: AuthContext) {
  return new Elysia({ prefix: '/api/v1/finance' })
    .get('/prepaid-expenses', async ({ request, query }) => {
      await auth.requireCapability(request, 'finance.view-cash')
      return ok(request, await db.transaction(tx => listPrepaidExpenses(tx, query.asOf ?? todayBusinessDate(), query)))
    }, { query: t.Object({ asOf: t.Optional(text), limit: t.Optional(text), cursor: t.Optional(text) }) })
    .post('/prepaid-expenses', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.post-cash')
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /finance/prepaid-expenses', key: requireIdempotencyKey(request), body },
        tx => payPrepaidExpense(tx, actor, body, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, result.data)
    }, { body: t.Object({ bankAccountId: text, amountMinor: t.String({ maxLength: 20 }), effectiveDate: text, description: text, evidenceRef: text,
      startMonth: text, months: t.Integer(), method: t.Literal('equal-months') }, { additionalProperties: false }) })
    .post('/prepaid-amortization-runs', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.close-period')
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /finance/prepaid-amortization-runs', key: requireIdempotencyKey(request), body },
        tx => runPrepaidAmortization(tx, actor, body, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      return ok(request, result.data)
    }, { body: t.Object({ throughPeriod: text }, { additionalProperties: false }) })
}
