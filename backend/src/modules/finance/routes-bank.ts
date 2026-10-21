import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext, SessionActor } from '../../auth/context'
import { assertIdParam, ok, requestIdOf } from '../../http/envelope'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { importStatement, listStatementLines, matchStatementLine, previewStatement, recordFromStatementLine, unmatchStatementLine } from './bank-statements'
import type { StatementMapping } from './statement-csv'

/**
 * Rekening koran (owner accounting F7). Reads and preview = finance.view-cash · import, match, unmatch and "record from
 * line" = finance.post-cash with an Idempotency-Key. Raw statement rows stay server-side (not returned in lists).
 */
const text = t.String({ maxLength: 500 })
const mapping = t.Object({
  delimiter: t.String({ maxLength: 2 }), skipRows: t.Integer(), dateColumn: t.Integer(), dateFormat: text, descriptionColumn: t.Integer(),
  amountColumn: t.Optional(t.Integer()), debitColumn: t.Optional(t.Integer()), creditColumn: t.Optional(t.Integer()), referenceColumn: t.Optional(t.Integer()), numberStyle: text
}, { additionalProperties: false })
const statementBody = t.Object({ bankAccountId: text, fileName: text, csv: t.String({ maxLength: 2_000_000 }), mapping }, { additionalProperties: false })

export function bankRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps
  async function idempotent<T>(request: Request, set: { headers: Record<string, string | number> }, actor: SessionActor, route: string, body: unknown, fn: Parameters<typeof withIdempotency<T>>[2]) {
    const result = await withIdempotency<T>(db, { actorUserId: actor.userId, route, key: requireIdempotencyKey(request), body }, fn)
    if (result.replayed) set.headers['idempotent-replayed'] = 'true'
    return ok(request, result.data)
  }
  const asInput = (b: { bankAccountId: string; fileName: string; csv: string; mapping: Record<string, unknown> }) => ({ ...b, mapping: b.mapping as unknown as StatementMapping })
  return new Elysia({ prefix: '/api/v1/finance' })
    .post('/bank-statements/preview', async ({ request, body }) => {
      await auth.requireCapability(request, 'finance.view-cash')
      return ok(request, await previewStatement(db, asInput(body)))
    }, { body: statementBody })
    .post('/bank-statements', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.post-cash')
      set.status = 201
      return idempotent(request, set, actor, 'POST /finance/bank-statements', body, tx => importStatement(tx, actor, asInput(body), requestIdOf(request)))
    }, { body: statementBody })
    .get('/bank-statement-lines', async ({ request, query }) => {
      await auth.requireCapability(request, 'finance.view-cash')
      return ok(request, await listStatementLines(db, query))
    }, { query: t.Object({ bankAccountId: text, from: t.Optional(text), to: t.Optional(text), status: t.Optional(text) }) })
    .post('/bank-statement-lines/:id/match', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.post-cash')
      const id = assertIdParam(params.id, 'Baris rekening koran')
      return idempotent(request, set, actor, `POST /finance/bank-statement-lines/${id}/match`, body, tx => matchStatementLine(tx, actor, id, body, requestIdOf(request)))
    }, { body: t.Object({ matches: t.Array(t.Object({ transactionId: text, amountMinor: t.String({ maxLength: 20 }) }), { maxItems: 20 }) }, { additionalProperties: false }) })
    .post('/bank-statement-lines/:id/unmatch', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.post-cash')
      const id = assertIdParam(params.id, 'Baris rekening koran')
      return idempotent(request, set, actor, `POST /finance/bank-statement-lines/${id}/unmatch`, body, tx => unmatchStatementLine(tx, actor, id, body.reason, requestIdOf(request)))
    }, { body: t.Object({ reason: text }, { additionalProperties: false }) })
    .post('/bank-statement-lines/:id/record', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.post-cash')
      const id = assertIdParam(params.id, 'Baris rekening koran')
      set.status = 201
      return idempotent(request, set, actor, `POST /finance/bank-statement-lines/${id}/record`, body, tx => recordFromStatementLine(tx, actor, id, body, requestIdOf(request)))
    }, { body: t.Object({ category: t.Optional(text), projectId: t.Optional(text), memo: t.Optional(text) }, { additionalProperties: false }) })
}
