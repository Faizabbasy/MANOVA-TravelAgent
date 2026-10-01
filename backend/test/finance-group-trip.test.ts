import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { todayBusinessDate } from '../src/modules/finance/common'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * Group Trip B2C — DP per participant. SLO-006 (PRJ-205, customer PTY-010, Rp 7.000.000, 2 pax) and SLO-011
 * (PRJ-502, PTY-016, Rp 14.000.000) come from the demo seed; the project itself belongs to the organiser
 * PTY-009, so the invoice must go to the participant, not the project customer.
 */

let t: TestApp
const who: Record<string, string> = {}
let keySeq = 0
const TODAY = todayBusinessDate()
const req = (method: string, as: string, path: string, body?: unknown, key?: string) =>
  t.call(method, `/api/v1${path}`, { cookie: who[as], body, headers: key ? { 'idempotency-key': key } : {} })
const get = (as: string, path: string) => req('GET', as, path)
const confirm = (as: string, id: string, body: unknown, key = `gt-${Date.now()}-${++keySeq}`) => req('POST', as, `/finance/sales-orders/${id}/confirm-dp`, body, key)

const SLO = { id: 'SLO-006', projectId: 'PRJ-205', partyId: 'PTY-010', price: 7_000_000n }
const FULL = { id: 'SLO-011', price: 14_000_000n }
const minDp = (price: bigint) => ((price * 30n + 99n) / 100n)
let bank: string

beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries({ finance: DEMO.finance, superAdmin: DEMO.superAdmin, admin: DEMO.admin })) who[k] = await t.login(email)
  bank = (await req('POST', 'finance', '/finance/accounts', { code: 'BCA-OPS', bankName: 'BCA', holderName: 'PT MANOVA', accountNumber: '0123456789' })).json.data.id
  await req('POST', 'finance', `/finance/accounts/${bank}/opening`, { amountMinor: '0', openingDate: TODAY })
  await req('POST', 'superAdmin', `/finance/accounts/${bank}/opening/verify`, { balanceMinor: '0', openingDate: TODAY })
})
afterAll(() => t.cleanup())

const body = (dp: bigint) => ({ bankAccountId: bank, dpAmountMinor: dp.toString(), effectiveDate: TODAY, dueDate: TODAY })

describe('group trip DP per participant', () => {
  test('before any DP: not invoiced, outstanding is the full price', async () => {
    const s = await get('finance', `/sales-orders/${SLO.id}/finance-summary`)
    expect(s.status).toBe(200)
    expect(s.json.data).toMatchObject({ view: 'full', salesOrderId: SLO.id, priceMinor: SLO.price.toString(), receivedMinor: '0', outstandingMinor: SLO.price.toString(), invoiceId: null, paymentStatus: 'not_invoiced' })
  })

  test('below 30% and above the price are rejected', async () => {
    expect((await confirm('finance', SLO.id, body(minDp(SLO.price) - 1n))).status).toBe(400)
    expect((await confirm('finance', SLO.id, body(SLO.price + 1n))).status).toBe(400)
  })

  test('admin cannot confirm and sees the status only; unknown order is 404; anonymous 401', async () => {
    expect((await confirm('admin', SLO.id, body(minDp(SLO.price)))).status).toBe(403)
    const s = await get('admin', `/sales-orders/${SLO.id}/finance-summary`)
    expect(s.status).toBe(200)
    expect(s.json.data).toEqual({ view: 'status', salesOrderId: SLO.id, paymentStatus: 'not_invoiced', label: 'Menunggu DP' })
    expect((await get('finance', '/sales-orders/SLO-999/finance-summary')).status).toBe(404)
    expect((await t.call('GET', `/api/v1/sales-orders/${SLO.id}/finance-summary`)).status).toBe(401)
  })

  test('minimum DP: full-price invoice to the participant, receipt allocated, cash in = DP', async () => {
    const dp = minDp(SLO.price)
    const r = await confirm('finance', SLO.id, body(dp), 'gt-fixed')
    expect(r.status).toBe(201)
    expect(r.json.data).toMatchObject({ outstandingMinor: (SLO.price - dp).toString(), minimumDpMinor: dp.toString() })
    expect(r.json.data.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/)
    const inv = await get('finance', `/finance/customer-invoices/${r.json.data.invoiceId}`)
    expect(inv.json.data).toMatchObject({
      status: 'issued', invoiceType: 'dp', totalMinor: SLO.price.toString(), salesOrderId: SLO.id,
      party: { id: SLO.partyId }, project: { id: SLO.projectId }, outstandingMinor: (SLO.price - dp).toString()
    })
    expect((await get('finance', `/finance/accounts/${bank}`)).json.data.balance.currentMinor).toBe(dp.toString())
    const s = await get('finance', `/sales-orders/${SLO.id}/finance-summary`)
    expect(s.json.data).toMatchObject({ receivedMinor: dp.toString(), outstandingMinor: (SLO.price - dp).toString(), paymentStatus: 'dp_received', label: 'DP diterima' })
  })

  test('same idempotency key replays; a second confirm on the same order is rejected; one receipt only', async () => {
    const dp = minDp(SLO.price)
    const replay = await confirm('finance', SLO.id, body(dp), 'gt-fixed')
    expect(replay.status).toBe(201)
    expect(replay.headers.get('idempotent-replayed')).toBe('true')
    expect((await confirm('finance', SLO.id, body(dp))).status).toBe(422)
    expect((await get('finance', `/finance/accounts/${bank}`)).json.data.balance.currentMinor).toBe(dp.toString())
  })

  test('the rest is paid like any invoice: a receipt from the participant against the project', async () => {
    const s = (await get('finance', `/sales-orders/${SLO.id}/finance-summary`)).json.data
    const rest = await req('POST', 'finance', '/finance/receipts', {
      bankAccountId: bank, amountMinor: s.outstandingMinor, effectiveDate: TODAY, partyId: SLO.partyId, projectId: SLO.projectId,
      allocations: [{ invoiceId: s.invoiceId, amountMinor: s.outstandingMinor }]
    }, `gt-rest-${Date.now()}`)
    expect(rest.status).toBe(201)
    expect((await get('finance', `/sales-orders/${SLO.id}/finance-summary`)).json.data).toMatchObject({ outstandingMinor: '0', paymentStatus: 'paid', label: 'Lunas' })
  })

  test('a debit note on a participant invoice is billed to the participant and counts in the order balance', async () => {
    const s = (await get('finance', `/sales-orders/${SLO.id}/finance-summary`)).json.data
    const dn = await req('POST', 'finance', `/finance/customer-invoices/${s.invoiceId}/debit-notes`, { amountMinor: '500000', reason: 'Tambahan kamar', dueDate: TODAY })
    expect(dn.status).toBe(201)
    expect(dn.json.data).toMatchObject({ invoiceType: 'debit_note', salesOrderId: SLO.id, party: { id: SLO.partyId } })
    const after = (await get('finance', `/sales-orders/${SLO.id}/finance-summary`)).json.data
    expect(BigInt(after.invoicedMinor)).toBe(SLO.price + 500000n)
    expect(BigInt(after.outstandingMinor)).toBe(500000n)
    expect(after.paymentStatus).toBe('dp_received')
    expect(after.invoiceId).toBe(s.invoiceId) // the base invoice stays the order's invoice
  })

  test('a receipt for the project from a party that is neither the organiser nor a participant is refused', async () => {
    const r = await req('POST', 'finance', '/finance/receipts', { bankAccountId: bank, amountMinor: '1000', effectiveDate: TODAY, partyId: 'PTY-005', projectId: SLO.projectId }, `gt-x-${Date.now()}`)
    expect(r.status).toBe(400)
  })

  test('super admin: full price as DP settles the invoice at once', async () => {
    const r = await confirm('superAdmin', FULL.id, body(FULL.price))
    expect(r.status).toBe(201)
    expect(r.json.data.outstandingMinor).toBe('0')
    expect((await get('superAdmin', `/sales-orders/${FULL.id}/finance-summary`)).json.data.paymentStatus).toBe('paid')
  })
})
