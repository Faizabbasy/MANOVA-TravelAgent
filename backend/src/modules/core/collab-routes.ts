import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { CHANGE_TYPES, clientCreateChangeRequest, listChangeRequests } from './change-requests'
import { clientChangeRequest } from './client-scope'
import {
  addAttachment, addComment, assertAttachmentEntity, assertStaffCollab, clientAttachment, clientComment, deleteChangeRequestDraft, listAttachments,
  listChangeRequestDrafts, listComments, resolveCollabTarget, saveChangeRequestDraft, takeChangeRequestDraft
} from './collab'

/** S12c-5: comments & attachment names (client portal and staff) and the client's change-request drafts. */
export function collabRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const body = { body: t.Record(t.String(), t.Unknown()) }
  const target = { query: t.Object({ entityType: t.String(), entityId: t.String() }) }
  const field = (b: unknown, key: string) => (b as Record<string, unknown> | undefined)?.[key]

  async function clientActor(request: Request) {
    const actor = await auth.requireActor(request)
    if (actor.role !== 'client') throw errors.forbidden()
    return { actor, partyId: actor.partyId ?? '__no-party__' }
  }
  async function staffActor(request: Request, entityType: unknown) {
    const actor = await auth.requireActor(request)
    assertStaffCollab(actor, entityType)
    return actor
  }
  const draftView = async (partyId: string, id: string) => (await listChangeRequestDrafts(db, partyId, id))[0]!

  const client = new Elysia({ prefix: '/api/v1/client' })
    .get('/comments', async ({ request, query }) => {
      const { partyId } = await clientActor(request)
      const tgt = await resolveCollabTarget(db, query.entityType, query.entityId, partyId)
      return ok(request, (await listComments(db, tgt.entityType, tgt.entityId)).map(clientComment))
    }, target)
    .post('/comments', async ({ request, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const tgt = await resolveCollabTarget(db, field(body, 'entityType'), field(body, 'entityId'), partyId)
      const key = requireIdempotencyKey(request)
      await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/comments', key, body }, tx => addComment(tx, actor, tgt, field(body, 'body'), requestIdOf(request)))
      set.status = 201
      return ok(request, (await listComments(db, tgt.entityType, tgt.entityId)).map(clientComment))
    }, body)
    .get('/attachments', async ({ request, query }) => {
      const { partyId } = await clientActor(request)
      const tgt = await resolveCollabTarget(db, query.entityType, query.entityId, partyId)
      assertAttachmentEntity(tgt)
      return ok(request, (await listAttachments(db, tgt.entityType, tgt.entityId)).map(clientAttachment))
    }, target)
    .post('/attachments', async ({ request, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const tgt = await resolveCollabTarget(db, field(body, 'entityType'), field(body, 'entityId'), partyId)
      const key = requireIdempotencyKey(request)
      await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/attachments', key, body }, tx => addAttachment(tx, actor, tgt, field(body, 'fileName'), requestIdOf(request)))
      set.status = 201
      return ok(request, (await listAttachments(db, tgt.entityType, tgt.entityId)).map(clientAttachment))
    }, body)
    .get('/change-request-drafts', async ({ request }) => {
      const { partyId } = await clientActor(request)
      return ok(request, await listChangeRequestDrafts(db, partyId))
    })
    .post('/change-request-drafts', async ({ request, body, set }) => {
      const { actor, partyId } = await clientActor(request)
      const { id } = await db.transaction(tx => saveChangeRequestDraft(tx, actor, partyId, null, body as Record<string, unknown>, CHANGE_TYPES, requestIdOf(request)))
      set.status = 201
      return ok(request, await draftView(partyId, id))
    }, body)
    .patch('/change-request-drafts/:id', async ({ request, params, body }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Draft')
      await db.transaction(tx => saveChangeRequestDraft(tx, actor, partyId, id, body as Record<string, unknown>, CHANGE_TYPES, requestIdOf(request)))
      return ok(request, await draftView(partyId, id))
    }, body)
    .delete('/change-request-drafts/:id', async ({ request, params }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Draft')
      await db.transaction(tx => deleteChangeRequestDraft(tx, actor, partyId, id, requestIdOf(request)))
      return ok(request, { id })
    })
    /** The draft becomes a real change request (same rules as a direct one) and the draft is removed — in one step. */
    .post('/change-request-drafts/:id/submit', async ({ request, params, set }) => {
      const { actor, partyId } = await clientActor(request)
      const id = assertIdParam(params.id, 'Draft')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /client/change-request-drafts/:id/submit', key, body: { id } }, async (tx) => {
        const draft = await takeChangeRequestDraft(tx, partyId, id)
        const created = await clientCreateChangeRequest(tx, actor, partyId, draft.project_id, {
          changeType: draft.change_type ?? undefined, beforeSummary: draft.before_summary, afterSummary: draft.after_summary
        }, requestIdOf(request))
        await deleteChangeRequestDraft(tx, actor, partyId, id, requestIdOf(request))
        return created
      })
      set.status = 201
      return ok(request, clientChangeRequest((await listChangeRequests(db, { id: result.data.id }))[0]!))
    })

  const staff = new Elysia({ prefix: '/api/v1' })
    .get('/comments', async ({ request, query }) => {
      await staffActor(request, query.entityType)
      const tgt = await resolveCollabTarget(db, query.entityType, query.entityId)
      return ok(request, await listComments(db, tgt.entityType, tgt.entityId))
    }, target)
    .post('/comments', async ({ request, body, set }) => {
      const actor = await staffActor(request, field(body, 'entityType'))
      const tgt = await resolveCollabTarget(db, field(body, 'entityType'), field(body, 'entityId'))
      const key = requireIdempotencyKey(request)
      await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /comments', key, body }, tx => addComment(tx, actor, tgt, field(body, 'body'), requestIdOf(request)))
      set.status = 201
      return ok(request, await listComments(db, tgt.entityType, tgt.entityId))
    }, body)
    .get('/attachments', async ({ request, query }) => {
      await staffActor(request, query.entityType)
      const tgt = await resolveCollabTarget(db, query.entityType, query.entityId)
      assertAttachmentEntity(tgt)
      return ok(request, await listAttachments(db, tgt.entityType, tgt.entityId))
    }, target)
    .post('/attachments', async ({ request, body, set }) => {
      const actor = await staffActor(request, field(body, 'entityType'))
      const tgt = await resolveCollabTarget(db, field(body, 'entityType'), field(body, 'entityId'))
      const key = requireIdempotencyKey(request)
      await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /attachments', key, body }, tx => addAttachment(tx, actor, tgt, field(body, 'fileName'), requestIdOf(request)))
      set.status = 201
      return ok(request, await listAttachments(db, tgt.entityType, tgt.entityId))
    }, body)

  return new Elysia().use(client).use(staff)
}
