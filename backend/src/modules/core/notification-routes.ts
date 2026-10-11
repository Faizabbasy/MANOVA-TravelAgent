import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ok } from '../../http/envelope'
import { listNotifications, markAllRead, markRead, removeNotification } from './notifications'

/** Notifications (S9b): every signed-in user reads and changes only their own. */
export function notificationRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const anyBody = { body: t.Optional(t.Record(t.String(), t.Unknown())) }

  return new Elysia({ prefix: '/api/v1' })
    .get('/notifications', async ({ request }) => {
      const actor = await auth.requireActor(request)
      return ok(request, await listNotifications(db, actor.userId))
    })
    .post('/notifications/read-all', async ({ request }) => {
      const actor = await auth.requireActor(request)
      await db.transaction(tx => markAllRead(tx, actor.userId))
      return ok(request, await listNotifications(db, actor.userId))
    }, anyBody)
    .post('/notifications/:id/read', async ({ request, params }) => {
      const actor = await auth.requireActor(request)
      const id = assertIdParam(params.id, 'Notifikasi')
      await db.transaction(tx => markRead(tx, actor.userId, id))
      return ok(request, (await listNotifications(db, actor.userId, id))[0])
    }, anyBody)
    .delete('/notifications/:id', async ({ request, params }) => {
      const actor = await auth.requireActor(request)
      const id = assertIdParam(params.id, 'Notifikasi')
      await db.transaction(tx => removeNotification(tx, actor.userId, id))
      return ok(request, { id, deleted: true })
    })
}
