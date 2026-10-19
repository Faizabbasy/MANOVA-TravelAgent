import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S12c-2: client support tickets — the client side and the staff inbox. Client USR-021 (PTY-005). */

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
const k = () => `tck-key-${++n}-${Date.now()}`
const notes = async (userId: string) => Number((await t.db.query<{ n: string }>('select count(*)::text as n from notifications where user_id = $1', [userId]))[0]!.n)
const owner = async (projectId: string) => (await t.db.query<{ owner_user_id: string }>('select owner_user_id from projects where id = $1', [projectId]))[0]!.owner_user_id
const ticket = (over: Record<string, unknown> = {}) => ({ projectId: 'PRJ-201', category: 'operational', priority: 'high', subject: 'Bus terlambat', description: 'Bus hari kedua belum datang', ...over })
type Ticket = { id: string; status: string; assignedTo: string | null; assignedToName: string | null; replies: { message: string; internal?: boolean }[]; resolutionRating: number | null; reopenCount: number }
const mine = async (id: string) => ((await call('GET', '/client/support-tickets', 'client')).json.data as Ticket[]).find(x => x.id === id)!

describe('client support tickets', () => {
  test('a ticket on a project goes to the project owner; replay is one ticket', async () => {
    const ownerId = await owner('PRJ-201')
    const n0 = await notes(ownerId)
    const key = k()
    const res = await call('POST', '/client/support-tickets', 'client', ticket(), key)
    expect(res.status, JSON.stringify(res.json)).toBe(201)
    expect(res.json.data).toMatchObject({ status: 'assigned', assignedTo: ownerId, category: 'operational', priority: 'high' })
    expect((await call('POST', '/client/support-tickets', 'client', ticket(), key)).json.data.id).toBe(res.json.data.id)
    expect(await notes(ownerId)).toBe(n0 + 1)
    const act = await t.db.query("select 1 from project_activities where project_id = 'PRJ-201' and source_entity_id = $1", [res.json.data.id])
    expect(act.length).toBe(1)
  })

  test('without a project it waits in the queue and every active admin is told; billing also tells Finance', async () => {
    const admins = (await t.db.query<{ id: string }>("select id from users where role = 'admin' and status = 'active' order by id")).map(r => r.id)
    const before = await Promise.all(admins.map(notes))
    const res = await call('POST', '/client/support-tickets', 'client', ticket({ projectId: null, category: 'billing' }), k())
    expect(res.json.data).toMatchObject({ status: 'open', assignedTo: null })
    const after = await Promise.all(admins.map(notes))
    expect(after.every((v, i) => v === before[i]! + 1)).toBe(true)
    expect(await notes('USR-008')).toBeGreaterThan(0)
  })

  test('validation, another party’s project and other roles', async () => {
    expect((await call('POST', '/client/support-tickets', 'client', ticket({ subject: ' ' }), k())).status).toBe(400)
    expect((await call('POST', '/client/support-tickets', 'client', ticket({ category: 'gossip' }), k())).status).toBe(400)
    expect((await call('POST', '/client/support-tickets', 'client', ticket({ priority: 'asap' }), k())).status).toBe(400)
    const foreign = (await t.db.query<{ id: string }>("select id from projects where party_id <> 'PTY-005' order by id limit 1"))[0]!.id
    expect((await call('POST', '/client/support-tickets', 'client', ticket({ projectId: foreign }), k())).status).toBe(404)
    expect((await call('POST', '/client/support-tickets', 'admin', ticket(), k())).status).toBe(403)
  })

  test('reply, confirm, reopen and rate follow the ticket status', async () => {
    const id = (await call('POST', '/client/support-tickets', 'client', ticket(), k())).json.data.id as string
    await t.db.query("update support_tickets set status = 'waiting-for-client' where id = $1", [id])
    const ownerId = await owner('PRJ-201')
    const n0 = await notes(ownerId)
    expect((await call('POST', `/client/support-tickets/${id}/replies`, 'client', { message: 'Sudah kami cek, masih terlambat' }, k())).status).toBe(201)
    expect((await mine(id)).status).toBe('in-progress')
    expect(await notes(ownerId)).toBe(n0 + 1)
    expect((await call('POST', `/client/support-tickets/${id}/confirm`, 'client', {})).status).toBe(422)
    expect((await call('POST', `/client/support-tickets/${id}/rate`, 'client', { rating: 5 })).status).toBe(422)
    await t.db.query("update support_tickets set status = 'resolved', resolution_note = 'Bus pengganti dikirim', resolved_at = now() where id = $1", [id])
    expect((await call('POST', `/client/support-tickets/${id}/rate`, 'client', { rating: 7 })).status).toBe(400)
    expect((await call('POST', `/client/support-tickets/${id}/rate`, 'client', { rating: 4, note: 'Cepat' })).status).toBe(200)
    expect((await call('POST', `/client/support-tickets/${id}/reopen`, 'client', {})).status).toBe(400)
    expect((await call('POST', `/client/support-tickets/${id}/reopen`, 'client', { reason: 'Bus pengganti juga terlambat' })).status).toBe(200)
    expect(await mine(id)).toMatchObject({ status: 'reopened', reopenCount: 1, resolutionRating: 4 })
    await t.db.query("update support_tickets set status = 'resolved' where id = $1", [id])
    expect((await call('POST', `/client/support-tickets/${id}/confirm`, 'client', {})).status).toBe(200)
    expect((await mine(id)).status).toBe('closed')
  })
})
