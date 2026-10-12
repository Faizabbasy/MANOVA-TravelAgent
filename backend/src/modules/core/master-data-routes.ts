import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import {
  createMasterRecord, getOrganizationProfile, isMasterCategory, listMasterData, setMasterRecordActive, updateMasterRecord,
  updateOrganizationProfile, type MasterCategory
} from './master-data'
import { isPortalActor } from './scope'

/** Master data and the organization profile (S10b): internal roles read, `admin.manage-master-data` writes. */
export function masterDataRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const anyBody = { body: t.Optional(t.Record(t.String(), t.Unknown())) }

  async function internalActor(request: Request) {
    const actor = await auth.requireActor(request)
    if (isPortalActor(actor)) throw errors.forbidden()
    return actor
  }
  const categoryOf = (value: string): MasterCategory => {
    if (!isMasterCategory(value)) throw errors.notFound('Kategori master data')
    return value
  }
  const record = async (id: string) => (await listMasterData(db, id))[0]!
  const manage = (request: Request) => auth.requireCapability(request, 'admin.manage-master-data')

  return new Elysia({ prefix: '/api/v1' })
    .get('/master-data', async ({ request }) => {
      await internalActor(request)
      return ok(request, await listMasterData(db))
    })
    .post('/master-data/:category', async ({ request, params, body, set }) => {
      const actor = await manage(request)
      const category = categoryOf(params.category)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: `POST /master-data/${category}`, key, body }, tx =>
        createMasterRecord(tx, actor, category, (body ?? {}) as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await record(result.data.id))
    }, anyBody)
    .patch('/master-data/:category/:id', async ({ request, params, body }) => {
      const actor = await manage(request)
      const category = categoryOf(params.category)
      const id = assertIdParam(params.id, 'Master data')
      await db.transaction(tx => updateMasterRecord(tx, actor, category, id, (body ?? {}) as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await record(id))
    }, anyBody)
    .post('/master-data/:category/:id/deactivate', async ({ request, params }) => {
      const actor = await manage(request)
      const category = categoryOf(params.category)
      const id = assertIdParam(params.id, 'Master data')
      await db.transaction(tx => setMasterRecordActive(tx, actor, category, id, false, requestIdOf(request)))
      return ok(request, await record(id))
    }, anyBody)
    .post('/master-data/:category/:id/reactivate', async ({ request, params }) => {
      const actor = await manage(request)
      const category = categoryOf(params.category)
      const id = assertIdParam(params.id, 'Master data')
      await db.transaction(tx => setMasterRecordActive(tx, actor, category, id, true, requestIdOf(request)))
      return ok(request, await record(id))
    }, anyBody)
    .get('/organization-profile', async ({ request }) => {
      await internalActor(request)
      const profile = await getOrganizationProfile(db)
      if (!profile) throw errors.notFound('Profil organisasi')
      return ok(request, profile)
    })
    .put('/organization-profile', async ({ request, body }) => {
      const actor = await manage(request)
      await db.transaction(tx => updateOrganizationProfile(tx, actor, (body ?? {}) as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await getOrganizationProfile(db))
    }, anyBody)
}
