import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext, SessionActor } from '../../auth/context'
import { hasCapability } from '../../auth/rbac'
import { assertIdParam, MAX_PAGE_LIMIT, ok, requestIdOf } from '../../http/envelope'
import { errors } from '../../http/errors'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { getBookingRef, getProject } from '../core/repository'
import {
  allocateVendorPayment, createVendorInvoice, getVendorInvoice, listPayables, postVendorPayment,
  reviewVendorInvoice, setVendorInvoiceExpectation, updateVendorInvoice, voidVendorInvoice
} from './payables'
import {
  allocateReceipt, cancelScheduleItem, createInvoiceDraft, createScheduleItem, deleteInvoiceDraft, getInvoice, issueCreditNote,
  issueInvoice, listInvoices, listReceivables, listSchedule, postReceipt, setInvoiceDispute, setInvoiceExpectation,
  updateInvoiceDraft, updateScheduleItem, voidCreditNote, voidInvoice
} from './receivables'
import { financeOverview } from './overview'
import { confirmGroupTripDp, salesOrderFinanceSummary } from './group-trip'
import { bookingFinanceSummary, listAdvances, partyFinanceSummary, projectFinanceSummary, vendorFinanceSummary } from './summaries'

/**
 * Finance Phase 3 API — receivables, payables, and finance context for other screens.
 * Capabilities: invoices/credit notes/schedule = finance.manage-receivables · vendor invoices =
 * finance.manage-payables · receipts/vendor payments/allocations = finance.post-cash (+ Idempotency-Key) ·
 * reads = finance.view-cash · summaries: full = finance.view-project-finance, status-only =
 * project-order.view-payment-status (Admin; no amounts).
 */

const bookingRef = t.Object({ type: t.String(), id: t.String() })
const line = t.Object({ description: t.String(), amountMinor: t.String() })

function parseLimit(raw: string | undefined): number {
  if (raw === undefined) return 50
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE_LIMIT) throw errors.validation({ limit: [`Harus bilangan bulat 1–${MAX_PAGE_LIMIT}.`] })
  return n
}

export function arApRoutes(deps: AppDeps, auth: AuthContext) {
  const { db } = deps

  /** Plain (non-money) command in one transaction. */
  const inTx = <T>(fn: Parameters<typeof db.transaction<T>>[0]) => db.transaction(fn)

  async function idempotent<T>(request: Request, set: { headers: Record<string, string | number> }, actor: SessionActor, route: string, body: unknown, fn: Parameters<typeof withIdempotency<T>>[2]) {
    const key = requireIdempotencyKey(request)
    const result = await withIdempotency<T>(db, { actorUserId: actor.userId, route, key, body }, fn)
    if (result.replayed) set.headers['idempotent-replayed'] = 'true'
    return ok(request, result.data)
  }

  /** Full view for Finance/Super Admin, status-only for Admin, 403 for everyone else. */
  async function summaryAccess(request: Request): Promise<{ actor: SessionActor; full: boolean }> {
    const actor = await auth.requireActor(request)
    if (hasCapability(actor.role, 'finance.view-project-finance')) return { actor, full: true }
    if (hasCapability(actor.role, 'project-order.view-payment-status')) return { actor, full: false }
    throw errors.forbidden()
  }

  return new Elysia({ prefix: '/api/v1' })
    // ── Billing schedule ────────────────────────────────────────────────────────────────────────────
    .get('/finance/billing-schedule', async ({ request, query }) => {
      await auth.requireCapability(request, 'finance.view-cash')
      return ok(request, await listSchedule(db, query))
    }, { query: t.Object({ projectId: t.Optional(t.String()), status: t.Optional(t.String()) }) })
    .post('/finance/billing-schedule', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-receivables')
      set.status = 201
      return ok(request, await inTx(tx => createScheduleItem(tx, actor, body, requestIdOf(request))))
    }, {
      body: t.Object({
        projectId: t.String({ error: 'Pilih project.' }), booking: t.Optional(bookingRef), label: t.String({ maxLength: 120, error: 'Nama termin wajib diisi.' }),
        invoiceType: t.String({ error: 'Pilih jenis tagihan.' }), amountMinor: t.String({ error: 'Nominal wajib diisi.' }), plannedDate: t.String({ error: 'Tanggal rencana wajib diisi.' })
      })
    })
    .patch('/finance/billing-schedule/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-receivables')
      return ok(request, await inTx(tx => updateScheduleItem(tx, actor, assertIdParam(params.id, 'Termin'), body, requestIdOf(request))))
    }, {
      body: t.Object({ label: t.Optional(t.String({ maxLength: 120 })), amountMinor: t.Optional(t.String()), plannedDate: t.Optional(t.String()), invoiceType: t.Optional(t.String()) })
    })
    .post('/finance/billing-schedule/:id/cancel', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-receivables')
      return ok(request, await inTx(tx => cancelScheduleItem(tx, actor, assertIdParam(params.id, 'Termin'), body.reason, requestIdOf(request))))
    }, { body: t.Object({ reason: t.String({ error: 'Alasan wajib diisi.' }) }) })

    // ── Customer invoices ───────────────────────────────────────────────────────────────────────────
    .get('/finance/customer-invoices', async ({ request, query }) => {
      await auth.requireCapability(request, 'finance.view-cash')
      return ok(request, await listInvoices(db, { ...query, limit: parseLimit(query.limit) }))
    }, { query: t.Object({ status: t.Optional(t.String()), projectId: t.Optional(t.String()), partyId: t.Optional(t.String()), limit: t.Optional(t.String()) }) })
    .get('/finance/customer-invoices/:id', async ({ request, params }) => {
      await auth.requireCapability(request, 'finance.view-cash')
      return ok(request, await getInvoice(db, params.id))
    })
    .post('/finance/customer-invoices', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-receivables')
      set.status = 201
      const created = await inTx(tx => createInvoiceDraft(tx, actor, body, requestIdOf(request)))
      return ok(request, await getInvoice(db, created.id))
    }, {
      body: t.Object({
        projectId: t.Optional(t.String()), booking: t.Optional(bookingRef), billingScheduleItemId: t.Optional(t.String()),
        invoiceType: t.Optional(t.String()), lines: t.Optional(t.Array(line)), dueDate: t.Optional(t.String()),
        expectedDate: t.Optional(t.String()), notes: t.Optional(t.String({ maxLength: 1000 }))
      })
    })
    .patch('/finance/customer-invoices/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-receivables')
      const id = assertIdParam(params.id, 'Invoice')
      await inTx(tx => updateInvoiceDraft(tx, actor, id, body, requestIdOf(request)))
      return ok(request, await getInvoice(db, id))
    }, {
      body: t.Object({
        projectId: t.Optional(t.String()), booking: t.Optional(bookingRef), billingScheduleItemId: t.Optional(t.String()),
        invoiceType: t.Optional(t.String()), lines: t.Optional(t.Array(line)), dueDate: t.Optional(t.String()),
        expectedDate: t.Optional(t.String()), notes: t.Optional(t.String({ maxLength: 1000 }))
      })
    })
    .delete('/finance/customer-invoices/:id', async ({ request, params }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-receivables')
      return ok(request, await inTx(tx => deleteInvoiceDraft(tx, actor, assertIdParam(params.id, 'Invoice'), requestIdOf(request))))
    })
    .post('/finance/customer-invoices/:id/issue', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-receivables')
      const id = assertIdParam(params.id, 'Invoice')
      const result = await inTx(tx => issueInvoice(tx, actor, id, body ?? {}, requestIdOf(request)))
      return { data: await getInvoice(db, id), meta: { requestId: requestIdOf(request), warnings: result.warnings } }
    }, { body: t.Optional(t.Object({ issueDate: t.Optional(t.String()), dueDate: t.Optional(t.String()) })) })
    .post('/finance/customer-invoices/:id/void', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-receivables')
      const id = assertIdParam(params.id, 'Invoice')
      await inTx(tx => voidInvoice(tx, actor, id, body.reason, requestIdOf(request)))
      return ok(request, await getInvoice(db, id))
    }, { body: t.Object({ reason: t.String({ error: 'Alasan wajib diisi.' }) }) })
    .patch('/finance/customer-invoices/:id/expectation', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-receivables')
      const id = assertIdParam(params.id, 'Invoice')
      await inTx(tx => setInvoiceExpectation(tx, actor, id, body, requestIdOf(request)))
      return ok(request, await getInvoice(db, id))
    }, { body: t.Object({ expectedDate: t.Union([t.String(), t.Null()]), reason: t.String({ error: 'Alasan wajib diisi.' }) }) })
    .post('/finance/customer-invoices/:id/dispute', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-receivables')
      const id = assertIdParam(params.id, 'Invoice')
      await inTx(tx => setInvoiceDispute(tx, actor, id, body, requestIdOf(request)))
      return ok(request, await getInvoice(db, id))
    }, { body: t.Object({ disputed: t.Boolean(), reason: t.String({ error: 'Alasan wajib diisi.' }) }) })

    // ── Credit notes ────────────────────────────────────────────────────────────────────────────────
    .post('/finance/credit-notes', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-receivables')
      set.status = 201
      return ok(request, await inTx(tx => issueCreditNote(tx, actor, body, requestIdOf(request))))
    }, { body: t.Object({ invoiceId: t.String({ error: 'Pilih invoice.' }), amountMinor: t.String({ error: 'Nominal wajib diisi.' }), reason: t.String({ error: 'Alasan wajib diisi.' }) }) })
    .post('/finance/credit-notes/:id/void', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-receivables')
      return ok(request, await inTx(tx => voidCreditNote(tx, actor, params.id, body.reason, requestIdOf(request))))
    }, { body: t.Object({ reason: t.String({ error: 'Alasan wajib diisi.' }) }) })

    // ── Receipts & receivables ──────────────────────────────────────────────────────────────────────
    .get('/finance/receivables', async ({ request, query }) => {
      await auth.requireCapability(request, 'finance.view-cash')
      const result = await listReceivables(db, { ...query, limit: parseLimit(query.limit) })
      return { data: result.items, meta: { requestId: requestIdOf(request), pagination: result.pagination, summary: result.summary } }
    }, {
      query: t.Object({
        settlement: t.Optional(t.String()), partyId: t.Optional(t.String()), projectId: t.Optional(t.String()),
        dueTo: t.Optional(t.String()), cursor: t.Optional(t.String()), limit: t.Optional(t.String())
      })
    })
    .post('/finance/receipts', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.post-cash')
      set.status = 201
      return idempotent(request, set, actor, 'POST /finance/receipts', body, tx => postReceipt(tx, actor, body, requestIdOf(request)))
    }, {
      body: t.Object({
        bankAccountId: t.String({ error: 'Pilih rekening.' }), amountMinor: t.String({ error: 'Nominal wajib diisi.' }),
        effectiveDate: t.String({ error: 'Tanggal wajib diisi.' }), partyId: t.String({ error: 'Pilih customer.' }),
        projectId: t.Optional(t.String()), booking: t.Optional(bookingRef), counterparty: t.Optional(t.String({ maxLength: 200 })),
        reference: t.Optional(t.String({ maxLength: 120 })), memo: t.Optional(t.String({ maxLength: 500 })),
        allocations: t.Optional(t.Array(t.Object({ invoiceId: t.String(), amountMinor: t.String() })))
      })
    })
    .post('/finance/receipts/:id/allocations', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.post-cash')
      const id = assertIdParam(params.id, 'Penerimaan')
      set.status = 201
      return idempotent(request, set, actor, `POST /finance/receipts/${id}/allocations`, body, tx => allocateReceipt(tx, actor, id, body.allocations, requestIdOf(request)))
    }, { body: t.Object({ allocations: t.Array(t.Object({ invoiceId: t.String(), amountMinor: t.String() })) }) })
    .get('/finance/advances', async ({ request, query }) => {
      await auth.requireCapability(request, 'finance.view-cash')
      return ok(request, await listAdvances(db, query))
    }, { query: t.Object({ type: t.Optional(t.String()), partyId: t.Optional(t.String()), vendorId: t.Optional(t.String()) }) })

    // ── Vendor invoices, payments & payables ────────────────────────────────────────────────────────
    .get('/finance/payables', async ({ request, query }) => {
      await auth.requireCapability(request, 'finance.view-cash')
      const result = await listPayables(db, { ...query, limit: parseLimit(query.limit) })
      return { data: result.items, meta: { requestId: requestIdOf(request), pagination: result.pagination, summary: result.summary } }
    }, {
      query: t.Object({
        view: t.Optional(t.String()), vendorId: t.Optional(t.String()), projectId: t.Optional(t.String()),
        dueTo: t.Optional(t.String()), cursor: t.Optional(t.String()), limit: t.Optional(t.String())
      })
    })
    .get('/finance/vendor-invoices/:id', async ({ request, params }) => {
      await auth.requireCapability(request, 'finance.view-cash')
      return ok(request, await getVendorInvoice(db, params.id))
    })
    .post('/finance/vendor-invoices', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-payables')
      set.status = 201
      const created = await inTx(tx => createVendorInvoice(tx, actor, body, requestIdOf(request)))
      return ok(request, await getVendorInvoice(db, created.id))
    }, {
      body: t.Object({
        vendorId: t.String({ error: 'Pilih vendor.' }), vendorInvoiceNumber: t.String({ maxLength: 80, error: 'Nomor invoice vendor wajib diisi.' }),
        serviceOrderId: t.Optional(t.String()), projectId: t.Optional(t.String()), booking: t.Optional(bookingRef),
        invoiceDate: t.String({ error: 'Tanggal invoice wajib diisi.' }), dueDate: t.String({ error: 'Jatuh tempo wajib diisi.' }),
        expectedDate: t.Optional(t.String()), totalMinor: t.String({ error: 'Nominal wajib diisi.' }), notes: t.Optional(t.String({ maxLength: 1000 }))
      })
    })
    .patch('/finance/vendor-invoices/:id', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-payables')
      const id = assertIdParam(params.id, 'Invoice vendor')
      await inTx(tx => updateVendorInvoice(tx, actor, id, body, requestIdOf(request)))
      return ok(request, await getVendorInvoice(db, id))
    }, {
      body: t.Object({
        vendorId: t.Optional(t.String()), vendorInvoiceNumber: t.Optional(t.String({ maxLength: 80 })), serviceOrderId: t.Optional(t.String()),
        projectId: t.Optional(t.String()), booking: t.Optional(bookingRef), invoiceDate: t.Optional(t.String()), dueDate: t.Optional(t.String()),
        totalMinor: t.Optional(t.String()), notes: t.Optional(t.String({ maxLength: 1000 }))
      })
    })
    .post('/finance/vendor-invoices/:id/review', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-payables')
      const id = assertIdParam(params.id, 'Invoice vendor')
      await inTx(tx => reviewVendorInvoice(tx, actor, id, body, requestIdOf(request)))
      return ok(request, await getVendorInvoice(db, id))
    }, {
      body: t.Object({ action: t.String({ error: 'Pilih aksi review.' }), note: t.Optional(t.String({ maxLength: 1000 })), reason: t.Optional(t.String()), matchStatus: t.Optional(t.String()) })
    })
    .post('/finance/vendor-invoices/:id/void', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-payables')
      const id = assertIdParam(params.id, 'Invoice vendor')
      await inTx(tx => voidVendorInvoice(tx, actor, id, body.reason, requestIdOf(request)))
      return ok(request, await getVendorInvoice(db, id))
    }, { body: t.Object({ reason: t.String({ error: 'Alasan wajib diisi.' }) }) })
    .patch('/finance/vendor-invoices/:id/expectation', async ({ request, params, body }) => {
      const actor = await auth.requireCapability(request, 'finance.manage-payables')
      const id = assertIdParam(params.id, 'Invoice vendor')
      await inTx(tx => setVendorInvoiceExpectation(tx, actor, id, body, requestIdOf(request)))
      return ok(request, await getVendorInvoice(db, id))
    }, { body: t.Object({ expectedDate: t.Union([t.String(), t.Null()]), reason: t.String({ error: 'Alasan wajib diisi.' }) }) })
    .post('/finance/vendor-payments', async ({ request, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.post-cash')
      set.status = 201
      return idempotent(request, set, actor, 'POST /finance/vendor-payments', body, tx => postVendorPayment(tx, actor, body, requestIdOf(request)))
    }, {
      body: t.Object({
        bankAccountId: t.String({ error: 'Pilih rekening.' }), amountMinor: t.String({ error: 'Nominal wajib diisi.' }),
        effectiveDate: t.String({ error: 'Tanggal wajib diisi.' }), vendorId: t.String({ error: 'Pilih vendor.' }),
        projectId: t.Optional(t.String()), counterparty: t.Optional(t.String({ maxLength: 200 })),
        reference: t.Optional(t.String({ maxLength: 120 })), memo: t.Optional(t.String({ maxLength: 500 })),
        allocations: t.Optional(t.Array(t.Object({ vendorInvoiceId: t.String(), amountMinor: t.String() })))
      })
    })
    .post('/finance/vendor-payments/:id/allocations', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.post-cash')
      const id = assertIdParam(params.id, 'Pembayaran vendor')
      set.status = 201
      return idempotent(request, set, actor, `POST /finance/vendor-payments/${id}/allocations`, body, tx => allocateVendorPayment(tx, actor, id, body.allocations, requestIdOf(request)))
    }, { body: t.Object({ allocations: t.Array(t.Object({ vendorInvoiceId: t.String(), amountMinor: t.String() })) }) })

    // ── Finance context for other screens ───────────────────────────────────────────────────────────
    /** App dashboard: every project's payment status (Admin) plus cash, forecast and AR/AP (Finance). */
    .get('/finance/overview', async ({ request }) => {
      const { full } = await summaryAccess(request)
      return ok(request, await financeOverview(db, full))
    })
    .get('/projects/:id/finance-summary', async ({ request, params }) => {
      const { actor, full } = await summaryAccess(request)
      const id = assertIdParam(params.id, 'Project')
      if (!(await getProject(db, actor, id))) throw errors.notFound('Project') // same row scope as the project itself
      return ok(request, await projectFinanceSummary(db, id, full))
    })
    .get('/sales-orders/:id/finance-summary', async ({ request, params }) => {
      const { full } = await summaryAccess(request)
      const id = assertIdParam(params.id, 'Sales order')
      return ok(request, await salesOrderFinanceSummary(db, id, full))
    })
    .post('/finance/sales-orders/:id/confirm-dp', async ({ request, params, body, set }) => {
      const actor = await auth.requireCapability(request, 'finance.post-cash')
      if (!hasCapability(actor.role, 'finance.manage-receivables')) throw errors.forbidden()
      const id = assertIdParam(params.id, 'Sales order')
      set.status = 201
      return idempotent(request, set, actor, `POST /finance/sales-orders/${id}/confirm-dp`, body,
        tx => confirmGroupTripDp(tx, actor, id, body, requestIdOf(request)))
    }, {
      body: t.Object({
        bankAccountId: t.String({ error: 'Pilih rekening.' }), dpAmountMinor: t.String({ error: 'Nominal DP wajib diisi.' }),
        effectiveDate: t.String({ error: 'Tanggal terima wajib diisi.' }), dueDate: t.String({ error: 'Jatuh tempo pelunasan wajib diisi.' })
      })
    })
    .get('/bookings/:type/:id/finance-summary', async ({ request, params }) => {
      const { actor, full } = await summaryAccess(request)
      const id = assertIdParam(params.id, 'Booking')
      if (!['flight', 'hotel', 'transport', 'mice'].includes(params.type)) throw errors.validation({ type: ['Tipe booking tidak dikenal.'] })
      if (!(await getBookingRef(db, actor, params.type as 'flight', id))) throw errors.notFound('Booking')
      return ok(request, await bookingFinanceSummary(db, params.type, id, full))
    })
    .get('/vendors/:id/finance-summary', async ({ request, params }) => {
      const { full } = await summaryAccess(request)
      return ok(request, await vendorFinanceSummary(db, assertIdParam(params.id, 'Vendor'), full))
    })
    .get('/parties/:id/finance-summary', async ({ request, params }) => {
      const { full } = await summaryAccess(request)
      return ok(request, await partyFinanceSummary(db, assertIdParam(params.id, 'Customer'), full))
    })
}
