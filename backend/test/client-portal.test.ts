import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * S12a: the client portal reads its own data from the server. A client (USR-021, party PTY-005) sees only the
 * projects of its party, and never internal data: hidden itinerary items, vendor costs, incident internals,
 * internal documents or messages. Vendors stay refused on these routes (S12d); internal roles see everything.
 */

let t: TestApp
const c: Record<string, string> = {}
const OWN = "(select id from projects where party_id = 'PTY-005')"
let ownProjects: string[] = []

beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
  ownProjects = (await t.db.query<{ id: string }>(`select id from projects where id in ${OWN}`)).map(r => r.id)
  // The seed has no rows of these kinds for PTY-005: move one of each into the client's project so every rule is exercised.
  const own = ownProjects[0]!
  const first = (table: string, where: string) => `(select id from ${table} where ${where} order by id limit 1)`
  await t.db.query(`update traveler_groups set project_id = $1 where id = ${first('traveler_groups', `project_id not in ${OWN}`)}`, [own])
  await t.db.query(`update room_assignments set project_id = $1 where id = ${first('room_assignments', `project_id not in ${OWN}`)}`, [own])
  await t.db.query(`update itinerary_items set visible_to_client = false where id = ${first('itinerary_items', `project_id in ${OWN}`)}`)
  await t.db.query(`update itinerary_items set vendor_id = 'VND-001', vendor_amount_minor = 1500000 where id in (select id from itinerary_items where project_id in ${OWN} and visible_to_client)`)
  await t.db.query(`update incidents set project_id = $1, booking_type = null, booking_id = null where id = ${first('incidents', `project_id not in ${OWN}`)}`, [own])
  await t.db.query(`update booking_cancellations set project_id = $1 where id = ${first('booking_cancellations', `project_id not in ${OWN}`)}`, [own])
  await t.db.query(`update documents set project_id = $1 where id = ${first('documents', "access_level <> 'client'")}`, [own])
  await t.db.query(`update messages set project_id = $1 where id = ${first('messages', "channel <> 'client-message'")}`, [own])
}, 60_000)
afterAll(() => t.cleanup())

const get = (path: string, who: string) => t.call('GET', `/api/v1${path}`, { cookie: c[who] })
const count = async (sql: string) => Number((await t.db.query<{ n: string }>(`select count(*)::text as n from ${sql}`))[0]!.n)
type Row = { id: string; projectId: string | null }

describe('client portal reads (S12a)', () => {
  test('participants: only the client party’s travelers, groups and rooms; another project’s traveler is 404', async () => {
    for (const [path, table] of [['/travelers', 'travelers'], ['/traveler-groups', 'traveler_groups'], ['/room-assignments', 'room_assignments']] as const) {
      const res = await get(path, 'client')
      expect(res.status, path).toBe(200)
      const rows = res.json.data as Row[]
      expect(rows.every(r => ownProjects.includes(r.projectId!)), path).toBe(true)
      expect(rows.length, path).toBe(await count(`${table} where project_id in ${OWN}`))
      expect(rows.length, path).toBeGreaterThan(0)
    }
    const [other] = await t.db.query<{ id: string }>(`select id from travelers where project_id not in ${OWN} limit 1`)
    expect((await get(`/travelers/${other!.id}`, 'client')).status).toBe(404)
    const [mine] = await t.db.query<{ id: string }>(`select id from travelers where project_id in ${OWN} limit 1`)
    expect((await get(`/travelers/${mine!.id}`, 'client')).status).toBe(200)
  })

  test('itinerary: only items visible to the client, without the vendor or its cost', async () => {
    const rows = (await get('/itinerary-items', 'client')).json.data as (Row & { visibleToClient: boolean; vendorId: string | null; vendorAmountMinor: string | null })[]
    expect(rows.length).toBe(await count(`itinerary_items where project_id in ${OWN} and visible_to_client`))
    expect(rows.every(r => ownProjects.includes(r.projectId!) && r.visibleToClient && r.vendorId === null && r.vendorAmountMinor === null)).toBe(true)
    const internal = (await get('/itinerary-items', 'admin')).json.data as { vendorAmountMinor: string | null }[]
    expect(internal.some(r => r.vendorAmountMinor === '1500000')).toBe(true) // internal roles still get it
  })

  test('change requests, incidents and cancellations: own projects only; incidents without the internal log or escalation', async () => {
    for (const [path, table] of [['/change-requests', 'change_requests'], ['/incidents', 'incidents'], ['/booking-cancellations', 'booking_cancellations']] as const) {
      const rows = (await get(path, 'client')).json.data as Row[]
      expect(rows.length, path).toBe(await count(`${table} where project_id in ${OWN}`))
      expect(rows.length, path).toBeGreaterThan(0)
      expect(rows.every(r => ownProjects.includes(r.projectId!)), path).toBe(true)
    }
    const incidents = (await get('/incidents', 'client')).json.data as { communicationLog: unknown[]; escalatedTo: string | null }[]
    expect(incidents.every(i => i.communicationLog.length === 0 && i.escalatedTo === null)).toBe(true)
  })

  test('documents and messages: only client-visible ones of the client party', async () => {
    const docs = (await get('/documents', 'client')).json.data as (Row & { accessLevel: string })[]
    expect(docs.length).toBe(await count(`documents where access_level = 'client' and (project_id in ${OWN} or (entity_type = 'party' and entity_id = 'PTY-005'))`))
    expect(docs.every(d => d.accessLevel === 'client')).toBe(true)
    const msgs = (await get('/messages', 'client')).json.data as (Row & { channel: string })[]
    expect(msgs.length).toBe(await count(`messages where channel = 'client-message' and project_id in ${OWN}`))
    expect(msgs.every(m => m.channel === 'client-message' && ownProjects.includes(m.projectId!))).toBe(true)
    expect(msgs.length).toBeGreaterThan(0)
  })

  test('a projectId filter cannot reach another party’s project', async () => {
    const [other] = await t.db.query<{ id: string }>(`select project_id as id from travelers where project_id not in ${OWN} limit 1`)
    const res = await get(`/travelers?projectId=${other!.id}`, 'client')
    expect(res.status).toBe(200)
    expect(res.json.data).toEqual([])
  })

  test('vendors are still refused; internal roles still see every party', async () => {
    for (const path of ['/travelers', '/itinerary-items', '/change-requests', '/incidents', '/documents', '/messages']) {
      expect((await get(path, 'vendor')).status, path).toBe(403)
    }
    expect(((await get('/travelers', 'admin')).json.data as Row[]).length).toBe(await count('travelers'))
  })
})
