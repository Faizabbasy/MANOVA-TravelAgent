import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { todayBusinessDate } from '../src/modules/finance/common'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S4b: vendor quotations, service orders and booking orchestration written through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s4b-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

describe('service orders', () => {
  test('assigning a vendor creates a draft SO; switching vendor cancels the old one; A→B→A works', async () => {
    const svc = (await call('POST', '/projects/PRJ-202/services', 'admin', { type: 'transportation', label: 'Bus' }, key())).json.data.id as string
    await call('PATCH', `/project-services/${svc}`, 'admin', { vendorId: 'VND-003' })
    const first = (await call('GET', `/service-orders?serviceId=${svc}`, 'admin')).json.data
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({ vendorId: 'VND-003', status: 'draft', projectId: 'PRJ-202', serviceId: svc })
    await call('PATCH', `/project-services/${svc}`, 'admin', { vendorId: 'VND-005' })
    await call('PATCH', `/project-services/${svc}`, 'admin', { vendorId: 'VND-003' })
    const all = (await call('GET', `/service-orders?serviceId=${svc}`, 'admin')).json.data as { vendorId: string; status: string; statusReason: string | null }[]
    expect(all.map(s => `${s.vendorId}:${s.status}`).sort()).toEqual(['VND-003:cancelled', 'VND-003:draft', 'VND-005:cancelled'])
    expect(all.find(s => s.status === 'cancelled')!.statusReason).toBe('Vendor layanan diganti.')
    await call('PATCH', `/project-services/${svc}`, 'admin', { vendorId: null })
    expect(((await call('GET', `/service-orders?serviceId=${svc}`, 'admin')).json.data as { status: string }[]).every(s => s.status === 'cancelled')).toBe(true)
  })

  test('status: draft→sent→acknowledged→fulfilled; invalid jumps 422; cancel needs a reason and is refused once billed', async () => {
    const svc = (await call('POST', '/projects/PRJ-203/services', 'admin', { type: 'hotel', label: 'Hotel', vendorId: 'VND-002' }, key())).json.data.id as string
    const so = (await call('GET', `/service-orders?serviceId=${svc}`, 'admin')).json.data[0].id as string
    expect((await call('POST', `/service-orders/${so}/status`, 'admin', { to: 'fulfilled' })).status).toBe(422)
    expect((await call('POST', `/service-orders/${so}/status`, 'admin', { to: 'sent' })).json.data.status).toBe('sent')
    const ack = await call('POST', `/service-orders/${so}/status`, 'admin', { to: 'acknowledged' })
    expect(ack.json.data.acknowledgedAt).toBeTruthy()
    expect((await call('POST', `/service-orders/${so}/status`, 'admin', { to: 'cancelled' })).status).toBe(400)
    expect((await call('POST', `/service-orders/${so}/status`, 'finance', { to: 'fulfilled' })).status).toBe(403)
    // Billed by the vendor → cannot be cancelled.
    expect((await call('POST', '/finance/vendor-invoices', 'finance', { vendorId: 'VND-002', vendorInvoiceNumber: 'S4B-1', serviceOrderId: so, invoiceDate: '2026-02-01', dueDate: '2026-03-01', totalMinor: '1000' }, key())).status).toBe(201)
    const refused = await call('POST', `/service-orders/${so}/status`, 'admin', { to: 'cancelled', reason: 'Batal' })
    expect(refused.status).toBe(422)
    expect(refused.json.error.message).toContain('ditagih')
    expect((await call('POST', `/service-orders/${so}/status`, 'admin', { to: 'fulfilled' })).json.data.fulfilledAt).toBeTruthy()
  })

  test('list scope: finance reads, client 403, unknown 404; old single view keeps its fields', async () => {
    expect((await call('GET', '/service-orders', 'finance')).status).toBe(200)
    expect((await call('GET', '/service-orders', 'client')).status).toBe(403)
    expect((await call('GET', '/service-orders/SO-999', 'admin')).status).toBe(404)
    const one = (await call('GET', '/service-orders/SO-101F', 'finance')).json.data
    expect(typeof one.status).toBe('string')
    expect(one).toMatchObject({ id: 'SO-101F', vendorId: expect.any(String), vendorName: expect.any(String), projectId: 'PRJ-101', serviceId: 'SVC-1011' })
  })
})

describe('vendor quotations', () => {
  test('submit (idempotent, validation, 403/401); accept rejects competitors, sets vendor + confirmed + SO with the amount', async () => {
    const svc = (await call('POST', '/projects/PRJ-204/services', 'admin', { type: 'hotel', label: 'Hotel Malang' }, key())).json.data.id as string
    const k = key()
    const body = { vendorId: 'VND-002', projectId: 'PRJ-204', serviceId: svc, serviceType: 'hotel', amountMinor: '12000000', notes: 'Termasuk sarapan' }
    const a = await call('POST', '/vendor-quotations', 'admin', body, k)
    expect(a.status).toBe(201)
    const qa = a.json.data.id as string
    expect(qa).toMatch(/^VQ-\d+$/)
    expect((await call('POST', '/vendor-quotations', 'admin', body, k)).json.data.id).toBe(qa)
    const qb = (await call('POST', '/vendor-quotations', 'admin', { ...body, vendorId: 'VND-006', amountMinor: '11000000' }, key())).json.data.id as string
    const bad = await call('POST', '/vendor-quotations', 'admin', { vendorId: 'VND-999', projectId: 'PRJ-204', serviceId: svc, serviceType: 'flight', amountMinor: '0' }, key())
    expect(bad.status).toBe(400)
    expect(Object.keys(bad.json.error.fieldErrors).sort()).toEqual(['amountMinor', 'serviceId', 'vendorId'])
    expect((await call('POST', '/vendor-quotations', 'finance', body, key())).status).toBe(403)
    expect((await t.call('POST', '/api/v1/vendor-quotations', { body, headers: { 'idempotency-key': key() } })).status).toBe(401)

    const acc = await call('POST', `/vendor-quotations/${qa}/accept`, 'admin', {})
    expect(acc.status).toBe(200)
    expect(acc.json.data.status).toBe('accepted')
    const list = (await call('GET', `/vendor-quotations?serviceId=${svc}`, 'finance')).json.data as { id: string; status: string }[]
    expect(list.find(q => q.id === qb)!.status).toBe('rejected')
    const service = (await call('GET', '/project-services?projectId=PRJ-204', 'admin')).json.data.find((s: { id: string }) => s.id === svc)
    expect(service).toMatchObject({ vendorId: 'VND-002', status: 'confirmed' })
    const so = (await call('GET', `/service-orders?serviceId=${svc}`, 'admin')).json.data[0]
    expect(so).toMatchObject({ vendorId: 'VND-002', status: 'draft', netCostMinor: '12000000', sourceQuotationId: qa })
    expect((await call('POST', `/vendor-quotations/${qa}/accept`, 'admin', {})).status).toBe(422) // already decided
    expect((await call('POST', `/vendor-quotations/${qb}/reject`, 'admin', {})).status).toBe(422)
  })

  test('accept on a service locked by another vendor invoice changes nothing; a quotation without service cannot be accepted', async () => {
    // SVC-1011 (VND-001) carries FLT-1011; a vendor invoice of VND-001 locks its vendor.
    expect((await call('POST', '/finance/vendor-invoices', 'finance', { vendorId: 'VND-001', vendorInvoiceNumber: 'S4B-LOCK', booking: { type: 'flight', id: 'FLT-1011' }, invoiceDate: '2026-02-01', dueDate: '2026-03-01', totalMinor: '1000' }, key())).status).toBe(201)
    const q = (await call('POST', '/vendor-quotations', 'admin', { vendorId: 'VND-006', projectId: 'PRJ-101', serviceId: 'SVC-1011', serviceType: 'flight', amountMinor: '5000' }, key())).json.data.id as string
    const other = (await call('POST', '/vendor-quotations', 'admin', { vendorId: 'VND-001', projectId: 'PRJ-101', serviceId: 'SVC-1011', serviceType: 'flight', amountMinor: '6000' }, key())).json.data.id as string
    expect((await call('POST', `/vendor-quotations/${q}/accept`, 'admin', {})).status).toBe(422)
    const after = (await call('GET', '/vendor-quotations?serviceId=SVC-1011', 'admin')).json.data as { id: string; status: string }[]
    expect(after.find(x => x.id === q)!.status).toBe('submitted')
    expect(after.find(x => x.id === other)!.status).toBe('submitted')
    const loose = (await call('POST', '/vendor-quotations', 'admin', { vendorId: 'VND-003', projectId: 'PRJ-202', serviceType: 'transportation', amountMinor: '7000' }, key())).json.data.id as string
    expect((await call('POST', `/vendor-quotations/${loose}/accept`, 'admin', {})).status).toBe(422)
    expect((await call('POST', `/vendor-quotations/${loose}/reject`, 'admin', { reason: 'Terlalu mahal' })).json.data).toMatchObject({ status: 'rejected', decisionReason: 'Terlalu mahal' })
  })

  test('accepting for a service that already has a booking keeps the booking-driven status', async () => {
    const created = (await call('POST', '/bookings/flight', 'admin', { projectId: 'PRJ-205', details: {} }, key())).json.data
    const serviceId = created.serviceId as string
    const q = (await call('POST', '/vendor-quotations', 'admin', { vendorId: 'VND-001', projectId: 'PRJ-205', serviceId, serviceType: 'flight', amountMinor: '8000' }, key())).json.data.id as string
    expect((await call('POST', `/vendor-quotations/${q}/accept`, 'admin', {})).status).toBe(200)
    const service = (await call('GET', '/project-services?projectId=PRJ-205', 'admin')).json.data.find((s: { id: string }) => s.id === serviceId)
    expect(service).toMatchObject({ vendorId: 'VND-001', status: 'pending-confirmation' })
  })
})

describe('vendor quotations — replacing the accepted one', () => {
  test('accepting a quotation of another vendor supersedes the first accepted one (no unique-index error)', async () => {
    const svc = (await call('POST', '/projects/PRJ-202/services', 'admin', { type: 'mice', label: 'Gala dinner' }, key())).json.data.id as string
    const q1 = (await call('POST', '/vendor-quotations', 'admin', { vendorId: 'VND-004', projectId: 'PRJ-202', serviceId: svc, serviceType: 'mice', amountMinor: '1000' }, key())).json.data.id as string
    expect((await call('POST', `/vendor-quotations/${q1}/accept`, 'admin', {})).status).toBe(200)
    const q2 = (await call('POST', '/vendor-quotations', 'admin', { vendorId: 'VND-007', projectId: 'PRJ-202', serviceId: svc, serviceType: 'mice', amountMinor: '2000' }, key())).json.data.id as string
    const res = await call('POST', `/vendor-quotations/${q2}/accept`, 'admin', {})
    expect(res.status).toBe(200)
    const list = (await call('GET', `/vendor-quotations?serviceId=${svc}`, 'admin')).json.data as { id: string; status: string; decisionReason: string | null }[]
    expect(list.find(q => q.id === q1)).toMatchObject({ status: 'rejected', decisionReason: 'Diganti quotation lain.' })
    expect(list.find(q => q.id === q2)!.status).toBe('accepted')
    const orders = (await call('GET', `/service-orders?serviceId=${svc}`, 'admin')).json.data as { vendorId: string; status: string }[]
    expect(orders.map(o => `${o.vendorId}:${o.status}`).sort()).toEqual(['VND-004:cancelled', 'VND-007:draft'])
  })
})

describe('booking orchestration', () => {
  test('payment gate: not-required before confirmed; project basis without own invoices; own unpaid invoice keeps it pending', async () => {
    const id = (await call('POST', '/bookings/hotel', 'admin', { projectId: 'PRJ-203', details: { checkInDate: '2026-12-01' } }, key())).json.data.id as string
    const gate = async () => (await call('GET', '/bookings?projectId=PRJ-203&type=hotel', 'admin')).json.data.find((b: { id: string }) => b.id === id).paymentGate
    expect(await gate()).toEqual({ status: 'not-required', basis: null })
    for (const to of ['quoted', 'confirmed']) await call('POST', `/bookings/hotel/${id}/status`, 'admin', { to })
    expect((await gate()).basis).toBe('project')
    // Own invoice issued but unpaid → pending on the booking basis, whatever the project's DP says.
    const inv = await call('POST', '/finance/customer-invoices', 'finance', { projectId: 'PRJ-203', booking: { type: 'hotel', id }, invoiceType: 'dp', lines: [{ description: 'DP hotel', amountMinor: '1000000' }], dueDate: '2026-12-30' }, key())
    expect(inv.status).toBe(201)
    await call('POST', `/finance/customer-invoices/${inv.json.data.id}/issue`, 'finance', {}, key())
    expect(await gate()).toEqual({ status: 'pending', basis: 'booking' })
  })

  test('attempts are logged and listed newest first; outcome validated; finance 403', async () => {
    const id = (await call('POST', '/bookings/flight', 'admin', { projectId: 'PRJ-204', details: {} }, key())).json.data.id as string
    expect((await call('POST', `/bookings/flight/${id}/attempts`, 'admin', { outcome: 'failed', note: 'GDS timeout' })).status).toBe(201)
    expect((await call('POST', `/bookings/flight/${id}/attempts`, 'admin', { outcome: 'manual-fallback' })).status).toBe(201)
    expect((await call('POST', `/bookings/flight/${id}/attempts`, 'admin', { outcome: 'maybe' })).status).toBe(400)
    expect((await call('POST', `/bookings/flight/${id}/attempts`, 'finance', { outcome: 'success' })).status).toBe(403)
    const b = (await call('GET', '/bookings?projectId=PRJ-204&type=flight', 'admin')).json.data.find((x: { id: string }) => x.id === id)
    expect(b.attempts.map((a: { outcome: string }) => a.outcome)).toEqual(['manual-fallback', 'failed'])
  })

  test('duplicate: an active booking on the same service gives 409; allowDuplicate flags it; allowDuplicate without conflict flags nothing', async () => {
    const first = (await call('POST', '/bookings/transport', 'admin', { projectId: 'PRJ-205', details: {} }, key())).json.data
    const clash = await call('POST', '/bookings/transport', 'admin', { projectId: 'PRJ-205', serviceId: first.serviceId, details: {} }, key())
    expect(clash.status).toBe(409)
    expect(clash.json.error.details.conflicts).toEqual([{ type: 'transport', id: first.id }])
    const dup = await call('POST', '/bookings/transport', 'admin', { projectId: 'PRJ-205', serviceId: first.serviceId, allowDuplicate: true, duplicateNote: 'Dua bus terpisah', details: {} }, key())
    expect(dup.status).toBe(201)
    expect(dup.json.data).toMatchObject({ flaggedDuplicate: true, duplicateOf: [{ type: 'transport', id: first.id }], duplicateNote: 'Dua bus terpisah' })
    const plain = await call('POST', '/bookings/mice', 'admin', { projectId: 'PRJ-205', allowDuplicate: true, details: {} }, key())
    expect(plain.json.data).toMatchObject({ flaggedDuplicate: false, duplicateOf: [] })
  })

  test('gate: an own paid invoice clears the booking; an invoice of another booking is not the project DP', async () => {
    const today = todayBusinessDate()
    const bank = (await call('POST', '/finance/accounts', 'finance', { code: 'BCA-S4B', bankName: 'BCA', holderName: 'PT MANOVA', accountNumber: '9876543210' }, key())).json.data.id as string
    await call('POST', `/finance/accounts/${bank}/opening`, 'finance', { amountMinor: '1000000', openingDate: today }, key())
    await call('POST', `/finance/accounts/${bank}/opening/verify`, 'superAdmin', { balanceMinor: '1000000', openingDate: today }, key())
    const confirm = async (id: string) => { for (const to of ['quoted', 'confirmed']) await call('POST', `/bookings/hotel/${id}/status`, 'admin', { to }) }
    const a = (await call('POST', '/bookings/hotel', 'admin', { projectId: 'PRJ-104', details: {} }, key())).json.data.id as string
    const b = (await call('POST', '/bookings/hotel', 'admin', { projectId: 'PRJ-104', details: {} }, key())).json.data.id as string
    await confirm(a)
    await confirm(b)
    const inv = (await call('POST', '/finance/customer-invoices', 'finance', { projectId: 'PRJ-104', booking: { type: 'hotel', id: a }, invoiceType: 'final', lines: [{ description: 'Hotel A', amountMinor: '500000' }], dueDate: today }, key())).json.data.id as string
    await call('POST', `/finance/customer-invoices/${inv}/issue`, 'finance', {}, key())
    const rec = await call('POST', '/finance/receipts', 'finance', { bankAccountId: bank, amountMinor: '500000', effectiveDate: today, partyId: 'PTY-001', allocations: [{ invoiceId: inv, amountMinor: '500000' }] }, key())
    expect(rec.status, JSON.stringify(rec.json.error)).toBe(201)
    const gates = (await call('GET', '/bookings?projectId=PRJ-104&type=hotel', 'admin')).json.data as { id: string; paymentGate: unknown }[]
    expect(gates.find(x => x.id === a)!.paymentGate).toEqual({ status: 'cleared', basis: 'booking' })
    // B has no invoice and the project has no DP: A's paid invoice must not clear it.
    expect(gates.find(x => x.id === b)!.paymentGate).toEqual({ status: 'pending', basis: 'project' })
  })
})
