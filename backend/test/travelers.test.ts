import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S7a: travelers, groups and rooming list through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s7a-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

// Needs the S7a demo seed (Task 5) and the rooming endpoint (Task 3).
describe.skip('travelers', () => {
  test('internal roles read full identity data; portals 403; anonymous 401; unknown 404', async () => {
    const list = await call('GET', '/travelers?projectId=PRJ-101', 'finance')
    expect(list.status).toBe(200)
    expect((list.json.data as { id: string; passportNumber: string }[]).find(x => x.id === 'TRV-1011')!.passportNumber).toBe('B1234561')
    expect((await call('GET', '/travelers', 'client')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/travelers')).status).toBe(401)
    expect((await call('GET', '/travelers/TRV-999', 'admin')).status).toBe(404)
    expect((await call('GET', '/traveler-groups?projectId=PRJ-103', 'admin')).json.data).toHaveLength(3)
    expect((await call('GET', '/room-assignments?projectId=PRJ-103', 'admin')).json.data).toHaveLength(3)
  })

  test('create (idempotent, validation), patch, verify, vip; finance 403 on writes', async () => {
    const k = key()
    const body = { name: 'Peserta Baru S7a', groupId: 'GRP-001', passportNumber: 'X1', passportExpiryDate: '2030-01-01' }
    const res = await call('POST', '/projects/PRJ-103/travelers', 'admin', body, k)
    expect(res.status).toBe(201)
    const id = res.json.data.id as string
    expect(res.json.data).toMatchObject({ projectId: 'PRJ-103', groupId: 'GRP-001', cancelled: false, isVip: false })
    expect((await call('POST', '/projects/PRJ-103/travelers', 'admin', body, k)).json.data.id).toBe(id)
    expect((await call('POST', '/projects/PRJ-103/travelers', 'admin', { name: '' }, key())).status).toBe(400)
    expect((await call('POST', '/projects/PRJ-103/travelers', 'admin', { name: 'X', groupId: 'GRP-004' }, key())).status).toBe(400) // other project's group
    expect((await call('POST', '/projects/PRJ-103/travelers', 'admin', { name: 'X', passportExpiryDate: '01-01-2030' }, key())).status).toBe(400)
    expect((await call('PATCH', `/travelers/${id}`, 'admin', { dietaryRestrictions: 'Halal', companionOfTravelerId: 'TRV-1031' })).json.data).toMatchObject({ dietaryRestrictions: 'Halal', companionOfTravelerId: 'TRV-1031' })
    expect((await call('PATCH', `/travelers/${id}`, 'admin', { salesOrderId: 'SLO-006' })).status).toBe(400)
    expect((await call('PATCH', `/travelers/${id}`, 'admin', { companionOfTravelerId: 'TRV-1011' })).status).toBe(400) // other project
    const verified = (await call('POST', `/travelers/${id}/verify`, 'admin', { verified: true })).json.data
    expect(verified.documentsVerifiedOn).toBeTruthy()
    expect(verified.documentsVerifiedBy).toBeTruthy()
    expect((await call('POST', `/travelers/${id}/verify`, 'admin', { verified: false })).json.data.documentsVerifiedOn).toBeNull()
    expect((await call('POST', `/travelers/${id}/vip`, 'admin', { isVip: true })).json.data.isVip).toBe(true)
    expect((await call('POST', '/projects/PRJ-103/travelers', 'finance', body, key())).status).toBe(403)
  })

  test('delete is for input mistakes only: a booking traveler is refused; deleting leaves no room entry', async () => {
    const id = (await call('POST', '/projects/PRJ-103/travelers', 'admin', { name: 'Salah Input' }, key())).json.data.id as string
    await call('PUT', '/room-assignments/ROOM-001/travelers', 'admin', { travelerIds: ['TRV-1032', 'TRV-1033', id] })
    expect((await call('DELETE', `/travelers/${id}`, 'admin')).status).toBe(200)
    expect((await call('GET', '/room-assignments?projectId=PRJ-103', 'admin')).json.data.find((r: { id: string }) => r.id === 'ROOM-001').travelerIds).not.toContain(id)
    const booked = (await call('GET', '/travelers?projectId=PRJ-205', 'admin')).json.data.find((x: { salesOrderId: string | null }) => x.salesOrderId)
    expect((await call('DELETE', `/travelers/${booked.id}`, 'admin')).status).toBe(422)
  })

  test('groups: create and patch; name required', async () => {
    const g = (await call('POST', '/projects/PRJ-101/traveler-groups', 'admin', { name: 'Rombongan S7a' }, key())).json.data
    expect(g).toMatchObject({ projectId: 'PRJ-101', name: 'Rombongan S7a', paxCount: 0 })
    expect((await call('PATCH', `/traveler-groups/${g.id}`, 'admin', { paxCount: 4, roomingNote: '2 twin' })).json.data).toMatchObject({ paxCount: 4, roomingNote: '2 twin' })
    expect((await call('POST', '/projects/PRJ-101/traveler-groups', 'admin', { name: ' ' }, key())).status).toBe(400)
  })
})

describe('travelers (empty)', () => {
  test('reads answer for internal roles, 403 for portals, 401 anonymous; create, patch, verify, vip, group', async () => {
    expect((await call('GET', '/travelers', 'finance')).status).toBe(200)
    expect((await call('GET', '/travelers', 'client')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/travelers')).status).toBe(401)
    const g = (await call('POST', '/projects/PRJ-101/traveler-groups', 'admin', { name: 'Grup Uji' }, key())).json.data.id as string
    const res = await call('POST', '/projects/PRJ-101/travelers', 'admin', { name: 'Uji S7a', groupId: g }, key())
    expect(res.status).toBe(201)
    const id = res.json.data.id as string
    expect((await call('PATCH', `/travelers/${id}`, 'admin', { specialRequest: 'Kursi lorong' })).json.data.specialRequest).toBe('Kursi lorong')
    expect((await call('POST', `/travelers/${id}/verify`, 'admin', { verified: true })).json.data.documentsVerifiedOn).toBeTruthy()
    expect((await call('POST', `/travelers/${id}/vip`, 'admin', { isVip: true })).json.data.isVip).toBe(true)
    expect((await call('DELETE', `/travelers/${id}`, 'admin')).status).toBe(200)
    expect((await call('GET', `/travelers/${id}`, 'admin')).status).toBe(404)
    expect((await call('POST', '/projects/PRJ-101/travelers', 'finance', { name: 'X' }, key())).status).toBe(403)
  })
})
