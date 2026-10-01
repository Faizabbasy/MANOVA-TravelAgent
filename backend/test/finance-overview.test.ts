import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { seedFinanceDemo } from '../src/db/seed-finance-demo'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * Phase 7 — GET /finance/overview (app dashboard). It must never disagree with the screens a user can drill
 * into: every project's status, cost and outstanding equal its own finance summary, and the totals equal
 * the Finance menus. Built on the finance demo scenario (real services, many states at once).
 */

let t: TestApp
const who: Record<string, string> = {}
const get = async (as: string, path: string) => t.call('GET', `/api/v1${path}`, { cookie: who[as] })

beforeAll(async () => {
  t = await makeTestApp()
  await seedFinanceDemo(t.db, { appEnv: 'test' })
  for (const [k, email] of Object.entries({ finance: DEMO.finance, admin: DEMO.admin, superAdmin: DEMO.superAdmin })) who[k] = await t.login(email)
})
afterAll(() => t.cleanup())

describe('finance overview', () => {
  test('Admin: every project with its payment status, and not a single amount', async () => {
    const res = await get('admin', '/finance/overview')
    expect(res.status).toBe(200)
    expect(res.json.data.view).toBe('status')
    expect(res.json.data.projects.length).toBeGreaterThan(5)
    expect(JSON.stringify(res.json.data)).not.toMatch(/Minor|cash|forecast/)
    for (const p of res.json.data.projects) {
      const own = (await get('admin', `/projects/${p.projectId}/finance-summary`)).json.data
      expect(p).toEqual({
        projectId: p.projectId, paymentStatus: own.paymentStatus, label: own.label, hasOverdue: own.hasOverdue,
        cancelled: own.cancellation !== null, dpInvoiced: own.dpInvoiced, dpReceived: own.dpReceived
      })
    }
  })

  test('Finance: per project status, cost and outstanding equal the project finance summary', async () => {
    const data = (await get('finance', '/finance/overview')).json.data
    expect(data.view).toBe('full')
    for (const p of data.projects) {
      const own = (await get('finance', `/projects/${p.projectId}/finance-summary`)).json.data
      expect(p.paymentStatus).toBe(own.paymentStatus)
      expect(p.hasOverdue).toBe(own.hasOverdue)
      expect(p.costMinor).toBe(own.profitability.costMinor)
      expect(p.outstandingMinor).toBe(own.receivable.outstandingMinor)
    }
    expect(data.projects.some((p: { paymentStatus: string }) => p.paymentStatus === 'overdue')).toBe(true)
    // Workflow facts (no amounts): PRJ-202 has a paid DP; a project without invoices has neither.
    const byId = Object.fromEntries(data.projects.map((p: { projectId: string }) => [p.projectId, p]))
    expect(byId['PRJ-202']).toMatchObject({ dpInvoiced: true, dpReceived: true })
    expect(Object.values(byId).some((p: any) => p.paymentStatus === 'not_invoiced' && !p.dpInvoiced && !p.dpReceived)).toBe(true)
  })

  test('Finance: totals equal the Finance menus (cash, forecast, receivables, payables)', async () => {
    const data = (await get('finance', '/finance/overview')).json.data
    const cash = (await get('finance', '/finance/cash-position')).json.data
    expect(data.cash).toEqual({ available: cash.available, reason: cash.reason, totalMinor: cash.totalMinor })
    // BRI is still waiting for verification in the demo: no forecast, never a fake one.
    expect(data.forecast).toEqual({ available: false, reason: 'OPENING_BALANCE_UNVERIFIED' })

    const ar = (await get('finance', '/finance/receivables?settlement=outstanding')).json.meta.summary
    expect(data.receivables).toEqual({ outstandingMinor: ar.outstandingMinor, openCount: ar.count, overdueMinor: ar.overdueMinor, overdueCount: data.overdueInvoices.length })
    const overdueList = (await get('finance', '/finance/receivables?settlement=overdue')).json
    expect(data.receivables.overdueCount).toBe(overdueList.meta.summary.count)
    expect(data.overdueInvoices.map((i: { id: string }) => i.id)).toEqual(overdueList.data.slice(0, 5).map((i: { id: string }) => i.id))

    const ap = (await get('finance', '/finance/payables?view=all')).json.meta.summary
    expect(data.payables).toMatchObject({ outstandingMinor: ap.outstandingMinor, overdueMinor: ap.overdueMinor, pendingReviewCount: ap.pendingReviewCount })
  })

  test('with every opening verified the 30-day forecast equals the Cash Flow page', async () => {
    const pending = (await get('finance', '/finance/accounts')).json.data.find((a: { opening: { status: string } }) => a.opening.status === 'pending')
    const verify = await t.call('POST', `/api/v1/finance/accounts/${pending.id}/opening/verify`, {
      cookie: who.superAdmin, body: { balanceMinor: pending.opening.balanceMinor, openingDate: pending.opening.date }
    })
    expect(verify.status).toBe(200)
    const data = (await get('finance', '/finance/overview')).json.data
    const cf = (await get('finance', '/finance/cash-flow?horizon=30d')).json.data
    expect(data.forecast).toEqual({ available: true, periodEnd: cf.periodEnd, closingMinor: cf.closingMinor, gap: null })
  })
})

describe('monthly report (accrual)', () => {
  test('Admin cannot read it; months are validated', async () => {
    expect((await get('admin', '/finance/reports/monthly')).status).toBe(403)
    expect((await get('finance', '/finance/reports/monthly?months=0')).status).toBe(400)
    expect((await get('finance', '/finance/reports/monthly?months=25')).status).toBe(400)
  })

  test('from/to returns exactly the calendar months the range touches', async () => {
    const r = await get('finance', '/finance/reports/monthly?from=2026-07-15&to=2026-09-10')
    expect(r.status).toBe(200)
    expect(r.json.data.months.map((m: { month: string }) => m.month)).toEqual(['2026-07', '2026-08', '2026-09'])
    const year = await get('finance', '/finance/reports/monthly?from=2025-11-01&to=2026-02-28')
    expect(year.json.data.months.map((m: { month: string }) => m.month)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })

  test('a range matches the same months of the months= report', async () => {
    const byCount = (await get('finance', '/finance/reports/monthly?months=3')).json.data
    const from = `${byCount.months[0].month}-01`
    const byRange = (await get('finance', `/finance/reports/monthly?from=${from}&to=${byCount.asOf}`)).json.data
    expect(byRange.months).toEqual(byCount.months)
  })

  test('range is validated: order, mixing with months, 24-month cap, format; 401 without a session', async () => {
    expect((await get('finance', '/finance/reports/monthly?from=2026-09-01&to=2026-08-01')).status).toBe(400)
    expect((await get('finance', '/finance/reports/monthly?months=3&from=2026-09-01&to=2026-09-30')).status).toBe(400)
    expect((await get('finance', '/finance/reports/monthly?from=2024-01-01&to=2026-09-30')).status).toBe(400)
    expect((await get('finance', '/finance/reports/monthly?from=2026-09-01')).status).toBe(400)
    expect((await get('finance', '/finance/reports/monthly?from=2026-13-01&to=2026-12-31')).status).toBe(400)
    expect((await get('admin', '/finance/reports/monthly?from=2026-09-01&to=2026-09-30')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/finance/reports/monthly?from=2026-09-01&to=2026-09-30')).status).toBe(401)
  })

  test('months add up to the projects, the vendors and the Statement', async () => {
    const report = (await get('finance', '/finance/reports/monthly?months=12')).json.data
    expect(report.months).toHaveLength(12)
    expect(report.months.at(-1).month).toBe(report.asOf.slice(0, 7))
    const total = (key: string) => report.months.reduce((s: bigint, m: Record<string, string>) => s + BigInt(m[key]!), 0n)
    for (const m of report.months) {
      expect(BigInt(m.revenueMinor)).toBe(BigInt(m.invoicedMinor) - BigInt(m.creditedMinor))
      expect(BigInt(m.netMinor)).toBe(BigInt(m.revenueMinor) - BigInt(m.costMinor))
      expect(BigInt(m.costMinor)).toBe(BigInt(m.vendorCostMinor) + BigInt(m.expenseMinor))
    }

    // Revenue = the projects' revenue (every demo invoice falls inside the 12 months).
    const overview = (await get('finance', '/finance/overview')).json.data
    const projectRevenue = overview.projects.reduce((s: bigint, p: { revenueMinor: string }) => s + BigInt(p.revenueMinor), 0n)
    expect(total('revenueMinor')).toBe(projectRevenue)
    // Vendor cost = approved vendor invoices per vendor.
    expect(total('vendorCostMinor')).toBe(report.vendors.reduce((s: bigint, v: { approvedMinor: string }) => s + BigInt(v.approvedMinor), 0n))
    // Expenses + transfer fees = the Statement's outflow of those kinds (reversed pairs excluded).
    const from = `${report.months[0].month}-01`
    const out = async (kind: string) => BigInt((await get('finance', `/finance/statement?from=${from}&to=${report.asOf}&kind=${kind}&limit=1`)).json.meta.summary.outMinor)
    expect(total('expenseMinor')).toBe(await out('expense') + await out('transfer_fee'))
  })

  test('per project revenue and received equal the project summary', async () => {
    const overview = (await get('finance', '/finance/overview')).json.data
    for (const p of overview.projects) {
      const own = (await get('finance', `/projects/${p.projectId}/finance-summary`)).json.data
      expect(p.revenueMinor).toBe(own.profitability.revenueMinor)
      expect(p.receivedMinor).toBe(own.receivable.receivedMinor)
    }
  })
})
