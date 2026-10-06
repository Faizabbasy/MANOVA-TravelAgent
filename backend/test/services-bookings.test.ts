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

describe('bookings', () => {
  const flight = { departureAt: '2026-11-02T07:00' }
  test('create reuses an empty service or makes one; derived departure; idempotent; validation', async () => {
    const empty = (await call('POST', '/projects/PRJ-104/services', 'admin', { type: 'hotel', label: 'Hotel Bali', budgetMinor: '80000000' }, key())).json.data.id
    const k = key()
    const body = { projectId: 'PRJ-104', reference: 'CONF-9', sellAmountMinor: '7000000', netCostMinor: '6000000', details: { checkInDate: '2026-11-03', options: [], travelerIds: [], status: 'completed', id: 'HTL-X' } }
    const res = await call('POST', '/bookings/hotel', 'admin', body, k)
    expect(res.status).toBe(201)
    const id = res.json.data.id as string
    expect(id).toMatch(/^HTL-\d+$/)
    expect(res.json.data.details).toEqual({ checkInDate: '2026-11-03', options: [], travelerIds: [] })
    expect(res.json.data).toMatchObject({ type: 'hotel', projectId: 'PRJ-104', serviceId: empty, status: 'requested', reference: 'CONF-9', sellAmountMinor: '7000000', netCostMinor: '6000000', departureDate: '2026-11-03' })
    const svc = (await call('GET', '/project-services?projectId=PRJ-104', 'admin')).json.data.find((s: { id: string }) => s.id === empty)
    expect(svc).toMatchObject({ status: 'pending-confirmation', bookingReference: 'CONF-9', hasBookings: true, budgetMinor: '80000000' }) // the budget placeholder is reused, its budget stays
    expect((await call('POST', '/bookings/hotel', 'admin', body, k)).json.data.id).toBe(id)

    const made = await call('POST', '/bookings/flight', 'admin', { projectId: 'PRJ-104', label: 'Flight Bali', details: { segments: [flight] } }, key())
    expect(made.status).toBe(201)
    const madeService = made.json.data.serviceId as string
    expect(made.json.data).toMatchObject({ status: 'requested', departureDate: '2026-11-02', sellAmountMinor: null })
    const newSvc = (await call('GET', '/project-services?projectId=PRJ-104', 'admin')).json.data.find((s: { id: string }) => s.id === madeService)
    expect(newSvc).toMatchObject({ type: 'flight', label: 'Flight Bali', status: 'pending-confirmation' })

    // A service of another project or another type is refused (no cross-project link).
    expect((await call('POST', '/bookings/flight', 'admin', { projectId: 'PRJ-104', serviceId: 'SVC-1011', details: {} }, key())).status).toBe(400)
    expect((await call('POST', '/bookings/flight', 'admin', { projectId: 'PRJ-104', serviceId: empty, details: {} }, key())).status).toBe(400)
    const bad = await call('POST', '/bookings/mice', 'admin', { projectId: 'PRJ-104', sellAmountMinor: '5', details: [] }, key())
    expect(bad.status).toBe(400)
    expect(Object.keys(bad.json.error.fieldErrors).sort()).toEqual(['details', 'sellAmountMinor'])
    expect((await call('POST', '/bookings/kapal', 'admin', { projectId: 'PRJ-104', details: {} }, key())).status).toBe(400)
    expect((await call('POST', '/bookings/flight', 'finance', { projectId: 'PRJ-104', details: {} }, key())).status).toBe(403)
    expect((await call('POST', '/bookings/flight', 'admin', { projectId: 'PRJ-104', details: {} })).status).toBe(400) // no key
    expect((await t.call('POST', '/api/v1/bookings/flight', { body: { projectId: 'PRJ-104', details: {} }, headers: { 'idempotency-key': key() } })).status).toBe(401)
  })

  test('MICE price comes from the BOQ; finance sees net cost; clients are refused', async () => {
    const res = await call('POST', '/bookings/mice', 'admin', { projectId: 'PRJ-202', details: { sessions: [{ startAt: '2026-12-01T09:00' }], boqItems: [{ description: 'Sound', sellPriceIdr: 3000000, netCostIdr: 2000000 }] } }, key())
    const id = res.json.data.id as string
    expect(res.json.data).toMatchObject({ status: 'planning', sellAmountMinor: '3000000', netCostMinor: '2000000', departureDate: '2026-12-01' })
    const list = await call('GET', '/bookings?projectId=PRJ-202&type=mice', 'finance')
    expect(list.json.data.find((b: { id: string }) => b.id === id)).toMatchObject({ netCostMinor: '2000000' })
    expect((await call('GET', '/bookings', 'client')).status).toBe(403)
  })

  test('patch: details, prices, reference; locked fields; not below what is billed (also when cleared)', async () => {
    const id = (await call('POST', '/bookings/transport', 'admin', { projectId: 'PRJ-203', sellAmountMinor: '4000000', details: { legs: [{ pickupLocation: 'A', dropoffLocation: 'B', scheduledAt: '2026-10-20T08:00' }] } }, key())).json.data.id
    const res = await call('PATCH', `/bookings/transport/${id}`, 'admin', { details: { legs: [{ pickupLocation: 'A', dropoffLocation: 'C', scheduledAt: '2026-10-19T08:00' }], driverName: 'Udin' }, reference: 'TRF-1' })
    expect(res.status).toBe(200)
    expect(res.json.data).toMatchObject({ departureDate: '2026-10-19', reference: 'TRF-1', details: { driverName: 'Udin' } })
    for (const body of [{ projectId: 'PRJ-101' }, { serviceId: 'SVC-1011' }, { status: 'confirmed' }, { type: 'hotel' }]) {
      expect((await call('PATCH', `/bookings/transport/${id}`, 'admin', body)).status, JSON.stringify(body)).toBe(400)
    }
    const inv = await call('POST', '/finance/customer-invoices', 'finance', { projectId: 'PRJ-203', booking: { type: 'transport', id }, invoiceType: 'dp', lines: [{ description: 'DP bus', amountMinor: '3000000' }], dueDate: '2026-10-30' }, key())
    expect(inv.status).toBe(201)
    expect((await call('POST', `/finance/customer-invoices/${inv.json.data.id}/issue`, 'finance', {}, key())).status).toBe(200)
    const low = await call('PATCH', `/bookings/transport/${id}`, 'admin', { sellAmountMinor: '2500000' })
    expect(low.status).toBe(422)
    expect(low.json.error.message).toContain('3.000.000')
    expect((await call('PATCH', `/bookings/transport/${id}`, 'admin', { sellAmountMinor: null })).status).toBe(422)
    expect((await call('PATCH', `/bookings/transport/${id}`, 'admin', { sellAmountMinor: '3000000' })).status).toBe(200)
    expect((await call('PATCH', `/bookings/transport/${id}`, 'admin', { sellAmountMinor: '5000000' })).status).toBe(200)
  })

  test('status: valid transitions, reason, service follows, locked after terminal; cancel refused with finance records', async () => {
    const created = (await call('POST', '/bookings/flight', 'admin', { projectId: 'PRJ-204', details: { segments: [flight] } }, key())).json.data
    const id = created.id as string
    const svcId = created.serviceId as string
    expect((await call('POST', `/bookings/flight/${id}/status`, 'admin', { to: 'issued' })).status).toBe(422)
    const held = await call('POST', `/bookings/flight/${id}/status`, 'admin', { to: 'confirmed' })
    expect(held.json.data.status).toBe('confirmed')
    const svc = (await call('GET', '/project-services?projectId=PRJ-204', 'admin')).json.data.find((s: { id: string }) => s.id === svcId)
    expect(svc.status).toBe('confirmed')
    expect((await call('POST', `/bookings/flight/${id}/status`, 'admin', { to: 'cancelled' })).status).toBe(400) // reason
    expect((await call('POST', `/bookings/flight/${id}/status`, 'finance', { to: 'issued' })).status).toBe(403)
    const [audit] = await t.db.query<{ n: string }>("select count(*) as n from audit_events where action = 'booking.status_changed' and entity_id = $1", [id])
    expect(audit!.n).toBe('1')

    // With a vendor invoice on it, cancelling goes through Finance.
    await call('PATCH', `/project-services/${svcId}`, 'admin', { vendorId: 'VND-001' })
    expect((await call('POST', '/finance/vendor-invoices', 'finance', { vendorId: 'VND-001', vendorInvoiceNumber: 'S4A-3', booking: { type: 'flight', id }, invoiceDate: '2026-02-01', dueDate: '2026-03-01', totalMinor: '1000' }, key())).status).toBe(201)
    const refused = await call('POST', `/bookings/flight/${id}/status`, 'admin', { to: 'cancelled', reason: 'Customer batal' })
    expect(refused.status).toBe(422)
    expect(refused.json.error.message).toContain('lewat Finance')

    // A booking without finance records cancels directly; a cancelled hotel is locked for edits.
    const hotel = (await call('POST', '/bookings/hotel', 'admin', { projectId: 'PRJ-204', details: {} }, key())).json.data.id
    expect((await call('POST', `/bookings/hotel/${hotel}/status`, 'admin', { to: 'cancelled', reason: 'Ganti hotel' })).json.data).toMatchObject({ status: 'cancelled', statusReason: 'Ganti hotel' })
    expect((await call('PATCH', `/bookings/hotel/${hotel}`, 'admin', { reference: 'X' })).status).toBe(422)
  })
})

describe('finance cancellation of a booking', () => {
  test('recording it cancels the booking; rejecting it restores the status; terminal bookings stay as they are', async () => {
    const id = (await call('POST', '/bookings/hotel', 'admin', { projectId: 'PRJ-205', sellAmountMinor: '8000000', details: { checkInDate: '2026-12-10' } }, key())).json.data.id as string
    await call('POST', `/bookings/hotel/${id}/status`, 'admin', { to: 'quoted' })
    await call('POST', `/bookings/hotel/${id}/status`, 'admin', { to: 'confirmed' })
    const kase = await call('POST', '/finance/cancellations', 'finance', { subjectType: 'hotel', subjectId: id, cancelDate: '2026-10-01', reason: 'Customer batal' }, key())
    expect(kase.status).toBe(201)
    const statusOf = async (b: string) => (await call('GET', '/bookings?projectId=PRJ-205&type=hotel', 'admin')).json.data.find((x: { id: string }) => x.id === b).status
    expect(await statusOf(id)).toBe('cancelled')
    expect((await call('POST', `/finance/refunds/${kase.json.data.id}/reject`, 'finance', { reason: 'Batal tidak jadi' })).status).toBe(200)
    expect(await statusOf(id)).toBe('confirmed')

    const done = (await call('POST', '/bookings/hotel', 'admin', { projectId: 'PRJ-205', details: { checkInDate: '2026-12-11' } }, key())).json.data.id as string
    for (const to of ['quoted', 'confirmed', 'completed']) await call('POST', `/bookings/hotel/${done}/status`, 'admin', { to })
    expect((await call('POST', '/finance/cancellations', 'finance', { subjectType: 'hotel', subjectId: done, cancelDate: '2026-10-01', reason: 'Klaim' }, key())).status).toBe(201)
    expect(await statusOf(done)).toBe('completed')
  })
})
