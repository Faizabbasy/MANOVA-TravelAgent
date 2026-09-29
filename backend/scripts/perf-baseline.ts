/**
 * Finance performance baseline (Phase 7). Builds a throwaway database with a realistic volume through the
 * real API (so every rule, trigger and view is exercised), then times the main Finance reads.
 *
 *   bun scripts/perf-baseline.ts [scale]        scale 1 ≈ 1.500 invoices, 600 vendor invoices, 1.000 expenses
 *   TEST_DATABASE_URL=postgres://… bun scripts/perf-baseline.ts   same against PostgreSQL
 *
 * Nothing touches the dev database. Prints median/p95 per endpoint; the report records the numbers.
 */
import { todayBusinessDate } from '../src/modules/finance/common'
import { DEMO, makeTestApp } from '../test/helpers'

const scale = Number(process.argv[2] ?? 1)
const t = await makeTestApp()
const TODAY = todayBusinessDate()
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
let seq = 0
const finance = await t.login(DEMO.finance)
const superAdmin = await t.login(DEMO.superAdmin)
const call = async (method: string, path: string, body?: unknown, cookie = finance, key = false) => {
  const res = await t.call(method, `/api/v1${path}`, { cookie, body, headers: key ? { 'idempotency-key': `perf-key-${String(++seq).padStart(6, "0")}` } : {} })
  if (res.status >= 400) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(res.json?.error)}`)
  return res.json?.data
}

// Deterministic pseudo-random numbers, so two runs build the same data.
let r = 42
const rand = (n: number) => { r = (r * 1103515245 + 12345) % 2147483648; return r % n }

const started = performance.now()
const accounts: string[] = []
for (const code of ['BCA-PERF', 'MDR-PERF']) {
  const acc = await call('POST', '/finance/accounts', { code, bankName: code.slice(0, 3), holderName: 'PT MANOVA', accountNumber: `99${accounts.length}0001111` })
  await call('POST', `/finance/accounts/${acc.id}/opening`, { amountMinor: '50000000000', openingDate: addDays(TODAY, -400) })
  await call('POST', `/finance/accounts/${acc.id}/opening/verify`, { balanceMinor: '50000000000', openingDate: addDays(TODAY, -400) }, superAdmin)
  accounts.push(acc.id)
}
const projects = await t.db.query<{ id: string; party_id: string }>('select id, party_id from projects order by id')
const vendors = await t.db.query<{ id: string }>("select id from vendors where status = 'active' order by id")

const invoices = Math.round(1500 * scale)
for (let i = 0; i < invoices; i++) {
  const p = projects[rand(projects.length)]!
  const due = addDays(TODAY, rand(420) - 300)
  const issue = due < TODAY ? addDays(due, -10) : TODAY
  const amount = String((rand(50) + 1) * 1_000_000)
  const draft = await call('POST', '/finance/customer-invoices', { projectId: p.id, invoiceType: 'progress', lines: [{ description: `Tagihan ${i}`, amountMinor: amount }], dueDate: due })
  await call('POST', `/finance/customer-invoices/${draft.id}/issue`, { issueDate: issue, dueDate: due })
  if (rand(3) > 0) {
    const paid = rand(2) === 0 ? amount : String(Number(amount) / 2)
    await call('POST', '/finance/receipts', { bankAccountId: accounts[rand(2)], amountMinor: paid, effectiveDate: issue, partyId: p.party_id, allocations: [{ invoiceId: draft.id, amountMinor: paid }] }, finance, true)
  }
}
const vendorInvoices = Math.round(600 * scale)
for (let i = 0; i < vendorInvoices; i++) {
  const v = vendors[rand(vendors.length)]!
  const p = projects[rand(projects.length)]!
  const date = addDays(TODAY, -rand(300))
  const amount = String((rand(40) + 1) * 1_000_000)
  const inv = await call('POST', '/finance/vendor-invoices', { vendorId: v.id, vendorInvoiceNumber: `PERF-${i}`, projectId: p.id, invoiceDate: date, dueDate: addDays(date, rand(60)), totalMinor: amount })
  await call('POST', `/finance/vendor-invoices/${inv.id}/review`, { action: 'approve', matchStatus: 'matched' })
  if (rand(2) === 0) {
    await call('POST', '/finance/vendor-payments', { bankAccountId: accounts[rand(2)], amountMinor: amount, effectiveDate: date, vendorId: v.id, allocations: [{ vendorInvoiceId: inv.id, amountMinor: amount }] }, finance, true)
  }
}
const expenses = Math.round(1000 * scale)
for (let i = 0; i < expenses; i++) {
  await call('POST', '/finance/transactions', { bankAccountId: accounts[rand(2)], kind: 'expense', category: 'office', amountMinor: String((rand(20) + 1) * 100_000), effectiveDate: addDays(TODAY, -rand(360)), counterparty: `Pengeluaran ${i}` }, finance, true)
}
const built = performance.now() - started

const ENDPOINTS: [string, string][] = [
  ['cash position', '/finance/cash-position'],
  ['statement (month)', '/finance/statement?limit=50'],
  ['statement (year)', `/finance/statement?from=${addDays(TODAY, -365)}&to=${TODAY}&limit=50`],
  ['account ledger (year)', `/finance/accounts/${accounts[0]}/ledger?from=${addDays(TODAY, -365)}&to=${TODAY}`],
  ['receivables (outstanding)', '/finance/receivables?settlement=outstanding&limit=50'],
  ['receivables (overdue)', '/finance/receivables?settlement=overdue&limit=50'],
  ['payables (all)', '/finance/payables?view=all&limit=50'],
  ['cash flow 30d', '/finance/cash-flow?horizon=30d'],
  ['cash flow 12m', '/finance/cash-flow?horizon=12m'],
  ['overview (dashboard)', '/finance/overview'],
  ['monthly report', '/finance/reports/monthly?months=12'],
  ['project summary', `/projects/${projects[0]!.id}/finance-summary`]
]
const RUNS = 7
console.log(`\nData: ${invoices} customer invoices, ${vendorInvoices} vendor invoices, ${expenses} expenses (built in ${(built / 1000).toFixed(1)} s)`)
console.log(`Engine: ${process.env.TEST_DATABASE_URL ? 'PostgreSQL' : 'PGlite (in-memory)'} · ${RUNS} runs each (first run discarded)\n`)
console.log('endpoint'.padEnd(28), 'median ms'.padStart(10), 'p95 ms'.padStart(9), '  bytes')
for (const [label, path] of ENDPOINTS) {
  const times: number[] = []
  let bytes = 0
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now()
    const res = await t.call('GET', `/api/v1${path}`, { cookie: finance })
    const ms = performance.now() - t0
    if (res.status !== 200) throw new Error(`${path} → ${res.status}`)
    bytes = JSON.stringify(res.json).length
    if (i > 0) times.push(ms)
  }
  times.sort((a, b) => a - b)
  const median = times[Math.floor(times.length / 2)]!
  const p95 = times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)]!
  console.log(label.padEnd(28), median.toFixed(0).padStart(10), p95.toFixed(0).padStart(9), `  ${bytes}`)
}
await t.cleanup()
