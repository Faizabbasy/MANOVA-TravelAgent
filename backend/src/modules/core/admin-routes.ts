import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { listSessions, listSystemEvents } from './audit-reads'
import { isPortalActor } from './scope'
import { changeUserRole, listUsers, reactivateUser, suspendUser } from './users'

/** User administration (`admin.manage-users`, Super Admin) and audit reads (`admin.view-activity-center`), S10a. */
export function adminRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const anyBody = { body: t.Optional(t.Record(t.String(), t.Unknown())) }

  async function userResponse(id: string) {
    const [u] = await listUsers(db, id)
    if (!u) throw errors.notFound('User')
    return u
  }

  return new Elysia({ prefix: '/api/v1' })
    .get('/users', async ({ request }) => {
      const actor = await auth.requireActor(request)
      if (isPortalActor(actor)) throw errors.forbidden()
      return ok(request, await listUsers(db))
    })
    .post('/users/:id/suspend', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'admin.manage-users')
      const id = assertIdParam(params.id, 'User')
      await db.transaction(tx => suspendUser(tx, actor, id, (body as Record<string, unknown> | undefined)?.reason, requestIdOf(request)))
      return ok(request, await userResponse(id))
    }, anyBody)
    .post('/users/:id/reactivate', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'admin.manage-users')
      const id = assertIdParam(params.id, 'User')
      await db.transaction(tx => reactivateUser(tx, actor, id, requestIdOf(request)))
      return ok(request, await userResponse(id))
    }, anyBody)
    .put('/users/:id/role', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'admin.manage-users')
      const id = assertIdParam(params.id, 'User')
      await db.transaction(tx => changeUserRole(tx, actor, id, (body as Record<string, unknown> | undefined)?.role, requestIdOf(request)))
      return ok(request, await userResponse(id))
    }, anyBody)
    .get('/audit/events', async ({ request }) => {
      await auth.requireCapability(request, 'admin.view-activity-center')
      return ok(request, await listSystemEvents(db))
    })
    .get('/audit/sessions', async ({ request }) => {
      await auth.requireCapability(request, 'admin.view-activity-center')
      return ok(request, await listSessions(db))
    })
}
