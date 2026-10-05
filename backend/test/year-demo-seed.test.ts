import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { SeedRefusedError } from '../src/db/seed-demo'
import { seedYearDemo } from '../src/db/seed-year-demo'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * "Perusahaan berjalan 1 tahun" (docs/superpowers/specs/2026-10-05-year-demo-data-design.md). Kalendernya tetap
 * (Sep 2025 – Okt 2026) sedangkan layanan finance memakai tanggal hari ini, jadi pemeriksaan di sini memakai
 * rentang dan sifat cerita, bukan angka pas.
 */

let t: TestApp
let finance: string
let first: Awaited<ReturnType<typeof seedYearDemo>>

beforeAll(async () => {
  t = await makeTestApp()
  first = await seedYearDemo(t.db, { appEnv: 'test' })
  finance = await t.login(DEMO.finance)
}, 120_000)
afterAll(() => t.cleanup())

const get = async (path: string) => (await t.call('GET', `/api/v1${path}`, { cookie: finance })).json
const jt = (minor: string | number) => Number(minor) / 1_000_000

describe('year demo seed', () => {
  test('builds a year of history through the real services', () => {
    expect(first.skipped).toBe(false)
    expect(first.accounts).toBe(3)
    expect(first.customerInvoices).toBeGreaterThanOrEqual(80)
    expect(first.vendorInvoices).toBeGreaterThanOrEqual(100)
    expect(first.policies).toBe(2)
  })

  test('all three accounts are verified and positive', async () => {
    const cash = (await get('/finance/cash-position')).data
    expect(cash.available).toBe(true)
    for (const account of cash.accounts as { code: string; currentMinor: string }[]) expect(Number(account.currentMinor)).toBeGreaterThan(0)
  })

  test('no account ever goes below zero at the end of a day', async () => {
    const rows = await t.db.query<{ code: string; low: string }>(
      `with daily as (
         select a.code, t.effective_date,
                sum(case when t.direction = 'in' then t.amount_minor else -t.amount_minor end) as net
           from financial_transactions t join bank_accounts a on a.id = t.bank_account_id
          group by a.code, t.effective_date
       ), running as (
         select d.code, sum(d.net) over (partition by d.code order by d.effective_date) + a.opening_balance_minor as bal
           from daily d join bank_accounts a on a.code = d.code
       )
       select code, min(bal)::text as low from running group by code`
    )
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(Number(row.low)).toBeGreaterThanOrEqual(0)
  })

  test('every month has revenue and expenses; the year totals look like a mid-size agency', async () => {
    const months = await t.db.query<{ m: string; revenue: string }>(
      "select to_char(issue_date, 'YYYY-MM') as m, sum(total_minor)::text as revenue from customer_invoices where status <> 'draft' group by 1"
    )
    const revenue = new Map(months.map(r => [r.m, Number(r.revenue)]))
    const spend = new Set((await t.db.query<{ m: string }>("select distinct to_char(effective_date, 'YYYY-MM') as m from financial_transactions where kind = 'expense'")).map(r => r.m))
    for (const m of ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']) {
      expect(revenue.get(m) ?? 0).toBeGreaterThan(0)
      expect(spend.has(m)).toBe(true)
    }
    const total = jt([...revenue.values()].reduce((a, b) => a + b, 0))
    expect(total).toBeGreaterThan(30_000)
    expect(total).toBeLessThan(40_000)
  })

  test('late payers show up as overdue receivables', async () => {
    const overdue = await get('/finance/receivables?settlement=overdue&limit=100')
    const projects = new Set((overdue.data as { project: { id: string } }[]).map(r => r.project.id))
    for (const id of ['PRJ-329', 'PRJ-335', 'PRJ-337', 'PRJ-101', 'PRJ-202']) expect(projects.has(id)).toBe(true)
  })

  test('project statuses tell the story', async () => {
    expect((await get('/projects/PRJ-301/finance-summary')).data.paymentStatus).toBe('paid')
    expect((await get('/projects/PRJ-203/finance-summary')).data.paymentStatus).toBe('paid')
    expect((await get('/projects/PRJ-202/finance-summary')).data.paymentStatus).toBe('overdue')
    expect((await get('/projects/PRJ-329/finance-summary')).data.paymentStatus).toBe('overdue')
  })

  test('every account and cash-book row is stamped demo-fixture', async () => {
    const [marks] = await t.db.query<{ accounts: string; rows: string }>(
      `select (select count(*) from bank_accounts where provenance <> 'demo-fixture') as accounts,
              (select count(*) from financial_transactions where provenance <> 'demo-fixture') as rows`
    )
    expect(marks).toEqual({ accounts: '0', rows: '0' })
  })

  test('running it again changes nothing', async () => {
    const [before] = await t.db.query<{ n: string }>('select count(*) as n from financial_transactions')
    expect((await seedYearDemo(t.db, { appEnv: 'test' })).skipped).toBe(true)
    const [after] = await t.db.query<{ n: string }>('select count(*) as n from financial_transactions')
    expect(after).toEqual(before)
  })

  test('refused in production', async () => {
    await expect(seedYearDemo(t.db, { appEnv: 'production' })).rejects.toBeInstanceOf(SeedRefusedError)
  })

  test('a second empty database gets the same numbers', async () => {
    const other = await makeTestApp()
    try {
      expect(await seedYearDemo(other.db, { appEnv: 'test' })).toEqual(first)
      const sum = 'select sum(case when direction = \'in\' then amount_minor else -amount_minor end)::text as s from financial_transactions'
      expect(await other.db.query(sum)).toEqual(await t.db.query(sum))
    } finally {
      await other.cleanup()
    }
  }, 120_000)
})
