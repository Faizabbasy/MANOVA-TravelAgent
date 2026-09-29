import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { todayBusinessDate } from '../src/modules/finance/common'
import { ALLOWED_ORIGIN, DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * Phase 8 — permission negative tests (09-RBAC-AUDIT-VALIDATION.md, 10 "RBAC"): every Finance route swept for
 * anonymous and Admin, body/ID tampering, maker ≠ checker, and the audit trail of money actions.
 * Proof files: no route serves or accepts them yet (ADR-005 still proposed) — asserted below so a future
 * upload route cannot appear without its own access tests.
 */

let t: TestApp
const who: Record<string, string> = {}
let keySeq = 0
const newKey = () => `perm-${Date.now()}-${++keySeq}`
const TODAY = todayBusinessDate()
function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const jt = (n: number) => String(n * 1_000_000)
/** `path` is relative to /api/v1 unless it already starts with it (the route table gives full paths). */
const req = (method: string, as: string | null, path: string, body?: unknown, key?: string) =>
  t.call(method, path.startsWith('/api/v1/') ? path : `/api/v1${path}`, { cookie: as ? who[as] : undefined, body, headers: { origin: ALLOWED_ORIGIN, ...(key ? { 'idempotency-key': key } : {}) } })
async function ok (as: string, method: string, path: string, body?: unknown, money = false) {
  const res = await req(method, as, path, body, money ? newKey() : undefined)
  if (res.status >= 400) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(res.json?.error)}`)
  return res.json.data
}

/** Routes Admin reaches by design; each narrows its answer to status only (no amounts). */
const ADMIN_SHARED = [
  'GET /api/v1/finance/overview',
  'GET /api/v1/projects/:id/finance-summary',
  'GET /api/v1/bookings/:type/:id/finance-summary',
  'GET /api/v1/vendors/:id/finance-summary',
  'GET /api/v1/parties/:id/finance-summary',
  'GET /api/v1/finance/policies',
  'GET /api/v1/finance/policies/:id',
  'GET /api/v1/finance/cancellation-policy/:subjectType/:subjectId',
  'GET /api/v1/finance/refunds',
  'GET /api/v1/finance/refunds/:id',
  'POST /api/v1/finance/cancellations/preview',
  'POST /api/v1/finance/cancellations'
]

let bank: string
let invoiceB: string
let vendorInvoice: string

beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries({ finance: DEMO.finance, superAdmin: DEMO.superAdmin, admin: DEMO.admin })) who[k] = await t.login(email)
  const acc = await ok('finance', 'POST', '/finance/accounts', { code: 'PRM-OPS', bankName: 'BCA', holderName: 'PT MANOVA', accountNumber: '5550001111' })
  bank = acc.id
  await ok('finance', 'POST', `/finance/accounts/${bank}/opening`, { amountMinor: jt(100), openingDate: addDays(TODAY, -30) })
  await ok('superAdmin', 'POST', `/finance/accounts/${bank}/opening/verify`, { balanceMinor: jt(100), openingDate: addDays(TODAY, -30) })
  // An invoice of customer B (PTY-002 · PRJ-102) and an approved invoice of vendor VND-002.
  const inv = await ok('finance', 'POST', '/finance/customer-invoices', { projectId: 'PRJ-102', invoiceType: 'progress', lines: [{ description: 'Termin', amountMinor: jt(10) }], dueDate: TODAY })
  await ok('finance', 'POST', `/finance/customer-invoices/${inv.id}/issue`, { issueDate: TODAY, dueDate: TODAY })
  invoiceB = inv.id
  const vi = await ok('finance', 'POST', '/finance/vendor-invoices', { vendorId: 'VND-002', vendorInvoiceNumber: 'PRM-001', projectId: 'PRJ-102', invoiceDate: TODAY, dueDate: TODAY, totalMinor: jt(5) })
  await ok('finance', 'POST', `/finance/vendor-invoices/${vi.id}/review`, { action: 'approve', matchStatus: 'matched' })
  vendorInvoice = vi.id
})
afterAll(() => t.cleanup())

describe('every Finance route', () => {
  const financeRoutes = () => (t.app as unknown as { routes: { method: string; path: string }[] }).routes
    .filter(r => /^\/api\/v1\/finance\/|\/finance-summary$/.test(r.path))
  const concrete = (path: string) => path.replace(':subjectType', 'flight').replace(':subjectId', 'FLT-1021').replace(':type', 'flight').replace(':id', 'X-1')

  test('the sweep sees the whole API (guards against a silently empty list)', () => {
    expect(financeRoutes().length).toBeGreaterThanOrEqual(70)
  })

  test('anonymous: 401 on every route, before any validation (an empty or bad body never gets a 400)', async () => {
    for (const r of financeRoutes()) {
      const res = await req(r.method, null, concrete(r.path), ['GET', 'DELETE'].includes(r.method) ? undefined : {})
      expect(res.status, `${r.method} ${r.path}`).toBe(401)
    }
  })

  test('Admin: 403 on every route outside the shared status/cancellation set, also before validation', async () => {
    for (const r of financeRoutes()) {
      if (ADMIN_SHARED.includes(`${r.method} ${r.path}`)) continue
      const res = await req(r.method, 'admin', concrete(r.path), ['GET', 'DELETE'].includes(r.method) ? undefined : {}, 'perm-admin-key-01')
      expect(res.status, `${r.method} ${r.path}`).toBe(403)
    }
  })

  test('Admin on the shared routes: status only — not a single amount anywhere in the answer', async () => {
    const answers = [
      await req('GET', 'admin', '/finance/overview'),
      await req('GET', 'admin', '/projects/PRJ-102/finance-summary'),
      await req('GET', 'admin', '/bookings/flight/FLT-1021/finance-summary'),
      await req('GET', 'admin', '/vendors/VND-002/finance-summary'),
      await req('GET', 'admin', '/parties/PTY-002/finance-summary'),
      await req('GET', 'admin', '/finance/refunds'),
      await req('POST', 'admin', '/finance/cancellations/preview', { subjectType: 'project', subjectId: 'PRJ-102' })
    ]
    for (const res of answers) {
      expect(res.status).toBe(200)
      expect(JSON.stringify(res.json.data)).not.toMatch(/Minor"|"amount/i)
    }
  })

  test('Finance and Super Admin pass the gate; sessions of suspended users and forged cookies do not', async () => {
    expect((await req('GET', 'finance', '/finance/cash-position')).status).toBe(200)
    expect((await req('GET', 'superAdmin', '/finance/cash-position')).status).toBe(200)
    await t.addUser({ id: 'USR-PRM', email: 'prm@manova.id', role: 'finance' })
    const cookie = await t.login('prm@manova.id')
    await t.db.query("update users set status = 'suspended' where id = 'USR-PRM'")
    expect((await t.call('GET', '/api/v1/finance/cash-position', { cookie })).status).toBe(401)
    expect((await t.call('GET', '/api/v1/finance/cash-position', { cookie: 'manova_session=forged-token-value' })).status).toBe(401)
  })

  test('no route serves or accepts proof files yet (ADR-005)', () => {
    expect(financeRoutes().filter(r => /proof|attachment|upload|file/i.test(r.path))).toEqual([])
  })
})

describe('ID tampering in the body', () => {
  test('a receipt for customer A cannot be allocated to customer B\'s invoice; nothing is posted', async () => {
    const before = (await ok('finance', 'GET', `/finance/accounts/${bank}`)).balance.currentMinor
    const res = await req('POST', 'finance', '/finance/receipts', { bankAccountId: bank, amountMinor: jt(1), effectiveDate: TODAY, partyId: 'PTY-005', allocations: [{ invoiceId: invoiceB, amountMinor: jt(1) }] }, newKey())
    expect([400, 422]).toContain(res.status)
    expect((await ok('finance', 'GET', `/finance/accounts/${bank}`)).balance.currentMinor).toBe(before)
    expect((await ok('finance', 'GET', `/finance/customer-invoices/${invoiceB}`)).outstandingMinor).toBe(jt(10))
  })

  test('a payment to vendor VND-001 cannot settle VND-002\'s invoice', async () => {
    const res = await req('POST', 'finance', '/finance/vendor-payments', { bankAccountId: bank, amountMinor: jt(1), effectiveDate: TODAY, vendorId: 'VND-001', allocations: [{ vendorInvoiceId: vendorInvoice, amountMinor: jt(1) }] }, newKey())
    expect([400, 422]).toContain(res.status)
    expect((await ok('finance', 'GET', `/finance/vendor-invoices/${vendorInvoice}`)).outstandingMinor).toBe(jt(5))
  })

  test('an invoice cannot point at a booking of another project', async () => {
    const res = await req('POST', 'finance', '/finance/customer-invoices', { projectId: 'PRJ-201', booking: { type: 'flight', id: 'FLT-1021' }, invoiceType: 'dp', lines: [{ description: 'x', amountMinor: '1000' }] })
    expect([400, 404, 422]).toContain(res.status)
  })

  test('actor and audit fields in the body are ignored: the session decides who acted', async () => {
    const res = await req('POST', 'finance', '/finance/transactions', {
      bankAccountId: bank, kind: 'expense', category: 'office', amountMinor: '150000', effectiveDate: TODAY, counterparty: 'Toko',
      createdBy: 'USR-001', actorUserId: 'USR-001', postedAt: '2020-01-01T00:00:00Z'
    }, newKey())
    expect(res.status).toBe(201)
    const tx = await ok('finance', 'GET', `/finance/transactions/${res.json.data.transactionId}`)
    expect(tx.createdBy.id).not.toBe('USR-001')
    expect(tx.postedAt.startsWith('2020')).toBe(false)
  })

  test('money moves only from an account whose opening balance is verified', async () => {
    const acc = await ok('finance', 'POST', '/finance/accounts', { code: 'PRM-NEW', bankName: 'BNI', holderName: 'PT MANOVA', accountNumber: '5550002222' })
    const res = await req('POST', 'finance', '/finance/transfers', { fromAccountId: acc.id, toAccountId: bank, amountMinor: '1000', effectiveDate: TODAY }, newKey())
    expect([400, 422]).toContain(res.status)
  })

  test('the same Idempotency-Key with a different body is refused, never applied', async () => {
    const key = newKey()
    const body = { bankAccountId: bank, kind: 'expense', category: 'office', amountMinor: '100000', effectiveDate: TODAY, counterparty: 'A' }
    expect((await req('POST', 'finance', '/finance/transactions', body, key)).status).toBe(201)
    const tampered = await req('POST', 'finance', '/finance/transactions', { ...body, amountMinor: '900000' }, key)
    expect([409, 422]).toContain(tampered.status)
  })

  test('maker ≠ checker: whoever submitted an opening balance cannot verify it, even Super Admin', async () => {
    const acc = await ok('superAdmin', 'POST', '/finance/accounts', { code: 'PRM-MC', bankName: 'BRI', holderName: 'PT MANOVA', accountNumber: '5550003333' })
    await ok('superAdmin', 'POST', `/finance/accounts/${acc.id}/opening`, { amountMinor: jt(1), openingDate: TODAY })
    const res = await req('POST', 'superAdmin', `/finance/accounts/${acc.id}/opening/verify`, { balanceMinor: jt(1), openingDate: TODAY })
    expect(res.status).toBe(403)
    expect((await ok('superAdmin', 'GET', `/finance/accounts/${acc.id}`)).opening.status).toBe('pending')
  })
})

describe('audit trail', () => {
  test('every money action is audited with the acting user and the request ID the client received', async () => {
    const res = await req('POST', 'finance', '/finance/receipts', { bankAccountId: bank, amountMinor: jt(2), effectiveDate: TODAY, partyId: 'PTY-002', allocations: [{ invoiceId: invoiceB, amountMinor: jt(2) }] }, newKey())
    expect(res.status).toBe(201)
    const requestId = res.headers.get('x-request-id')
    const rows = await t.db.query<{ action: string; actor_user_id: string; request_id: string; entity_id: string }>(
      'select action, actor_user_id, request_id, entity_id from audit_events where request_id = $1', [requestId]
    )
    expect(rows.length).toBeGreaterThan(0)
    const finance = await t.db.query<{ id: string }>('select id from users where email = $1', [DEMO.finance])
    for (const row of rows) expect(row.actor_user_id).toBe(finance[0]!.id)
    expect(rows.map(r => r.entity_id)).toContain(res.json.data.transactionId)
  })

  test('audit rows cannot be edited or deleted', async () => {
    await expect(t.db.query("update audit_events set actor_user_id = 'USR-001'")).rejects.toThrow()
    await expect(t.db.query('delete from audit_events')).rejects.toThrow()
  })

  test('refused attempts leave the books untouched and write no audit row', async () => {
    const before = await t.db.query<{ n: string }>("select count(*) as n from audit_events where action like 'finance.%'")
    await req('POST', 'admin', '/finance/transactions', { bankAccountId: bank, kind: 'expense', amountMinor: '1', effectiveDate: TODAY }, newKey())
    await req('POST', null, '/finance/receipts', {}, newKey())
    const after = await t.db.query<{ n: string }>("select count(*) as n from audit_events where action like 'finance.%'")
    expect(after[0]!.n).toBe(before[0]!.n)
  })
})
