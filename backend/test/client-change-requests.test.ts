import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * S12b-2: change requests between the client portal and staff — staff send the impact to the client when it costs
 * something, the client approves / rejects it or cancels the request. Client USR-021, party PTY-005.
 */

let t: TestApp
const c: Record<string, string> = {}
let n = 0
beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 60_000)
afterAll(() => t.cleanup())

const call = (method: string, path: string, who: string, body?: unknown, key?: string) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: key ? { 'idempotency-key': key } : {} })
const k = () => `cr-key-${++n}-${Date.now()}`
type CR = { id: string; status: string; source: string; commercialImpactMinor: string | null; cancellationFeeMinor: string | null; changeType: string | null; activityId: string }
const staffCreate = async (projectId: string, body: Record<string, unknown>) =>
  (await call('POST', `/projects/${projectId}/change-requests`, 'admin', { beforeSummary: 'Hotel A', afterSummary: 'Hotel B', ...body }, k())).json.data as CR

describe('staff side of a client change request', () => {
  test('send the impact to the client: needs a cost; only client requests; then it waits for the client', async () => {
    const cr = await staffCreate('PRJ-201', { source: 'client' })
    expect((await call('POST', `/change-requests/${cr.id}/send-to-client`, 'admin', { commercialImpactMinor: '0' })).status).toBe(400)
    const sent = await call('POST', `/change-requests/${cr.id}/send-to-client`, 'admin', { commercialImpactMinor: '2500000', cancellationFeeMinor: '0', timelineImpactNote: 'Jadwal mundur 1 hari' })
    expect(sent.status, JSON.stringify(sent.json)).toBe(200)
    expect(sent.json.data).toMatchObject({ status: 'waiting-client-approval', commercialImpactMinor: '2500000', cancellationFeeMinor: '0', timelineImpactNote: 'Jadwal mundur 1 hari' })
    expect((await call('POST', `/change-requests/${cr.id}/send-to-client`, 'admin', { commercialImpactMinor: '1' })).status).toBe(422)
    expect((await call('POST', `/change-requests/${cr.id}/approve`, 'admin')).status).toBe(422)
    const internal = await staffCreate('PRJ-201', { source: 'internal' })
    expect((await call('POST', `/change-requests/${internal.id}/send-to-client`, 'admin', { commercialImpactMinor: '1000' })).status).toBe(422)
    expect((await call('POST', `/change-requests/${cr.id}/send-to-client`, 'finance', { commercialImpactMinor: '1000' })).status).toBe(403)
  })

  test('a client request that costs something cannot be approved directly; an internal one can; a free client one can', async () => {
    const costly = await staffCreate('PRJ-201', { source: 'client', commercialImpactMinor: '1000000' })
    const res = await call('POST', `/change-requests/${costly.id}/approve`, 'admin')
    expect(res.status).toBe(422)
    expect(res.json.error.message).toContain('kirim dampaknya ke client')
    const internal = await staffCreate('PRJ-201', { source: 'internal', commercialImpactMinor: '1000000' })
    expect((await call('POST', `/change-requests/${internal.id}/approve`, 'admin')).json.data.status).toBe('approved')
    const free = await staffCreate('PRJ-201', { source: 'client' })
    expect((await call('POST', `/change-requests/${free.id}/approve`, 'admin')).json.data.status).toBe('approved')
  })

  test('a request waiting for the client blocks project completion', async () => {
    await t.db.query("update projects set status = 'ongoing-trip' where id = 'PRJ-204'")
    const cr = await staffCreate('PRJ-204', { source: 'client' })
    await call('POST', `/change-requests/${cr.id}/send-to-client`, 'admin', { cancellationFeeMinor: '500000' })
    const done = await call('POST', '/projects/PRJ-204/transition', 'admin', { to: 'completed' })
    expect(done.status).toBe(422)
    expect(done.json.error.message).toContain(cr.id)
  })

  test('the change type is stored and sets the change entry category', async () => {
    const cr = await staffCreate('PRJ-201', { source: 'client', changeType: 'change-hotel' })
    expect(cr.changeType).toBe('change-hotel')
    expect((await call('POST', '/projects/PRJ-201/change-requests', 'admin', { source: 'client', changeType: 'teleport', beforeSummary: 'A', afterSummary: 'B' }, k())).status).toBe(400)
  })
})
