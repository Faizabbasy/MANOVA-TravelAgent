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
