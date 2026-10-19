import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * S12c-1: a client sends a proof of payment for its invoice; Finance verifies it by posting the receipt it describes,
 * or rejects it. Client USR-021 (PTY-005), Finance USR-008.
 */

let t: TestApp
const c: Record<string, string> = {}
let n = 0
beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 60_000)
afterAll(() => t.cleanup())

const call = (method: string, path: string, who: string, body?: unknown, key?: string) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: key ? { 'idempotency-key': key } : {} })
const k = () => `ppf-key-${++n}-${Date.now()}`
const notes = async (userId: string) => Number((await t.db.query<{ n: string }>('select count(*)::text as n from notifications where user_id = $1', [userId]))[0]!.n)

async function issuedInvoice(projectId: string, amount: string, issue = true) {
  const res = await call('POST', '/finance/customer-invoices', 'finance', { projectId, invoiceType: 'dp', lines: [{ description: 'DP perjalanan', amountMinor: amount }], dueDate: '2026-12-01' })
  expect(res.status, JSON.stringify(res.json)).toBe(201)
  const id = res.json.data.id as string
  if (issue) expect((await call('POST', `/finance/customer-invoices/${id}/issue`, 'finance', {})).status).toBe(200)
  return id
}
const proof = (over: Record<string, unknown> = {}) => ({ reference: 'TRF-001', amountMinor: '4000000', transferDate: '2026-10-18', senderBank: 'BCA', fileName: 'bukti.jpg', ...over })
const clientInvoice = async (id: string) => (await call('GET', `/client/invoices/${id}`, 'client')).json.data as {
  paidMinor: string; viewedAt: string | null; paymentProof: { status: string; reference: string; amountMinor: string; rejectionReason: string | null } | null
}

describe('client payment proof', () => {
  test('send a proof: stored as waiting, Finance told; one waiting proof per invoice; validated', async () => {
    const inv = await issuedInvoice('PRJ-201', '10000000')
    const n0 = await notes('USR-008')
    const res = await call('POST', `/client/invoices/${inv}/payment-proofs`, 'client', proof(), k())
    expect(res.status, JSON.stringify(res.json)).toBe(201)
    expect((await clientInvoice(inv)).paymentProof).toMatchObject({ status: 'submitted', reference: 'TRF-001', amountMinor: '4000000' })
    expect(await notes('USR-008')).toBe(n0 + 1)
    expect((await call('POST', `/client/invoices/${inv}/payment-proofs`, 'client', proof({ reference: 'TRF-002' }), k())).status).toBe(422)
    const other = await issuedInvoice('PRJ-201', '3000000')
    expect((await call('POST', `/client/invoices/${other}/payment-proofs`, 'client', proof({ amountMinor: '5000000' }), k())).status).toBe(400)
    expect((await call('POST', `/client/invoices/${other}/payment-proofs`, 'client', proof({ transferDate: '2099-01-01' }), k())).status).toBe(400)
    expect((await call('POST', `/client/invoices/${other}/payment-proofs`, 'client', proof({ reference: ' ' }), k())).status).toBe(400)
  })

  test('another party’s or a draft invoice is not found; staff cannot send for the client; a rejected proof can be replaced', async () => {
    const foreignProject = (await t.db.query<{ id: string }>("select id from projects where party_id <> 'PTY-005' order by id limit 1"))[0]!.id
    const foreign = await issuedInvoice(foreignProject, '2000000')
    expect((await call('POST', `/client/invoices/${foreign}/payment-proofs`, 'client', proof({ amountMinor: '1000' }), k())).status).toBe(404)
    const draft = await issuedInvoice('PRJ-201', '2000000', false)
    expect((await call('POST', `/client/invoices/${draft}/payment-proofs`, 'client', proof({ amountMinor: '1000' }), k())).status).toBe(404)
    const inv = await issuedInvoice('PRJ-201', '2000000')
    expect((await call('POST', `/client/invoices/${inv}/payment-proofs`, 'admin', proof({ amountMinor: '1000' }), k())).status).toBe(403)
    expect((await call('POST', `/client/invoices/${inv}/payment-proofs`, 'client', proof({ amountMinor: '1000' }), k())).status).toBe(201)
    await t.db.query("update payment_proofs set status = 'rejected', rejection_reason = 'Nominal tidak sesuai' where customer_invoice_id = $1", [inv])
    expect((await call('POST', `/client/invoices/${inv}/payment-proofs`, 'client', proof({ amountMinor: '2000', reference: 'TRF-009' }), k())).status).toBe(201)
  })

  test('opening an invoice marks it viewed once', async () => {
    const inv = await issuedInvoice('PRJ-201', '1500000')
    expect((await clientInvoice(inv)).viewedAt).toBeNull()
    const first = await call('POST', `/client/invoices/${inv}/viewed`, 'client', {})
    expect(first.status).toBe(200)
    const viewedAt = (await clientInvoice(inv)).viewedAt
    expect(viewedAt).not.toBeNull()
    await call('POST', `/client/invoices/${inv}/viewed`, 'client', {})
    expect((await clientInvoice(inv)).viewedAt).toBe(viewedAt)
  })
})

describe('Finance reviews payment proofs', () => {
  let bank = ''
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
  beforeAll(async () => {
    const acc = await call('POST', '/finance/accounts', 'finance', { code: 'BCA-PPF', bankName: 'BCA', holderName: 'PT MANOVA', accountNumber: '0099887766' })
    bank = acc.json.data.id
    const opening = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
    await call('POST', `/finance/accounts/${bank}/opening`, 'finance', { amountMinor: '100000000', openingDate: opening })
    await call('POST', `/finance/accounts/${bank}/opening/verify`, 'superAdmin', { balanceMinor: '100000000', openingDate: opening })
  })
  const submitted = async (amount: string) => {
    const inv = await issuedInvoice('PRJ-201', '9000000')
    expect((await call('POST', `/client/invoices/${inv}/payment-proofs`, 'client', proof({ amountMinor: amount, transferDate: today }), k())).status).toBe(201)
    const list = (await call('GET', '/finance/payment-proofs?status=submitted', 'finance')).json.data as { id: string; invoiceId: string }[]
    return { inv, proofId: list.find(p => p.invoiceId === inv)!.id }
  }

  test('verify posts the receipt allocated to the invoice; the client sees it paid and is told; replay is one receipt', async () => {
    const { inv, proofId } = await submitted('4000000')
    expect((await call('GET', '/finance/payment-proofs?status=submitted', 'admin')).status).toBe(403)
    const n0 = await notes('USR-021')
    const key = k()
    const res = await call('POST', `/finance/payment-proofs/${proofId}/verify`, 'finance', { bankAccountId: bank, amountMinor: '4000000', effectiveDate: today }, key)
    expect(res.status, JSON.stringify(res.json)).toBe(200)
    const replay = await call('POST', `/finance/payment-proofs/${proofId}/verify`, 'finance', { bankAccountId: bank, amountMinor: '4000000', effectiveDate: today }, key)
    expect(replay.json.data.transactionId).toBe(res.json.data.transactionId)
    const mine = await clientInvoice(inv)
    expect(mine.paidMinor).toBe('4000000')
    expect(mine.paymentProof?.status).toBe('verified')
    expect(await notes('USR-021')).toBe(n0 + 1)
    expect((await call('POST', `/finance/payment-proofs/${proofId}/reject`, 'finance', { reason: 'Terlambat' })).status).toBe(422)
  })

  test('verify more than the outstanding amount is refused with no receipt; reject needs a reason and the client sees why', async () => {
    const { inv, proofId } = await submitted('2000000')
    const before = Number((await t.db.query<{ n: string }>("select count(*)::text as n from financial_transactions where kind = 'customer_receipt'"))[0]!.n)
    const tooMuch = await call('POST', `/finance/payment-proofs/${proofId}/verify`, 'finance', { bankAccountId: bank, amountMinor: '9500000', effectiveDate: today }, k())
    expect(tooMuch.status).toBeGreaterThanOrEqual(400)
    expect(Number((await t.db.query<{ n: string }>("select count(*)::text as n from financial_transactions where kind = 'customer_receipt'"))[0]!.n)).toBe(before)
    expect((await call('POST', `/finance/payment-proofs/${proofId}/reject`, 'finance', { reason: ' ' })).status).toBe(400)
    expect((await call('POST', `/finance/payment-proofs/${proofId}/reject`, 'finance', { reason: 'Dana belum masuk rekening' })).status).toBe(200)
    expect((await clientInvoice(inv)).paymentProof).toMatchObject({ status: 'rejected', rejectionReason: 'Dana belum masuk rekening' })
    expect((await call('POST', `/finance/payment-proofs/${proofId}/reject`, 'admin', { reason: 'x' })).status).toBe(403)
  })

  test('the Finance invoice detail lists its proofs', async () => {
    const { inv } = await submitted('1000000')
    const detail = (await call('GET', `/finance/customer-invoices/${inv}`, 'finance')).json.data as { paymentProofs: { status: string }[] }
    expect(detail.paymentProofs.map(p => p.status)).toEqual(['submitted'])
  })
})
