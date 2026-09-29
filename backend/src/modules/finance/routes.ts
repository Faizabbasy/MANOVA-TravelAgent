import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { hasCapability } from '../../auth/rbac'
import { assertIdParam, MAX_PAGE_LIMIT, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { createAccount, getAccount, listAccounts, submitOpening, updateAccount, verifyOpening } from './accounts'
import { postManualTransaction, postTransfer, reverseTransaction, reverseTransfer } from './postings'
import { accountLedger, cashPosition, getTransaction, getTransfer, statement } from './reads'

/**
 * Finance Phase 2 API — bank accounts, opening balance, the cash book, transfers, statement and ledger.
 * Capabilities (ADR-006/007): read = finance.view-cash · accounts = finance.manage-bank-accounts ·
 * opening verification = finance.approve-opening-balance (checker ≠ maker) · postings = finance.post-cash.
 * Every money-moving POST requires an Idempotency-Key header; a replay returns the first result.
 */

const bookingRef = t.Object({ type: t.String(), id: t.String() })

function parseLimit(raw: string | undefined): number {
  if (raw === undefined) return 50
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE_LIMIT) throw errors.validation({ limit: [`Harus bilangan bulat 1–${MAX_PAGE_LIMIT}.`] })
  return n
}

export function financeRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps

  /** Runs a posting command once per Idempotency-Key and marks replays with a response header. */
  async function idempotent<T>(
    request: Request,
    set: { headers: Record<string, string | number> },
    actorUserId: string,
    route: string,
    body: unknown,
    fn: Parameters<typeof withIdempotency<T>>[2]
  ) {
    const key = requireIdempotencyKey(request)
    const result = await withIdempotency<T>(db, { actorUserId, route, key, body }, fn)
    if (result.replayed) set.headers['idempotent-replayed'] = 'true'
    return ok(request, result.data)
  }

  return new Elysia({ prefix: '/api/v1/finance' })
    // ── Cash position, accounts ─────────────────────────────────────────────────────────────────────
    .get('/cash-position', async ({ request }) => {
      await auth.requireCapability(request, 'finance.view-cash')
      return ok(request, await cashPosition(db))
    })
    .get('/accounts', async ({ request }) => {
      const actor = await auth.requireCapability(request, 'finance.view-cash')
      return ok(request, await listAccounts(db, hasCapability(actor.role, 'finance.manage-bank-accounts')))
    })
    .get('/accounts/:id', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'finance.view-cash')
      return ok(request, await getAccount(db, assertIdParam(params.id, 'Rekening'), hasCapability(actor.role, 'finance.manage-bank-accounts')))
    })
    .post(
      '/accounts',
      async ({ request, body, set }) => {
        const actor = await auth.requireCapability(request, 'finance.manage-bank-accounts')
        set.status = 201
        return ok(request, await createAccount(db, actor, body, requestIdOf(request)))
      },
      {
        body: t.Object({
          code: t.String({ maxLength: 20, error: 'Kode rekening wajib diisi.' }),
          bankName: t.String({ maxLength: 80, error: 'Nama bank wajib diisi.' }),
          holderName: t.String({ maxLength: 120, error: 'Nama pemilik rekening wajib diisi.' }),
          accountNumber: t.String({ maxLength: 42, error: 'Nomor rekening wajib diisi.' })
        })
      }
    )
    .patch(
      '/accounts/:id',
      async ({ request, params, body }) => {
        const actor = await auth.requireCapability(request, 'finance.manage-bank-accounts')
        return ok(request, await updateAccount(db, actor, assertIdParam(params.id, 'Rekening'), body, requestIdOf(request)))
      },
      {
        body: t.Object({
          bankName: t.Optional(t.String({ maxLength: 80 })),
          holderName: t.Optional(t.String({ maxLength: 120 })),
          accountNumber: t.Optional(t.String({ maxLength: 42 })),
          isActive: t.Optional(t.Boolean())
        })
      }
    )
    .post(
      '/accounts/:id/opening',
      async ({ request, params, body }) => {
        const actor = await auth.requireCapability(request, 'finance.manage-bank-accounts')
        return ok(request, await submitOpening(db, actor, assertIdParam(params.id, 'Rekening'), body, requestIdOf(request)))
      },
      {
        body: t.Object({
          amountMinor: t.String({ error: 'Nominal saldo pembuka wajib diisi.' }),
          openingDate: t.String({ error: 'Tanggal saldo pembuka wajib diisi.' }),
          note: t.Optional(t.String({ maxLength: 500 }))
        })
      }
    )
    .post('/accounts/:id/opening/verify', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'finance.approve-opening-balance')
      const id = assertIdParam(params.id, 'Rekening')
      return ok(request, await verifyOpening(db, actor, id, requestIdOf(request), hasCapability(actor.role, 'finance.manage-bank-accounts')))
    })
    .get(
      '/accounts/:id/ledger',
      async ({ request, params, query }) => {
        await auth.requireCapability(request, 'finance.view-cash')
        return ok(request, await accountLedger(db, assertIdParam(params.id, 'Rekening'), query))
      },
      { query: t.Object({ from: t.Optional(t.String()), to: t.Optional(t.String()) }) }
    )

    // ── Statement and cash book ─────────────────────────────────────────────────────────────────────
    .get(
      '/statement',
      async ({ request, query }) => {
        await auth.requireCapability(request, 'finance.view-cash')
        const result = await statement(db, {
          ...query,
          includeTransfers: query.includeTransfers === undefined ? undefined : query.includeTransfers !== 'false',
          limit: parseLimit(query.limit)
        })
        return {
          data: result.items,
          meta: { requestId: requestIdOf(request), pagination: result.pagination, period: result.period, summary: result.summary }
        }
      },
      {
        query: t.Object({
          from: t.Optional(t.String()),
          to: t.Optional(t.String()),
          accountId: t.Optional(t.String()),
          projectId: t.Optional(t.String()),
          direction: t.Optional(t.String()),
          kind: t.Optional(t.String()),
          includeTransfers: t.Optional(t.String()),
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String())
        })
      }
    )
    .get('/transactions/:id', async ({ request, params }) => {
      await auth.requireCapability(request, 'finance.view-cash')
      return ok(request, await getTransaction(db, params.id))
    })
    .post(
      '/transactions',
      async ({ request, body, set }) => {
        const actor = await auth.requireCapability(request, 'finance.post-cash')
        set.status = 201
        return idempotent(request, set, actor.userId, 'POST /finance/transactions', body, tx =>
          postManualTransaction(tx, actor, body, requestIdOf(request)))
      },
      {
        body: t.Object({
          bankAccountId: t.String({ error: 'Pilih rekening.' }),
          kind: t.String({ error: 'Pilih jenis transaksi.' }),
          amountMinor: t.String({ error: 'Nominal wajib diisi.' }),
          effectiveDate: t.String({ error: 'Tanggal wajib diisi.' }),
          category: t.Optional(t.String()),
          projectId: t.Optional(t.String()),
          booking: t.Optional(bookingRef),
          partyId: t.Optional(t.String()),
          vendorId: t.Optional(t.String()),
          counterparty: t.Optional(t.String({ maxLength: 200 })),
          reference: t.Optional(t.String({ maxLength: 120 })),
          memo: t.Optional(t.String({ maxLength: 500 }))
        })
      }
    )
    .post(
      '/transactions/:id/reverse',
      async ({ request, params, body, set }) => {
        const actor = await auth.requireCapability(request, 'finance.post-cash')
        const id = assertIdParam(params.id, 'Transaksi')
        set.status = 201
        return idempotent(request, set, actor.userId, `POST /finance/transactions/${id}/reverse`, body, tx =>
          reverseTransaction(tx, actor, id, body.reason, requestIdOf(request)))
      },
      { body: t.Object({ reason: t.String({ error: 'Alasan pembatalan wajib diisi.' }) }) }
    )

    // ── Transfers ───────────────────────────────────────────────────────────────────────────────────
    .get('/transfers/:id', async ({ request, params }) => {
      await auth.requireCapability(request, 'finance.view-cash')
      return ok(request, await getTransfer(db, params.id))
    })
    .post(
      '/transfers',
      async ({ request, body, set }) => {
        const actor = await auth.requireCapability(request, 'finance.post-cash')
        set.status = 201
        return idempotent(request, set, actor.userId, 'POST /finance/transfers', body, tx =>
          postTransfer(tx, actor, body, requestIdOf(request)))
      },
      {
        body: t.Object({
          fromAccountId: t.String({ error: 'Pilih rekening asal.' }),
          toAccountId: t.String({ error: 'Pilih rekening tujuan.' }),
          amountMinor: t.String({ error: 'Nominal wajib diisi.' }),
          feeMinor: t.Optional(t.String()),
          effectiveDate: t.String({ error: 'Tanggal wajib diisi.' }),
          memo: t.Optional(t.String({ maxLength: 500 }))
        })
      }
    )
    .post(
      '/transfers/:id/reverse',
      async ({ request, params, body, set }) => {
        const actor = await auth.requireCapability(request, 'finance.post-cash')
        const id = assertIdParam(params.id, 'Transfer')
        set.status = 201
        return idempotent(request, set, actor.userId, `POST /finance/transfers/${id}/reverse`, body, tx =>
          reverseTransfer(tx, actor, id, body.reason, requestIdOf(request)))
      },
      { body: t.Object({ reason: t.String({ error: 'Alasan pembatalan wajib diisi.' }) }) }
    )
}
