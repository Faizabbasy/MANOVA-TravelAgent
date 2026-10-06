import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S4a: project services and bookings written through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s4a-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

describe('project services', () => {
  test('admin creates a service; idempotent; validation; finance 403; portal/no session', async () => {
    const k = key()
    const res = await call('POST', '/projects/PRJ-101/services', 'admin', { type: 'additional', label: 'Asuransi perjalanan', budgetMinor: '2500000' }, k)
    expect(res.status).toBe(201)
    // Bun's toMatchObject writes the matchers into the received object — read the id first.
    const created = res.json.data.id as string
    expect(created).toMatch(/^SVC-\d+$/)
    expect(res.json.data).toMatchObject({ projectId: 'PRJ-101', type: 'additional', label: 'Asuransi perjalanan', status: 'not-started', budgetMinor: '2500000', vendorId: null, hasBookings: false })
    expect((await call('POST', '/projects/PRJ-101/services', 'admin', { type: 'additional', label: 'Asuransi perjalanan', budgetMinor: '2500000' }, k)).json.data.id).toBe(created)
    expect((await call('POST', '/projects/PRJ-101/services', 'admin', { type: 'additional', label: 'X' })).status).toBe(400) // no key
    const bad = await call('POST', '/projects/PRJ-101/services', 'admin', { type: 'kapal', label: ' ', budgetMinor: '-1', vendorId: 'VND-999' }, key())
    expect(bad.status).toBe(400)
    expect(Object.keys(bad.json.error.fieldErrors).sort()).toEqual(['budgetMinor', 'label', 'type', 'vendorId'])
    expect((await call('POST', '/projects/PRJ-101/services', 'finance', { type: 'hotel', label: 'X' }, key())).status).toBe(403)
    expect((await call('POST', '/projects/PRJ-999/services', 'admin', { type: 'hotel', label: 'X' }, key())).status).toBe(404)
    expect((await t.call('POST', '/api/v1/projects/PRJ-101/services', { body: { type: 'hotel', label: 'X' }, headers: { 'idempotency-key': key() } })).status).toBe(401)
    const list = await call('GET', '/project-services?projectId=PRJ-101', 'finance')
    expect(list.json.data.some((s: { id: string }) => s.id === created)).toBe(true)
    expect((await call('GET', '/project-services', 'client')).status).toBe(403)
  })

  test('patch: label, budget, manual status only without bookings; type fixed; audit', async () => {
    const id = (await call('POST', '/projects/PRJ-102/services', 'admin', { type: 'hotel', label: 'Hotel cadangan' }, key())).json.data.id
    const res = await call('PATCH', `/project-services/${id}`, 'admin', { label: 'Hotel utama', budgetMinor: '9000000', status: 'sourcing', bookingReference: 'RSV-1' })
    expect(res.status).toBe(200)
    expect(res.json.data).toMatchObject({ label: 'Hotel utama', budgetMinor: '9000000', status: 'sourcing', bookingReference: 'RSV-1' })
    for (const body of [{ type: 'flight' }, { projectId: 'PRJ-101' }, { status: 'selesai' }]) {
      expect((await call('PATCH', `/project-services/${id}`, 'admin', body)).status, JSON.stringify(body)).toBe(400)
    }
    // SVC-1011 carries FLT-1011: its status follows the booking.
    expect((await call('PATCH', '/project-services/SVC-1011', 'admin', { status: 'completed' })).status).toBe(422)
    const [a] = await t.db.query<{ n: string }>("select count(*) as n from audit_events where action = 'service.updated' and entity_id = $1", [id])
    expect(a!.n).toBe('1')
  })

  test('vendor change is refused once a vendor invoice points at the service (booking or service order)', async () => {
    // SVC-1011 (VND-001) carries FLT-1011.
    const inv = await call('POST', '/finance/vendor-invoices', 'finance', { vendorId: 'VND-001', vendorInvoiceNumber: 'S4A-1', booking: { type: 'flight', id: 'FLT-1011' }, invoiceDate: '2026-02-01', dueDate: '2026-03-01', totalMinor: '1000' }, key())
    expect(inv.status).toBe(201)
    const res = await call('PATCH', '/project-services/SVC-1011', 'admin', { vendorId: 'VND-002' })
    expect(res.status).toBe(422)
    expect(res.json.error.message).toContain('invoice vendor')
    // A service order of the service counts too.
    const [so] = await t.db.query<{ id: string; vendor_id: string; service_id: string }>('select id, vendor_id, service_id from service_orders where service_id is not null order by id limit 1')
    const soInv = await call('POST', '/finance/vendor-invoices', 'finance', { vendorId: so!.vendor_id, vendorInvoiceNumber: 'S4A-2', serviceOrderId: so!.id, invoiceDate: '2026-02-01', dueDate: '2026-03-01', totalMinor: '1000' }, key())
    expect(soInv.status).toBe(201)
    expect((await call('PATCH', `/project-services/${so!.service_id}`, 'admin', { vendorId: null })).status).toBe(422)
    // Without invoices the vendor can change.
    const free = (await call('POST', '/projects/PRJ-103/services', 'admin', { type: 'transportation', label: 'Bus', vendorId: 'VND-003' }, key())).json.data.id
    expect((await call('PATCH', `/project-services/${free}`, 'admin', { vendorId: 'VND-005' })).json.data.vendorId).toBe('VND-005')
  })
})
