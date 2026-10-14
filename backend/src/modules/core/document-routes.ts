import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { ID_PATTERN, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { createDocument, listDocuments, listMessages, sendMessage } from './documents'
import { isPortalActor } from './scope'
import { clientDocument, clientMessage, forReader, readerScopeOf } from './client-scope'

/** Document metadata and messages (S9). Internal roles read and send messages; `document.manage` uploads documents. */
export function documentRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const projectQuery = { query: t.Object({ projectId: t.Optional(t.String()) }) }

  async function internalActor(request: Request) {
    const actor = await auth.requireActor(request)
    if (isPortalActor(actor)) throw errors.forbidden()
    return actor
  }
  const checkProjectQuery = (projectId?: string) => {
    if (projectId && !ID_PATTERN.test(projectId)) throw errors.validation({ projectId: ['ID tidak valid.'] })
    return projectId
  }

  return new Elysia({ prefix: '/api/v1' })
    .get('/documents', async ({ request, query }) => {
      // A client reads only client-visible documents of its own party (S12a).
      const scope = readerScopeOf(await auth.requireActor(request))
      return ok(request, forReader(scope, await listDocuments(db, { projectId: checkProjectQuery(query.projectId), partyId: scope.partyId }), clientDocument))
    }, projectQuery)
    .post('/documents', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'document.manage')
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /documents', key, body }, tx =>
        createDocument(tx, actor, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, (await listDocuments(db, { id: result.data.id }))[0])
    }, { body: t.Record(t.String(), t.Unknown()) })
    .get('/messages', async ({ request, query }) => {
      // A client reads only the client messages of its own projects (S12a).
      const scope = readerScopeOf(await auth.requireActor(request))
      return ok(request, forReader(scope, await listMessages(db, { projectId: checkProjectQuery(query.projectId), partyId: scope.partyId }), clientMessage))
    }, projectQuery)
    .post('/messages', async ({ request, body, set }) => {
      const actor = await internalActor(request)
      const key = requireIdempotencyKey(request)
      const result = await withIdempotency(db, { actorUserId: actor.userId, route: 'POST /messages', key, body }, tx =>
        sendMessage(tx, actor, body as Record<string, unknown>, requestIdOf(request)))
      if (result.replayed) set.headers['idempotent-replayed'] = 'true'
      set.status = 201
      return ok(request, (await listMessages(db, { id: result.data.id }))[0])
    }, { body: t.Record(t.String(), t.Unknown()) })
}
