import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import {
  createContentIdea, createContentSchedule, listContentDevelopment, listContentSchedule, updateContentIdea, updateContentSchedule
} from './marketing'
import { isPortalActor } from './scope'

/** Marketing content schedule and development (S11b): internal roles read, `marketing.manage-content` writes. */
export function marketingRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const anyBody = { body: t.Optional(t.Record(t.String(), t.Unknown())) }
  const body = (b: unknown) => (b ?? {}) as Record<string, unknown>

  async function internalActor(request: Request) {
    const actor = await auth.requireActor(request)
    if (isPortalActor(actor)) throw errors.forbidden()
    return actor
  }
  const manage = (request: Request) => auth.requireCapability(request, 'marketing.manage-content')

  return new Elysia({ prefix: '/api/v1' })
    .get('/content-schedule', async ({ request }) => {
      await internalActor(request)
      return ok(request, await listContentSchedule(db))
    })
    .post('/content-schedule', async ({ request, body: b, set }) => {
      const actor = await manage(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /content-schedule', key, body: b }, tx =>
        createContentSchedule(tx, actor, body(b), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, (await listContentSchedule(db, result.data.id))[0])
    }, anyBody)
    .patch('/content-schedule/:id', async ({ request, params, body: b }) => {
      const actor = await manage(request)
      const id = assertIdParam(params.id, 'Jadwal konten')
      await db.transaction(tx => updateContentSchedule(tx, actor, id, body(b), requestIdOf(request)))
      return ok(request, (await listContentSchedule(db, id))[0])
    }, anyBody)
    .get('/content-development', async ({ request }) => {
      await internalActor(request)
      return ok(request, await listContentDevelopment(db))
    })
    .post('/content-development', async ({ request, body: b, set }) => {
      const actor = await manage(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /content-development', key, body: b }, tx =>
        createContentIdea(tx, actor, body(b), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, (await listContentDevelopment(db, result.data.id))[0])
    }, anyBody)
    .patch('/content-development/:id', async ({ request, params, body: b }) => {
      const actor = await manage(request)
      const id = assertIdParam(params.id, 'Konten')
      await db.transaction(tx => updateContentIdea(tx, actor, id, body(b), requestIdOf(request)))
      return ok(request, (await listContentDevelopment(db, id))[0])
    }, anyBody)
}
