import { beforeAll, afterAll, describe, expect, test } from 'bun:test'
import { makeTestApp, DEMO, type TestApp } from './helpers'
import { seedOwnerYearDemo, OWNER_YEAR_DEMO, type OwnerYearSummary } from '../src/db/seed-owner-year-demo'
import { SeedRefusedError, DEFAULT_DEMO_PASSWORD } from '../src/db/seed-demo'
import { trialBalance } from '../src/modules/accounting/reads'

let t: TestApp
let summary: OwnerYearSummary
beforeAll(async () => {
  t = await makeTestApp({ seed: false })
  summary = await seedOwnerYearDemo(t.db, { appEnv: 'test' })
}, 600_000)
afterAll(async () => { await t?.cleanup() })

describe('persistent owner year demo recipe', () => {
  test('builds a source-backed year with posted accounting and no unresolved events', async () => {
    expect(summary.skipped).toBe(false)
    expect(summary.projects).toBe(40)
    expect(summary.invoices).toBeGreaterThan(30)
    expect(summary.supplierInvoices).toBe(summary.invoices)
    expect(summary.cashTransactions).toBeGreaterThan(150)
    expect(summary.journals).toBeGreaterThan(300)
    expect(summary.pending).toBe(0)
    const trial = await trialBalance(t.db, OWNER_YEAR_DEMO.asOf)
    expect(trial.balanced).toBe(true)
    const months = await t.db.query(`select distinct to_char(effective_date,'YYYY-MM') from accounting_journals where status='posted'`)
    expect(months.length).toBe(12)
    const [book] = await t.db.query('select mode,purpose,entity_type,tax_status,opening_validated from accounting_books')
    expect(book).toMatchObject({ mode: 'shadow', purpose: 'rehearsal', entity_type: 'unknown', tax_status: 'unknown', opening_validated: true })
    expect(await t.db.query("select id from accounting_policies where validation_status='validated'")).toHaveLength(0)
  })
  test('each bank reconciles exactly to the one existing cash book', async () => {
    const banks = await t.db.query<{ finance: string; ledger: string }>(`select
      (a.opening_balance_minor+coalesce((select sum(case when t.direction='in' then t.amount_minor else -t.amount_minor end) from financial_transactions t where t.bank_account_id=a.id and t.effective_date<=$1),0))::text as finance,
      coalesce((select sum(l.debit_minor-l.credit_minor) from accounting_journal_lines l join accounting_journals j on j.id=l.journal_id where l.bank_account_id=a.id and l.account_code='1100' and j.status='posted' and j.effective_date<=$1),0)::text as ledger
      from bank_accounts a`, [OWNER_YEAR_DEMO.asOf])
    expect(banks).toHaveLength(3)
    for (const b of banks) { expect(b.ledger).toBe(b.finance); expect(BigInt(b.finance)).toBeGreaterThanOrEqual(0n) }
    const [revenue] = await t.db.query<{ source: string; ledger: string }>(`select
      (select sum(amount_minor) from service_fulfillments where side='customer' and status='recorded')::text as source,
      (select sum(l.credit_minor-l.debit_minor) from accounting_journal_lines l join accounting_journals j on j.id=l.journal_id where l.account_code='4100' and j.status='posted')::text as ledger`)
    expect(revenue!.ledger).toBe(revenue!.source)
  })
  test('re-running preserves transactions and does not duplicate any seed rows', async () => {
    const before = await t.db.query('select (select count(*) from financial_transactions) as cash,(select count(*) from accounting_journals) as journals,(select count(*) from audit_events) as audit')
    expect(await seedOwnerYearDemo(t.db, { appEnv: 'test' })).toEqual({ ...summary, skipped: true })
    expect(await t.db.query('select (select count(*) from financial_transactions) as cash,(select count(*) from accounting_journals) as journals,(select count(*) from audit_events) as audit')).toEqual(before)
  })
  test('bank statement fixtures include matched and practice rows without adding any cash', async () => {
    const [state] = await t.db.query<{ lines: string; matched: string; current: string; cash: string }>(`select
      (select count(*) from bank_statement_lines)::text as lines,
      (select count(distinct statement_line_id) from bank_reconciliation_matches where unmatched_at is null)::text as matched,
      (select count(*) from bank_statement_lines where booked_on>='2026-10-01')::text as current,
      (select count(*) from financial_transactions)::text as cash`)
    expect(Number(state!.lines)).toBe(summary.cashTransactions + 2)
    expect(Number(state!.matched)).toBeGreaterThan(200)
    expect(Number(state!.matched)).toBeLessThan(Number(state!.lines))
    expect(Number(state!.current)).toBeGreaterThan(2)
    expect(Number(state!.cash)).toBe(summary.cashTransactions)
    expect(await t.db.query("select id from bank_statement_lines where external_ref in ('DEMO-BANK-FEE-REVIEW','DEMO-BANK-IN-REVIEW')")).toHaveLength(2)
  })
  test('Finance reads real reports while Admin cannot read financial values', async () => {
    const finance = await t.login(DEMO.finance, DEFAULT_DEMO_PASSWORD)
    const admin = await t.login(DEMO.admin, DEFAULT_DEMO_PASSWORD)
    for (const path of ['/finance/receivables', '/finance/payables', '/finance/staff-funds', '/finance/funding', `/accounting/trial-balance?asOf=${OWNER_YEAR_DEMO.asOf}`]) {
      expect((await t.call('GET', `/api/v1${path}`, { cookie: finance })).status).toBe(200)
      expect((await t.call('GET', `/api/v1${path}`, { cookie: admin })).status).toBe(403)
    }
  })
  test('refuses production and an occupied database without changing any data', async () => {
    await expect(seedOwnerYearDemo(t.db, { appEnv: 'production' })).rejects.toBeInstanceOf(SeedRefusedError)
    const occupied = await makeTestApp()
    try {
      const before = await occupied.db.query('select count(*) as n from users')
      await expect(seedOwnerYearDemo(occupied.db, { appEnv: 'test' })).rejects.toBeInstanceOf(SeedRefusedError)
      expect(await occupied.db.query('select count(*) as n from users')).toEqual(before)
      expect(await occupied.db.query('select id from bank_accounts')).toHaveLength(0)
    } finally { await occupied.cleanup() }
  }, 60_000)
})
