import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { todayBusinessDate } from '../src/modules/finance/common'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * Phase 8 — controlled acceptance fixture (10-TESTING-AND-ACCEPTANCE-CRITERIA.md "Acceptance fixture terkontrol").
 * Test-only data on a fresh database, built through the real API; every expected figure is written out by hand.
 *
 *   Accounts   OPS (BCA) opening 500 jt · VND (Mandiri) opening 100 jt, both verified at H-60
 *   Fee rules  OPS→VND Rp 6.500 fixed · VND→OPS 0,1% (min Rp 2.500)
 *   Project A  PRJ-201, customer A (PTY-005): DP 100 jt (due H-20) paid 60 jt · pelunasan 200 jt (due H+20)
 *              hotel VND-002 80 jt (due H+10) paid 50 jt · airline VND-001 45 jt (due H-3) unpaid
 *   Project B  PRJ-102, customer B (PTY-002): DP 30 jt on FLT-1021 paid 20 jt; policy 4 tiers;
 *              booking cancelled at H-7 → refund 30% × 20 jt = 6 jt, unpaid 10 jt written off; refund paid from OPS
 *   Transfer   OPS→VND 30 jt at H-10, fee from the rule
 *
 *   OPS = 500 + 60 + 20 − 30 − 0,0065 − 6        = 543.993.500
 *   VND = 100 + 30 − 50                          =  80.000.000      company cash 623.993.500
 *   AR  = 40 (overdue) + 200                     = 240 jt           AP = 30 + 45 (overdue) = 75 jt
 *   Cash flow 30d closing = 623.993.500 + 240 jt − 75 jt = 788.993.500
 */

let t: TestApp
const who: Record<string, string> = {}
let keySeq = 0
const newKey = () => `acc-${Date.now()}-${++keySeq}`
const TODAY = todayBusinessDate()
function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const jt = (n: number) => String(n * 1_000_000)
const req = (method: string, as: string, path: string, body?: unknown, key?: string) =>
  t.call(method, `/api/v1${path}`, { cookie: who[as], body, headers: key ? { 'idempotency-key': key } : {} })
const get = async (as: string, path: string) => {
  const res = await req('GET', as, path)
  if (res.status !== 200) throw new Error(`GET ${path} → ${res.status} ${JSON.stringify(res.json?.error)}`)
  return res.json
}
async function post (as: string, path: string, body: unknown = {}, money = false) {
  const res = await req('POST', as, path, body, money ? newKey() : undefined)
  if (res.status >= 400) throw new Error(`POST ${path} → ${res.status} ${JSON.stringify(res.json?.error)}`)
  return res.json.data
}
const sumOf = (rows: Record<string, unknown>[], field: string) => rows.reduce((s, r) => s + BigInt(r[field] as string), 0n)

const A = { project: 'PRJ-201', party: 'PTY-005' }
const B = { project: 'PRJ-102', party: 'PTY-002', booking: { type: 'flight', id: 'FLT-1021' } }
let OPS: string
let VND: string
const ids: Record<string, string> = {}

beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries({ finance: DEMO.finance, superAdmin: DEMO.superAdmin, admin: DEMO.admin })) who[k] = await t.login(email)
  // The fixture's dates move with today, so H-7 and "due in 20 days" hold on any day the suite runs.
  await t.db.query("update booking_refs set departure_date = $1 where booking_type = 'flight' and booking_id = 'FLT-1021'", [addDays(TODAY, 7)])
  await t.db.query('update projects set travel_start_date = $1, travel_end_date = $2 where id = $3', [addDays(TODAY, 40), addDays(TODAY, 45), A.project])

  const open = async (code: string, bank: string, opening: string) => {
    const acc = await post('finance', '/finance/accounts', { code, bankName: bank, holderName: 'PT MANOVA', accountNumber: `88${code.length}0012345` })
    await post('finance', `/finance/accounts/${acc.id}/opening`, { amountMinor: opening, openingDate: addDays(TODAY, -60) })
    await post('superAdmin', `/finance/accounts/${acc.id}/opening/verify`, { balanceMinor: opening, openingDate: addDays(TODAY, -60) })
    return acc.id as string
  }
  OPS = await open('ACC-OPS', 'BCA', jt(500))
  VND = await open('ACC-VND', 'Mandiri', jt(100))
  await post('finance', '/finance/transfer-fee-rules', { fromAccountId: OPS, toAccountId: VND, feeType: 'fixed', fixedMinor: '6500', effectiveFrom: addDays(TODAY, -60) })
  await post('finance', '/finance/transfer-fee-rules', { fromAccountId: VND, toAccountId: OPS, feeType: 'percent', percentBasisPoints: 10, minMinor: '2500', effectiveFrom: addDays(TODAY, -60) })
})
afterAll(() => t.cleanup())

describe('journeys', () => {
  test('issue a customer invoice → AR once, no cash movement yet', async () => {
    const cashBefore = (await get('finance', '/finance/cash-position')).data.totalMinor
    const dp = await post('finance', '/finance/customer-invoices', { projectId: A.project, invoiceType: 'dp', lines: [{ description: 'DP 50%', amountMinor: jt(100) }], dueDate: addDays(TODAY, -20) })
    await post('finance', `/finance/customer-invoices/${dp.id}/issue`, { issueDate: addDays(TODAY, -30), dueDate: addDays(TODAY, -20) })
    ids.dpA = dp.id
    const fin = await post('finance', '/finance/customer-invoices', { projectId: A.project, invoiceType: 'final', lines: [{ description: 'Pelunasan', amountMinor: jt(200) }], dueDate: addDays(TODAY, 20) })
    await post('finance', `/finance/customer-invoices/${fin.id}/issue`, { issueDate: TODAY, dueDate: addDays(TODAY, 20) })
    ids.finalA = fin.id

    const ar = await get('finance', `/finance/receivables?settlement=outstanding&projectId=${A.project}&limit=100`)
    expect(ar.data.map((i: { id: string }) => i.id).sort()).toEqual([ids.dpA, ids.finalA].sort())
    expect(ar.meta.summary.outstandingMinor).toBe(jt(300))
    expect((await get('finance', '/finance/cash-position')).data.totalMinor).toBe(cashBefore)
    expect((await get('finance', `/finance/statement?from=${addDays(TODAY, -60)}&limit=100`)).data).toHaveLength(0)
  })

  test('partial DP receipt → allocation, AR down exactly, statement and ledger up, project context linked', async () => {
    const rc = await post('finance', '/finance/receipts', { bankAccountId: OPS, amountMinor: jt(60), effectiveDate: addDays(TODAY, -18), partyId: A.party, allocations: [{ invoiceId: ids.dpA, amountMinor: jt(60) }] }, true)
    ids.receiptA = rc.transactionId
    expect((await get('finance', `/finance/customer-invoices/${ids.dpA}`)).data).toMatchObject({ paidMinor: jt(60), outstandingMinor: jt(40) })
    const moved = (await get('finance', `/finance/transactions/${ids.receiptA}`)).data
    // A receipt belongs to the customer (it may pay several projects); the project link is its allocation.
    expect(moved).toMatchObject({ kind: 'customer_receipt', direction: 'in', amountMinor: jt(60), party: { id: A.party }, account: { id: OPS } })
    expect(rc.allocations).toEqual([expect.objectContaining({ invoiceId: ids.dpA, amountMinor: jt(60), outstandingMinor: jt(40) })])
    const summary = (await get('finance', `/projects/${A.project}/finance-summary`)).data
    expect(summary.receivable).toMatchObject({ receivedMinor: jt(60), outstandingMinor: jt(240) })
  })

  test('vendor invoices approved → AP once, cash unchanged; partial payment → AP down, account down; replay posts once', async () => {
    const cashBefore = (await get('finance', '/finance/cash-position')).data.totalMinor
    const hotel = await post('finance', '/finance/vendor-invoices', { vendorId: 'VND-002', vendorInvoiceNumber: 'HPM/ACC/001', projectId: A.project, invoiceDate: addDays(TODAY, -12), dueDate: addDays(TODAY, 10), totalMinor: jt(80) })
    await post('finance', `/finance/vendor-invoices/${hotel.id}/review`, { action: 'approve', matchStatus: 'matched' })
    const air = await post('finance', '/finance/vendor-invoices', { vendorId: 'VND-001', vendorInvoiceNumber: 'CTM/ACC/001', projectId: A.project, invoiceDate: addDays(TODAY, -20), dueDate: addDays(TODAY, -3), totalMinor: jt(45) })
    await post('finance', `/finance/vendor-invoices/${air.id}/review`, { action: 'approve', matchStatus: 'matched' })
    ids.hotel = hotel.id
    ids.air = air.id
    expect((await get('finance', '/finance/cash-position')).data.totalMinor).toBe(cashBefore)
    const ap = await get('finance', '/finance/payables?view=outstanding&limit=100')
    expect(ap.data.map((v: { id: string }) => v.id).sort()).toEqual([hotel.id, air.id].sort())

    // Pay 50 jt of the hotel from VND after topping VND up from OPS (fee from the direction's rule).
    const trf = await post('finance', '/finance/transfers', { fromAccountId: OPS, toAccountId: VND, amountMinor: jt(30), effectiveDate: addDays(TODAY, -10), memo: 'Top up rekening vendor' }, true)
    ids.transfer = trf.transferId
    const key = newKey()
    const body = { bankAccountId: VND, amountMinor: jt(50), effectiveDate: addDays(TODAY, -5), vendorId: 'VND-002', allocations: [{ vendorInvoiceId: hotel.id, amountMinor: jt(50) }] }
    const first = await req('POST', 'finance', '/finance/vendor-payments', body, key)
    const replay = await req('POST', 'finance', '/finance/vendor-payments', body, key)
    expect(first.status).toBe(201)
    expect(replay.headers.get('idempotent-replayed')).toBe('true')
    expect((await get('finance', `/finance/vendor-invoices/${hotel.id}`)).data).toMatchObject({ paidMinor: jt(50), outstandingMinor: jt(30) })
    expect((await get('finance', `/finance/accounts/${VND}`)).data.balance.currentMinor).toBe(jt(80)) // 100 + 30 − 50, once
  })

  test('transfer A→B: two legs plus the rule fee; company cash drops by the fee only', async () => {
    const tr = (await get('finance', `/finance/transfers/${ids.transfer}`)).data
    expect(tr).toMatchObject({ amountMinor: jt(30), feeMinor: '6500', feeSource: 'rule' })
    expect(tr.legs.map((l: { kind: string; amountMinor: string }) => [l.kind, l.amountMinor])).toEqual([['transfer_out', jt(30)], ['transfer_in', jt(30)], ['transfer_fee', '6500']])
    // The other direction has its own rule.
    const back = (await get('finance', `/finance/transfer-fee-quote?fromAccountId=${VND}&toAccountId=${OPS}&amountMinor=${jt(30)}&effectiveDate=${TODAY}`)).data
    expect(back.feeMinor).toBe('30000')
  })

  test('cancellation at H-7 under a 4-tier policy: refund from the paid DP, snapshot kept, cash moves only at settlement, once', async () => {
    const policy = await post('finance', '/finance/policies', {
      code: 'ACC-STD', name: 'Standar uji', effectiveFrom: addDays(TODAY, -60),
      tiers: [{ minDays: 30, maxDays: null, refundBp: 10_000 }, { minDays: 14, maxDays: 30, refundBp: 5_000 }, { minDays: 7, maxDays: 14, refundBp: 3_000 }, { minDays: null, maxDays: 7, refundBp: 0 }]
    })
    await post('finance', `/finance/policies/${policy.id}/publish`)
    const dp = await post('finance', '/finance/customer-invoices', { projectId: B.project, booking: B.booking, invoiceType: 'dp', lines: [{ description: 'DP tiket', amountMinor: jt(30) }], dueDate: TODAY })
    await post('finance', `/finance/customer-invoices/${dp.id}/issue`, { issueDate: addDays(TODAY, -25), dueDate: addDays(TODAY, -15) })
    ids.dpB = dp.id
    await post('finance', '/finance/receipts', { bankAccountId: OPS, amountMinor: jt(20), effectiveDate: addDays(TODAY, -16), partyId: B.party, allocations: [{ invoiceId: dp.id, amountMinor: jt(20) }] }, true)
    expect((await req('PUT', 'finance', `/finance/cancellation-policy/flight/${B.booking.id}`, { policyId: policy.id })).status).toBe(200)

    const cashBefore = BigInt((await get('finance', '/finance/cash-position')).data.totalMinor)
    const kase = await post('finance', '/finance/cancellations', { subjectType: 'flight', subjectId: B.booking.id, cancelDate: TODAY, reason: 'Customer membatalkan tiket' }, true)
    expect(kase).toMatchObject({ daysBefore: 7, refundableMinor: jt(6), retainedMinor: jt(14), writtenOffMinor: jt(10) })
    expect(kase.sourcePayments).toEqual([expect.objectContaining({ invoiceId: dp.id, amountMinor: jt(20) })])
    expect(kase.policy).toMatchObject({ id: policy.id, version: 1 })
    await post('finance', `/finance/refunds/${kase.id}/approve`, { note: 'Sesuai kebijakan' })
    expect(BigInt((await get('finance', '/finance/cash-position')).data.totalMinor)).toBe(cashBefore) // approval moves no money

    const key = newKey()
    const body = { bankAccountId: OPS, amountMinor: jt(6), effectiveDate: TODAY, recipient: 'PT Alam Raya Group' }
    expect((await req('POST', 'finance', `/finance/refunds/${kase.id}/settlements`, body, key)).status).toBe(201)
    expect((await req('POST', 'finance', `/finance/refunds/${kase.id}/settlements`, body, key)).headers.get('idempotent-replayed')).toBe('true')
    expect(BigInt((await get('finance', '/finance/cash-position')).data.totalMinor)).toBe(cashBefore - 6_000_000n)
    expect((await get('finance', `/finance/refunds/${kase.id}`)).data).toMatchObject({ settlement: 'settled', outstandingMinor: '0' })
    expect((await get('finance', `/finance/customer-invoices/${dp.id}`)).data.outstandingMinor).toBe('0')
  })

  test('reversal: the original stays visible, the balance and outstanding come back, then re-post restores the fixture', async () => {
    const cash = async () => (await get('finance', '/finance/cash-position')).data.totalMinor
    const before = await cash()
    const rev = await post('finance', `/finance/transactions/${ids.receiptA}/reverse`, { reason: 'Uji pembatalan' }, true)
    expect(BigInt(await cash())).toBe(BigInt(before) - 60_000_000n)
    expect((await get('finance', `/finance/customer-invoices/${ids.dpA}`)).data.outstandingMinor).toBe(jt(100))
    const original = (await get('finance', `/finance/transactions/${ids.receiptA}`)).data
    expect(original.reversedById).toBe(rev.reversalId)
    // Record the receipt again, as Finance would after a mistaken reversal.
    const again = await post('finance', '/finance/receipts', { bankAccountId: OPS, amountMinor: jt(60), effectiveDate: addDays(TODAY, -18), partyId: A.party, allocations: [{ invoiceId: ids.dpA, amountMinor: jt(60) }] }, true)
    ids.receiptA = again.transactionId
    expect(await cash()).toBe(before)
  })
})

describe('numeric reconciliation (exact figures)', () => {
  test('cash: company total = sum of accounts = the hand-computed figures', async () => {
    const cash = (await get('finance', '/finance/cash-position')).data
    expect(cash).toMatchObject({ available: true, totalMinor: '623993500' })
    const byId = Object.fromEntries(cash.accounts.map((a: { id: string; currentMinor: string }) => [a.id, a.currentMinor]))
    expect(byId[OPS]).toBe('543993500')
    expect(byId[VND]).toBe(jt(80))
    expect(sumOf(cash.accounts, 'currentMinor')).toBe(BigInt(cash.totalMinor))
  })

  test('each account ledger: opening + in − out = closing = today\'s balance, and every running balance chains', async () => {
    for (const [id, opening, inMinor, outMinor, closing] of [[OPS, jt(500), jt(140), '96006500', '543993500'], [VND, jt(100), jt(30), jt(50), jt(80)]]) {
      const l = (await get('finance', `/finance/accounts/${id}/ledger?from=${addDays(TODAY, -60)}&to=${TODAY}`)).data
      // OPS in: 60 + 20 + 60 (reversal leg of the receipt) · out: 30 + 0,0065 + 6 + 60 (the reversed receipt)
      expect(l).toMatchObject({ openingMinor: opening, inMinor, outMinor, closingMinor: closing })
      expect(BigInt(l.openingMinor) + BigInt(l.inMinor) - BigInt(l.outMinor)).toBe(BigInt(l.closingMinor))
      let running = BigInt(l.openingMinor)
      for (const row of l.items) {
        running += row.direction === 'in' ? BigInt(row.amountMinor) : -BigInt(row.amountMinor)
        expect(row.balanceAfterMinor).toBe(running.toString())
      }
    }
  })

  test('statement: operational totals exclude internal transfers and cancelled pairs, keep the fee; totals = rows', async () => {
    const s = await get('finance', `/finance/statement?from=${addDays(TODAY, -60)}&to=${TODAY}&limit=100`)
    // in: 60 + 20 (the reversed 60 and its reversal are listed but not counted) · out: vendor 50 + refund 6 + fee 0,0065
    expect(s.meta.summary).toMatchObject({ inMinor: jt(80), outMinor: '56006500', internalTransferInMinor: jt(30), internalTransferOutMinor: jt(30), reversedCount: 2 })
    const counted = s.data.filter((r: { isInternalTransfer: boolean; reversedById: string | null; reversalOfId: string | null }) => !r.isInternalTransfer && !r.reversedById && !r.reversalOfId)
    expect(sumOf(counted.filter((r: { direction: string }) => r.direction === 'in'), 'amountMinor')).toBe(80_000_000n)
    expect(sumOf(counted.filter((r: { direction: string }) => r.direction === 'out'), 'amountMinor')).toBe(56_006_500n)
    expect(BigInt(s.meta.summary.inMinor) - BigInt(s.meta.summary.outMinor)).toBe(BigInt(s.meta.summary.netMinor))
  })

  test('AR / AP: aggregate = sum of the outstanding rows', async () => {
    const ar = await get('finance', '/finance/receivables?settlement=outstanding&limit=100')
    expect(ar.meta.summary).toMatchObject({ outstandingMinor: jt(240), overdueMinor: jt(40), count: 2 })
    expect(sumOf(ar.data, 'outstandingMinor')).toBe(240_000_000n)
    const overdue = await get('finance', '/finance/receivables?settlement=overdue&limit=100')
    expect(overdue.data.map((i: { id: string }) => i.id)).toEqual([ids.dpA])

    const ap = await get('finance', '/finance/payables?view=outstanding&limit=100')
    expect(ap.meta.summary).toMatchObject({ outstandingMinor: jt(75), overdueMinor: jt(45), count: 2 })
    expect(sumOf(ap.data, 'outstandingMinor')).toBe(75_000_000n)
  })

  test('cash flow 30d: opening + in − out = closing per row, rows chain, totals = rows = counted items; overdue in the first period', async () => {
    const cf = (await get('finance', '/finance/cash-flow?horizon=30d')).data
    expect(cf).toMatchObject({ available: true, openingCashMinor: '623993500', closingMinor: '788993500' })
    expect(cf.totals).toMatchObject({ incomingMinor: jt(240), outgoingMinor: jt(75), overdueIncomingMinor: jt(40), overdueOutgoingMinor: jt(45) })
    let opening = BigInt(cf.openingCashMinor)
    for (const row of cf.rows) {
      expect(row.openingMinor).toBe(opening.toString())
      expect(BigInt(row.openingMinor) + BigInt(row.incomingMinor) - BigInt(row.outgoingMinor)).toBe(BigInt(row.closingMinor))
      opening = BigInt(row.closingMinor)
    }
    expect(opening.toString()).toBe(cf.closingMinor)
    expect(sumOf(cf.rows, 'incomingMinor')).toBe(BigInt(cf.totals.incomingMinor))
    const counted = cf.items.filter((i: { counted: boolean }) => i.counted)
    expect(sumOf(counted.filter((i: { direction: string }) => i.direction === 'in'), 'amountMinor')).toBe(BigInt(cf.totals.incomingMinor))
    expect(sumOf(counted.filter((i: { direction: string }) => i.direction === 'out'), 'amountMinor')).toBe(BigInt(cf.totals.outgoingMinor))
    for (const i of cf.items.filter((x: { certainty: string }) => x.certainty === 'overdue')) expect(i.periodIndex).toBe(0)
    // Posted money is never projected again: the paid 60 jt and the settled refund are not items.
    expect(cf.items.find((i: { id: string }) => i.id === ids.dpA).amountMinor).toBe(jt(40))
    expect(cf.items.some((i: { source: string }) => i.source === 'refund')).toBe(false)
  })

  test('dashboard overview and project summaries agree with the menus', async () => {
    const ov = (await get('finance', '/finance/overview')).data
    expect(ov.cash.totalMinor).toBe('623993500')
    expect(ov.receivables).toMatchObject({ outstandingMinor: jt(240), overdueMinor: jt(40) })
    expect(ov.payables).toMatchObject({ outstandingMinor: jt(75), overdueMinor: jt(45) })
    expect(ov.forecast).toMatchObject({ available: true, closingMinor: '788993500' })

    const pa = ov.projects.find((p: { projectId: string }) => p.projectId === A.project)
    expect(pa).toMatchObject({ revenueMinor: jt(300), receivedMinor: jt(60), outstandingMinor: jt(240), costMinor: jt(125), hasOverdue: true })
    const sa = (await get('finance', `/projects/${A.project}/finance-summary`)).data
    expect(sa.profitability).toMatchObject({ revenueMinor: jt(300), costMinor: jt(125), grossProfitMinor: jt(175) })
    expect(sa.payable).toMatchObject({ approvedMinor: jt(125), outstandingMinor: jt(75) })

    // Project B: billed 30, 10 written off, 6 refunded → revenue 14 jt, the same on both screens.
    const pb = ov.projects.find((p: { projectId: string }) => p.projectId === B.project)
    const sb = (await get('finance', `/projects/${B.project}/finance-summary`)).data
    expect(pb.revenueMinor).toBe(jt(14))
    expect(sb.profitability.revenueMinor).toBe(jt(14))
    expect(sb.refunds).toMatchObject({ openCount: 0, outstandingMinor: '0', refundCreditedMinor: jt(6) })
  })

  test('monthly report: revenue and vendor spend add up to the projects and vendors', async () => {
    const report = (await get('finance', '/finance/reports/monthly?months=12')).data
    const ov = (await get('finance', '/finance/overview')).data
    const projectRevenue = ov.projects.reduce((s: bigint, p: { revenueMinor: string }) => s + BigInt(p.revenueMinor), 0n)
    expect(sumOf(report.months, 'revenueMinor')).toBe(projectRevenue)
    expect(projectRevenue).toBe(314_000_000n)
  })
})

describe('role context', () => {
  test('Admin sees project payment status without a single amount; finance menus are closed', async () => {
    const ov = (await get('admin', '/finance/overview')).data
    expect(ov.view).toBe('status')
    expect(ov.projects.find((p: { projectId: string }) => p.projectId === A.project)).toMatchObject({ hasOverdue: true, dpInvoiced: true, dpReceived: true })
    expect(JSON.stringify(ov)).not.toMatch(/Minor/)
    for (const path of ['/finance/cash-position', '/finance/receivables', '/finance/payables', '/finance/cash-flow', `/finance/transfers/${ids.transfer}`, '/finance/transfer-fee-rules']) {
      expect((await req('GET', 'admin', path)).status, path).toBe(403)
    }
  })
})
