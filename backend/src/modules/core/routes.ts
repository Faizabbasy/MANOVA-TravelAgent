import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext, SessionActor } from '../../auth/context'
import { hasCapability, type CapabilityKey } from '../../auth/rbac'
import { assertIdParam, ID_PATTERN, ok, okList, paginate, parsePageQuery, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { businessDateOf } from '../../shared/dates'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { projectFinanceSummary } from '../finance/summaries'
import { createActivity, createContact, createParty, setCreditLimit, updateParty } from './party-writes'
import { createVendor, createVendorContact, createVendorDocument, createVendorProduct, updateVendor } from './vendor-writes'
import { acceptHandover, addMember, closeFinance, closeProject, markReady, removeMember, returnHandover, transition } from './project-workflow'
import { createProject, setContractValue, updateProject } from './project-writes'
import { SERVICE_TYPES, serviceTypeOf } from './booking-rules'
import { changeBookingStatus, createBooking, updateBooking } from './booking-writes'
import { changeServiceOrderStatus } from './service-orders'
import { acceptQuotation, rejectQuotation, submitQuotation } from './vendor-quotations'
import { createService, updateService } from './service-writes'
import {
  BOOKING_TYPES,
  getBookingRef,
  getParty,
  getProject,
  getBooking,
  getProjectService,
  listBookings,
  listProjectServices,
  getServiceOrder,
  listServiceOrders,
  listQuotations,
  getVendor,
  listActivities,
  listContacts,
  listParties,
  listVendorContacts,
  listVendorDocuments,
  listVendorProducts,
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

  async function visibleVendor(actor: SessionActor, raw: string): Promise<string> {
    const id = assertIdParam(raw, 'Vendor')
    if (isPortalActor(actor) || !(await getVendor(db, actor, id))) throw errors.notFound('Vendor')
    return id
  }

  async function visibleProject(actor: SessionActor, raw: string): Promise<string> {
    const id = assertIdParam(raw, 'Project')
    if (!(await getProject(db, actor, id))) throw errors.notFound('Project')
    return id
  }

  const serviceCapability = (type: string) => `project-order.manage-service.${type}` as CapabilityKey

  /** Writes to a service or booking need the capability of its service type; portals never write. */
  function requireServiceCapability(actor: SessionActor, type: string) {
    if (isPortalActor(actor) || !(SERVICE_TYPES as readonly string[]).includes(type) || !hasCapability(actor.role, serviceCapability(type))) throw errors.forbidden()
  }

  async function writableQuotation(actor: SessionActor, raw: string) {
    const id = assertIdParam(raw, 'Quotation')
    const [q] = isPortalActor(actor) ? [] : await listQuotations(db, actor, { id })
    if (!q) throw errors.notFound('Quotation')
    requireServiceCapability(actor, q.serviceType)
    return q
  }

  function bookingType(raw: string): BookingType {
    if (!(BOOKING_TYPES as readonly string[]).includes(raw)) throw errors.validation({ type: [`Tipe booking harus salah satu dari: ${BOOKING_TYPES.join(', ')}.`] })
    return raw as BookingType
  }

  async function writableBooking(actor: SessionActor, rawType: string, rawId: string) {
    const type = bookingType(rawType)
    requireServiceCapability(actor, serviceTypeOf(type))
    const id = assertIdParam(rawId, 'Booking')
    if (!(await getBooking(db, actor, type, id))) throw errors.notFound('Booking')
    return { type, id }
  }

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
    .post('/projects/:id/handover/accept', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'project-order.accept-handover')
      const id = await visibleProject(actor, params.id)
      await db.transaction(tx => acceptHandover(tx, actor, id, requestIdOf(request)))
      return ok(request, await getProject(db, actor, id))
    })
    .post('/projects/:id/handover/return', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'project-order.accept-handover')
      const id = await visibleProject(actor, params.id)
      await db.transaction(tx => returnHandover(tx, actor, id, (body as Record<string, unknown>)?.reason, requestIdOf(request)))
      return ok(request, await getProject(db, actor, id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/projects/:id/transition', async ({ request, params, body }) => {
      const b = (body ?? {}) as Record<string, unknown>
      const actor = await auth.requireCapability(request, b.to === 'cancelled' ? 'project-order.request-cancellation' : 'project-order.advance-step')
      const id = await visibleProject(actor, params.id)
      await db.transaction(tx => transition(tx, actor, id, b.to, b.reason, requestIdOf(request)))
      return ok(request, await getProject(db, actor, id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/projects/:id/ready', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'project-order.advance-step')
      const id = await visibleProject(actor, params.id)
      await markReady(db, actor, id, requestIdOf(request))
      return ok(request, await getProject(db, actor, id))
    })
    .post('/projects/:id/finance-close', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'project-order.close')
      const id = await visibleProject(actor, params.id)
      await closeFinance(db, actor, id, requestIdOf(request))
      return ok(request, await getProject(db, actor, id))
    })
    .post('/projects/:id/close', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'project-order.close')
      const id = await visibleProject(actor, params.id)
      await db.transaction(tx => closeProject(tx, actor, id, (body ?? {}) as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await getProject(db, actor, id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .put('/projects/:id/members/:userId', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'project-order.accept-handover')
      const id = await visibleProject(actor, params.id)
      await db.transaction(tx => addMember(tx, actor, id, assertIdParam(params.userId, 'User'), requestIdOf(request)))
      return ok(request, await getProject(db, actor, id))
    })
    .delete('/projects/:id/members/:userId', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'project-order.accept-handover')
      const id = await visibleProject(actor, params.id)
      await db.transaction(tx => removeMember(tx, actor, id, assertIdParam(params.userId, 'User'), requestIdOf(request)))
      return ok(request, await getProject(db, actor, id))
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
    .post('/parties', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'crm.manage-party')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /parties', key, body }, tx =>
        createParty(tx, actor, body as Parameters<typeof createParty>[2], requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await getParty(db, actor, result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/parties/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'crm.manage-party')
      const id = assertIdParam(params.id, 'Customer')
      if (!(await getParty(db, actor, id))) throw errors.notFound('Customer')
      await db.transaction(tx => updateParty(tx, actor, id, body as Parameters<typeof updateParty>[3], requestIdOf(request)))
      return ok(request, await getParty(db, actor, id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .put('/parties/:id/credit-limit', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.edit-credit-limit')
      const id = assertIdParam(params.id, 'Customer')
      if (!(await getParty(db, actor, id))) throw errors.notFound('Customer')
      await db.transaction(tx => setCreditLimit(tx, actor, id, body as Parameters<typeof setCreditLimit>[3], requestIdOf(request)))
      return ok(request, await getParty(db, actor, id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .get('/parties/:id/contacts', async ({ request, params }) => {
      const actor = await auth.requireActor(request)
      if (isPortalActor(actor) || !canListParties(actor)) throw errors.notFound('Customer')
      const id = assertIdParam(params.id, 'Customer')
      if (!(await getParty(db, actor, id))) throw errors.notFound('Customer')
      return ok(request, await listContacts(db, id))
    })
    .post('/parties/:id/contacts', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'crm.manage-party')
      const id = assertIdParam(params.id, 'Customer')
      if (!(await getParty(db, actor, id))) throw errors.notFound('Customer')
      const created = await db.transaction(tx => createContact(tx, actor, id, body as Record<string, unknown>, requestIdOf(request)))
      set.status = 201
      return ok(request, (await listContacts(db, id)).find(x => x.id === created.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .get('/party-contacts', async ({ request }) => {
      const actor = await auth.requireActor(request)
      if (isPortalActor(actor) || !canListParties(actor)) throw errors.forbidden()
      return ok(request, await listContacts(db))
    })
    .get('/party-activities', async ({ request, query }) => {
      const actor = await auth.requireActor(request)
      if (isPortalActor(actor) || !canListParties(actor)) throw errors.forbidden()
      for (const k of ['partyId', 'leadId'] as const) if (query[k] && !ID_PATTERN.test(query[k]!)) throw errors.validation({ [k]: ['ID tidak valid.'] })
      return ok(request, await listActivities(db, { partyId: query.partyId, leadId: query.leadId }))
    }, { query: t.Object({ partyId: t.Optional(t.String()), leadId: t.Optional(t.String()) }) })
    .post('/parties/:id/activities', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'crm.log-activity')
      const id = assertIdParam(params.id, 'Customer')
      if (!(await getParty(db, actor, id))) throw errors.notFound('Customer')
      const created = await db.transaction(tx => createActivity(tx, actor, id, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      set.status = 201
      return ok(request, (await listActivities(db, { partyId: id })).find(x => x.id === created.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
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
    .post('/vendors', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'vendor.manage-vendor')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /vendors', key, body }, tx =>
        createVendor(tx, actor, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await getVendor(db, actor, result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/vendors/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'vendor.manage-vendor')
      const id = await visibleVendor(actor, params.id)
      await db.transaction(tx => updateVendor(tx, actor, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await getVendor(db, actor, id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/vendors/:id/contacts', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'vendor.manage-vendor')
      const id = await visibleVendor(actor, params.id)
      const created = await db.transaction(tx => createVendorContact(tx, actor, id, body as Record<string, unknown>, requestIdOf(request)))
      set.status = 201
      return ok(request, (await listVendorContacts(db, id)).find(x => x.id === created.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/vendors/:id/products', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'vendor.manage-vendor')
      const id = await visibleVendor(actor, params.id)
      const created = await db.transaction(tx => createVendorProduct(tx, actor, id, body as Record<string, unknown>, requestIdOf(request)))
      set.status = 201
      return ok(request, (await listVendorProducts(db, id)).find(x => x.id === created.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/vendors/:id/documents', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'vendor.manage-vendor')
      const id = await visibleVendor(actor, params.id)
      const created = await db.transaction(tx => createVendorDocument(tx, actor, id, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      set.status = 201
      return ok(request, (await listVendorDocuments(db, id)).find(x => x.id === created.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .get('/vendor-contacts', async ({ request }) => {
      const actor = await auth.requireActor(request)
      if (isPortalActor(actor) || !canListVendors(actor)) throw errors.forbidden()
      return ok(request, await listVendorContacts(db))
    })
    .get('/vendor-products', async ({ request }) => {
      const actor = await auth.requireActor(request)
      if (isPortalActor(actor) || !canListVendors(actor)) throw errors.forbidden()
      return ok(request, await listVendorProducts(db))
    })
    .get('/vendor-documents', async ({ request }) => {
      const actor = await auth.requireActor(request)
      if (isPortalActor(actor) || !canListVendors(actor)) throw errors.forbidden()
      return ok(request, await listVendorDocuments(db))
    })
    .get('/project-services', async ({ request, query }) => {
      const actor = await auth.requireActor(request)
      if (actor.role === 'client') throw errors.forbidden()
      if (query.projectId && !ID_PATTERN.test(query.projectId)) throw errors.validation({ projectId: ['ID project tidak valid.'] })
      return ok(request, await listProjectServices(db, actor, { projectId: query.projectId }))
    }, { query: t.Object({ projectId: t.Optional(t.String()) }) })
    .post('/projects/:id/services', async ({ request, params, body, set }) => {
      const actor = await auth.requireActor(request)
      const b = body as Record<string, unknown>
      // A known type needs its own capability; an unknown type is a validation error for anyone who may add services.
      if ((SERVICE_TYPES as readonly unknown[]).includes(b.type)) requireServiceCapability(actor, b.type as string)
      else if (isPortalActor(actor) || !SERVICE_TYPES.some(s => hasCapability(actor.role, serviceCapability(s)))) throw errors.forbidden()
      const projectId = await visibleProject(actor, params.id)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: `POST /projects/${projectId}/services`, key, body }, tx =>
        createService(tx, actor, projectId, b, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await getProjectService(db, actor, result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/project-services/:id', async ({ request, params, body }) => {
      const actor = await auth.requireActor(request)
      const id = assertIdParam(params.id, 'Layanan')
      const current = isPortalActor(actor) ? null : await getProjectService(db, actor, id)
      if (!current) throw errors.notFound('Layanan')
      requireServiceCapability(actor, current.type)
      await db.transaction(tx => updateService(tx, actor, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await getProjectService(db, actor, id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .get('/vendor-quotations', async ({ request, query }) => {
      const actor = await auth.requireActor(request)
      if (actor.role === 'client') throw errors.forbidden()
      for (const k of ['projectId', 'serviceId', 'vendorId'] as const) {
        if (query[k] && !ID_PATTERN.test(query[k]!)) throw errors.validation({ [k]: ['ID tidak valid.'] })
      }
      return ok(request, await listQuotations(db, actor, { projectId: query.projectId, serviceId: query.serviceId, vendorId: query.vendorId }))
    }, { query: t.Object({ projectId: t.Optional(t.String()), serviceId: t.Optional(t.String()), vendorId: t.Optional(t.String()) }) })
    .post('/vendor-quotations', async ({ request, body, set }) => {
      const actor = await auth.requireActor(request)
      const b = body as Record<string, unknown>
      // A known type needs its own capability; an unknown type is a validation error for anyone who may add services.
      if ((SERVICE_TYPES as readonly unknown[]).includes(b.serviceType)) requireServiceCapability(actor, b.serviceType as string)
      else if (isPortalActor(actor) || !SERVICE_TYPES.some(s => hasCapability(actor.role, serviceCapability(s)))) throw errors.forbidden()
      if (typeof b.projectId !== 'string' || !b.projectId) throw errors.validation({ projectId: ['Project wajib diisi.'] })
      const projectId = await visibleProject(actor, b.projectId)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /vendor-quotations', key, body }, tx =>
        submitQuotation(tx, actor, projectId, b, businessDateOf(new Date()), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, (await listQuotations(db, actor, { id: result.data.id }))[0])
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/vendor-quotations/:id/accept', async ({ request, params }) => {
      const actor = await auth.requireActor(request)
      const q = await writableQuotation(actor, params.id)
      await db.transaction(tx => acceptQuotation(tx, actor, q.id, requestIdOf(request)))
      return ok(request, (await listQuotations(db, actor, { id: q.id }))[0])
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/vendor-quotations/:id/reject', async ({ request, params, body }) => {
      const actor = await auth.requireActor(request)
      const q = await writableQuotation(actor, params.id)
      await db.transaction(tx => rejectQuotation(tx, actor, q.id, (body as Record<string, unknown> | undefined)?.reason, requestIdOf(request)))
      return ok(request, (await listQuotations(db, actor, { id: q.id }))[0])
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .get('/service-orders', async ({ request, query }) => {
      const actor = await auth.requireActor(request)
      if (actor.role === 'client' || (!isPortalActor(actor) && !canListVendors(actor))) throw errors.forbidden()
      for (const k of ['projectId', 'vendorId', 'serviceId'] as const) {
        if (query[k] && !ID_PATTERN.test(query[k]!)) throw errors.validation({ [k]: ['ID tidak valid.'] })
      }
      return ok(request, await listServiceOrders(db, actor, { projectId: query.projectId, vendorId: query.vendorId, serviceId: query.serviceId }))
    }, { query: t.Object({ projectId: t.Optional(t.String()), vendorId: t.Optional(t.String()), serviceId: t.Optional(t.String()) }) })
    .post('/service-orders/:id/status', async ({ request, params, body }) => {
      const actor = await auth.requireActor(request)
      const id = assertIdParam(params.id, 'Service order')
      const so = isPortalActor(actor) ? null : await getServiceOrder(db, actor, id)
      if (!so) throw errors.notFound('Service order')
      // Orders on a service follow its type's capability; legacy orders without a service belong to vendor management.
      if (so.serviceType) requireServiceCapability(actor, so.serviceType)
      else if (!hasCapability(actor.role, 'vendor.manage-vendor')) throw errors.forbidden()
      const b = (body ?? {}) as Record<string, unknown>
      await db.transaction(tx => changeServiceOrderStatus(tx, actor, id, b.to, b.reason, requestIdOf(request)))
      return ok(request, await getServiceOrder(db, actor, id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .get('/service-orders/:id', async ({ request, params }) => {
      const actor = await auth.requireActor(request)
      if (!isPortalActor(actor) && !canListVendors(actor)) throw errors.forbidden()
      const serviceOrder = await getServiceOrder(db, actor, assertIdParam(params.id, 'Service order'))
      if (!serviceOrder) throw errors.notFound('Service order')
      return ok(request, serviceOrder)
    })
    .get('/bookings', async ({ request, query }) => {
      const actor = await auth.requireActor(request)
      if (actor.role === 'client') throw errors.forbidden()
      if (query.projectId && !ID_PATTERN.test(query.projectId)) throw errors.validation({ projectId: ['ID project tidak valid.'] })
      return ok(request, await listBookings(db, actor, { projectId: query.projectId, type: query.type ? bookingType(query.type) : undefined }))
    }, { query: t.Object({ projectId: t.Optional(t.String()), type: t.Optional(t.String()) }) })
    .post('/bookings/:type', async ({ request, params, body, set }) => {
      const actor = await auth.requireActor(request)
      const type = bookingType(params.type)
      requireServiceCapability(actor, serviceTypeOf(type))
      const b = body as Record<string, unknown>
      if (typeof b.projectId !== 'string' || !b.projectId) throw errors.validation({ projectId: ['Project wajib diisi.'] })
      const projectId = await visibleProject(actor, b.projectId)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: `POST /bookings/${type}`, key, body }, tx =>
        createBooking(tx, actor, type, projectId, b, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await getBooking(db, actor, type, result.data.id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .patch('/bookings/:type/:id', async ({ request, params, body }) => {
      const actor = await auth.requireActor(request)
      const { type, id } = await writableBooking(actor, params.type, params.id)
      await db.transaction(tx => updateBooking(tx, actor, type, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await getBooking(db, actor, type, id))
    }, { body: t.Record(t.String(), t.Unknown()) })
    .post('/bookings/:type/:id/status', async ({ request, params, body }) => {
      const actor = await auth.requireActor(request)
      const { type, id } = await writableBooking(actor, params.type, params.id)
      const b = (body ?? {}) as Record<string, unknown>
      await db.transaction(tx => changeBookingStatus(tx, actor, type, id, b.to, b.reason, requestIdOf(request)))
      return ok(request, await getBooking(db, actor, type, id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
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
