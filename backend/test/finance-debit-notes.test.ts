import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { todayBusinessDate } from '../src/modules/finance/common'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * Debit notes: an extra charge on an issued customer invoice (extra room, admin fee…). Recorded as a DN-numbered
 * supplementary invoice for the same customer/project, so receivables, aging, cash flow and revenue include it
 * without a second outstanding formula. PRJ-201 belongs to PTY-005 in the demo seed.
 */

let t: TestApp
const who: Record<string, string> = {}
let keySeq = 0
const TODAY = todayBusinessDate()
const req = (method: string, as: string, path: string, body?: unknown, key?: string) =>
  t.call(method, `/api/v1${path}`, { cookie: who[as], body, headers: key ? { 'idempotency-key': key } : {} })
const get = (as: string, path: string) => req('GET', as, path)
const post = (as: string, path: string, body: unknown = {}) => req('POST', as, path, body)
const money = (as: string, path: string, body: unknown) => req('POST', as, path, body, `dn-${Date.now()}-${++keySeq}`)

let bank: string
let origin: string

async function issuedInvoice (amount: string, type = 'other') {
  const d = await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-201', invoiceType: type, lines: [{ description: 'Uji', amountMinor: amount }], dueDate: TODAY })
  expect(d.status).toBe(201)
  expect((await post('finance', `/finance/customer-invoices/${d.json.data.id}/issue`)).status).toBe(200)
  return d.json.data.id as string
}
const outstandingOfProject = async () => BigInt((await get('finance', '/projects/PRJ-201/finance-summary')).json.data.receivable.outstandingMinor)

beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries({ finance: DEMO.finance, superAdmin: DEMO.superAdmin, admin: DEMO.admin })) who[k] = await t.login(email)
  bank = (await post('finance', '/finance/accounts', { code: 'BCA-OPS', bankName: 'BCA', holderName: 'PT MANOVA', accountNumber: '0123456789' })).json.data.id
  await post('finance', `/finance/accounts/${bank}/opening`, { amountMinor: '0', openingDate: TODAY })
  await post('superAdmin', `/finance/accounts/${bank}/opening/verify`, { balanceMinor: '0', openingDate: TODAY })
  origin = await issuedInvoice('1000000', 'dp')
})
afterAll(() => t.cleanup())

describe('debit notes', () => {
  test('issues a DN-numbered note for the same customer and project; the receivable grows by its amount', async () => {
    const before = await outstandingOfProject()
    const r = await post('finance', `/finance/customer-invoices/${origin}/debit-notes`, { amountMinor: '250000', reason: 'Tambahan kamar', dueDate: TODAY })
    expect(r.status).toBe(201)
    expect(r.json.data).toMatchObject({
      invoiceType: 'debit_note', adjustsInvoiceId: origin, status: 'issued', totalMinor: '250000', outstandingMinor: '250000',
      party: { id: 'PTY-005' }, project: { id: 'PRJ-201' }
    })
    expect(r.json.data.number).toMatch(/^DN-\d{4}-\d{5}$/)
    expect(r.json.data.lines).toEqual([{ position: 1, description: 'Tambahan kamar', amountMinor: '250000' }])
    expect(await outstandingOfProject() - before).toBe(250000n)
  })

  test('no cash moves when a debit note is issued', async () => {
    expect((await get('finance', `/finance/accounts/${bank}`)).json.data.balance.currentMinor).toBe('0')
  })

  test('refuses a draft or void origin, a debit note as origin, a short reason, a past due date, zero amount', async () => {
    const draft = (await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-201', invoiceType: 'other', lines: [{ description: 'x', amountMinor: '1' }] })).json.data.id
    expect((await post('finance', `/finance/customer-invoices/${draft}/debit-notes`, { amountMinor: '1', reason: 'Tambahan', dueDate: TODAY })).status).toBe(422)
    const toVoid = await issuedInvoice('1')
    expect((await post('finance', `/finance/customer-invoices/${toVoid}/void`, { reason: 'Salah input' })).status).toBe(200)
    expect((await post('finance', `/finance/customer-invoices/${toVoid}/debit-notes`, { amountMinor: '1', reason: 'Tambahan', dueDate: TODAY })).status).toBe(422)
    const dn = (await post('finance', `/finance/customer-invoices/${origin}/debit-notes`, { amountMinor: '1', reason: 'Biaya kecil', dueDate: TODAY })).json.data.id
    expect((await post('finance', `/finance/customer-invoices/${dn}/debit-notes`, { amountMinor: '1', reason: 'Tambahan', dueDate: TODAY })).status).toBe(422)
    expect((await post('finance', `/finance/customer-invoices/${origin}/debit-notes`, { amountMinor: '1', reason: 'ab', dueDate: TODAY })).status).toBe(400)
    expect((await post('finance', `/finance/customer-invoices/${origin}/debit-notes`, { amountMinor: '1', reason: 'Tambahan', dueDate: '2020-01-01' })).status).toBe(400)
    expect((await post('finance', `/finance/customer-invoices/${origin}/debit-notes`, { amountMinor: '0', reason: 'Tambahan', dueDate: TODAY })).status).toBe(400)
  })

  test('admin gets 403 (before validation); an unknown origin is 404', async () => {
    expect((await post('admin', `/finance/customer-invoices/${origin}/debit-notes`, {})).status).toBe(403)
    expect((await post('finance', '/finance/customer-invoices/CINV-99999/debit-notes', { amountMinor: '1', reason: 'Tambahan', dueDate: TODAY })).status).toBe(404)
  })

  test('a normal draft cannot be created with type debit_note', async () => {
    expect((await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-201', invoiceType: 'debit_note', lines: [{ description: 'x', amountMinor: '1' }] })).status).toBe(400)
  })

  test('a debit note is paid like any invoice, and once paid it cannot be voided', async () => {
    const dn = (await post('finance', `/finance/customer-invoices/${origin}/debit-notes`, { amountMinor: '1000', reason: 'Biaya admin', dueDate: TODAY })).json.data.id
    const pay = await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: '1000', effectiveDate: TODAY, partyId: 'PTY-005', projectId: 'PRJ-201', allocations: [{ invoiceId: dn, amountMinor: '1000' }] })
    expect(pay.status).toBe(201)
    expect((await get('finance', `/finance/customer-invoices/${dn}`)).json.data).toMatchObject({ settlement: 'paid', outstandingMinor: '0' })
    expect((await post('finance', `/finance/customer-invoices/${dn}/void`, { reason: 'Salah input' })).status).toBe(422)
  })

  test('an unpaid debit note can be voided and the receivable drops back', async () => {
    const before = await outstandingOfProject()
    const dn = (await post('finance', `/finance/customer-invoices/${origin}/debit-notes`, { amountMinor: '5000', reason: 'Biaya ganda', dueDate: TODAY })).json.data.id
    expect((await post('finance', `/finance/customer-invoices/${dn}/void`, { reason: 'Tagihan ganda' })).status).toBe(200)
    expect(await outstandingOfProject()).toBe(before)
  })
})
