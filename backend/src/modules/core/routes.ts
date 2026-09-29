import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ID_PATTERN, ok, okList, paginate, parsePageQuery } from '../../http/envelope'
import { errors } from '../../http/errors'
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
 * Core reference reads (Phase 1). Read-only on purpose: Project/Party/Vendor/Booking are still operated
 * by their own modules; finance only needs to resolve and scope these IDs. Out-of-scope IDs return 404
 * exactly like missing ones.
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
