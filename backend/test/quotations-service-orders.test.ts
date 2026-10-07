import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
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
