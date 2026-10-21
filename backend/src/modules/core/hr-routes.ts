import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { todayBusinessDate } from '../finance/common'
import {
  approvePayrollRun, createEmployee, createIncentive, createPayrollRun, listAttendance, listCommissions, listEmployees, listPayrollLines,
  listPayrollRuns, listPerformanceReviews, payPayrollRun, updateEmployee, updatePayrollLine
} from './hr'
import { isPortalActor } from './scope'

/** Human resources (S11c): employees, attendance and reviews for internal roles; pay only for `hr.manage-payroll`. */
export function hrRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const anyBody = { body: t.Optional(t.Record(t.String(), t.Unknown())) }
  const body = (b: unknown) => (b ?? {}) as Record<string, unknown>

  async function internalActor(request: Request) {
    const actor = await auth.requireActor(request)
    if (isPortalActor(actor)) throw errors.forbidden()
    return actor
  }

  return new Elysia({ prefix: '/api/v1' })
    .get('/employees', async ({ request }) => {
      const actor = await internalActor(request)
      return ok(request, await listEmployees(db, actor))
    })
    .post('/employees', async ({ request, body: b, set }) => {
      const actor = await internalActor(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /employees', key, body: b }, tx =>
        createEmployee(tx, actor, body(b), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, (await listEmployees(db, actor, result.data.id))[0])
    }, anyBody)
    .patch('/employees/:id', async ({ request, params, body: b }) => {
      const actor = await internalActor(request)
      const id = assertIdParam(params.id, 'Karyawan')
      await db.transaction(tx => updateEmployee(tx, actor, id, body(b), requestIdOf(request)))
      return ok(request, (await listEmployees(db, actor, id))[0])
    }, anyBody)
    .get('/attendance', async ({ request }) => {
      await internalActor(request)
      return ok(request, await listAttendance(db))
    })
    .get('/performance-reviews', async ({ request }) => {
      await internalActor(request)
      return ok(request, await listPerformanceReviews(db))
    })
    // Payroll, commissions and incentives: hr.manage-payroll (Finance, Super Admin) only — checked in hr.ts.
    .get('/payroll-runs', async ({ request }) => ok(request, await listPayrollRuns(db, await internalActor(request))))
    .get('/payroll-lines', async ({ request }) => ok(request, await listPayrollLines(db, await internalActor(request))))
    .post('/payroll-runs', async ({ request, body: b, set }) => {
      const actor = await internalActor(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /payroll-runs', key, body: b }, tx =>
        createPayrollRun(tx, actor, body(b), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, (await listPayrollRuns(db, actor, result.data.id))[0])
    }, anyBody)
    .post('/payroll-runs/:id/approve', async ({ request, params }) => {
      const actor = await internalActor(request)
      const id = assertIdParam(params.id, 'Payroll')
      await db.transaction(tx => approvePayrollRun(tx, actor, id, todayBusinessDate(), requestIdOf(request)))
      return ok(request, (await listPayrollRuns(db, actor, id))[0])
    }, anyBody)
    // Money out: requires the bank account and date, and an Idempotency-Key (a retry never pays twice).
    .post('/payroll-runs/:id/pay', async ({ request, params, body: b, set }) => {
      const actor = await internalActor(request)
      const id = assertIdParam(params.id, 'Payroll')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: `POST /payroll-runs/${id}/pay`, key, body: b }, tx =>
        payPayrollRun(tx, actor, id, body(b), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      return ok(request, (await listPayrollRuns(db, actor, id))[0])
    }, anyBody)
    .patch('/payroll-lines/:id', async ({ request, params, body: b }) => {
      const actor = await internalActor(request)
      const id = assertIdParam(params.id, 'Baris payroll')
      await db.transaction(tx => updatePayrollLine(tx, actor, id, body(b), requestIdOf(request)))
      return ok(request, (await listPayrollLines(db, actor, id))[0])
    }, anyBody)
    .get('/hr/commissions', async ({ request }) => ok(request, await listCommissions(db, await internalActor(request))))
    .post('/incentives', async ({ request, body: b, set }) => {
      const actor = await internalActor(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /incentives', key, body: b }, tx =>
        createIncentive(tx, actor, body(b), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, (await listCommissions(db, actor, result.data.id)).find(x => x.id === result.data.id))
    }, anyBody)
}
