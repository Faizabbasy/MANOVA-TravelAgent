import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { listVendorProducts } from './repository'
import { vendorCreateProduct } from './vendor-portal'

/** Vendor portal (S12d): only a vendor, only its own vendor (from the session). */
export function vendorPortalRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps

  async function vendorActor(request: Request) {
    const actor = await auth.requireActor(request)
    if (actor.role !== 'vendor' || !actor.vendorId) throw errors.forbidden()
    return { actor, vendorId: actor.vendorId }
  }

  return new Elysia({ prefix: '/api/v1/vendor' })
    .get('/products', async ({ request }) => {
      const { vendorId } = await vendorActor(request)
      return ok(request, await listVendorProducts(db, vendorId))
    })
    .post('/products', async ({ request, body, set }) => {
      const { actor, vendorId } = await vendorActor(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /vendor/products', key, body }, tx =>
        vendorCreateProduct(tx, actor, vendorId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, (await listVendorProducts(db, vendorId)).find(p => p.id === result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
}
