import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { clientChangeRequest, clientDocument, clientMessage, clientTraveler } from './client-scope'
import { clientCancelChangeRequest, clientCreateChangeRequest, clientDecideChangeRequest, listChangeRequests } from './change-requests'
import {
  clientCancelTraveler, clientCreateDocument, clientCreateRoom, clientCreateTraveler, clientImportTravelers, clientMarkMessagesRead, clientReplaceDocument,
  clientCreateContact, clientDeleteContact, clientDisputeInvoice, clientReplaceTraveler, clientSendMessage, clientSetRoomTravelers, clientUpdateContact,
  clientUpdateProfile, clientUpdateTraveler
} from './client-writes'
import { listDocuments, listMessages } from './documents'
import { listRoomAssignments, listTravelers, rule } from './travelers'
import { getParty, listContacts } from './repository'
import { getClientInvoice, listClientQuotations } from './client-commerce'
import { respondToQuotation } from '../sales/quotation-writes'
import { markInvoiceViewed, submitPaymentProof } from '../finance/payment-proofs'
import { clientPendingChange, submitProfileChange } from './profile-changes'
import { businessDateOf } from '../../shared/dates'

/** Client portal writes (S12b-1): only a client, only its own party (from the session). */
export function clientWriteRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const body = { body: t.Record(t.String(), t.Unknown()) }

  async function clientActor(request: Request) {
    const actor = await auth.requireActor(request)
    if (actor.role !== 'client') throw errors.forbidden()
    return { actor, partyId: actor.partyId ?? '__no-party__' }
  }
  const travelerView = async (id: string) => clientTraveler((await listTravelers(db, { id }))[0]!)
  const roomView = async (id: string) => (await listRoomAssignments(db, { id }))[0]!
  const changeRequestView = async (id: string) => clientChangeRequest((await listChangeRequests(db, { id }))[0]!)
  const documentView = async (id: string) => clientDocument((await listDocuments(db, { id }))[0]!)
  const messageView = async (id: string) => clientMessage((await listMessages(db, { id }))[0]!)

  return new Elysia({ prefix: '/api/v1/client' })
    .post('/projects/:id/travelers', async ({ request, params, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const projectId = assertIdParam(params.id, 'Project')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/projects/:id/travelers', key, body: { projectId, ...(body as object) } }, tx =>
        clientCreateTraveler(tx, actor, partyId, projectId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await travelerView(result.data.id))
    }, body)
    .patch('/travelers/:id', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Traveler')
      await db.transaction(tx => clientUpdateTraveler(tx, actor, partyId, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await travelerView(id))
    }, body)
    .post('/travelers/:id/cancel', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Traveler')
      await db.transaction(tx => clientCancelTraveler(tx, actor, partyId, id, (body as Record<string, unknown>).reason, requestIdOf(request)))
      return ok(request, await travelerView(id))
    }, body)
    .post('/travelers/:id/replace', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Traveler')
      const created = await db.transaction(tx => clientReplaceTraveler(tx, actor, partyId, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, await travelerView(created.id))
    }, body)
    .post('/projects/:id/travelers/import', async ({ request, params, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const projectId = assertIdParam(params.id, 'Project')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/projects/:id/travelers/import', key, body: { projectId, ...(body as object) } }, tx =>
        clientImportTravelers(tx, actor, partyId, projectId, (body as Record<string, unknown>).rows, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      // Same shape as the internal import: the created travelers (client view) and the rejected rows.
      const all = await listTravelers(db, { projectId })
      return ok(request, { created: all.filter(x => result.data.created.includes(x.id)).map(clientTraveler), rejected: result.data.rejected })
    }, body)
    .post('/projects/:id/room-assignments', async ({ request, params, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const projectId = assertIdParam(params.id, 'Project')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/projects/:id/room-assignments', key, body: { projectId, ...(body as object) } }, tx =>
        clientCreateRoom(tx, actor, partyId, projectId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await roomView(result.data.id))
    }, body)
    .put('/room-assignments/:id/travelers', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Kamar')
      await db.transaction(tx => clientSetRoomTravelers(tx, actor, partyId, id, (body as Record<string, unknown>).travelerIds, requestIdOf(request)))
      return ok(request, await roomView(id))
    }, body)
    .post('/documents', async ({ request, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/documents', key, body }, tx =>
        clientCreateDocument(tx, actor, partyId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await documentView(result.data.id))
    }, body)
    .post('/documents/:id/replace', async ({ request, params, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Dokumen')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/documents/:id/replace', key, body: { id, ...(body as object) } }, tx =>
        clientReplaceDocument(tx, actor, partyId, id, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await documentView(result.data.id))
    }, body)
    .post('/messages', async ({ request, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/messages', key, body }, tx =>
        clientSendMessage(tx, actor, partyId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await messageView(result.data.id))
    }, body)
    .post('/projects/:id/messages/read', async ({ request, params }) => {
      const { actor, partyId } = await clientActor(request)
      const projectId = assertIdParam(params.id, 'Project')
      return ok(request, await db.transaction(tx => clientMarkMessagesRead(tx, actor, partyId, projectId)))
    })
    .get('/profile', async ({ request }) => {
      const { actor, partyId } = await clientActor(request)
      const party = await getParty(db, actor, partyId)
      if (!party) throw errors.notFound('Customer')
      return ok(request, { ...party, pendingChange: await clientPendingChange(db, partyId) })
    })
    .patch('/profile', async ({ request, body }) => {
      const { actor, partyId } = await clientActor(request)
      await db.transaction(tx => clientUpdateProfile(tx, actor, partyId, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, { ...(await getParty(db, actor, partyId)), pendingChange: await clientPendingChange(db, partyId) })
    }, body)
    // S12c-1: registration / tax / billing data and the company name are proposed here and checked by our team.
    .post('/profile/changes', async ({ request, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      await db.transaction(tx => submitProfileChange(tx, actor, partyId, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      set.status = 201
      return ok(request, { ...(await getParty(db, actor, partyId)), pendingChange: await clientPendingChange(db, partyId) })
    }, body)
    .get('/contacts', async ({ request }) => {
      const { partyId } = await clientActor(request)
      return ok(request, await listContacts(db, partyId))
    })
    .post('/contacts', async ({ request, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/contacts', key, body }, tx =>
        clientCreateContact(tx, actor, partyId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, (await listContacts(db, partyId)).find(x => x.id === result.data.id))
    }, body)
    .patch('/contacts/:id', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Kontak')
      await db.transaction(tx => clientUpdateContact(tx, actor, partyId, id, body as Record<string, unknown>, requestIdOf(request)))
      return ok(request, (await listContacts(db, partyId)).find(x => x.id === id))
    }, body)
    .delete('/contacts/:id', async ({ request, params }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Kontak')
      await db.transaction(tx => clientDeleteContact(tx, actor, partyId, id, requestIdOf(request)))
      return ok(request, { id, deleted: true })
    })
    .post('/invoices/:id/dispute', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Invoice')
      const current = await getClientInvoice(db, partyId, id)
      if (current.status !== 'issued') throw errors.notFound('Invoice')
      if (current.outstandingMinor === '0') throw rule('Invoice ini sudah lunas — tidak bisa disengketakan.')
      await db.transaction(tx => clientDisputeInvoice(tx, actor, partyId, id, (body as Record<string, unknown>).reason, requestIdOf(request)))
      return ok(request, await getClientInvoice(db, partyId, id))
    }, body)
    // S12b-2: change requests — submit, decide the impact staff sent, cancel until decided.
    .post('/projects/:id/change-requests', async ({ request, params, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const projectId = assertIdParam(params.id, 'Project')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/projects/:id/change-requests', key, body: { projectId, ...(body as object) } }, tx =>
        clientCreateChangeRequest(tx, actor, partyId, projectId, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await changeRequestView(result.data.id))
    }, body)
    .post('/change-requests/:id/approve', async ({ request, params }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Change request')
      await db.transaction(tx => clientDecideChangeRequest(tx, actor, partyId, id, 'approved', null, requestIdOf(request)))
      return ok(request, await changeRequestView(id))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
    .post('/change-requests/:id/reject', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Change request')
      await db.transaction(tx => clientDecideChangeRequest(tx, actor, partyId, id, 'rejected', (body as Record<string, unknown>).reason, requestIdOf(request)))
      return ok(request, await changeRequestView(id))
    }, body)
    .post('/change-requests/:id/cancel', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Change request')
      await db.transaction(tx => clientCancelChangeRequest(tx, actor, partyId, id, (body as Record<string, unknown>).reason, requestIdOf(request)))
      return ok(request, await changeRequestView(id))
    }, body)
    // S12b-2: the client answers a quotation it was sent (once per version); staff decide what happens next.
    .post('/quotations/:id/respond', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Quotation')
      await db.transaction(tx => respondToQuotation(tx, actor, partyId, id, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      return ok(request, (await listClientQuotations(db, partyId)).find(q => q.id === id))
    }, body)
    // S12c-1: a proof of payment (Finance verifies it) and the first time the client opens an invoice.
    .post('/invoices/:id/payment-proofs', async ({ request, params, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Invoice')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/invoices/:id/payment-proofs', key, body: { id, ...(body as object) } }, tx =>
        submitPaymentProof(tx, actor, partyId, id, body as Record<string, unknown>, businessDateOf(new Date()), requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, await getClientInvoice(db, partyId, id))
    }, body)
    .post('/invoices/:id/viewed', async ({ request, params }) => {
      const { partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Invoice')
      return ok(request, await db.transaction(tx => markInvoiceViewed(tx, partyId, id)))
    }, { body: t.Optional(t.Record(t.String(), t.Unknown())) })
}
