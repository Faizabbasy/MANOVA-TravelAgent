import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { SeedRefusedError } from '../src/db/seed-demo'
import { seedFinanceDemo } from '../src/db/seed-finance-demo'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * The finance demo scenario is built through the real services, so these checks are the numbers a
 * reviewer would verify by hand in the UI (Rp jt = million).
 */

let t: TestApp
let finance: string

beforeAll(async () => {
  t = await makeTestApp()
  const result = await seedFinanceDemo(t.db, { appEnv: 'test' })
  expect(result).toEqual({ skipped: false, accounts: 3, customerInvoices: 9, vendorInvoices: 5, transactions: 19, policies: 2 })
  finance = await t.login(DEMO.finance)
})
afterAll(() => t.cleanup())

const get = async (path: string) => (await t.call('GET', `/api/v1${path}`, { cookie: finance })).json

describe('finance demo seed', () => {
  test('balances: BCA and Mandiri verified, BRI waiting for the checker (total shown as incomplete)', async () => {
    const cash = (await get('/finance/cash-position')).data
    expect(cash).toMatchObject({ available: false, reason: 'OPENING_BALANCE_UNVERIFIED', totalMinor: '1305847500' })
    const byCode = Object.fromEntries(cash.accounts.map((a: { code: string; currentMinor: string | null }) => [a.code, a.currentMinor]))
    // BCA 750 + receipts 944,25 + income 7,25 − transfer 250 − fee 0,0025 − expenses 245,9 (the reversed one nets to 0)
    expect(byCode).toEqual({ 'BCA-OPS': '1206347500', 'BRI-CADANGAN': null, 'MDR-VENDOR': '99500000' })
  })

  test('receivables: Rp 1.094 jt outstanding, Rp 240 jt overdue; the draft is not a receivable', async () => {
    const ar = await get('/finance/receivables?settlement=outstanding')
    expect(ar.meta.summary).toMatchObject({ outstandingMinor: '1094000000', overdueMinor: '240000000', count: 4 })
    expect((await get('/finance/customer-invoices?status=draft')).data).toHaveLength(1)
    expect((await get('/finance/advances?type=customer')).data).toEqual([expect.objectContaining({ unallocatedMinor: '50000000', projectId: 'PRJ-204' })])
  })

  test('payables: Rp 331 jt outstanding, Rp 86 jt overdue, one invoice waiting for review', async () => {
    const ap = await get('/finance/payables?view=outstanding')
    expect(ap.meta.summary).toMatchObject({ outstandingMinor: '331000000', overdueMinor: '86000000', count: 2 })
    // Summaries follow the chosen view; "all" is what the page header shows.
    expect((await get('/finance/payables?view=all')).meta.summary).toMatchObject({ outstandingMinor: '331000000', pendingReviewMinor: '64800000', pendingReviewCount: 1 })
  })

  test('project statuses read as a person would expect', async () => {
    expect((await get('/projects/PRJ-203/finance-summary')).data.paymentStatus).toBe('paid')
    expect((await get('/projects/PRJ-202/finance-summary')).data.paymentStatus).toBe('overdue')
    expect((await get('/projects/PRJ-201/finance-summary')).data.paymentStatus).toBe('awaiting_payment')
  })

  test('every demo account and cash-book row is stamped demo-fixture; real postings stay manual', async () => {
    const [marks] = await t.db.query<{ accounts: string; rows: string }>(
      `select (select count(*) from bank_accounts where provenance <> 'demo-fixture') as accounts,
              (select count(*) from financial_transactions where provenance <> 'demo-fixture') as rows`
    )
    expect(marks).toEqual({ accounts: '0', rows: '0' })
    const accounts = (await get('/finance/accounts')).data
    const bca = accounts.find((a: { code: string }) => a.code === 'BCA-OPS')
    const posted = await t.call('POST', '/api/v1/finance/transactions', {
      cookie: finance, headers: { 'idempotency-key': `seed-check-${Date.now()}` },
      body: { bankAccountId: bca.id, kind: 'other_income', amountMinor: '1000', effectiveDate: bca.balance.asOf }
    })
    expect(posted.status).toBe(201)
    const [row] = await t.db.query<{ provenance: string }>('select provenance from financial_transactions where id = $1', [posted.json.data.transactionId])
    expect(row!.provenance).toBe('manual')
  })

  test('runs once; refused in production', async () => {
    expect(await seedFinanceDemo(t.db, { appEnv: 'test' })).toMatchObject({ skipped: true, policies: 0 })
    expect((await get('/finance/cancellation-policy/project/PRJ-201')).data.assignment).toMatchObject({ version: 1, snapshot: { code: 'STD-DP' } })
    expect((await get('/finance/cancellation-policy/hotel/HTL-1022')).data.assignment.snapshot.code).toBe('HOTEL-FLEX')
    await expect(seedFinanceDemo(t.db, { appEnv: 'production' })).rejects.toBeInstanceOf(SeedRefusedError)
  })
})
