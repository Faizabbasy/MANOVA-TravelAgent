import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { accountDto } from '../src/modules/finance/accounts'
import { todayBusinessDate } from '../src/modules/finance/common'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * Finance Phase 2 — money foundation. Numbers are chosen so every balance can be checked by hand.
 * Runs on PGlite by default and on PostgreSQL with TEST_DATABASE_URL.
 */

let t: TestApp
const who: Record<string, string> = {}
let keySeq = 0
const newKey = () => `test-key-${Date.now()}-${++keySeq}`

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const TODAY = todayBusinessDate()
const OPENING_DATE = addDays(TODAY, -20)

const get = (as: string, path: string) => t.call('GET', `/api/v1/finance${path}`, { cookie: who[as] })
const post = (as: string, path: string, body: unknown, key?: string | null) =>
  t.call('POST', `/api/v1/finance${path}`, {
    cookie: who[as],
    body,
    headers: key === null ? {} : { 'idempotency-key': key ?? newKey() }
  })
const patch = (as: string, path: string, body: unknown) => t.call('PATCH', `/api/v1/finance${path}`, { cookie: who[as], body })

async function balanceOf(accountId: string): Promise<string | null> {
  return (await get('finance', `/accounts/${accountId}`)).json.data.balance.currentMinor
}

/** Creates an account and takes it through maker (finance) → checker (super-admin). */
async function openAccount(code: string, openingMinor: string, openingDate = OPENING_DATE): Promise<string> {
  const created = await post('finance', '/accounts', { code, bankName: 'Bank Uji', holderName: 'PT MANOVA', accountNumber: `123-456-${code.length}789` })
  expect(created.status).toBe(201)
  const id = created.json.data.id
  expect((await post('finance', `/accounts/${id}/opening`, { amountMinor: openingMinor, openingDate })).status).toBe(200)
  expect((await post('superAdmin', `/accounts/${id}/opening/verify`, {})).status).toBe(200)
  return id
}

beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries({ finance: DEMO.finance, superAdmin: DEMO.superAdmin, admin: DEMO.admin })) who[k] = await t.login(email)
})
afterAll(() => t.cleanup())

describe('access (ADR-006: Admin never touches Finance)', () => {
  test('admin gets 403 on every finance endpoint; anonymous gets 401', async () => {
    for (const path of ['/cash-position', '/accounts', '/statement', '/accounts/BA-001/ledger', '/transactions/TRX-000001']) {
      expect((await get('admin', path)).status, path).toBe(403)
      expect((await t.call('GET', `/api/v1/finance${path}`)).status, path).toBe(401)
    }
    expect((await post('admin', '/accounts', { code: 'X-1', bankName: 'B', holderName: 'H', accountNumber: '12345' })).status).toBe(403)
    expect((await post('admin', '/transactions', { bankAccountId: 'BA-001', kind: 'expense', amountMinor: '1', effectiveDate: TODAY })).status).toBe(403)
  })

  test('finance cannot verify an opening balance (checker capability is super-admin only)', async () => {
    const created = await post('finance', '/accounts', { code: 'CHK-1', bankName: 'Bank', holderName: 'PT', accountNumber: '9988776655' })
    const id = created.json.data.id
    await post('finance', `/accounts/${id}/opening`, { amountMinor: '1000', openingDate: OPENING_DATE })
    expect((await post('finance', `/accounts/${id}/opening/verify`, {})).status).toBe(403)
  })
})

describe('bank accounts and opening balance', () => {
  test('a new account has no balance yet — "unavailable", never Rp0', async () => {
    const res = await post('finance', '/accounts', { code: 'bca-new', bankName: 'BCA', holderName: 'PT MANOVA Travel', accountNumber: '0123 4567 89' })
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ code: 'BCA-NEW', currency: 'IDR', isActive: true, accountNumber: '0123 4567 89' })
    expect(res.json.data.opening.status).toBe('unset')
    expect(res.json.data.balance).toMatchObject({ available: false, currentMinor: null })

    const position = (await get('finance', '/cash-position')).json.data
    expect(position.available).toBe(false)
    expect(position.reason).toBe('OPENING_BALANCE_UNVERIFIED')
  })

  test('validation, duplicate code and masking', async () => {
    const bad = await post('finance', '/accounts', { code: 'a', bankName: ' ', holderName: 'PT', accountNumber: 'abc' })
    expect(bad.status).toBe(400)
    expect(Object.keys(bad.json.error.fieldErrors).sort()).toEqual(['accountNumber', 'bankName', 'code'])
    const dup = await post('finance', '/accounts', { code: 'BCA-NEW', bankName: 'BCA', holderName: 'PT', accountNumber: '1111122222' })
    expect(dup.status).toBe(409)
    expect(dup.json.error.fieldErrors).toHaveProperty('code')

    const row = { id: 'BA-X', code: 'X', bank_name: 'B', holder_name: 'H', account_number: '0123-4567-89', currency: 'IDR', is_active: true, opening_status: 'unset', opening_balance_minor: null, opening_date: null, opening_note: null, opening_submitted_by: null, opening_submitted_at: null, opening_verified_by: null, opening_verified_at: null, provenance: 'manual', created_at: new Date(), updated_at: new Date() } as const
    expect(accountDto({ ...row }, undefined, false).accountNumber).toBe('•••• 6789')
  })

  test('maker/checker: the submitter can never verify their own opening balance', async () => {
    const created = await post('superAdmin', '/accounts', { code: 'SELF-1', bankName: 'Bank', holderName: 'PT', accountNumber: '5566778899' })
    const id = created.json.data.id
    await post('superAdmin', `/accounts/${id}/opening`, { amountMinor: '500', openingDate: OPENING_DATE })
    const self = await post('superAdmin', `/accounts/${id}/opening/verify`, {})
    expect(self.status).toBe(403)
    expect(self.json.error.code).toBe('MAKER_CHECKER_VIOLATION')
  })

  test('opening: future date refused; verified opening is locked; verifying twice is a rule error', async () => {
    const created = await post('finance', '/accounts', { code: 'LOCK-1', bankName: 'Bank', holderName: 'PT', accountNumber: '4455667788' })
    const id = created.json.data.id
    expect((await post('finance', `/accounts/${id}/opening`, { amountMinor: '1000', openingDate: addDays(TODAY, 1) })).status).toBe(400)
    expect((await post('superAdmin', `/accounts/${id}/opening/verify`, {})).status).toBe(422) // nothing submitted yet
    await post('finance', `/accounts/${id}/opening`, { amountMinor: '1000', openingDate: OPENING_DATE })
    const pending = await post('finance', `/accounts/${id}/opening`, { amountMinor: '2000', openingDate: OPENING_DATE }) // resubmit while pending
    expect(pending.json.data.opening).toMatchObject({ status: 'pending', balanceMinor: '2000' })
    const verified = await post('superAdmin', `/accounts/${id}/opening/verify`, {})
    expect(verified.json.data.opening.status).toBe('verified')
    expect(verified.json.data.balance).toMatchObject({ available: true, currentMinor: '2000' })
    expect((await post('finance', `/accounts/${id}/opening`, { amountMinor: '3000', openingDate: OPENING_DATE })).status).toBe(409)
    expect((await post('superAdmin', `/accounts/${id}/opening/verify`, {})).status).toBe(422)
  })

  test('a pending opening blocks postings', async () => {
    const created = await post('finance', '/accounts', { code: 'PEND-1', bankName: 'Bank', holderName: 'PT', accountNumber: '3344556677' })
    const id = created.json.data.id
    await post('finance', `/accounts/${id}/opening`, { amountMinor: '1000', openingDate: OPENING_DATE })
    const res = await post('finance', '/transactions', { bankAccountId: id, kind: 'other_income', amountMinor: '100', effectiveDate: TODAY })
    expect(res.status).toBe(422)
    expect(res.json.error.code).toBe('OPENING_BALANCE_UNVERIFIED')
  })
})

describe('cash book postings', () => {
  let ops: string

  beforeAll(async () => {
    ops = await openAccount('OPS-1', '100000000') // Rp100 jt
  })

  test('expense needs a category; money cannot be dated in the future or before the cutover', async () => {
    const noCategory = await post('finance', '/transactions', { bankAccountId: ops, kind: 'expense', amountMinor: '1000', effectiveDate: TODAY })
    expect(noCategory.json.error.fieldErrors).toHaveProperty('category')
    expect((await post('finance', '/transactions', { bankAccountId: ops, kind: 'other_income', amountMinor: '1000', effectiveDate: addDays(TODAY, 1) })).status).toBe(400)
    const beforeCutover = await post('finance', '/transactions', { bankAccountId: ops, kind: 'other_income', amountMinor: '1000', effectiveDate: addDays(OPENING_DATE, -1) })
    expect(beforeCutover.status).toBe(422)
    const wrongKind = await post('finance', '/transactions', { bankAccountId: ops, kind: 'customer_receipt', amountMinor: '1000', effectiveDate: TODAY })
    expect(wrongKind.json.error.fieldErrors).toHaveProperty('kind')
    expect((await post('finance', '/transactions', { bankAccountId: ops, kind: 'expense', category: 'office', amountMinor: '1.5', effectiveDate: TODAY })).status).toBe(400)
  })

  test('Idempotency-Key: required, a replay returns the first result, a reused key with another body is refused', async () => {
    const body = { bankAccountId: ops, kind: 'other_income', amountMinor: '5000000', effectiveDate: addDays(TODAY, -5), memo: 'Bunga bank' }
    const missing = await post('finance', '/transactions', body, null)
    expect(missing.status).toBe(400)
    expect(missing.json.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED')

    const key = newKey()
    const first = await post('finance', '/transactions', body, key)
    const again = await post('finance', '/transactions', body, key)
    expect(first.status).toBe(201)
    expect(again.status).toBe(201)
    expect(again.headers.get('idempotent-replayed')).toBe('true')
    expect(again.json.data.transactionId).toBe(first.json.data.transactionId)
    expect(await balanceOf(ops)).toBe('105000000') // posted once

    const reused = await post('finance', '/transactions', { ...body, amountMinor: '1' }, key)
    expect(reused.status).toBe(409)
    expect(reused.json.error.code).toBe('IDEMPOTENCY_KEY_REUSED')
  })

  test('an expense larger than the balance is refused with the numbers', async () => {
    const res = await post('finance', '/transactions', { bankAccountId: ops, kind: 'expense', category: 'office', amountMinor: '999000000', effectiveDate: TODAY })
    expect(res.status).toBe(422)
    expect(res.json.error.code).toBe('INSUFFICIENT_BALANCE')
    expect(res.json.error.details).toEqual({ accountId: ops, balanceMinor: '105000000', requiredMinor: '999000000' })
  })

  test('concurrent expenses can never overdraw the account', async () => {
    const acc = await openAccount('RACE-1', '100000000')
    const results = await Promise.all(Array.from({ length: 5 }, () =>
      post('finance', '/transactions', { bankAccountId: acc, kind: 'expense', category: 'other', amountMinor: '30000000', effectiveDate: TODAY })))
    expect(results.filter(r => r.status === 201)).toHaveLength(3)
    expect(results.filter(r => r.json?.error?.code === 'INSUFFICIENT_BALANCE')).toHaveLength(2)
    expect(await balanceOf(acc)).toBe('10000000')
  })

  test('links: a booking implies its project; a mismatching project or unknown ids are field errors', async () => {
    const linked = await post('finance', '/transactions', {
      bankAccountId: ops, kind: 'expense', category: 'travel', amountMinor: '2000000', effectiveDate: addDays(TODAY, -3),
      booking: { type: 'flight', id: 'FLT-1011' }, counterparty: 'Porter bandara'
    })
    expect(linked.status).toBe(201)
    const tx = (await get('finance', `/transactions/${linked.json.data.transactionId}`)).json.data
    expect(tx).toMatchObject({ project: { id: 'PRJ-101', name: 'Manila Business Trip' }, booking: { type: 'flight', id: 'FLT-1011' }, direction: 'out', kind: 'expense', category: 'travel' })

    const mismatch = await post('finance', '/transactions', { bankAccountId: ops, kind: 'expense', category: 'travel', amountMinor: '1', effectiveDate: TODAY, projectId: 'PRJ-102', booking: { type: 'flight', id: 'FLT-1011' } })
    expect(mismatch.json.error.fieldErrors.booking[0]).toContain('PRJ-101')
    const unknown = await post('finance', '/transactions', { bankAccountId: ops, kind: 'expense', category: 'travel', amountMinor: '1', effectiveDate: TODAY, projectId: 'PRJ-999', vendorId: 'VND-999' })
    expect(Object.keys(unknown.json.error.fieldErrors).sort()).toEqual(['projectId', 'vendorId'])
  })

  test('reversal restores the balance, keeps the original, and happens only once', async () => {
    const before = await balanceOf(ops)
    const expense = await post('finance', '/transactions', { bankAccountId: ops, kind: 'expense', category: 'marketing', amountMinor: '7000000', effectiveDate: TODAY })
    expect(await balanceOf(ops)).toBe((BigInt(before!) - 7000000n).toString())

    expect((await post('finance', `/transactions/${expense.json.data.transactionId}/reverse`, { reason: 'ok' })).status).toBe(400) // reason too short
    const reversal = await post('finance', `/transactions/${expense.json.data.transactionId}/reverse`, { reason: 'Salah input nominal' })
    expect(reversal.status).toBe(201)
    expect(await balanceOf(ops)).toBe(before)

    const original = (await get('finance', `/transactions/${expense.json.data.transactionId}`)).json.data
    expect(original.reversedById).toBe(reversal.json.data.reversalId)
    const rev = (await get('finance', `/transactions/${reversal.json.data.reversalId}`)).json.data
    expect(rev).toMatchObject({ direction: 'in', kind: 'expense', reversalOfId: expense.json.data.transactionId, reversalReason: 'Salah input nominal', effectiveDate: TODAY })

    const twice = await post('finance', `/transactions/${expense.json.data.transactionId}/reverse`, { reason: 'Coba lagi dua kali' })
    expect(twice.status).toBe(409)
    expect(twice.json.error.code).toBe('ALREADY_REVERSED')
    expect((await post('finance', `/transactions/${reversal.json.data.reversalId}/reverse`, { reason: 'Balik yang balik' })).status).toBe(422)
  })

  test('posted money is immutable at the database level', async () => {
    await expect(t.db.query(`update financial_transactions set amount_minor = 1`)).rejects.toThrow('immutable')
    await expect(t.db.query(`delete from financial_transactions`)).rejects.toThrow('immutable')
  })
})

describe('transfers between own accounts', () => {
  let a: string
  let b: string

  beforeAll(async () => {
    a = await openAccount('TRF-A', '50000000')
    b = await openAccount('TRF-B', '10000000')
  })

  test('A→B with a fee: two legs + fee atomically; company cash drops by the fee only', async () => {
    const companyBefore = BigInt((await get('finance', '/cash-position')).json.data.accounts.filter((x: { id: string }) => [a, b].includes(x.id)).reduce((s: bigint, x: { currentMinor: string }) => s + BigInt(x.currentMinor), 0n))
    const res = await post('finance', '/transfers', { fromAccountId: a, toAccountId: b, amountMinor: '20000000', feeMinor: '6500', effectiveDate: TODAY, memo: 'Top up' })
    expect(res.status).toBe(201)
    expect(res.json.data.transactionIds).toHaveLength(3)
    expect(await balanceOf(a)).toBe('29993500')
    expect(await balanceOf(b)).toBe('30000000')
    expect(BigInt(await balanceOf(a) as string) + BigInt(await balanceOf(b) as string)).toBe(companyBefore - 6500n)

    const detail = (await get('finance', `/transfers/${res.json.data.transferId}`)).json.data
    expect(detail.legs.map((l: { kind: string }) => l.kind)).toEqual(['transfer_out', 'transfer_in', 'transfer_fee'])
    expect(detail.legs.find((l: { kind: string }) => l.kind === 'transfer_fee').category).toBe('bank_fee')
  })

  test('refusals: same account, insufficient balance, reversing only one leg', async () => {
    expect((await post('finance', '/transfers', { fromAccountId: a, toAccountId: a, amountMinor: '1', effectiveDate: TODAY })).status).toBe(400)
    const broke = await post('finance', '/transfers', { fromAccountId: a, toAccountId: b, amountMinor: '29993500', feeMinor: '1', effectiveDate: TODAY })
    expect(broke.json.error.code).toBe('INSUFFICIENT_BALANCE')

    const res = await post('finance', '/transfers', { fromAccountId: b, toAccountId: a, amountMinor: '1000000', effectiveDate: TODAY })
    const leg = res.json.data.transactionIds[0]
    const oneLeg = await post('finance', `/transactions/${leg}/reverse`, { reason: 'Hanya satu sisi' })
    expect(oneLeg.status).toBe(422)
  })

  test('reversing a transfer undoes every leg together, once', async () => {
    const beforeA = await balanceOf(a)
    const beforeB = await balanceOf(b)
    const res = await post('finance', '/transfers', { fromAccountId: a, toAccountId: b, amountMinor: '3000000', feeMinor: '2500', effectiveDate: TODAY })
    const rev = await post('finance', `/transfers/${res.json.data.transferId}/reverse`, { reason: 'Salah rekening tujuan' })
    expect(rev.status).toBe(201)
    expect(rev.json.data.reversalIds).toHaveLength(3)
    expect(await balanceOf(a)).toBe(beforeA)
    expect(await balanceOf(b)).toBe(beforeB)
    expect((await get('finance', `/transfers/${res.json.data.transferId}`)).json.data.reversed).toBe(true)
    expect((await post('finance', `/transfers/${res.json.data.transferId}/reverse`, { reason: 'Dua kali dibatalkan' })).json.error.code).toBe('ALREADY_REVERSED')
  })
})

describe('statement and account ledger reconcile', () => {
  let acc: string
  let other: string

  beforeAll(async () => {
    acc = await openAccount('LEDG-1', '10000000', addDays(TODAY, -30))
    other = await openAccount('LEDG-2', '0', addDays(TODAY, -30))
    const p = (body: object) => post('finance', '/transactions', { bankAccountId: acc, ...body })
    await p({ kind: 'other_income', amountMinor: '4000000', effectiveDate: addDays(TODAY, -25) })
    await p({ kind: 'expense', category: 'office', amountMinor: '1500000', effectiveDate: addDays(TODAY, -10) })
    await p({ kind: 'other_income', amountMinor: '2500000', effectiveDate: addDays(TODAY, -2) })
    await post('finance', '/transfers', { fromAccountId: acc, toAccountId: other, amountMinor: '1000000', feeMinor: '6500', effectiveDate: addDays(TODAY, -1) })
  })

  test('ledger for a period: opening + in − out = closing, with a running balance on each row', async () => {
    const res = await get('finance', `/accounts/${acc}/ledger?from=${addDays(TODAY, -15)}&to=${TODAY}`)
    expect(res.status).toBe(200)
    const l = res.json.data
    expect(l.available).toBe(true)
    expect(l.openingMinor).toBe('14000000') // 10 jt opening + 4 jt income before the period
    expect(l.inMinor).toBe('2500000')
    expect(l.outMinor).toBe('2506500') // 1.5 jt expense + 1 jt transfer + 6.5 rb fee
    expect(l.closingMinor).toBe('13993500')
    expect(l.items.map((i: { balanceAfterMinor: string }) => i.balanceAfterMinor)).toEqual(['12500000', '15000000', '14000000', '13993500'])
    expect(await balanceOf(acc)).toBe(l.closingMinor)
  })

  test('ledger clamps to the cutover date and refuses periods entirely before it', async () => {
    const clamped = (await get('finance', `/accounts/${acc}/ledger?from=${addDays(TODAY, -90)}&to=${TODAY}`)).json.data
    expect(clamped.period.from).toBe(addDays(TODAY, -30))
    expect(clamped.openingMinor).toBe('10000000')
    expect((await get('finance', `/accounts/${acc}/ledger?from=${addDays(TODAY, -90)}&to=${addDays(TODAY, -60)}`)).status).toBe(422)
    expect((await get('finance', `/accounts/${acc}/ledger?from=${TODAY}&to=${addDays(TODAY, -1)}`)).status).toBe(400)
  })

  test('statement: operational in/out exclude internal transfers but keep the fee; totals match the rows', async () => {
    const res = await get('finance', `/statement?accountId=${acc}&from=${addDays(TODAY, -30)}&to=${TODAY}`)
    expect(res.status).toBe(200)
    expect(res.json.meta.summary).toMatchObject({
      inMinor: '6500000', outMinor: '1506500', netMinor: '4993500', internalTransferInMinor: '0', internalTransferOutMinor: '1000000', count: 5
    })
    // Newest first: the fee was posted after its transfer leg. The fee is real outflow, the leg is internal.
    expect(res.json.data[0]).toMatchObject({ kind: 'transfer_fee', isInternalTransfer: false })
    expect(res.json.data[1]).toMatchObject({ kind: 'transfer_out', isInternalTransfer: true })
    const withoutTransfers = await get('finance', `/statement?accountId=${acc}&from=${addDays(TODAY, -30)}&to=${TODAY}&includeTransfers=false`)
    expect(withoutTransfers.json.data.map((r: { kind: string }) => r.kind)).not.toContain('transfer_out')
  })

  test('cursor pagination walks every row exactly once, newest first', async () => {
    const seen: string[] = []
    let cursor: string | null = null
    do {
      const res = await get('finance', `/statement?from=${addDays(TODAY, -30)}&to=${TODAY}&accountId=${acc}&limit=2${cursor ? `&cursor=${cursor}` : ''}`)
      seen.push(...res.json.data.map((r: { id: string }) => r.id))
      cursor = res.json.meta.pagination.nextCursor
    } while (cursor)
    expect(seen).toHaveLength(5)
    expect(new Set(seen).size).toBe(5)
    const dates = (await get('finance', `/statement?from=${addDays(TODAY, -30)}&to=${TODAY}&accountId=${acc}`)).json.data.map((r: { effectiveDate: string }) => r.effectiveDate)
    expect(dates).toEqual([...dates].sort().reverse())
    expect((await get('finance', '/statement?cursor=garbage')).status).toBe(400)
  })

  test('an account without a verified opening has an explicitly unavailable ledger', async () => {
    const created = await post('finance', '/accounts', { code: 'NOLEDG', bankName: 'Bank', holderName: 'PT', accountNumber: '1212121212' })
    const res = await get('finance', `/accounts/${created.json.data.id}/ledger`)
    expect(res.json.data).toMatchObject({ available: false, reason: 'OPENING_BALANCE_UNVERIFIED' })
  })

  test('money actions are audited with the actor', async () => {
    const rows = await t.db.query<{ action: string; actor_user_id: string }>(
      `select action, actor_user_id from audit_events where action like 'finance.%'`
    )
    const actions = new Set(rows.map(r => r.action))
    for (const a of ['finance.account_created', 'finance.opening_submitted', 'finance.opening_verified', 'finance.transaction_posted', 'finance.transaction_reversed', 'finance.transfer_posted', 'finance.transfer_reversed']) {
      expect(actions.has(a), a).toBe(true)
    }
    expect(rows.find(r => r.action === 'finance.opening_verified')!.actor_user_id).toBe('USR-010')
  })
})

describe('account maintenance', () => {
  test('number is fixed after the first transaction; an account with money cannot be deactivated', async () => {
    const id = await openAccount('MAINT-1', '1000000')
    await post('finance', '/transactions', { bankAccountId: id, kind: 'expense', category: 'bank_fee', amountMinor: '5000', effectiveDate: TODAY })
    expect((await patch('finance', `/accounts/${id}`, { accountNumber: '99999999' })).status).toBe(422)
    expect((await patch('finance', `/accounts/${id}`, { isActive: false })).status).toBe(422)
    const renamed = await patch('finance', `/accounts/${id}`, { bankName: 'Bank Uji Baru' })
    expect(renamed.json.data.bankName).toBe('Bank Uji Baru')
  })

  test('an inactive account refuses new postings', async () => {
    const id = await openAccount('MAINT-2', '0')
    expect((await patch('finance', `/accounts/${id}`, { isActive: false })).status).toBe(200)
    const res = await post('finance', '/transactions', { bankAccountId: id, kind: 'other_income', amountMinor: '100', effectiveDate: TODAY })
    expect(res.status).toBe(422)
  })
})
