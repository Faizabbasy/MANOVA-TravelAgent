import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { todayBusinessDate } from '../src/modules/finance/common'
import { computeFee } from '../src/modules/finance/fee-rules'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * Directional transfer fee rules (Phase 8 · spec 02 "Arah fee A→B dan B→A punya rule berbeda", 03, 05, 09).
 * Runs on PGlite by default and on PostgreSQL with TEST_DATABASE_URL.
 */

let t: TestApp
const who: Record<string, string> = {}
let keySeq = 0
const newKey = () => `fee-key-${Date.now()}-${++keySeq}`
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const TODAY = todayBusinessDate()
const get = (as: string, path: string) => t.call('GET', `/api/v1/finance${path}`, { cookie: who[as] })
const post = (as: string, path: string, body: unknown) =>
  t.call('POST', `/api/v1/finance${path}`, { cookie: who[as], body, headers: { 'idempotency-key': newKey() } })
const patch = (as: string, path: string, body: unknown) => t.call('PATCH', `/api/v1/finance${path}`, { cookie: who[as], body })

async function openAccount(code: string, openingMinor = '100000000'): Promise<string> {
  const created = await post('finance', '/accounts', { code, bankName: 'Bank Uji', holderName: 'PT MANOVA', accountNumber: `777-${code.length}-12345` })
  const id = created.json.data.id
  await post('finance', `/accounts/${id}/opening`, { amountMinor: openingMinor, openingDate: addDays(TODAY, -30) })
  await post('superAdmin', `/accounts/${id}/opening/verify`, { balanceMinor: openingMinor, openingDate: addDays(TODAY, -30) })
  return id
}
const cash = async () => (await get('finance', '/cash-position')).json.data.totalMinor as string

let A: string
let B: string
let C: string

beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries({ finance: DEMO.finance, superAdmin: DEMO.superAdmin, admin: DEMO.admin })) who[k] = await t.login(email)
  A = await openAccount('FEE-A')
  B = await openAccount('FEE-B')
  C = await openAccount('FEE-C')
})
afterAll(() => t.cleanup())

describe('fee arithmetic', () => {
  test('fixed is the fixed amount; percent rounds half up to whole rupiah, then min/max', () => {
    const fixed = { fee_type: 'fixed' as const, fixed_minor: '6500', percent_bp: null, min_minor: null, max_minor: null }
    expect(computeFee(fixed, 999_999_999n)).toBe(6500n)
    const pct = { fee_type: 'percent' as const, fixed_minor: null, percent_bp: 10, min_minor: '2500', max_minor: '25000' } // 0,1%
    expect(computeFee(pct, 12_345_678n)).toBe(12_346n) // 12.345,678 → 12.346
    expect(computeFee(pct, 12_345_000n)).toBe(12_345n) // exactly .0
    expect(computeFee(pct, 12_345_500n)).toBe(12_346n) // .5 rounds up
    expect(computeFee(pct, 1_000_000n)).toBe(2_500n) // 1.000 → min 2.500
    expect(computeFee(pct, 900_000_000n)).toBe(25_000n) // 900.000 → max 25.000
    expect(computeFee({ ...pct, min_minor: null, max_minor: null }, 1_000n)).toBe(1n)
  })
})

describe('access', () => {
  test('admin cannot read or write fee rules; anonymous gets 401', async () => {
    expect((await get('admin', '/transfer-fee-rules')).status).toBe(403)
    expect((await get('admin', `/transfer-fee-quote?fromAccountId=${A}&toAccountId=${B}&amountMinor=1000&effectiveDate=${TODAY}`)).status).toBe(403)
    expect((await post('admin', '/transfer-fee-rules', { fromAccountId: A, toAccountId: B, feeType: 'fixed', fixedMinor: '1', effectiveFrom: TODAY })).status).toBe(403)
    expect((await t.call('GET', '/api/v1/finance/transfer-fee-rules')).status).toBe(401)
  })
})

describe('directional rules', () => {
  let ruleAB: string
  test('A→B and B→A have their own rule and quote differently', async () => {
    const ab = await post('finance', '/transfer-fee-rules', { fromAccountId: A, toAccountId: B, feeType: 'fixed', fixedMinor: '6500', effectiveFrom: addDays(TODAY, -10), note: 'BCA → Mandiri online' })
    expect(ab.status).toBe(201)
    ruleAB = ab.json.data.id
    const ba = await post('finance', '/transfer-fee-rules', { fromAccountId: B, toAccountId: A, feeType: 'percent', percentBasisPoints: 10, minMinor: '2500', maxMinor: '25000', effectiveFrom: addDays(TODAY, -10) })
    expect(ba.status).toBe(201)

    const q = async (from: string, to: string, amount: string) =>
      (await get('finance', `/transfer-fee-quote?fromAccountId=${from}&toAccountId=${to}&amountMinor=${amount}&effectiveDate=${TODAY}`)).json.data
    expect((await q(A, B, '20000000')).feeMinor).toBe('6500')
    expect((await q(B, A, '20000000')).feeMinor).toBe('20000')
    expect((await q(B, A, '1000000')).feeMinor).toBe('2500')
    const none = await q(A, C, '20000000')
    expect(none).toEqual({ feeMinor: '0', rule: null })
  })

  test('a transfer without a typed fee applies the rule and keeps a snapshot; company cash drops by the fee only', async () => {
    const before = BigInt(await cash())
    const res = await post('finance', '/transfers', { fromAccountId: B, toAccountId: A, amountMinor: '20000000', effectiveDate: TODAY })
    expect(res.status).toBe(201)
    expect(BigInt(await cash())).toBe(before - 20_000n)
    const detail = (await get('finance', `/transfers/${res.json.data.transferId}`)).json.data
    expect(detail).toMatchObject({ feeMinor: '20000', feeSource: 'rule' })
    expect(detail.feeRule).toMatchObject({ feeType: 'percent', percentBasisPoints: 10, minMinor: '2500', maxMinor: '25000', quotedMinor: '20000' })
    expect(detail.legs.map((l: { kind: string }) => l.kind)).toEqual(['transfer_out', 'transfer_in', 'transfer_fee'])
  })

  test('typing the quoted fee counts as the rule; typing another fee is a manual override next to the quote', async () => {
    const same = await post('finance', '/transfers', { fromAccountId: A, toAccountId: B, amountMinor: '1000000', feeMinor: '6500', effectiveDate: TODAY })
    expect((await get('finance', `/transfers/${same.json.data.transferId}`)).json.data.feeSource).toBe('rule')
    const other = await post('finance', '/transfers', { fromAccountId: A, toAccountId: B, amountMinor: '1000000', feeMinor: '0', effectiveDate: TODAY })
    const d = (await get('finance', `/transfers/${other.json.data.transferId}`)).json.data
    expect(d).toMatchObject({ feeMinor: '0', feeSource: 'manual' })
    expect(d.feeRule.quotedMinor).toBe('6500')
    expect(d.legs).toHaveLength(2)
  })

  test('no rule for the direction: no fee unless typed', async () => {
    const res = await post('finance', '/transfers', { fromAccountId: A, toAccountId: C, amountMinor: '1000000', effectiveDate: TODAY })
    expect((await get('finance', `/transfers/${res.json.data.transferId}`)).json.data).toMatchObject({ feeMinor: '0', feeSource: 'none', feeRule: null })
    const typed = await post('finance', '/transfers', { fromAccountId: A, toAccountId: C, amountMinor: '1000000', feeMinor: '2900', effectiveDate: TODAY })
    expect((await get('finance', `/transfers/${typed.json.data.transferId}`)).json.data).toMatchObject({ feeMinor: '2900', feeSource: 'manual', feeRule: null })
  })

  test('periods: one active rule per direction and day; a new rule after ending the old one; history keeps its snapshot', async () => {
    const overlap = await post('finance', '/transfer-fee-rules', { fromAccountId: A, toAccountId: B, feeType: 'fixed', fixedMinor: '5000', effectiveFrom: TODAY })
    expect(overlap.status).toBe(422)
    expect(overlap.json.error.message).toContain('bertabrakan')

    const earlier = await post('finance', '/transfers', { fromAccountId: A, toAccountId: B, amountMinor: '1000000', effectiveDate: addDays(TODAY, -2) })
    expect((await patch('finance', `/transfer-fee-rules/${ruleAB}`, { effectiveTo: addDays(TODAY, -1) })).status).toBe(200)
    expect((await post('finance', '/transfer-fee-rules', { fromAccountId: A, toAccountId: B, feeType: 'fixed', fixedMinor: '5000', effectiveFrom: TODAY })).status).toBe(201)

    const q = async (date: string) => (await get('finance', `/transfer-fee-quote?fromAccountId=${A}&toAccountId=${B}&amountMinor=1000000&effectiveDate=${date}`)).json.data.feeMinor
    expect(await q(addDays(TODAY, -2))).toBe('6500') // old rule still covers its own period
    expect(await q(TODAY)).toBe('5000')
    expect(await q(addDays(TODAY, -20))).toBe('0') // before any rule

    // Editing the old rule's amount never rewrites the transfer that used it.
    expect((await patch('finance', `/transfer-fee-rules/${ruleAB}`, { fixedMinor: '9999' })).status).toBe(200)
    const d = (await get('finance', `/transfers/${earlier.json.data.transferId}`)).json.data
    expect(d).toMatchObject({ feeMinor: '6500', feeSource: 'rule' })
    expect(d.feeRule.fixedMinor).toBe('6500')

    // An inactive rule does not block a new one and is never applied.
    const bc = await post('finance', '/transfer-fee-rules', { fromAccountId: B, toAccountId: C, feeType: 'fixed', fixedMinor: '1000', effectiveFrom: addDays(TODAY, -5), isActive: false })
    expect(bc.status).toBe(201)
    expect((await get('finance', `/transfer-fee-quote?fromAccountId=${B}&toAccountId=${C}&amountMinor=1000&effectiveDate=${TODAY}`)).json.data.feeMinor).toBe('0')
    expect((await post('finance', '/transfer-fee-rules', { fromAccountId: B, toAccountId: C, feeType: 'fixed', fixedMinor: '2000', effectiveFrom: addDays(TODAY, -5) })).status).toBe(201)
    // Re-activating the old one would now overlap.
    expect((await patch('finance', `/transfer-fee-rules/${bc.json.data.id}`, { isActive: true })).status).toBe(422)
  })

  test('validation: shape per fee type, direction is fixed, distinct accounts, known accounts', async () => {
    const base = { fromAccountId: C, toAccountId: A, effectiveFrom: TODAY }
    expect((await post('finance', '/transfer-fee-rules', { ...base, feeType: 'fixed' })).json.error.fieldErrors.fixedMinor).toBeDefined()
    expect((await post('finance', '/transfer-fee-rules', { ...base, feeType: 'percent' })).json.error.fieldErrors.percentBasisPoints).toBeDefined()
    expect((await post('finance', '/transfer-fee-rules', { ...base, feeType: 'percent', percentBasisPoints: 10, minMinor: '5000', maxMinor: '100' })).json.error.fieldErrors.maxMinor).toBeDefined()
    expect((await post('finance', '/transfer-fee-rules', { ...base, feeType: 'fixed', fixedMinor: '1', effectiveTo: addDays(TODAY, -1) })).json.error.fieldErrors.effectiveTo).toBeDefined()
    expect((await post('finance', '/transfer-fee-rules', { ...base, toAccountId: C, feeType: 'fixed', fixedMinor: '1' })).status).toBe(400)
    expect((await post('finance', '/transfer-fee-rules', { ...base, toAccountId: 'BA-999', feeType: 'fixed', fixedMinor: '1' })).json.error.fieldErrors.toAccountId).toBeDefined()
    expect((await patch('finance', `/transfer-fee-rules/${ruleAB}`, { toAccountId: C })).status).toBe(400)
    expect((await patch('finance', '/transfer-fee-rules/TFR-9999', { note: 'x' })).status).toBe(404)
  })

  test('rule changes are audited with before/after', async () => {
    const rows = await t.db.query<{ action: string; actor_user_id: string }>(
      "select action, actor_user_id from audit_events where entity_type = 'transfer_fee_rule' order by id"
    )
    expect(rows.filter(r => r.action === 'finance.fee_rule_created').length).toBeGreaterThanOrEqual(4)
    expect(rows.some(r => r.action === 'finance.fee_rule_updated')).toBe(true)
  })
})
