import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { todayBusinessDate } from '../src/modules/finance/common'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * Finance Phase 3 — receivables & payables. One scenario per describe, numbers checkable by hand.
 * PRJ-201 (PT Java Bhakti Persada, PTY-005) has a contract value of Rp 980 jt (seed).
 */

let t: TestApp
const who: Record<string, string> = {}
let keySeq = 0
const newKey = () => `arap-${Date.now()}-${++keySeq}`
function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const TODAY = todayBusinessDate()

const req = (method: string, as: string, path: string, body?: unknown, key?: string) =>
  t.call(method, `/api/v1${path}`, { cookie: who[as], body, headers: key ? { 'idempotency-key': key } : {} })
const get = (as: string, path: string) => req('GET', as, path)
const post = (as: string, path: string, body?: unknown) => req('POST', as, path, body ?? {})
const money = (as: string, path: string, body: unknown, key = newKey()) => req('POST', as, path, body, key)

let bank: string
const balance = async () => (await get('finance', `/finance/accounts/${bank}`)).json.data.balance.currentMinor

beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries({ finance: DEMO.finance, superAdmin: DEMO.superAdmin, admin: DEMO.admin })) who[k] = await t.login(email)
  const acc = await post('finance', '/finance/accounts', { code: 'BCA-OPS', bankName: 'BCA', holderName: 'PT MANOVA', accountNumber: '0123456789' })
  bank = acc.json.data.id
  await post('finance', `/finance/accounts/${bank}/opening`, { amountMinor: '300000000', openingDate: addDays(TODAY, -30) })
  await post('superAdmin', `/finance/accounts/${bank}/opening/verify`, { balanceMinor: '300000000', openingDate: addDays(TODAY, -30) })
})
afterAll(() => t.cleanup())

describe('customer: schedule → invoice → partial receipt → advance → settlement', () => {
  let dpSchedule: string
  let finalSchedule: string
  let dpInvoice: string
  let finalInvoice: string
  let secondReceipt: string

  test('billing schedule plans DP 30% and final payment; nothing is a receivable yet', async () => {
    const dp = await post('finance', '/finance/billing-schedule', { projectId: 'PRJ-201', label: 'DP 30%', invoiceType: 'dp', amountMinor: '294000000', plannedDate: addDays(TODAY, 5) })
    const fin = await post('finance', '/finance/billing-schedule', { projectId: 'PRJ-201', label: 'Pelunasan 70%', invoiceType: 'final', amountMinor: '686000000', plannedDate: addDays(TODAY, 40) })
    expect(dp.status).toBe(201)
    dpSchedule = dp.json.data.id
    finalSchedule = fin.json.data.id
    const receivables = await get('finance', '/finance/receivables?partyId=PTY-005')
    expect(receivables.json.data).toHaveLength(0)
    expect((await get('finance', '/projects/PRJ-201/finance-summary')).json.data).toMatchObject({
      paymentStatus: 'not_invoiced', receivable: { scheduledNotInvoicedMinor: '980000000', uninvoicedMinor: '980000000' }
    })
  })

  test('a draft from the schedule is not a receivable; issuing freezes it and moves no money', async () => {
    const draft = await post('finance', '/finance/customer-invoices', { billingScheduleItemId: dpSchedule, dueDate: addDays(TODAY, 7) })
    expect(draft.status).toBe(201)
    expect(draft.json.data).toMatchObject({ status: 'draft', number: null, invoiceType: 'dp', totalMinor: '294000000', party: { id: 'PTY-005' }, project: { id: 'PRJ-201' } })
    expect(draft.json.data.lines).toEqual([{ position: 1, description: 'DP 30%', amountMinor: '294000000' }])
    dpInvoice = draft.json.data.id
    expect((await post('finance', '/finance/customer-invoices', { billingScheduleItemId: dpSchedule })).status).toBe(422) // schedule already used

    const issued = await post('finance', `/finance/customer-invoices/${dpInvoice}/issue`, {})
    expect(issued.status).toBe(200)
    expect(issued.json.data).toMatchObject({ status: 'issued', settlement: 'open', outstandingMinor: '294000000', issueDate: TODAY, dueDate: addDays(TODAY, 7) })
    expect(issued.json.data.number).toMatch(new RegExp(`^INV-${TODAY.slice(0, 4)}-\\d{5}$`))
    expect(issued.json.meta.warnings).toEqual([])
    expect(await balance()).toBe('300000000')

    expect((await req('PATCH', 'finance', `/finance/customer-invoices/${dpInvoice}`, { notes: 'x' })).status).toBe(422)
    await expect(t.db.query(`update customer_invoices set total_minor = 1 where id = $1`, [dpInvoice])).rejects.toThrow('frozen')
    await expect(t.db.query(`delete from customer_invoices where id = $1`, [dpInvoice])).rejects.toThrow('cannot be deleted')
    const schedule = (await get('finance', '/finance/billing-schedule?projectId=PRJ-201')).json.data
    expect(schedule.find((s: { id: string }) => s.id === dpSchedule)).toMatchObject({ status: 'invoiced', invoiceId: dpInvoice })
  })

  test('partial receipt: outstanding drops by exactly the allocation, cash rises by the receipt', async () => {
    const res = await money('finance', '/finance/receipts', {
      bankAccountId: bank, amountMinor: '200000000', effectiveDate: TODAY, partyId: 'PTY-005', projectId: 'PRJ-201', reference: 'TRX-BCA-001',
      allocations: [{ invoiceId: dpInvoice, amountMinor: '200000000' }]
    })
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ unallocatedMinor: '0', allocations: [{ invoiceId: dpInvoice, amountMinor: '200000000', outstandingMinor: '94000000' }] })
    expect(await balance()).toBe('500000000')
    const inv = (await get('finance', `/finance/customer-invoices/${dpInvoice}`)).json.data
    expect(inv).toMatchObject({ settlement: 'partial', paidMinor: '200000000', outstandingMinor: '94000000' })
    expect(inv.payments).toHaveLength(1)
    expect((await get('finance', '/projects/PRJ-201/finance-summary')).json.data.paymentStatus).toBe('partially_paid')
  })

  test('allocation guards: over outstanding, over the receipt, another customer\'s invoice', async () => {
    const over = await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: '100000000', effectiveDate: TODAY, partyId: 'PTY-005', allocations: [{ invoiceId: dpInvoice, amountMinor: '95000000' }] })
    expect(over.status).toBe(400)
    expect(over.json.error.fieldErrors['allocations.0.amountMinor'][0]).toContain('94000000')
    const tooMuch = await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: '1000', effectiveDate: TODAY, partyId: 'PTY-005', allocations: [{ invoiceId: dpInvoice, amountMinor: '2000' }] })
    expect(tooMuch.status).toBe(400)
    const otherParty = await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: '1000', effectiveDate: TODAY, partyId: 'PTY-001', allocations: [{ invoiceId: dpInvoice, amountMinor: '1000' }] })
    expect(otherParty.json.error.fieldErrors['allocations.0.invoiceId'][0]).toContain('customer lain')
    expect(await balance()).toBe('500000000') // nothing posted by failed attempts
  })

  test('receipt larger than what is due: remainder becomes the customer\'s advance (uang muka)', async () => {
    const key = newKey()
    const body = { bankAccountId: bank, amountMinor: '100000000', effectiveDate: TODAY, partyId: 'PTY-005', allocations: [{ invoiceId: dpInvoice, amountMinor: '94000000' }] }
    const res = await money('finance', '/finance/receipts', body, key)
    const replay = await money('finance', '/finance/receipts', body, key)
    expect(replay.headers.get('idempotent-replayed')).toBe('true')
    expect(res.json.data.unallocatedMinor).toBe('6000000')
    secondReceipt = res.json.data.transactionId
    expect(await balance()).toBe('600000000') // posted once
    expect((await get('finance', `/finance/customer-invoices/${dpInvoice}`)).json.data).toMatchObject({ settlement: 'paid', outstandingMinor: '0' })
    // DP settled but Pelunasan 70% is still only planned: never 'Lunas'.
    expect((await get('finance', '/projects/PRJ-201/finance-summary')).json.data).toMatchObject({ paymentStatus: 'dp_received', label: 'DP diterima' })
    const advances = (await get('finance', '/finance/advances?type=customer&partyId=PTY-005')).json.data
    expect(advances).toEqual([expect.objectContaining({ transactionId: secondReceipt, unallocatedMinor: '6000000' })])
  })

  test('final invoice; the advance is applied later; DP-settled project reads "DP diterima"', async () => {
    const draft = await post('finance', '/finance/customer-invoices', { billingScheduleItemId: finalSchedule })
    finalInvoice = draft.json.data.id
    expect((await post('finance', `/finance/customer-invoices/${finalInvoice}/issue`, {})).status).toBe(400) // no due date yet
    const issued = await post('finance', `/finance/customer-invoices/${finalInvoice}/issue`, { dueDate: addDays(TODAY, 30) })
    expect(issued.json.data.outstandingMinor).toBe('686000000')
    const summary = (await get('finance', '/projects/PRJ-201/finance-summary')).json.data
    expect(summary).toMatchObject({ paymentStatus: 'dp_received', label: 'DP diterima', receivable: { invoicedMinor: '980000000', receivedMinor: '294000000', outstandingMinor: '686000000', uninvoicedMinor: '0', scheduledNotInvoicedMinor: '0' } })

    const alloc = await money('finance', `/finance/receipts/${secondReceipt}/allocations`, { allocations: [{ invoiceId: finalInvoice, amountMinor: '6000000' }] })
    expect(alloc.status).toBe(201)
    expect(alloc.json.data).toMatchObject({ unallocatedMinor: '0', allocations: [{ outstandingMinor: '680000000' }] })
    expect(await balance()).toBe('600000000') // allocating an advance moves no money
    expect((await money('finance', `/finance/receipts/${secondReceipt}/allocations`, { allocations: [{ invoiceId: finalInvoice, amountMinor: '1' }] })).status).toBe(400)
    expect((await get('finance', '/finance/advances?type=customer&partyId=PTY-005')).json.data).toEqual([])
  })

  test('credit note reduces what is owed (never below zero); an invoice with payments cannot be voided', async () => {
    const cn = await post('finance', '/finance/credit-notes', { invoiceId: finalInvoice, amountMinor: '5000000', reason: 'Diskon kesepakatan' })
    expect(cn.status).toBe(201)
    expect(cn.json.data.outstandingMinor).toBe('675000000')
    const tooBig = await post('finance', '/finance/credit-notes', { invoiceId: finalInvoice, amountMinor: '675000001', reason: 'Terlalu besar' })
    expect(tooBig.status).toBe(422)
    const voidPaid = await post('finance', `/finance/customer-invoices/${dpInvoice}/void`, { reason: 'Coba void' })
    expect(voidPaid.status).toBe(422)
  })

  test('profitability: revenue = invoiced − credit notes; cost = approved vendor invoices + project expenses', async () => {
    await money('finance', '/finance/transactions', { bankAccountId: bank, kind: 'expense', category: 'travel', amountMinor: '3000000', effectiveDate: TODAY, projectId: 'PRJ-201' })
    const s = (await get('finance', '/projects/PRJ-201/finance-summary')).json.data
    expect(s.profitability).toEqual({ revenueMinor: '975000000', costMinor: '3000000', grossProfitMinor: '972000000', marginBasisPoints: 9969 })
    expect(s.receivable).toMatchObject({ creditedMinor: '5000000', outstandingMinor: '675000000' })
  })
})

describe('reversing a receipt releases its allocations', () => {
  test('outstanding comes back, cash goes down, history stays', async () => {
    const draft = await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-202', invoiceType: 'final', lines: [{ description: 'Paket', amountMinor: '40000000' }], dueDate: addDays(TODAY, 14) })
    const id = draft.json.data.id
    await post('finance', `/finance/customer-invoices/${id}/issue`, {})
    const before = await balance()
    const receipt = await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: '40000000', effectiveDate: TODAY, partyId: 'PTY-005', allocations: [{ invoiceId: id, amountMinor: '40000000' }] })
    expect((await get('finance', `/finance/customer-invoices/${id}`)).json.data.settlement).toBe('paid')
    const rev = await money('finance', `/finance/transactions/${receipt.json.data.transactionId}/reverse`, { reason: 'Transfer ditolak bank' })
    expect(rev.status).toBe(201)
    const inv = (await get('finance', `/finance/customer-invoices/${id}`)).json.data
    expect(inv).toMatchObject({ settlement: 'open', outstandingMinor: '40000000', paidMinor: '0' })
    expect(inv.payments).toEqual([expect.objectContaining({ amountMinor: '40000000', reversed: true })])
    expect(await balance()).toBe(before)
    // A reversed receipt cannot be allocated again, and the invoice can now be voided.
    expect((await money('finance', `/finance/receipts/${receipt.json.data.transactionId}/allocations`, { allocations: [{ invoiceId: id, amountMinor: '1' }] })).status).toBe(422)
    const voided = await post('finance', `/finance/customer-invoices/${id}/void`, { reason: 'Project dibatalkan' })
    expect(voided.json.data.status).toBe('void')
  })
})

describe('overdue receivables and booking context', () => {
  test('an unpaid invoice past its due date is overdue everywhere, with days counted', async () => {
    const draft = await post('finance', '/finance/customer-invoices', {
      booking: { type: 'flight', id: 'FLT-1011' }, invoiceType: 'final', lines: [{ description: 'Tiket Manila', amountMinor: '95000000' }]
    })
    expect(draft.json.data.project.id).toBe('PRJ-101') // booking implies project
    const id = draft.json.data.id
    const issued = await post('finance', `/finance/customer-invoices/${id}/issue`, { issueDate: addDays(TODAY, -20), dueDate: addDays(TODAY, -10) })
    expect(issued.json.data).toMatchObject({ overdue: true, daysOverdue: 10 })
    const overdue = await get('finance', '/finance/receivables?settlement=overdue')
    expect(overdue.json.data.map((r: { id: string }) => r.id)).toContain(id)
    expect(overdue.json.meta.summary.overdueMinor).toBe('95000000')
    expect((await get('finance', '/projects/PRJ-101/finance-summary')).json.data.paymentStatus).toBe('overdue')
    const booking = (await get('finance', '/bookings/flight/FLT-1011/finance-summary')).json.data
    expect(booking).toMatchObject({ paymentStatus: 'overdue', sellAmountMinor: '95000000', departureDate: '2026-08-20', receivable: { outstandingMinor: '95000000' } })
  })

  test('expected date moves the forecast, never the contractual due date', async () => {
    const list = (await get('finance', '/finance/receivables?settlement=overdue')).json.data
    const id = list[0].id
    const res = await req('PATCH', 'finance', `/finance/customer-invoices/${id}/expectation`, { expectedDate: addDays(TODAY, 3), reason: 'Customer janji transfer Jumat' })
    expect(res.json.data).toMatchObject({ expectedDate: addDays(TODAY, 3), dueDate: addDays(TODAY, -10), overdue: true })
  })

  test('receivables pagination walks every row once, soonest due first', async () => {
    const seen: string[] = []
    let cursor: string | null = null
    do {
      const res = await get('finance', `/finance/receivables?settlement=all&limit=1${cursor ? `&cursor=${cursor}` : ''}`)
      seen.push(...res.json.data.map((r: { id: string }) => r.id))
      cursor = res.json.meta.pagination.nextCursor
    } while (cursor)
    const all = (await get('finance', '/finance/receivables?settlement=all')).json.data
    expect(seen).toEqual(all.map((r: { id: string }) => r.id))
    const dues = all.map((r: { dueDate: string }) => r.dueDate)
    expect(dues).toEqual([...dues].sort())
  })
})

describe('vendor: invoice → review → payable → partial payments → deposit', () => {
  let vinv: string

  test('recording a vendor invoice links its service order and project; duplicates are refused', async () => {
    const res = await post('finance', '/finance/vendor-invoices', {
      vendorId: 'VND-006', vendorInvoiceNumber: 'ABC/INV/001', serviceOrderId: 'SO-002', invoiceDate: TODAY, dueDate: addDays(TODAY, 10), totalMinor: '12000000'
    })
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ status: 'submitted', project: { id: 'PRJ-102' }, outstandingMinor: '0', settlement: null })
    vinv = res.json.data.id
    const dup = await post('finance', '/finance/vendor-invoices', { vendorId: 'VND-006', vendorInvoiceNumber: 'abc/inv/001', invoiceDate: TODAY, dueDate: TODAY, totalMinor: '1' })
    expect(dup.status).toBe(409)
    const wrongSo = await post('finance', '/finance/vendor-invoices', { vendorId: 'VND-001', vendorInvoiceNumber: 'X-1', serviceOrderId: 'SO-002', invoiceDate: TODAY, dueDate: TODAY, totalMinor: '1' })
    expect(wrongSo.json.error.fieldErrors.serviceOrderId[0]).toContain('vendor lain')
    const wrongBooking = await post('finance', '/finance/vendor-invoices', { vendorId: 'VND-006', vendorInvoiceNumber: 'X-2', booking: { type: 'flight', id: 'FLT-1011' }, invoiceDate: TODAY, dueDate: TODAY, totalMinor: '1' })
    expect(wrongBooking.json.error.fieldErrors.booking[0]).toContain('vendor lain')
  })

  test('not a payable until approved; approval moves no money; disputed match cannot be approved', async () => {
    expect((await get('finance', '/finance/payables?vendorId=VND-006')).json.data).toHaveLength(0)
    const review = await get('finance', '/finance/payables?view=review')
    expect(review.json.meta.summary).toMatchObject({ pendingReviewMinor: '12000000', pendingReviewCount: 1 })
    const early = await money('finance', '/finance/vendor-payments', { bankAccountId: bank, amountMinor: '1000', effectiveDate: TODAY, vendorId: 'VND-006', allocations: [{ vendorInvoiceId: vinv, amountMinor: '1000' }] })
    expect(early.status).toBe(400)

    await post('finance', `/finance/vendor-invoices/${vinv}/review`, { action: 'start_review', matchStatus: 'disputed' })
    expect((await post('finance', `/finance/vendor-invoices/${vinv}/review`, { action: 'approve' })).status).toBe(422)
    const before = await balance()
    const approved = await post('finance', `/finance/vendor-invoices/${vinv}/review`, { action: 'approve', matchStatus: 'matched' })
    expect(approved.json.data).toMatchObject({ status: 'approved', settlement: 'open', outstandingMinor: '12000000' })
    expect(await balance()).toBe(before)
    await expect(t.db.query('update vendor_invoices set total_minor = 1 where id = $1', [vinv])).rejects.toThrow('frozen')
  })

  test('partial payments reduce the payable and the bank; overpaying an invoice is refused', async () => {
    const before = BigInt(await balance())
    const p1 = await money('finance', '/finance/vendor-payments', { bankAccountId: bank, amountMinor: '5000000', effectiveDate: TODAY, vendorId: 'VND-006', allocations: [{ vendorInvoiceId: vinv, amountMinor: '5000000' }] })
    expect(p1.json.data.allocations[0].outstandingMinor).toBe('7000000')
    expect((await get('finance', `/finance/vendor-invoices/${vinv}`)).json.data.settlement).toBe('partial')
    const over = await money('finance', '/finance/vendor-payments', { bankAccountId: bank, amountMinor: '8000000', effectiveDate: TODAY, vendorId: 'VND-006', allocations: [{ vendorInvoiceId: vinv, amountMinor: '8000000' }] })
    expect(over.status).toBe(400)
    await money('finance', '/finance/vendor-payments', { bankAccountId: bank, amountMinor: '7000000', effectiveDate: TODAY, vendorId: 'VND-006', allocations: [{ vendorInvoiceId: vinv, amountMinor: '7000000' }] })
    expect((await get('finance', `/finance/vendor-invoices/${vinv}`)).json.data).toMatchObject({ settlement: 'paid', outstandingMinor: '0', paidMinor: '12000000' })
    expect(BigInt(await balance())).toBe(before - 12000000n)
    expect((await post('finance', `/finance/vendor-invoices/${vinv}/void`, { reason: 'Coba void' })).status).toBe(422)
  })

  test('vendor deposit paid before the invoice, then settled against it', async () => {
    const dep = await money('finance', '/finance/vendor-payments', { bankAccountId: bank, amountMinor: '3000000', effectiveDate: TODAY, vendorId: 'VND-006', memo: 'Deposit kamar' })
    expect(dep.json.data.unallocatedMinor).toBe('3000000')
    const vendorSummary = (await get('finance', '/vendors/VND-006/finance-summary')).json.data
    expect(vendorSummary.depositUnallocatedMinor).toBe('3000000')
    const inv = await post('finance', '/finance/vendor-invoices', { vendorId: 'VND-006', vendorInvoiceNumber: 'ABC/INV/002', invoiceDate: TODAY, dueDate: addDays(TODAY, 5), totalMinor: '4500000' })
    await post('finance', `/finance/vendor-invoices/${inv.json.data.id}/review`, { action: 'approve' })
    const alloc = await money('finance', `/finance/vendor-payments/${dep.json.data.transactionId}/allocations`, { allocations: [{ vendorInvoiceId: inv.json.data.id, amountMinor: '3000000' }] })
    expect(alloc.json.data).toMatchObject({ unallocatedMinor: '0', allocations: [{ outstandingMinor: '1500000' }] })
    const payables = await get('finance', '/finance/payables?vendorId=VND-006')
    expect(payables.json.meta.summary.outstandingMinor).toBe('1500000')
  })

  test('rejecting needs a reason; a rejected invoice is never payable', async () => {
    const inv = await post('finance', '/finance/vendor-invoices', { vendorId: 'VND-001', vendorInvoiceNumber: 'CTM-77', invoiceDate: TODAY, dueDate: TODAY, totalMinor: '1000' })
    expect((await post('finance', `/finance/vendor-invoices/${inv.json.data.id}/review`, { action: 'reject' })).status).toBe(400)
    const rejected = await post('finance', `/finance/vendor-invoices/${inv.json.data.id}/review`, { action: 'reject', reason: 'Harga tidak sesuai kontrak' })
    expect(rejected.json.data).toMatchObject({ status: 'rejected', outstandingMinor: '0', settlement: null })
    const pay = await money('finance', '/finance/vendor-payments', { bankAccountId: bank, amountMinor: '1000', effectiveDate: TODAY, vendorId: 'VND-001', allocations: [{ vendorInvoiceId: inv.json.data.id, amountMinor: '1000' }] })
    expect(pay.status).toBe(400)
  })
})

describe('access and the Admin status-only view (ADR-007 #3)', () => {
  function collectKeys(v: unknown, keys = new Set<string>()): Set<string> {
    if (Array.isArray(v)) v.forEach(x => collectKeys(x, keys))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.add(k); collectKeys(x, keys) }
    return keys
  }

  test('Admin sees payment status but not a single amount, on every context summary', async () => {
    for (const path of ['/projects/PRJ-201/finance-summary', '/projects/PRJ-101/finance-summary', '/bookings/flight/FLT-1011/finance-summary', '/vendors/VND-006/finance-summary', '/parties/PTY-005/finance-summary']) {
      const res = await get('admin', path)
      expect(res.status, path).toBe(200)
      expect(res.json.data.view).toBe('status')
      expect([...collectKeys(res.json.data)].filter(k => /minor|amount|total|paid|outstanding|profit|cost|revenue/i.test(k)), path).toEqual([])
    }
    const project = (await get('admin', '/projects/PRJ-201/finance-summary')).json.data
    expect(project).toMatchObject({ paymentStatus: 'dp_received', label: 'DP diterima', hasOverdue: false, openInvoiceCount: 1 })
    expect((await get('admin', '/projects/PRJ-101/finance-summary')).json.data).toMatchObject({ paymentStatus: 'overdue', hasOverdue: true })
  })

  test('Admin cannot open receivables, payables, invoices or post receipts; Finance and Super Admin can', async () => {
    for (const path of ['/finance/receivables', '/finance/payables', '/finance/customer-invoices', '/finance/advances', '/finance/billing-schedule']) {
      expect((await get('admin', path)).status, path).toBe(403)
      expect((await get('superAdmin', path)).status, path).toBe(200)
    }
    expect((await money('admin', '/finance/receipts', { bankAccountId: bank, amountMinor: '1', effectiveDate: TODAY, partyId: 'PTY-005' })).status).toBe(403)
    expect((await post('admin', '/finance/vendor-invoices', { vendorId: 'VND-001', vendorInvoiceNumber: 'Z', invoiceDate: TODAY, dueDate: TODAY, totalMinor: '1' })).status).toBe(403)
    expect((await get('finance', '/projects/PRJ-201/finance-summary')).json.data.view).toBe('full')
  })

  test('money-moving endpoints demand an Idempotency-Key', async () => {
    const res = await req('POST', 'finance', '/finance/receipts', { bankAccountId: bank, amountMinor: '1', effectiveDate: TODAY, partyId: 'PTY-005' })
    expect(res.json.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED')
  })
})

describe('database guards for allocations', () => {
  test('the trigger refuses allocations beyond outstanding or to the wrong party, even via raw SQL', async () => {
    const draft = await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-103', invoiceType: 'dp', lines: [{ description: 'DP', amountMinor: '1000' }], dueDate: TODAY })
    await post('finance', `/finance/customer-invoices/${draft.json.data.id}/issue`, {})
    const receipt = await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: '5000', effectiveDate: TODAY, partyId: 'PTY-003' })
    const tx = receipt.json.data.transactionId
    await expect(t.db.query(`insert into payment_allocations (transaction_id, target_type, target_id, amount_minor, created_by) values ($1, 'customer_invoice', $2, 2000, 'USR-008')`, [tx, draft.json.data.id]))
      .rejects.toThrow('exceeds outstanding')
    const other = await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: '5000', effectiveDate: TODAY, partyId: 'PTY-001' })
    await expect(t.db.query(`insert into payment_allocations (transaction_id, target_type, target_id, amount_minor, created_by) values ($1, 'customer_invoice', $2, 100, 'USR-008')`, [other.json.data.transactionId, draft.json.data.id]))
      .rejects.toThrow('paying customer')
    await expect(t.db.query('delete from payment_allocations')).rejects.toThrow('immutable')
  })
})

describe('review fixes (Phase 3 hardening, migration 0009)', () => {
  test('a voided invoice releases its billing-schedule item: it can be invoiced again', async () => {
    const sched = (await post('finance', '/finance/billing-schedule', { projectId: 'PRJ-204', label: 'DP', invoiceType: 'dp', amountMinor: '96000000', plannedDate: addDays(TODAY, 3) })).json.data.id
    const first = (await post('finance', '/finance/customer-invoices', { billingScheduleItemId: sched, dueDate: addDays(TODAY, 10) })).json.data.id
    expect((await post('finance', '/finance/customer-invoices', { billingScheduleItemId: sched })).status).toBe(422) // still linked
    await post('finance', `/finance/customer-invoices/${first}/issue`, {})
    expect((await post('finance', `/finance/customer-invoices/${first}/void`, { reason: 'Salah nominal' })).json.data.status).toBe('void')
    const again = await post('finance', '/finance/customer-invoices', { billingScheduleItemId: sched, dueDate: addDays(TODAY, 10) })
    expect(again.status).toBe(201)
    expect(again.json.data).toMatchObject({ status: 'draft', totalMinor: '96000000' })
  })

  test('status is honest: settled DP is not "Lunas" while the contract is not fully billed', async () => {
    // PRJ-203 contract Rp 165 jt. DP 50 jt invoiced and paid → DP diterima.
    const dp = (await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-203', invoiceType: 'dp', lines: [{ description: 'DP', amountMinor: '50000000' }], dueDate: addDays(TODAY, 7) })).json.data.id
    await post('finance', `/finance/customer-invoices/${dp}/issue`, {})
    await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: '50000000', effectiveDate: TODAY, partyId: 'PTY-005', allocations: [{ invoiceId: dp, amountMinor: '50000000' }] })
    expect((await get('admin', '/projects/PRJ-203/finance-summary')).json.data).toMatchObject({ paymentStatus: 'dp_received', label: 'DP diterima' })
    // The rest invoiced and paid → Lunas.
    const fin = (await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-203', invoiceType: 'final', lines: [{ description: 'Pelunasan', amountMinor: '115000000' }], dueDate: addDays(TODAY, 7) })).json.data.id
    await post('finance', `/finance/customer-invoices/${fin}/issue`, {})
    expect((await get('admin', '/projects/PRJ-203/finance-summary')).json.data.paymentStatus).toBe('dp_received')
    await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: '115000000', effectiveDate: TODAY, partyId: 'PTY-005', allocations: [{ invoiceId: fin, amountMinor: '115000000' }] })
    expect((await get('admin', '/projects/PRJ-203/finance-summary')).json.data).toMatchObject({ paymentStatus: 'paid', label: 'Lunas' })
  })

  test('without a DP: settled invoices below the contract read "Tagihan terbit sudah lunas"; a fully credited invoice is not "paid"', async () => {
    // PRJ-104 contract Rp 60 jt.
    const part = (await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-104', invoiceType: 'progress', lines: [{ description: 'Termin 1', amountMinor: '20000000' }], dueDate: addDays(TODAY, 7) })).json.data.id
    await post('finance', `/finance/customer-invoices/${part}/issue`, {})
    await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: '20000000', effectiveDate: TODAY, partyId: 'PTY-001', allocations: [{ invoiceId: part, amountMinor: '20000000' }] })
    expect((await get('admin', '/projects/PRJ-104/finance-summary')).json.data).toMatchObject({ paymentStatus: 'up_to_date', label: 'Tagihan terbit sudah lunas' })

    const zeroed = (await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-104', invoiceType: 'other', lines: [{ description: 'Biaya tambahan', amountMinor: '4000000' }], dueDate: addDays(TODAY, 7) })).json.data.id
    await post('finance', `/finance/customer-invoices/${zeroed}/issue`, {})
    await post('finance', '/finance/credit-notes', { invoiceId: zeroed, amountMinor: '4000000', reason: 'Dibatalkan, digratiskan' })
    expect((await get('finance', `/finance/customer-invoices/${zeroed}`)).json.data).toMatchObject({ settlement: 'credited', outstandingMinor: '0', paidMinor: '0' })
    expect((await get('admin', '/projects/PRJ-104/finance-summary')).json.data.paymentStatus).toBe('up_to_date')
  })

  test('a draft whose lines add up past the per-document ceiling is a 400, not a 500', async () => {
    const lines = [{ description: 'A', amountMinor: '600000000000000' }, { description: 'B', amountMinor: '600000000000000' }]
    const created = await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-102', invoiceType: 'other', lines })
    expect(created.status).toBe(400)
    expect(created.json.error.fieldErrors.lines[0]).toContain('batas')
    const ok = (await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-102', invoiceType: 'other', lines: [lines[0]] })).json.data.id
    expect((await req('PATCH', 'finance', `/finance/customer-invoices/${ok}`, { lines })).status).toBe(400)
    await req('DELETE', 'finance', `/finance/customer-invoices/${ok}`)
  })

  test('status never moves backwards, even via raw SQL', async () => {
    const [issued] = await t.db.query<{ id: string }>("select id from customer_invoices where status = 'issued' limit 1")
    await expect(t.db.query("update customer_invoices set status = 'draft' where id = $1", [issued!.id])).rejects.toThrow('cannot return to draft')
    const [approved] = await t.db.query<{ id: string }>("select id from vendor_invoices where status = 'approved' limit 1")
    await expect(t.db.query("update vendor_invoices set status = 'submitted' where id = $1", [approved!.id])).rejects.toThrow('cannot return to review')
    await expect(t.db.query("update vendor_invoices set status = 'under_review' where id = $1", [approved!.id])).rejects.toThrow('cannot return to review')
  })
})
