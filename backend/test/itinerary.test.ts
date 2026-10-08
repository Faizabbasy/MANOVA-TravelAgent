import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S7b: daily itinerary items through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s7b-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

describe('itinerary items', () => {
  test('internal roles read in day order; portals 403; anonymous 401', async () => {
    await call('POST', '/projects/PRJ-103/itinerary-items', 'admin', { date: '2026-08-14', time: '10:00', title: 'Pulang' }, key())
    await call('POST', '/projects/PRJ-103/itinerary-items', 'admin', { date: '2026-08-14', title: 'Sarapan (tanpa jam)' }, key())
    await call('POST', '/projects/PRJ-103/itinerary-items', 'admin', { date: '2026-08-13', time: '09:00', title: 'Briefing' }, key())
    const res = await call('GET', '/itinerary-items?projectId=PRJ-103', 'finance')
    expect(res.status).toBe(200)
    const items = res.json.data as { id: string; date: string; time: string | null; projectId: string }[]
    expect(items.length).toBeGreaterThan(0)
    expect(items.every(x => x.projectId === 'PRJ-103')).toBe(true)
    const keys = items.map(x => `${x.date} ${x.time ?? ''}`)
    expect([...keys].sort()).toEqual(keys)
    expect((await call('GET', '/itinerary-items', 'client')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/itinerary-items')).status).toBe(401)
  })

  test('create is idempotent and validated; finance cannot write; unknown project 404', async () => {
    const k = key()
    const body = { date: '2026-08-11', time: '08:30', title: 'City tour', serviceType: 'transportation', groupId: 'GRP-001', location: 'Palu' }
    const res = await call('POST', '/projects/PRJ-103/itinerary-items', 'admin', body, k)
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ projectId: 'PRJ-103', title: 'City tour', time: '08:30', groupId: 'GRP-001', visibleToClient: true, vendorId: null, vendorAmountMinor: null })
    expect((await call('POST', '/projects/PRJ-103/itinerary-items', 'admin', body, k)).json.data.id).toBe(res.json.data.id)
    const bad = async (b: unknown) => (await call('POST', '/projects/PRJ-103/itinerary-items', 'admin', b, key())).status
    expect(await bad({ title: 'Tanpa tanggal' })).toBe(400)
    expect(await bad({ date: '2026-08-11', title: '  ' })).toBe(400)
    expect(await bad({ date: '11-08-2026', title: 'X' })).toBe(400)
    expect(await bad({ date: '2026-08-11', title: 'X', time: '8:30' })).toBe(400)
    expect(await bad({ date: '2026-08-11', title: 'X', serviceType: 'cruise' })).toBe(400)
    expect(await bad({ date: '2026-08-11', title: 'X', groupId: 'GRP-004' })).toBe(400) // other project's group
    expect(await bad({ date: '2026-08-11', title: 'X', vendorId: 'VND-999' })).toBe(400)
    expect(await bad({ date: '2026-08-11', title: 'X', vendorAmountMinor: '1000' })).toBe(400) // amount without vendor
    expect(await bad({ date: '2026-08-11', title: 'X', vendorId: 'VND-001', vendorAmountMinor: '-5' })).toBe(400)
    expect((await call('POST', '/projects/PRJ-103/itinerary-items', 'finance', body, key())).status).toBe(403)
    expect((await call('POST', '/projects/PRJ-999/itinerary-items', 'admin', body, key())).status).toBe(404)
  })

  test('patch toggles visibility, sets and clears a vendor with its amount; delete', async () => {
    const id = (await call('POST', '/projects/PRJ-103/itinerary-items', 'admin', { date: '2026-08-12', title: 'Gala dinner' }, key())).json.data.id as string
    expect((await call('PATCH', `/itinerary-items/${id}`, 'admin', { visibleToClient: false })).json.data.visibleToClient).toBe(false)
    expect((await call('PATCH', `/itinerary-items/${id}`, 'admin', { vendorAmountMinor: '500000' })).status).toBe(400)
    expect((await call('PATCH', `/itinerary-items/${id}`, 'admin', { vendorId: 'VND-001', vendorAmountMinor: '500000' })).json.data)
      .toMatchObject({ vendorId: 'VND-001', vendorAmountMinor: '500000' })
    expect((await call('PATCH', `/itinerary-items/${id}`, 'admin', { vendorId: null })).json.data).toMatchObject({ vendorId: null, vendorAmountMinor: null })
    expect((await call('PATCH', `/itinerary-items/${id}`, 'admin', { time: null, description: 'Ballroom' })).json.data).toMatchObject({ time: null, description: 'Ballroom' })
    expect((await call('PATCH', `/itinerary-items/${id}`, 'admin', { projectId: 'PRJ-101' })).status).toBe(400)
    expect((await call('PATCH', `/itinerary-items/${id}`, 'admin', { title: '' })).status).toBe(400)
    expect((await call('PATCH', `/itinerary-items/${id}`, 'finance', { title: 'X' })).status).toBe(403)
    expect((await call('DELETE', `/itinerary-items/${id}`, 'admin')).status).toBe(200)
    expect((await call('DELETE', `/itinerary-items/${id}`, 'admin')).status).toBe(404)
    expect((await call('PATCH', '/itinerary-items/ITIN-999', 'admin', { title: 'X' })).status).toBe(404)
  })
})
