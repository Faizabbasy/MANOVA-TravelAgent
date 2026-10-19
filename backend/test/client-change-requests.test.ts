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

const notes = async (userId: string) => Number((await t.db.query<{ n: string }>('select count(*)::text as n from notifications where user_id = $1', [userId]))[0]!.n)
const owner = async (projectId: string) => (await t.db.query<{ owner_user_id: string }>('select owner_user_id from projects where id = $1', [projectId]))[0]!.owner_user_id
const clientCreate = (projectId: string, body: Record<string, unknown>, key = k()) =>
  call('POST', `/client/projects/${projectId}/change-requests`, 'client', { beforeSummary: 'Hotel A', afterSummary: 'Hotel B', ...body }, key)

describe('client side of change requests', () => {
  test('the client submits a request on its own open project; the owner is told; replay is one request', async () => {
    const ownerId = await owner('PRJ-201')
    const n0 = await notes(ownerId)
    const key = k()
    const res = await clientCreate('PRJ-201', { changeType: 'change-hotel', source: 'internal' }, key)
    expect(res.status, JSON.stringify(res.json)).toBe(201)
    expect(res.json.data).toMatchObject({ source: 'client', changeType: 'change-hotel', status: 'submitted', projectId: 'PRJ-201' })
    expect((await clientCreate('PRJ-201', { changeType: 'change-hotel', source: 'internal' }, key)).json.data.id).toBe(res.json.data.id)
    expect(await notes(ownerId)).toBe(n0 + 1)
    expect((await clientCreate('PRJ-203', {})).status).toBe(422) // completed
    const foreign = (await t.db.query<{ id: string }>("select id from projects where party_id <> 'PTY-005' order by id limit 1"))[0]!.id
    expect((await clientCreate(foreign, {})).status).toBe(404)
    expect((await call('POST', '/client/projects/PRJ-201/change-requests', 'admin', { beforeSummary: 'A', afterSummary: 'B' }, k())).status).toBe(403)
  })

  test('approve the impact after staff send it: approved, change entry approved, owner told; only while waiting', async () => {
    const cr = (await clientCreate('PRJ-201', { changeType: 'add-activity' })).json.data as CR
    expect((await call('POST', `/client/change-requests/${cr.id}/approve`, 'client')).status).toBe(422)
    await call('POST', `/change-requests/${cr.id}/send-to-client`, 'admin', { commercialImpactMinor: '3000000' })
    const ownerId = await owner('PRJ-201')
    const n0 = await notes(ownerId)
    const ok = await call('POST', `/client/change-requests/${cr.id}/approve`, 'client')
    expect(ok.status, JSON.stringify(ok.json)).toBe(200)
    expect(ok.json.data).toMatchObject({ status: 'approved', clientDecidedBy: 'USR-021' })
    const entry = await t.db.query<{ approval_status: string }>('select approval_status from project_activities where id = $1', [cr.activityId])
    expect(entry[0]!.approval_status).toBe('approved')
    expect(await notes(ownerId)).toBe(n0 + 1)
    expect((await call('POST', `/client/change-requests/${cr.id}/approve`, 'client')).status).toBe(422)
  })

  test('reject the impact needs a reason; cancel needs a reason and works until decided', async () => {
    const a = (await clientCreate('PRJ-201', {})).json.data as CR
    await call('POST', `/change-requests/${a.id}/send-to-client`, 'admin', { cancellationFeeMinor: '750000' })
    expect((await call('POST', `/client/change-requests/${a.id}/reject`, 'client', { reason: ' ' })).status).toBe(400)
    expect((await call('POST', `/client/change-requests/${a.id}/reject`, 'client', { reason: 'Biaya terlalu besar' })).json.data).toMatchObject({ status: 'rejected', rejectionReason: 'Biaya terlalu besar' })
    const b = (await clientCreate('PRJ-201', {})).json.data as CR
    expect((await call('POST', `/client/change-requests/${b.id}/cancel`, 'client', {})).status).toBe(400)
    expect((await call('POST', `/client/change-requests/${b.id}/cancel`, 'client', { reason: 'Tidak jadi' })).json.data).toMatchObject({ status: 'cancelled', cancelReason: 'Tidak jadi' })
    expect((await call('POST', `/client/change-requests/${b.id}/cancel`, 'client', { reason: 'Lagi' })).status).toBe(422)
    const entry = await t.db.query<{ approval_status: string }>('select approval_status from project_activities where id = $1', [b.activityId])
    expect(entry[0]!.approval_status).toBe('rejected')
  })

  test('another party’s request is not found; other roles are refused', async () => {
    const foreignProject = (await t.db.query<{ id: string }>("select id from projects where party_id <> 'PTY-005' order by id limit 1"))[0]!.id
    const cr = await staffCreate(foreignProject, { source: 'client' })
    for (const action of ['approve', 'reject', 'cancel']) {
      expect((await call('POST', `/client/change-requests/${cr.id}/${action}`, 'client', { reason: 'x' })).status, action).toBe(404)
    }
    expect((await call('POST', `/client/change-requests/${cr.id}/cancel`, 'vendor', { reason: 'x' })).status).toBe(403)
  })
})

describe('client change request category (S12b-2)', () => {
  test('a quick request keeps the category the client picked for its change entry', async () => {
    const cr = (await clientCreate('PRJ-201', { category: 'traveler' })).json.data as CR
    const [entry] = await t.db.query<{ category: string }>('select category from project_activities where id = $1', [cr.activityId])
    expect(entry!.category).toBe('traveler')
  })
})
