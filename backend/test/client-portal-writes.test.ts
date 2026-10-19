import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * S12b-1: client portal writes through /client/* — participants & rooms, documents & messages, profile & contacts,
 * invoice disputes. Client USR-021, party PTY-005 (PRJ-201 planning = open, PRJ-202 ongoing-trip = locked).
 */

let t: TestApp
const c: Record<string, string> = {}
let other = ''
let n = 0
beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
  other = (await t.db.query<{ id: string }>("select id from projects where party_id <> 'PTY-005' and status not in ('ongoing-trip', 'completed', 'cancelled') order by id limit 1"))[0]!.id
}, 60_000)
afterAll(() => t.cleanup())

const call = (method: string, path: string, who: string, body?: unknown, key?: string) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: key ? { 'idempotency-key': key } : {} })
const k = () => `k-${++n}-${Date.now()}`
const owner = async (projectId: string) => (await t.db.query<{ owner_user_id: string }>('select owner_user_id from projects where id = $1', [projectId]))[0]!.owner_user_id
const notes = async (userId: string) => Number((await t.db.query<{ n: string }>('select count(*)::text as n from notifications where user_id = $1', [userId]))[0]!.n)
const activities = async (projectId: string) => Number((await t.db.query<{ n: string }>('select count(*)::text as n from project_activities where project_id = $1', [projectId]))[0]!.n)

describe('client participants', () => {
  test('add, edit, cancel, replace and import on an open project; staff is told; staff-only fields refused', async () => {
    const ownerId = await owner('PRJ-201')
    const [n0, a0] = [await notes(ownerId), await activities('PRJ-201')]
    const key = k()
    const created = await call('POST', '/client/projects/PRJ-201/travelers', 'client', { name: 'Peserta Client', passportNumber: 'X1234567' }, key)
    expect(created.status, JSON.stringify(created.json)).toBe(201)
    const id = created.json.data.id as string
    expect(created.json.data.documentsVerifiedBy).toBeNull()
    // Same key again: the same traveler, no second notification.
    const replay = await call('POST', '/client/projects/PRJ-201/travelers', 'client', { name: 'Peserta Client', passportNumber: 'X1234567' }, key)
    expect(replay.json.data.id).toBe(id)
    expect(await notes(ownerId)).toBe(n0 + 1)
    expect(await activities('PRJ-201')).toBe(a0 + 1)

    expect((await call('PATCH', `/client/travelers/${id}`, 'client', { dietaryRestrictions: 'Vegetarian' })).json.data.dietaryRestrictions).toBe('Vegetarian')
    expect((await call('PATCH', `/client/travelers/${id}`, 'client', { isVip: true })).status).toBe(400)
    expect((await call('POST', `/client/projects/PRJ-201/travelers`, 'client', { name: 'VIP', isVip: true }, k())).status).toBe(400)

    const replaced = await call('POST', `/client/travelers/${id}/replace`, 'client', { name: 'Pengganti Client' })
    expect(replaced.status, JSON.stringify(replaced.json)).toBe(200)
    const newId = replaced.json.data.id as string
    expect(newId).not.toBe(id)
    expect((await call('POST', `/client/travelers/${newId}/cancel`, 'client', { reason: 'Tidak jadi berangkat' })).json.data.cancelled).toBe(true)
    expect((await call('POST', `/client/travelers/${newId}/cancel`, 'client', {})).status).toBe(400)

    const imported = await call('POST', '/client/projects/PRJ-201/travelers/import', 'client', { rows: [{ name: 'Impor Satu' }, { name: '' }] }, k())
    expect(imported.status).toBe(201)
    expect(imported.json.data.created.length).toBe(1)
    expect(imported.json.data.rejected.length).toBe(1)
    expect(await notes(ownerId)).toBeGreaterThan(n0 + 1)
  })

  test('locked project (ongoing-trip) refuses every participant write, import creates nothing', async () => {
    const before = Number((await t.db.query<{ n: string }>("select count(*)::text as n from travelers where project_id = 'PRJ-202'"))[0]!.n)
    const add = await call('POST', '/client/projects/PRJ-202/travelers', 'client', { name: 'Telat' }, k())
    expect(add.status).toBe(422)
    expect(add.json.error.message).toContain('change request')
    expect((await call('POST', '/client/projects/PRJ-202/travelers/import', 'client', { rows: [{ name: 'Telat Impor' }] }, k())).status).toBe(422)
    const after = Number((await t.db.query<{ n: string }>("select count(*)::text as n from travelers where project_id = 'PRJ-202'"))[0]!.n)
    expect(after).toBe(before)
    const locked = (await t.db.query<{ id: string }>("select id from travelers where project_id = 'PRJ-202' and not cancelled order by id limit 1"))[0]
    if (locked) expect((await call('PATCH', `/client/travelers/${locked.id}`, 'client', { specialRequest: 'x' })).status).toBe(422)
  })

  test('another party’s project or traveler is not found; other roles are refused', async () => {
    expect((await call('POST', `/client/projects/${other}/travelers`, 'client', { name: 'Bukan Milik' }, k())).status).toBe(404)
    const foreign = (await t.db.query<{ id: string }>('select id from travelers where project_id = $1 order by id limit 1', [other]))[0]
    if (foreign) expect((await call('PATCH', `/client/travelers/${foreign.id}`, 'client', { specialRequest: 'x' })).status).toBe(404)
    for (const who of ['admin', 'finance', 'vendor']) expect((await call('POST', '/client/projects/PRJ-201/travelers', who, { name: 'X' }, k())).status, who).toBe(403)
    expect((await t.call('POST', '/api/v1/client/projects/PRJ-201/travelers', { body: { name: 'X' }, headers: { 'idempotency-key': k() } })).status).toBe(401)
  })

  test('rooms: create with members and set members, only travelers of the project', async () => {
    const group = (await t.db.query<{ id: string }>("select id from traveler_groups where project_id = 'PRJ-201' order by id limit 1"))[0]
      ?? (await t.db.query<{ id: string }>("insert into traveler_groups (id, project_id, name, pax_count) values ('GRP-T12B', 'PRJ-201', 'Grup Client', 2) returning id"))[0]!
    const a = (await call('POST', '/client/projects/PRJ-201/travelers', 'client', { name: 'Kamar A' }, k())).json.data.id as string
    const b = (await call('POST', '/client/projects/PRJ-201/travelers', 'client', { name: 'Kamar B' }, k())).json.data.id as string
    const room = await call('POST', '/client/projects/PRJ-201/room-assignments', 'client', { groupId: group.id, roomLabel: 'Kamar 101', roomType: 'twin', travelerIds: [a] }, k())
    expect(room.status, JSON.stringify(room.json)).toBe(201)
    const set = await call('PUT', `/client/room-assignments/${room.json.data.id}/travelers`, 'client', { travelerIds: [a, b] })
    expect(set.json.data.travelerIds).toEqual([a, b])
    const foreign = (await t.db.query<{ id: string }>('select id from travelers where project_id = $1 order by id limit 1', [other]))[0]
    if (foreign) expect((await call('PUT', `/client/room-assignments/${room.json.data.id}/travelers`, 'client', { travelerIds: [foreign.id] })).status).toBe(400)
  })
})
