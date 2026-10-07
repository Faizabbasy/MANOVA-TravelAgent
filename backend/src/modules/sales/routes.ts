import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext, SessionActor } from '../../auth/context'
import { assertIdParam, ID_PATTERN, ok } from '../../http/envelope'
import { errors } from '../../http/errors'
import { isPortalActor } from '../core/scope'
import { listLeads, listSalesQuotations } from './repository'

/** Sales (S6a): leads, client quotations and Won. Internal roles read; Sales (admin) writes; portals never see leads. */
export function salesRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps

  async function readActor(request: Request): Promise<SessionActor> {
    const actor = await auth.requireActor(request)
    if (isPortalActor(actor)) throw errors.forbidden()
    return actor
  }

  async function leadResponse(id: string) {
    const [lead] = await listLeads(db, { id })
    if (!lead) throw errors.notFound('Lead')
    return lead
  }

  async function quotationResponse(id: string) {
    const [q] = await listSalesQuotations(db, { id })
    if (!q) throw errors.notFound('Quotation')
    return q
  }

  return new Elysia({ prefix: '/api/v1' })
    .get('/leads', async ({ request }) => {
      await readActor(request)
      return ok(request, await listLeads(db))
    })
    .get('/leads/:id', async ({ request, params }) => {
      await readActor(request)
      return ok(request, await leadResponse(assertIdParam(params.id, 'Lead')))
    })
    .get('/quotations', async ({ request, query }) => {
      await readActor(request)
      if (query.leadId && !ID_PATTERN.test(query.leadId)) throw errors.validation({ leadId: ['ID tidak valid.'] })
      return ok(request, await listSalesQuotations(db, { leadId: query.leadId }))
    }, { query: t.Object({ leadId: t.Optional(t.String()) }) })
    .get('/quotations/:id', async ({ request, params }) => {
      await readActor(request)
      return ok(request, await quotationResponse(assertIdParam(params.id, 'Quotation')))
    })
}
