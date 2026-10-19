import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { hasModuleLevel } from '../../auth/rbac'
import { assertIdParam, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { acknowledgeFeedback, closeFeedback, flagFeedbackFollowUp, listFeedback } from './feedback'
import { isPortalActor } from './scope'

/** CRM review of trip feedback (S12c-2): CRM readers list it; `crm.manage-follow-up` acknowledges, follows up, closes. */
export function feedbackRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  const CAP = 'crm.manage-follow-up' as const
  const anyBody = { body: t.Optional(t.Record(t.String(), t.Unknown())) }
  const view = async (id: string) => {
    const [f] = await listFeedback(db, { id })
    if (!f) throw errors.notFound('Feedback')
    return f
  }
  const field = (body: unknown, key: string) => (body as Record<string, unknown> | undefined)?.[key]

  return new Elysia({ prefix: '/api/v1' })
    .get('/feedback', async ({ request, query }) => {
      const actor = await auth.requireActor(request)
      if (isPortalActor(actor) || !hasModuleLevel(actor.role, 'crm', 'VIEW')) throw errors.forbidden()
      return ok(request, await listFeedback(db, { status: query.status }))
    }, { query: t.Object({ status: t.Optional(t.String()) }) })
    .post('/feedback/:id/acknowledge', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Feedback')
      await db.transaction(tx => acknowledgeFeedback(tx, actor, id, requestIdOf(request)))
      return ok(request, await view(id))
    }, anyBody)
    .post('/feedback/:id/follow-up', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Feedback')
      await db.transaction(tx => flagFeedbackFollowUp(tx, actor, id, field(body, 'note'), requestIdOf(request)))
      return ok(request, await view(id))
    }, anyBody)
    .post('/feedback/:id/close', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, CAP)
      const id = assertIdParam(params.id, 'Feedback')
      await db.transaction(tx => closeFeedback(tx, actor, id, field(body, 'note'), requestIdOf(request)))
      return ok(request, await view(id))
    }, anyBody)
}
