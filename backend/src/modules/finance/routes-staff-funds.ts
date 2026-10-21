import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext, SessionActor } from '../../auth/context'
import { assertIdParam, ok, requestIdOf } from '../../http/envelope'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { postStaffCash, recordExpenseClaim, staffFunds, voidExpenseClaim, type StaffCashKind } from './staff-funds'

/**
 * Kasbon dan bukti biaya (owner accounting F5). Reads = finance.view-cash · staff cash (give, return, reimburse)
 * = finance.post-cash · spending evidence = finance.manage-opex. Every command takes an Idempotency-Key.
 */
const text = t.String({ maxLength: 500 })
const cashBody = t.Object({
  bankAccountId: text, employeeId: text, projectId: t.Optional(text), amountMinor: t.String({ maxLength: 20 }), effectiveDate: text,
  reference: t.Optional(text), memo: t.Optional(text)
}, { additionalProperties: false })

export function staffFundRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  async function idempotent<T>(request: Request, set: { headers: Record<string, string | number> }, actor: SessionActor, route: string, body: unknown, fn: Parameters<typeof withIdempotency<T>>[2]) {
    const result = await withIdempotency<T>(db, { actorUserId: actor.userId, route, key: requireIdempotencyKey(request), body }, fn)
    if (result.replayed) set.headers['idempotent-replayed'] = 'true'
    return ok(request, result.data)
  }
  const cashRoute = (path: string, kind: StaffCashKind) => ({ path, kind })
  const app = new Elysia({ prefix: '/api/v1/finance' })
    .get('/staff-funds', async ({ request, query }) => {
      await auth.requireCapability(request, 'finance.view-cash')
      return ok(request, await staffFunds(db, query))
    }, { query: t.Object({ employeeId: t.Optional(text) }) })
    .post('/expense-claims', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-opex')
      set.status = 201
      return idempotent(request, set, actor, 'POST /finance/expense-claims', body, tx => recordExpenseClaim(tx, actor, body, requestIdOf(request)))
    }, { body: t.Object({
      employeeId: text, projectId: t.Optional(text), category: text, amountMinor: t.String({ maxLength: 20 }), spentOn: text, evidenceRef: text, description: text
    }, { additionalProperties: false }) })
    .post('/expense-claims/:id/void', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-opex')
      const id = assertIdParam(params.id, 'Bukti pengeluaran')
      return idempotent(request, set, actor, `POST /finance/expense-claims/${id}/void`, body, tx => voidExpenseClaim(tx, actor, id, body.reason, requestIdOf(request)))
    }, { body: t.Object({ reason: text }, { additionalProperties: false }) })
  return [cashRoute('/staff-funds/advances', 'employee_advance'), cashRoute('/staff-funds/returns', 'employee_advance_return'),
    cashRoute('/staff-funds/reimbursements', 'employee_reimbursement')].reduce((a, r) => a.post(r.path, async ({ request, body, set }) => {
    const actor = await auth.requireCapability(request, 'finance.post-cash')
    set.status = 201
    return idempotent(request, set, actor, `POST /finance${r.path}`, body, tx => postStaffCash(tx, actor, r.kind, body, requestIdOf(request)))
  }, { body: cashBody }), app)
}
