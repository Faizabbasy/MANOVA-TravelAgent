import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { applyAdvances, buildPeriods, cashFlow, detectWarnings, project, type ForecastItem } from '../src/modules/finance/cashflow'
import { todayBusinessDate } from '../src/modules/finance/common'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * Finance Phase 6 — Cash Flow projection (docs/.../07). Pure period/projection rules first (with the numeric
 * acceptance example), then one company scenario built step by step. Every API answer is checked for the
 * chain opening + in − out = closing and for rows = sum of the drill-down items.
 */

const TODAY = todayBusinessDate()
function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const jt = (n: number) => (BigInt(Math.round(n * 1000)) * 1_000_000n / 1000n).toString()

describe('periods (pure)', () => {
  test('3m = rest of this month + 3 full months; none left on the last day of a month', () => {
    expect(buildPeriods('2026-09-29', '3m').map(p => [p.startDate, p.endDate, p.kind])).toEqual([
      ['2026-09-30', '2026-09-30', 'rest_of_month'],
      ['2026-10-01', '2026-10-31', 'month'],
      ['2026-11-01', '2026-11-30', 'month'],
      ['2026-12-01', '2026-12-31', 'month']
    ])
    expect(buildPeriods('2026-09-30', '3m').map(p => p.startDate)).toEqual(['2026-10-01', '2026-11-01', '2026-12-01'])
  })
  test('30d = 30 days from tomorrow in weeks; the last bucket is shorter', () => {
    const p = buildPeriods('2026-01-31', '30d')
    expect(p.map(x => [x.startDate, x.endDate])).toEqual([
      ['2026-02-01', '2026-02-07'], ['2026-02-08', '2026-02-14'], ['2026-02-15', '2026-02-21'], ['2026-02-22', '2026-02-28'], ['2026-03-01', '2026-03-02']
    ])
  })
  test('12m across a leap February and a year end', () => {
    const p = buildPeriods('2028-02-10', '12m')
    expect(p[0]).toEqual({ startDate: '2028-02-11', endDate: '2028-02-29', kind: 'rest_of_month' })
    expect(p).toHaveLength(13)
    expect(p[12]).toEqual({ startDate: '2029-02-01', endDate: '2029-02-28', kind: 'month' })
  })
})

describe('projection (pure) — acceptance example from 07', () => {
  const periods = [
    { startDate: '2026-10-01', endDate: '2026-10-31', kind: 'month' as const },
    { startDate: '2026-11-01', endDate: '2026-11-30', kind: 'month' as const }
  ]
  const item = (key: string, direction: 'in' | 'out', amount: number, date: string): ForecastItem =>
    ({ key, direction, amount: BigInt(jt(amount)), forecastDate: date, certainty: 'confirmed', disputed: false })
  const base = [item('ar1', 'in', 200, '2026-10-10'), item('ap1', 'out', 150, '2026-10-20'), item('ar2', 'in', 100, '2026-11-05'), item('ap2', 'out', 400, '2026-11-25')]

  test('Oct closes at Rp 350 jt, Nov at Rp 50 jt', () => {
    const r = project(BigInt(jt(300)), periods, base)
    expect(r.rows.map(x => x.closingMinor.toString())).toEqual([jt(350), jt(50)])
    expect(r.rows[1]!.openingMinor).toBe(r.rows[0]!.closingMinor)
  })
  test('paying Rp 100 jt of the vendor: cash −100, AP −100 → same closing', () => {
    const paid = [item('ar1', 'in', 200, '2026-10-10'), item('ap1', 'out', 50, '2026-10-20'), item('ar2', 'in', 100, '2026-11-05'), item('ap2', 'out', 400, '2026-11-25')]
    expect(project(BigInt(jt(200)), periods, paid).rows[0]!.closingMinor.toString()).toBe(jt(350))
  })
  test('an unpaid refund of Rp 20 jt → Rp 330 jt; once settled the closing stays Rp 330 jt', () => {
    expect(project(BigInt(jt(300)), periods, [...base, item('rf', 'out', 20, '2026-10-01')]).rows[0]!.closingMinor.toString()).toBe(jt(330))
    expect(project(BigInt(jt(280)), periods, base).rows[0]!.closingMinor.toString()).toBe(jt(330))
  })
  test('the lowest point inside a month is found even when the month closes positive', () => {
    const r = project(BigInt(jt(10)), periods, [item('out', 'out', 30, '2026-10-05'), item('in', 'in', 50, '2026-10-20')])
    expect(r.rows[0]!.closingMinor.toString()).toBe(jt(30))
    expect(r.rows[0]!.lowestMinor.toString()).toBe(`-${jt(20)}`)
    expect(r.rows[0]!.lowestDate).toBe('2026-10-05')
  })
})

describe('warnings and advance netting (pure)', () => {
  const out = (key: string, amount: bigint, date: string): ForecastItem => ({ key, direction: 'out', amount, forecastDate: date, certainty: 'confirmed', disputed: false })
  test('a balance already negative today is a gap from today', () => {
    const w = detectWarnings(-10n, '2026-09-29', [{ date: '2026-09-30', balance: 10n }], [], null)
    expect(w).toEqual([{ code: 'CASH_GAP', date: '2026-09-29', balanceMinor: '-10', lowestDate: '2026-09-29', lowestMinor: '-10', contributors: [] }])
  })
  test('the floor warning is kept even when it starts on the gap day; a zero floor is ignored', () => {
    const items = [out('a', 50n, '2026-09-30'), out('b', 80n, '2026-09-30'), out('c', 5n, '2026-10-01')]
    const days = [{ date: '2026-09-30', balance: -30n }, { date: '2026-10-01', balance: 20n }]
    const w = detectWarnings(100n, '2026-09-29', days, items, 60n)
    expect(w.map(x => [x.code, x.date])).toEqual([['CASH_GAP', '2026-09-30'], ['LOW_CASH', '2026-09-30']])
    expect(w[0]!.contributors).toEqual(['b', 'a'])
    expect(detectWarnings(100n, '2026-09-29', [{ date: '2026-09-30', balance: 5n }], [], 0n)).toEqual([])
  })
  test('advances are applied per customer, earliest first, never above what is owed', () => {
    const a = { party: 'P1', outstanding: 50n, order: '2026-10-01|a' }
    const b = { party: 'P1', outstanding: 40n, order: '2026-10-05|b' }
    const c = { party: 'P2', outstanding: 30n, order: '2026-09-30|c' }
    const r = applyAdvances([b, c, a], new Map([['P1', 70n], ['P3', 9n]]))
    expect(r.applied.get(a)).toBe(50n)
    expect(r.applied.get(b)).toBe(20n)
    expect(r.applied.has(c)).toBe(false)
    expect(r.remaining.get('P1')).toBe(0n)
    expect(r.remaining.get('P3')).toBe(9n)
  })
})

// ── API ─────────────────────────────────────────────────────────────────────────────────────────────────

let t: TestApp
const who: Record<string, string> = {}
let keySeq = 0
const newKey = () => `cf-${Date.now()}-${++keySeq}`
const req = (method: string, as: string, path: string, body?: unknown, key?: string) =>
  t.call(method, `/api/v1${path}`, { cookie: who[as], body, headers: key ? { 'idempotency-key': key } : {} })
const get = (as: string, path: string) => req('GET', as, path)
const post = (as: string, path: string, body?: unknown) => req('POST', as, path, body ?? {})
const patch = (as: string, path: string, body?: unknown) => req('PATCH', as, path, body ?? {})
const money = (as: string, path: string, body: unknown, key = newKey()) => req('POST', as, path, body, key)

type Flow = Record<string, any>
/** The invariants every answer must satisfy. */
function assertReconciles(f: Flow) {
  expect(f.available).toBe(true)
  let running = BigInt(f.openingCashMinor)
  f.rows.forEach((r: Flow, i: number) => {
    expect(BigInt(r.openingMinor)).toBe(running)
    const mine = f.items.filter((x: Flow) => x.counted && x.periodIndex === i)
    const sumDir = (d: string) => mine.filter((x: Flow) => x.direction === d).reduce((s: bigint, x: Flow) => s + BigInt(x.amountMinor), 0n)
    expect(BigInt(r.incomingMinor)).toBe(sumDir('in'))
    expect(BigInt(r.outgoingMinor)).toBe(sumDir('out'))
    expect(BigInt(r.incomingMinor)).toBe(BigInt(r.confirmedIncomingMinor) + BigInt(r.expectedIncomingMinor) + BigInt(r.overdueIncomingMinor))
    expect(BigInt(r.outgoingMinor)).toBe(BigInt(r.confirmedOutgoingMinor) + BigInt(r.expectedOutgoingMinor) + BigInt(r.overdueOutgoingMinor))
    running = running + BigInt(r.incomingMinor) - BigInt(r.outgoingMinor)
    expect(BigInt(r.closingMinor)).toBe(running)
  })
  expect(BigInt(f.closingMinor)).toBe(running)
  expect(BigInt(f.closingMinor)).toBe(BigInt(f.openingCashMinor) + BigInt(f.totals.incomingMinor) - BigInt(f.totals.outgoingMinor))
  for (const x of f.items) {
    expect(x.forecastDate >= f.periodStart && x.forecastDate <= f.periodEnd).toBe(true)
    expect(x.periodIndex).toBeGreaterThanOrEqual(0)
  }
}

const flow = async (query = 'horizon=30d') => {
  const res = await get('finance', `/finance/cash-flow?${query}`)
  expect(res.status).toBe(200)
  if (res.json.data.available) assertReconciles(res.json.data)
  return res.json.data as Flow
}
const itemOf = (f: Flow, id: string) => f.items.find((x: Flow) => x.id === id)

let bank: string
let bank2: string

async function issueInvoice(projectId: string, amount: string, dueDate: string, issueDate?: string) {
  const draft = await post('finance', '/finance/customer-invoices', { projectId, invoiceType: 'progress', lines: [{ description: 'Tagihan', amountMinor: amount }], dueDate })
  expect(draft.status).toBe(201)
  const issued = await post('finance', `/finance/customer-invoices/${draft.json.data.id}/issue`, issueDate ? { issueDate, dueDate } : {})
  expect(issued.status).toBe(200)
  return draft.json.data.id as string
}
let vendorSeq = 0
async function approvedVendorInvoice(amount: string, dueDate: string, projectId?: string) {
  const res = await post('finance', '/finance/vendor-invoices', { vendorId: 'VND-006', vendorInvoiceNumber: `CF-${++vendorSeq}`, projectId, invoiceDate: TODAY, dueDate, totalMinor: amount })
  expect(res.status).toBe(201)
  expect((await post('finance', `/finance/vendor-invoices/${res.json.data.id}/review`, { action: 'approve', matchStatus: 'matched' })).status).toBe(200)
  return res.json.data.id as string
}

beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries({ finance: DEMO.finance, superAdmin: DEMO.superAdmin, admin: DEMO.admin })) who[k] = await t.login(email)
})
afterAll(() => t.cleanup())

describe('access and validation', () => {
  test('Admin has no Finance: 403; bad parameters are explained', async () => {
    expect((await get('admin', '/finance/cash-flow')).status).toBe(403)
    expect((await get('superAdmin', '/finance/cash-flow')).status).toBe(200)
    expect((await get('finance', '/finance/cash-flow?horizon=2y')).status).toBe(400)
    expect((await get('finance', '/finance/cash-flow?projectId=PRJ-201&accountId=BA-001')).status).toBe(400)
    expect((await get('finance', '/finance/cash-flow?minimumCashMinor=1.5')).status).toBe(400)
    expect((await get('finance', '/finance/cash-flow?projectId=PRJ-999')).status).toBe(404)
  })
})

describe('no fake numbers before the opening balance is verified', () => {
  test('no accounts → unavailable (NO_ACCOUNTS)', async () => {
    const f = await flow()
    expect(f).toMatchObject({ available: false, reason: 'NO_ACCOUNTS', horizon: '30d', periodStart: addDays(TODAY, 1) })
    expect(f.rows).toBeUndefined()
  })
  test('an account waiting for verification → unavailable, and the account is named', async () => {
    bank = (await post('finance', '/finance/accounts', { code: 'BCA-CF', bankName: 'BCA', holderName: 'PT MANOVA', accountNumber: '5550001111' })).json.data.id
    await post('finance', `/finance/accounts/${bank}/opening`, { amountMinor: jt(300), openingDate: addDays(TODAY, -30) })
    const f = await flow()
    expect(f).toMatchObject({ available: false, reason: 'OPENING_BALANCE_UNVERIFIED', missingAccounts: [{ id: bank, code: 'BCA-CF' }] })
    // A project's net flow does not depend on the opening balance.
    expect((await flow('horizon=30d&projectId=PRJ-201')).available).toBe(true)
  })
  test('verified → available; nothing outstanding means a flat line', async () => {
    await post('superAdmin', `/finance/accounts/${bank}/opening/verify`, { balanceMinor: jt(300), openingDate: addDays(TODAY, -30) })
    const f = await flow()
    expect(f).toMatchObject({ available: true, openingBasis: 'company_cash', openingCashMinor: jt(300), closingMinor: jt(300), asOf: TODAY, timezone: 'Asia/Jakarta' })
    expect(f.rows).toHaveLength(5)
    expect(f.rows[0].startDate).toBe(addDays(TODAY, 1))
    expect(f.periodEnd).toBe(addDays(TODAY, 30))
    expect(f.warnings).toEqual([])
  })
})

describe('company projection, step by step', () => {
  let arA: string
  let arB: string
  let apV1: string
  let apV2: string
  let receiptA: string

  test('AR 200 (wk1) − AP 150 (wk2) + AR 100 (wk3) − AP 400 (wk4): closing Rp 50 jt, rows chain', async () => {
    arA = await issueInvoice('PRJ-201', jt(200), addDays(TODAY, 3))
    apV1 = await approvedVendorInvoice(jt(150), addDays(TODAY, 10), 'PRJ-201')
    arB = await issueInvoice('PRJ-202', jt(100), addDays(TODAY, 17))
    apV2 = await approvedVendorInvoice(jt(400), addDays(TODAY, 24))
    const f = await flow()
    expect(f.closingMinor).toBe(jt(50))
    expect(f.rows.map((r: Flow) => r.closingMinor)).toEqual([jt(500), jt(350), jt(450), jt(50), jt(50)])
    expect(itemOf(f, arA)).toMatchObject({ direction: 'in', certainty: 'confirmed', periodIndex: 0, forecastDate: addDays(TODAY, 3), counted: true, source: 'customer_invoice' })
    expect(itemOf(f, apV2)).toMatchObject({ direction: 'out', periodIndex: 3, project: null })
    expect(f.totals).toMatchObject({ incomingMinor: jt(300), outgoingMinor: jt(550), confirmedIncomingMinor: jt(300) })
  })

  test('posting money does not double count: vendor paid Rp 100 jt and customer paid Rp 50 jt → same closing', async () => {
    const pay = await money('finance', '/finance/vendor-payments', { bankAccountId: bank, amountMinor: jt(100), effectiveDate: TODAY, vendorId: 'VND-006', allocations: [{ vendorInvoiceId: apV1, amountMinor: jt(100) }] })
    expect(pay.status).toBe(201)
    const rec = await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: jt(50), effectiveDate: TODAY, partyId: 'PTY-005', allocations: [{ invoiceId: arA, amountMinor: jt(50) }] })
    expect(rec.status).toBe(201)
    receiptA = rec.json.data.transactionId
    const f = await flow()
    expect(f.openingCashMinor).toBe(jt(250))
    expect(itemOf(f, apV1).amountMinor).toBe(jt(50))
    expect(itemOf(f, arA).amountMinor).toBe(jt(150))
    expect(f.closingMinor).toBe(jt(50))
  })

  test('reversing that receipt: cash −50, receivable +50 → same closing again', async () => {
    expect((await money('finance', `/finance/transactions/${receiptA}/reverse`, { reason: 'Transfer ditolak bank' })).status).toBe(201)
    const f = await flow()
    expect(f.openingCashMinor).toBe(jt(200))
    expect(itemOf(f, arA).amountMinor).toBe(jt(200))
    expect(f.closingMinor).toBe(jt(50))
  })

  test('an expected date moves the invoice and labels it "expected"; the closing is unchanged', async () => {
    expect((await patch('finance', `/finance/customer-invoices/${arA}/expectation`, { expectedDate: addDays(TODAY, 20), reason: 'Customer janji bayar tgl 20' })).status).toBe(200)
    const f = await flow()
    expect(itemOf(f, arA)).toMatchObject({ certainty: 'expected', periodIndex: 2, dueDate: addDays(TODAY, 3), expectedDate: addDays(TODAY, 20) })
    expect(f.rows[0].incomingMinor).toBe('0')
    expect(f.rows[2].expectedIncomingMinor).toBe(jt(200))
    expect(f.closingMinor).toBe(jt(50))
  })

  test('overdue is placed in the first period, labelled, and reported', async () => {
    const late = await issueInvoice('PRJ-203', jt(10), addDays(TODAY, -5), addDays(TODAY, -20))
    const f = await flow()
    expect(itemOf(f, late)).toMatchObject({ certainty: 'overdue', periodIndex: 0, forecastDate: addDays(TODAY, 1), movedToFirstPeriod: true, dueDate: addDays(TODAY, -5) })
    expect(f.rows[0].overdueIncomingMinor).toBe(jt(10))
    expect(f.warnings).toContainEqual({ code: 'OVERDUE_INCOMING', count: 1, amountMinor: jt(10), inFirstPeriodCount: 1 })
    expect(f.closingMinor).toBe(jt(60))

    // Disputed stays in, with its own subtotal; a credit note reduces what is expected.
    expect((await post('finance', `/finance/customer-invoices/${late}/dispute`, { disputed: true, reason: 'Customer mempertanyakan jumlah peserta' })).status).toBe(200)
    expect((await post('finance', '/finance/credit-notes', { invoiceId: late, amountMinor: jt(4), reason: 'Koreksi jumlah peserta' })).status).toBe(201)
    const g = await flow()
    expect(itemOf(g, late)).toMatchObject({ disputed: true, amountMinor: jt(6) })
    expect(g.totals.disputedIncomingMinor).toBe(jt(6))
    expect(g.warnings).toContainEqual({ code: 'DISPUTED_INCOMING', count: 1, amountMinor: jt(6) })
    expect(g.closingMinor).toBe(jt(56))
  })

  test('an approved unpaid refund is owed now (first period); settling it keeps the closing', async () => {
    const inv = (await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-102', booking: { type: 'hotel', id: 'HTL-1022' }, invoiceType: 'dp', lines: [{ description: 'DP hotel', amountMinor: jt(40) }], dueDate: TODAY })).json.data.id
    await post('finance', `/finance/customer-invoices/${inv}/issue`, {})
    await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: jt(40), effectiveDate: TODAY, partyId: 'PTY-002', allocations: [{ invoiceId: inv, amountMinor: jt(40) }] })
    const cx = await money('finance', '/finance/cancellations', { subjectType: 'hotel', subjectId: 'HTL-1022', reason: 'Hotel overbook, customer minta refund', calculation: 'manual' })
    expect(cx.status).toBe(201)
    const caseId = cx.json.data.id

    // Awaiting a decision: not in the projection, but listed as excluded.
    const pending = await flow()
    expect(pending.closingMinor).toBe(jt(96))
    expect(pending.excluded.map((e: Flow) => e.code)).toContain('refunds_awaiting_decision')

    expect((await post('finance', `/finance/refunds/${caseId}/approve`, { refundMinor: jt(20) })).status).toBe(200)
    const owed = await flow()
    expect(itemOf(owed, caseId)).toMatchObject({ source: 'refund', direction: 'out', amountMinor: jt(20), periodIndex: 0, movedToFirstPeriod: true, dueDate: null })
    expect(owed.totals.refundOutgoingMinor).toBe(jt(20))
    expect(owed.closingMinor).toBe(jt(76))

    expect((await money('finance', `/finance/refunds/${caseId}/settlements`, { bankAccountId: bank, amountMinor: jt(20), effectiveDate: TODAY })).status).toBe(201)
    const settled = await flow()
    expect(itemOf(settled, caseId)).toBeUndefined()
    expect(settled.openingCashMinor).toBe(jt(220))
    expect(settled.closingMinor).toBe(jt(76))
  })

  test('an internal transfer changes nothing for the company except its fee', async () => {
    bank2 = (await post('finance', '/finance/accounts', { code: 'MDR-CF', bankName: 'Mandiri', holderName: 'PT MANOVA', accountNumber: '9990002222' })).json.data.id
    await post('finance', `/finance/accounts/${bank2}/opening`, { amountMinor: '0', openingDate: TODAY })
    await post('superAdmin', `/finance/accounts/${bank2}/opening/verify`, { balanceMinor: '0', openingDate: TODAY })
    expect((await flow()).closingMinor).toBe(jt(76))
    const tr = await money('finance', '/finance/transfers', { fromAccountId: bank, toAccountId: bank2, amountMinor: jt(30), feeMinor: '6500', effectiveDate: TODAY })
    expect(tr.status).toBe(201)
    const f = await flow()
    expect(f.closingMinor).toBe((BigInt(jt(76)) - 6500n).toString())
  })

  test('account view: that account\'s cash; obligations without an account are listed, not counted', async () => {
    const company = await flow()
    const f = await flow(`horizon=30d&accountId=${bank2}`)
    expect(f).toMatchObject({ openingBasis: 'account_cash', openingCashMinor: jt(30), closingMinor: jt(30), scope: { type: 'account', id: bank2, name: 'MDR-CF' } })
    expect(f.rows.every((r: Flow) => r.incomingMinor === '0' && r.outgoingMinor === '0')).toBe(true)
    expect(f.unassigned).toEqual({ count: company.items.length, incomingMinor: company.totals.incomingMinor, outgoingMinor: company.totals.outgoingMinor })
    expect(f.items.every((x: Flow) => x.counted === false)).toBe(true)
    expect(company.unassigned).toBeNull()
  })

  test('project view: net flow from zero, only that project, no cash-gap claim', async () => {
    const f = await flow('horizon=30d&projectId=PRJ-201')
    expect(f).toMatchObject({ openingBasis: 'zero_net_flow', openingCashMinor: '0', scope: { type: 'project', id: 'PRJ-201', name: expect.any(String) } })
    expect(f.items.map((x: Flow) => x.id).sort()).toEqual([arA, apV1].sort())
    expect(f.closingMinor).toBe(jt(150)) // +200 expected − 50 still owed to the vendor
    expect(f.warnings.find((w: Flow) => w.code === 'CASH_GAP')).toBeUndefined()
    expect(itemOf(await flow(), arB)).toBeDefined()
  })

  test('a large payment opens a gap: first negative date, value, and the top contributors', async () => {
    const big = await approvedVendorInvoice(jt(500), addDays(TODAY, 8))
    const f = await flow()
    const gap = f.warnings.find((w: Flow) => w.code === 'CASH_GAP')
    expect(gap).toBeDefined()
    expect(gap.date).toBe(addDays(TODAY, 8))
    expect(BigInt(gap.balanceMinor)).toBeLessThan(0n)
    expect(gap.contributors[0]).toBe(`vendor_invoice:${big}`)
    expect(BigInt(gap.lowestMinor)).toBeLessThanOrEqual(BigInt(gap.balanceMinor))
    expect(BigInt(f.rows[1].lowestMinor)).toBeLessThan(0n)

    // A minimum-cash floor warns earlier, before the balance turns negative.
    const floored = await flow(`horizon=30d&minimumCashMinor=${jt(260)}`)
    const low = floored.warnings.find((w: Flow) => w.code === 'LOW_CASH')
    expect(low).toMatchObject({ floorMinor: jt(260) })
    expect(low.date < gap.date).toBe(true)
  })

  test('outside the horizon: listed as excluded on 30d, counted on 12m', async () => {
    const far = await issueInvoice('PRJ-204', jt(70), addDays(TODAY, 200))
    const short = await flow()
    expect(itemOf(short, far)).toBeUndefined()
    expect(short.excluded).toContainEqual({ code: 'incoming_after_horizon', direction: 'in', count: 1, amountMinor: jt(70) })
    const year = await flow('horizon=12m')
    expect(itemOf(year, far)).toMatchObject({ certainty: 'confirmed', counted: true })
    expect(BigInt(year.closingMinor) - BigInt(short.closingMinor)).toBe(BigInt(jt(70)))
    expect(year.rows[year.rows.length - 1].endDate).toBe(year.periodEnd)
  })

  test('drafts, plans and invoices under review are shown as excluded, never counted', async () => {
    const before = await flow('horizon=3m')
    await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-201', invoiceType: 'other', lines: [{ description: 'Draft', amountMinor: jt(9) }], dueDate: addDays(TODAY, 5) })
    await post('finance', '/finance/billing-schedule', { projectId: 'PRJ-201', label: 'Pelunasan', invoiceType: 'final', amountMinor: jt(11), plannedDate: addDays(TODAY, 15) })
    await post('finance', '/finance/vendor-invoices', { vendorId: 'VND-006', vendorInvoiceNumber: 'CF-REVIEW', invoiceDate: TODAY, dueDate: addDays(TODAY, 5), totalMinor: jt(13) })
    const after = await flow('horizon=3m')
    expect(after.closingMinor).toBe(before.closingMinor)
    const codes = Object.fromEntries(after.excluded.map((e: Flow) => [e.code, e.amountMinor]))
    expect(codes).toMatchObject({ draft_invoices: jt(9), planned_billing: jt(11), vendor_invoices_in_review: jt(13) })
    expect(after.assumptions).toMatchObject({ dateRule: 'expected_else_due', noProbabilityWeighting: true })
  })

  test('boundaries: due today is not overdue (first period); due on the last day is in; one day later is out', async () => {
    const dueToday = await issueInvoice('PRJ-203', jt(1), TODAY)
    const lastDay = await issueInvoice('PRJ-203', jt(2), addDays(TODAY, 30))
    const dayAfter = await issueInvoice('PRJ-203', jt(3), addDays(TODAY, 31))
    const f = await flow()
    expect(itemOf(f, dueToday)).toMatchObject({ certainty: 'confirmed', periodIndex: 0, forecastDate: addDays(TODAY, 1), movedToFirstPeriod: true })
    expect(itemOf(f, lastDay)).toMatchObject({ periodIndex: f.rows.length - 1, forecastDate: f.periodEnd, movedToFirstPeriod: false })
    expect(itemOf(f, dayAfter)).toBeUndefined()
  })

  test('an expected date already passed moves the invoice to the first period; overdue with a new expected date follows that date', async () => {
    const notDue = await issueInvoice('PRJ-203', jt(4), addDays(TODAY, 10))
    expect((await patch('finance', `/finance/customer-invoices/${notDue}/expectation`, { expectedDate: addDays(TODAY, -2), reason: 'Janji bayar kemarin' })).status).toBe(200)
    const late = await issueInvoice('PRJ-203', jt(5), addDays(TODAY, -3), addDays(TODAY, -15))
    expect((await patch('finance', `/finance/customer-invoices/${late}/expectation`, { expectedDate: addDays(TODAY, 12), reason: 'Customer minta mundur' })).status).toBe(200)
    const f = await flow()
    expect(itemOf(f, notDue)).toMatchObject({ certainty: 'expected', periodIndex: 0, movedToFirstPeriod: true })
    expect(itemOf(f, late)).toMatchObject({ certainty: 'overdue', forecastDate: addDays(TODAY, 12), movedToFirstPeriod: false, periodIndex: 1 })
    const w = f.warnings.find((x: Flow) => x.code === 'OVERDUE_INCOMING')
    expect(w.count - w.inFirstPeriodCount).toBe(1)
  })

  test('a voided invoice leaves the projection', async () => {
    const inv = await issueInvoice('PRJ-203', jt(7), addDays(TODAY, 6))
    expect(itemOf(await flow(), inv)).toBeDefined()
    expect((await post('finance', `/finance/customer-invoices/${inv}/void`, { reason: 'Salah terbit' })).status).toBe(200)
    expect(itemOf(await flow(), inv)).toBeUndefined()
  })

  test('partial refund settlement and its reversal keep the closing; the refund amount follows', async () => {
    const inv = (await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-102', booking: { type: 'flight', id: 'FLT-1023' }, invoiceType: 'dp', lines: [{ description: 'DP tiket', amountMinor: jt(10) }], dueDate: TODAY })).json.data.id
    await post('finance', `/finance/customer-invoices/${inv}/issue`, {})
    await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: jt(10), effectiveDate: TODAY, partyId: 'PTY-002', allocations: [{ invoiceId: inv, amountMinor: jt(10) }] })
    const caseId = (await money('finance', '/finance/cancellations', { subjectType: 'flight', subjectId: 'FLT-1023', reason: 'Tiket batal, refund sebagian', calculation: 'manual' })).json.data.id
    const pending = (await flow()).excluded.find((e: Flow) => e.code === 'refunds_awaiting_decision')
    expect(pending).toMatchObject({ undeterminedCount: 1 })
    expect((await post('finance', `/finance/refunds/${caseId}/approve`, { refundMinor: jt(8) })).status).toBe(200)
    const before = await flow()
    const settle = await money('finance', `/finance/refunds/${caseId}/settlements`, { bankAccountId: bank, amountMinor: jt(3), effectiveDate: TODAY })
    expect(settle.status).toBe(201)
    const partial = await flow()
    expect(itemOf(partial, caseId).amountMinor).toBe(jt(5))
    expect(partial.closingMinor).toBe(before.closingMinor)
    expect((await money('finance', `/finance/transactions/${settle.json.data.transactionId}/reverse`, { reason: 'Transfer ditolak bank penerima' })).status).toBe(201)
    const reversed = await flow()
    expect(itemOf(reversed, caseId).amountMinor).toBe(jt(8))
    expect(reversed.closingMinor).toBe(before.closingMinor)
  })

  test('an unallocated customer advance is not counted twice: it reduces that customer\'s expected receipts', async () => {
    const before = await flow()
    const rec = await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: jt(30), effectiveDate: TODAY, partyId: 'PTY-005' })
    expect(rec.status).toBe(201)
    const f = await flow()
    expect(BigInt(f.openingCashMinor) - BigInt(before.openingCashMinor)).toBe(BigInt(jt(30)))
    expect(f.closingMinor).toBe(before.closingMinor)
    const applied = f.items.reduce((s: bigint, x: Flow) => s + BigInt(x.advanceAppliedMinor), 0n)
    expect(applied).toBe(BigInt(jt(30)))
    expect(f.warnings).toContainEqual({ code: 'ADVANCES_NETTED', count: expect.any(Number), amountMinor: jt(30) })
    for (const x of f.items) expect(BigInt(x.amountMinor)).toBe(BigInt(x.outstandingMinor) - BigInt(x.advanceAppliedMinor))
    // Not booked on a project: a project view does not use it.
    expect((await flow('horizon=30d&projectId=PRJ-201')).items.every((x: Flow) => x.advanceAppliedMinor === '0')).toBe(true)
  })

  test('3m periods: tomorrow to the end of the third full month', async () => {
    const f = await flow('horizon=3m')
    expect(f.periodStart).toBe(addDays(TODAY, 1))
    expect(f.rows.length === 3 || f.rows.length === 4).toBe(true)
    expect(f.rows.filter((r: Flow) => r.kind === 'month')).toHaveLength(3)
  })
})

describe('asOf and unavailable views', () => {
  test('the business date is Jakarta: 30 Sep 17:30 UTC is already 1 Oct', async () => {
    const late = await cashFlow(t.db, { horizon: '30d' }, new Date('2026-09-30T17:30:00Z'))
    expect(late).toMatchObject({ asOf: '2026-10-01', periodStart: '2026-10-02', periodEnd: '2026-10-31' })
    const early = await cashFlow(t.db, { horizon: '30d' }, new Date('2026-09-30T16:59:59Z'))
    expect(early).toMatchObject({ asOf: '2026-09-30', periodStart: '2026-10-01' })
  })

  test('an account waiting for verification: its own view and the company view are unavailable', async () => {
    const pending = (await post('finance', '/finance/accounts', { code: 'BNI-CF', bankName: 'BNI', holderName: 'PT MANOVA', accountNumber: '7770003333' })).json.data.id
    await post('finance', `/finance/accounts/${pending}/opening`, { amountMinor: jt(5), openingDate: TODAY })
    expect(await flow(`horizon=30d&accountId=${pending}`)).toMatchObject({ available: false, reason: 'OPENING_BALANCE_UNVERIFIED', missingAccounts: [{ id: pending, code: 'BNI-CF' }] })
    expect((await flow()).available).toBe(false)
    expect((await flow(`horizon=30d&accountId=${bank}`)).available).toBe(true)
  })
})
