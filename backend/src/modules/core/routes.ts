import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ID_PATTERN, ok, okList, paginate, parsePageQuery, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { projectFinanceSummary } from '../finance/summaries'
import { createProject, setContractValue, updateProject } from './project-writes'
import {
  BOOKING_TYPES,
  getBookingRef,
  getParty,
  getProject,
  getServiceOrder,
  getVendor,
  listParties,
  listProjects,
  listVendors,
  PROJECT_STATUSES,
  type BookingType
} from './repository'
import { canListParties, canListVendors, isPortalActor } from './scope'

/**
 * Core references. Reads for every module; project header writes (S3a) — status, team and services stay in
 * the frontend until their stage moves. Out-of-scope IDs return 404 exactly like missing ones.
 */

const pageQuery = {
  limit: t.Optional(t.String()),
  cursor: t.Optional(t.String())
}

export function coreRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps

  return new Elysia({ prefix: '/api/v1' })
    .get(
      '/projects',
      async ({ request, query }) => {
        const actor = await auth.requireActor(request)
        if (query.status && !(PROJECT_STATUSES as readonly string[]).includes(query.status)) {
          throw errors.validation({ status: [`Status harus salah satu dari: ${PROJECT_STATUSES.join(', ')}.`] })
        }
        if (query.partyId && !ID_PATTERN.test(query.partyId)) throw errors.validation({ partyId: ['ID customer tidak valid.'] })
        const page = parsePageQuery(query)
        const rows = await listProjects(db, actor, { status: query.status, partyId: query.partyId, ...page })
        const { items, pagination } = paginate(rows, page.limit)
        return okList(request, items, pagination)
      },
      { query: t.Object({ ...pageQuery, status: t.Optional(t.String()), partyId: t.Optional(t.String()) }) }
    )
    .get('/projects/:id', async ({ request, params }) => {
      const actor = await auth.requireActor(request)
      const project = await getProject(db, actor, assertIdParam(params.id, 'Project'))
      if (!project) throw errors.notFound('Project')
      return ok(request, project)
    })
    .post('/projects', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'project-order.manage-operations')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /projects', key, body }, async tx =>
        createProject(tx, actor, body as Parameters<typeof createProject>[2], requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await getProject(db, actor, result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/projects/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'project-order.manage-operations')
      const id = assertIdParam(params.id, 'Project')
      if (!(await getProject(db, actor, id))) throw errors.notFound('Project')
      await db.transaction(tx => updateProject(tx, actor, id, body as Parameters<typeof updateProject>[3], requestIdOf(request)))
      return ok(request, await getProject(db, actor, id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .put('/projects/:id/contract-value', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.edit-contract-value')
      const id = assertIdParam(params.id, 'Project')
      if (!(await getProject(db, actor, id))) throw errors.notFound('Project')
      // "Sudah ditagih" as the project finance summary shows it: issued invoices − credit notes.
      const summary = await projectFinanceSummary(db, id, true)
      const billed = summary.view === 'full' ? BigInt(summary.receivable.invoicedMinor) - BigInt(summary.receivable.creditedMinor) : 0n
      await db.transaction(tx => setContractValue(tx, actor, id, body, billed, requestIdOf(request)))
      return ok(request, await getProject(db, actor, id))
    }, { body: t.Object({ contractValueMinor: t.Optional(t.String()), reason: t.Optional(t.String()) }) })
    .get(
      '/parties',
      async ({ request, query }) => {
        const actor = await auth.requireActor(request)
        if (!canListParties(actor)) throw errors.forbidden()
        const page = parsePageQuery(query)
        const { items, pagination } = paginate(await listParties(db, actor, page), page.limit)
        return okList(request, items, pagination)
      },
      { query: t.Object(pageQuery) }
    )
    .get('/parties/:id', async ({ request, params }) => {
      const actor = await auth.requireActor(request)
      if (!isPortalActor(actor) && !canListParties(actor)) throw errors.forbidden()
      const party = await getParty(db, actor, assertIdParam(params.id, 'Customer'))
      if (!party) throw errors.notFound('Customer')
      return ok(request, party)
    })
    .get(
      '/vendors',
      async ({ request, query }) => {
        const actor = await auth.requireActor(request)
        if (!canListVendors(actor)) throw errors.forbidden()
        const page = parsePageQuery(query)
        const { items, pagination } = paginate(await listVendors(db, actor, page), page.limit)
        return okList(request, items, pagination)
      },
      { query: t.Object(pageQuery) }
    )
    .get('/vendors/:id', async ({ request, params }) => {
      const actor = await auth.requireActor(request)
      if (!isPortalActor(actor) && !canListVendors(actor)) throw errors.forbidden()
      const vendor = await getVendor(db, actor, assertIdParam(params.id, 'Vendor'))
      if (!vendor) throw errors.notFound('Vendor')
      return ok(request, vendor)
    })
    .get('/service-orders/:id', async ({ request, params }) => {
      const actor = await auth.requireActor(request)
      if (!isPortalActor(actor) && !canListVendors(actor)) throw errors.forbidden()
      const serviceOrder = await getServiceOrder(db, actor, assertIdParam(params.id, 'Service order'))
      if (!serviceOrder) throw errors.notFound('Service order')
      return ok(request, serviceOrder)
    })
    .get('/bookings/:type/:id', async ({ request, params }) => {
      const actor = await auth.requireActor(request)
      if (!(BOOKING_TYPES as readonly string[]).includes(params.type)) {
        throw errors.validation({ type: [`Tipe booking harus salah satu dari: ${BOOKING_TYPES.join(', ')}.`] })
      }
      const booking = await getBookingRef(db, actor, params.type as BookingType, assertIdParam(params.id, 'Booking'))
      if (!booking) throw errors.notFound('Booking')
      return ok(request, booking)
    })
}
