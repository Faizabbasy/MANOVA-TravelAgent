import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import {
  checkoutAsset, completeMaintenance, createAsset, listAssets, listCheckouts, listMaintenance, returnAsset, scheduleMaintenance, updateAsset
} from './inventory'
import { isPortalActor } from './scope'

/** Assets, maintenance and checkouts (S11a): internal roles read, `inventory.manage-asset` writes. */
export function inventoryRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const anyBody = { body: t.Optional(t.Record(t.String(), t.Unknown())) }
  const body = (b: unknown) => (b ?? {}) as Record<string, unknown>

  async function internalActor(request: Request) {
    const actor = await auth.requireActor(request)
    if (isPortalActor(actor)) throw errors.forbidden()
    return actor
  }
  const manage = (request: Request) => auth.requireCapability(request, 'inventory.manage-asset')

  return new Elysia({ prefix: '/api/v1' })
    .get('/assets', async ({ request }) => {
      await internalActor(request)
      return ok(request, await listAssets(db))
    })
    .get('/asset-maintenance', async ({ request }) => {
      await internalActor(request)
      return ok(request, await listMaintenance(db))
    })
    .get('/asset-checkouts', async ({ request }) => {
      await internalActor(request)
      return ok(request, await listCheckouts(db))
    })
    .post('/assets', async ({ request, body: b, set }) => {
      const actor = await manage(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /assets', key, body: b }, tx =>
        createAsset(tx, actor, body(b), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, (await listAssets(db, result.data.id))[0])
    }, anyBody)
    .patch('/assets/:id', async ({ request, params, body: b }) => {
      const actor = await manage(request)
      const id = assertIdParam(params.id, 'Aset')
      await db.transaction(tx => updateAsset(tx, actor, id, body(b), requestIdOf(request)))
      return ok(request, (await listAssets(db, id))[0])
    }, anyBody)
    .post('/asset-checkouts', async ({ request, body: b, set }) => {
      const actor = await manage(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /asset-checkouts', key, body: b }, tx =>
        checkoutAsset(tx, actor, body(b), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, (await listCheckouts(db, result.data.id))[0])
    }, anyBody)
    .post('/asset-checkouts/:id/return', async ({ request, params, body: b }) => {
      const actor = await manage(request)
      const id = assertIdParam(params.id, 'Peminjaman aset')
      await db.transaction(tx => returnAsset(tx, actor, id, body(b), requestIdOf(request)))
      return ok(request, (await listCheckouts(db, id))[0])
    }, anyBody)
    .post('/asset-maintenance', async ({ request, body: b, set }) => {
      const actor = await manage(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /asset-maintenance', key, body: b }, tx =>
        scheduleMaintenance(tx, actor, body(b), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, (await listMaintenance(db, result.data.id))[0])
    }, anyBody)
    .post('/asset-maintenance/:id/complete', async ({ request, params }) => {
      const actor = await manage(request)
      const id = assertIdParam(params.id, 'Jadwal maintenance')
      await db.transaction(tx => completeMaintenance(tx, actor, id, requestIdOf(request)))
      return ok(request, (await listMaintenance(db, id))[0])
    }, anyBody)
}
