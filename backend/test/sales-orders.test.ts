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
    const paid = (await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'paid' })).json.data
    expect(paid.status).toBe('paid')
    expect(paid.paidOn).toBeTruthy()
    expect((await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'cancelled' })).status).toBe(400)
    await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'ongoing' })
    expect((await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'done' })).json.data.status).toBe('done')
    expect((await call('POST', `/sales-orders/${id}/status`, 'admin', { to: 'cancelled', reason: 'x' })).status).toBe(422)
    expect((await call('POST', `/sales-orders/${id}/status`, 'finance', { to: 'done' })).status).toBe(403)
  })

  // Needs the S6b seed statuses (Task 5).
  test.skip('a Group Trip order cannot become paid by hand; it stays draft', async () => {
    const before = (await call('GET', '/sales-orders/SLO-007', 'admin')).json.data
    expect(before.status).toBe('draft')
    const refused = await call('POST', '/sales-orders/SLO-007/status', 'admin', { to: 'paid' })
    expect(refused.status).toBe(422)
    expect(refused.json.error.message).toContain('Finance')
    expect((await call('GET', '/sales-orders/SLO-007', 'admin')).json.data.status).toBe('draft')
  })

  test.skip('seats: paid fill, drafts hold, cancelling frees; non group trip 422', async () => {
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
