import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S6b: B2C sales orders and Group Trip seats through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s6b-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

const standalone = (extra: Record<string, unknown> = {}) => ({
  customerName: 'Ibu Ratna S6b', destination: 'Bali', travelStartDate: '2026-12-01', travelEndDate: '2026-12-04',
  travelerCount: 2, priceMinor: '9000000', ...extra
})

describe('sales orders', () => {
  test('lists for internal roles; portals 403; anonymous 401; unknown 404', async () => {
    expect((await call('GET', '/sales-orders', 'finance')).status).toBe(200)
    expect((await call('GET', '/sales-orders', 'client')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/sales-orders')).status).toBe(401)
    expect((await call('GET', '/sales-orders/SLO-999', 'admin')).status).toBe(404)
  })

  test('create standalone with a new individual client customer; idempotent; validation; finance 403', async () => {
    const k = key()
    const res = await call('POST', '/sales-orders', 'admin', standalone(), k)
    expect(res.status).toBe(201)
    const id = res.json.data.id as string
    const partyId = res.json.data.partyId as string
    expect(res.json.data).toMatchObject({ projectId: null, status: 'draft', destination: 'Bali', travelerCount: 2, priceMinor: '9000000', partyName: 'Ibu Ratna S6b' })
    const party = (await call('GET', `/parties/${partyId}`, 'admin')).json.data
    expect(party).toMatchObject({ partyType: 'individual', lifecycleStatus: 'client' })
    expect((await call('POST', '/sales-orders', 'admin', standalone(), k)).json.data.id).toBe(id)
    expect((await call('POST', '/sales-orders', 'admin', standalone({ priceMinor: '0' }), key())).status).toBe(400)
    expect((await call('POST', '/sales-orders', 'admin', standalone({ travelEndDate: '2026-11-01' }), key())).status).toBe(400)
    expect((await call('POST', '/sales-orders', 'admin', standalone({ customerName: undefined, partyId: 'PTY-999' }), key())).status).toBe(400)
    expect((await call('POST', '/sales-orders', 'admin', standalone({ customerName: undefined, partyId: 'PTY-006' }), key())).json.data.partyId).toBe('PTY-006')
    expect((await call('POST', '/sales-orders', 'finance', standalone(), key())).status).toBe(403)
  })

  test('status follows draft to paid to ongoing to done; cancel needs a reason; done is final', async () => {
    const id = (await call('POST', '/sales-orders', 'admin', standalone(), key())).json.data.id as string
    expect((await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'ongoing' })).status).toBe(422)
    // Paid comes only from the Finance DP/payment confirmation (owner accounting F4), never a manual status.
    const manual = await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'paid' })
    expect(manual.status).toBe(422)
    expect(manual.json.error.message).toContain('Finance')
    await t.db.query("update sales_order_refs set status = 'paid', paid_on = current_date where id = $1", [id]) // stands in for the Finance confirmation
    expect((await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'cancelled' })).status).toBe(400)
    await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'ongoing' })
    expect((await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'done' })).json.data.status).toBe('done')
    expect((await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'cancelled', reason: 'x' })).status).toBe(422)
    expect((await call('POST', `/sales-orders/${id}/status`, 'finance', { to: 'done' })).status).toBe(403)
  })

  test('a Group Trip order cannot become paid by hand; it stays draft', async () => {
    const before = (await call('GET', '/sales-orders/SLO-007', 'admin')).json.data
    expect(before.status).toBe('draft')
    const refused = await call('POST', '/sales-orders/SLO-007/status', 'admin', { to: 'paid' })
    expect(refused.status).toBe(422)
    expect(refused.json.error.message).toContain('Finance')
    expect((await call('GET', '/sales-orders/SLO-007', 'admin')).json.data.status).toBe('draft')
  })

  test('seats: paid fill, drafts hold, cancelling frees; non group trip 422', async () => {
    const seats = (await call('GET', '/projects/PRJ-205/seats', 'finance')).json.data
    expect(seats.capacity).toBeGreaterThan(0)
    expect(seats.filled).toBe(5) // SLO-006 (2) + SLO-009 (3)
    expect(seats.held).toBe(3) // SLO-007 (1) + SLO-008 (2)
    expect(seats.available).toBe(Math.max(0, seats.capacity - 8))
    await call('POST', '/sales-orders/SLO-008/status', 'admin', { to: 'cancelled', reason: 'Batal ikut' })
    expect((await call('GET', '/projects/PRJ-205/seats', 'admin')).json.data.held).toBe(1)
    expect((await call('GET', '/projects/PRJ-101/seats', 'admin')).status).toBe(422)
  })
})

const b2cLead = async (name: string, extra: Record<string, unknown> = {}) => (await call('POST', '/leads', 'admin', {
  name, source: 'instagram', serviceCategory: 'individual-travel', destination: 'Bromo', travelStartDate: '2026-12-10',
  travelEndDate: '2026-12-12', travelerEstimate: 2, serviceScope: ['transportation'], requirementSummary: 'Liburan keluarga', ...extra
}, key())).json.data.id as string

const tripBody = (projectId: string, adultCount: number, priceMinor = '3500000') => ({
  projectId, adultCount, childCount: 0, infantCount: 0, priceMinor, priceAcceptance: 'accept', bookingReadiness: 'ready'
})

describe('B2C qualify', () => {
  test('qualify with a price creates a standalone draft order linked to the lead', async () => {
    const id = await b2cLead('Pak Hadi S6b')
    const lead = (await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'individual', priceMinor: '5000000' })).json.data
    expect(lead.stage).toBe('qualified')
    const orderId = lead.b2c.salesOrderId as string
    expect((await call('GET', `/sales-orders/${orderId}`, 'admin')).json.data).toMatchObject({ leadId: id, partyId: lead.partyId, projectId: null, travelerCount: 2, priceMinor: '5000000', status: 'draft', destination: 'Bromo' })
    expect((await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'individual', priceMinor: '5000000' })).status).toBe(409)
  })

  test('group trip: enough seats qualifies with an order; too many pax is waitlisted without an order; a second try is 409', async () => {
    const seats = (await call('GET', '/projects/PRJ-205/seats', 'admin')).json.data as { available: number }
    const id = await b2cLead('Bu Nining S6b')
    const okRes = (await call('POST', `/leads/${id}/group-trip`, 'admin', tripBody('PRJ-205', 1))).json.data
    expect(okRes.outcome).toBe('qualified')
    expect(okRes.salesOrder).toMatchObject({ projectId: 'PRJ-205', status: 'draft', travelerCount: 1, leadId: id })
    expect(okRes.lead).toMatchObject({ stage: 'qualified', b2c: { b2cQualificationResult: 'qualified', projectId: 'PRJ-205', salesOrderId: okRes.salesOrder.id } })
    expect((await call('GET', '/projects/PRJ-205/seats', 'admin')).json.data.available).toBe(Math.max(0, seats.available - 1))
    expect((await call('POST', `/leads/${id}/group-trip`, 'admin', tripBody('PRJ-205', 1))).status).toBe(409)
    const big = await b2cLead('Rombongan Besar S6b')
    const wait = (await call('POST', `/leads/${big}/group-trip`, 'admin', tripBody('PRJ-205', 500, '1000000'))).json.data
    expect(wait).toMatchObject({ outcome: 'waitlist', salesOrder: null })
    expect(wait.lead.stage).not.toBe('qualified')
    expect(wait.lead.b2c.b2cQualificationResult).toBe('waitlist')
    expect((await call('POST', `/leads/${big}/group-trip`, 'admin', tripBody('PRJ-101', 1, '1'))).status).toBe(422)
    expect((await call('POST', `/leads/${big}/group-trip`, 'finance', tripBody('PRJ-205', 1, '1'))).status).toBe(403)
  })

  test('two group trip qualifies for the last seat: one order, one waitlist', async () => {
    const project = (await call('POST', '/projects', 'admin', {
      name: 'Trip Satu Kursi S6b', isGroupTrip: true, destination: 'Dieng', travelStartDate: '2026-12-20', travelEndDate: '2026-12-22',
      serviceScope: ['transportation'], travelerCount: 1, contractValueMinor: '0'
    }, key())).json.data.id as string
    const a = await b2cLead('Kursi Terakhir A S6b')
    const b = await b2cLead('Kursi Terakhir B S6b')
    const [ra, rb] = await Promise.all([call('POST', `/leads/${a}/group-trip`, 'admin', tripBody(project, 1)), call('POST', `/leads/${b}/group-trip`, 'admin', tripBody(project, 1))])
    expect([ra.json.data.outcome, rb.json.data.outcome].sort()).toEqual(['qualified', 'waitlist'])
    expect((await call('GET', `/projects/${project}/seats`, 'admin')).json.data).toMatchObject({ capacity: 1, held: 1, available: 0 })
  })
})
