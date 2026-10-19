import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S12c-5: comments & attachment names on client-facing records, and client change-request drafts. Client USR-021 (PTY-005). */

let t: TestApp
const c: Record<string, string> = {}
let n = 0
beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 60_000)
afterAll(() => t.cleanup())

const call = (method: string, path: string, who: string, body?: unknown, key = true) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: key ? { 'idempotency-key': `collab-${++n}-${Date.now()}` } : {} })
const notes = async (userId: string) => Number((await t.db.query<{ n: string }>('select count(*)::text as n from notifications where user_id = $1', [userId]))[0]!.n)
const owner = async (projectId: string) => (await t.db.query<{ owner_user_id: string }>('select owner_user_id from projects where id = $1', [projectId]))[0]!.owner_user_id
const clientCr = async () => (await call('POST', '/client/projects/PRJ-201/change-requests', 'client', { changeType: 'change-hotel', beforeSummary: 'Hotel A', afterSummary: 'Hotel B' })).json.data.id as string
const foreignProject = async () => (await t.db.query<{ id: string }>("select id from projects where party_id <> 'PTY-005' order by id limit 1"))[0]!.id

describe('comments', () => {
  test('client and staff talk on a change request; each side is told; the client never sees staff ids', async () => {
    const cr = await clientCr()
    const ownerId = await owner('PRJ-201')
    const before = await notes(ownerId)
    const posted = await call('POST', '/client/comments', 'client', { entityType: 'change-request', entityId: cr, body: 'Mohon kamar twin' })
    expect(posted.status, JSON.stringify(posted.json)).toBe(201)
    expect(await notes(ownerId)).toBe(before + 1)

    const clientBefore = await notes('USR-021')
    const staff = await call('POST', '/comments', 'admin', { entityType: 'change-request', entityId: cr, body: 'Kami cek ketersediaan' })
    expect(staff.status).toBe(201)
    expect(staff.json.data.map((x: { body: string }) => x.body)).toEqual(['Mohon kamar twin', 'Kami cek ketersediaan'])
    expect(await notes('USR-021')).toBe(clientBefore + 1)

    const seen = (await call('GET', `/client/comments?entityType=change-request&entityId=${cr}`, 'client', undefined, false)).json.data
    expect(seen[1]).toMatchObject({ body: 'Kami cek ketersediaan', fromClient: false, authorId: null })
    expect(seen[1].authorName).toBeTruthy()
    expect(seen[0].authorId).toBe('USR-021')
  })

  test('itinerary comments are per project; another party’s records are 404; empty body 400; unknown type 400', async () => {
    expect((await call('POST', '/client/comments', 'client', { entityType: 'itinerary', entityId: 'PRJ-202', body: 'Jam makan siang?' })).status).toBe(201)
    expect((await call('GET', '/comments?entityType=itinerary&entityId=PRJ-202', 'admin', undefined, false)).json.data.at(-1).body).toBe('Jam makan siang?')
    const foreign = await foreignProject()
    expect((await call('POST', '/client/comments', 'client', { entityType: 'itinerary', entityId: foreign, body: 'x' })).status).toBe(404)
    expect((await call('GET', `/client/comments?entityType=itinerary&entityId=${foreign}`, 'client', undefined, false)).status).toBe(404)
    expect((await call('POST', '/client/comments', 'client', { entityType: 'itinerary', entityId: 'PRJ-202', body: '  ' })).status).toBe(400)
    expect((await call('POST', '/client/comments', 'client', { entityType: 'invoice', entityId: 'PRJ-202', body: 'x' })).status).toBe(400)
  })

  test('a quotation is reachable by the client only once sent; an internal document never', async () => {
    const [q] = await t.db.query<{ id: string; lead_id: string; sent: string | null }>('select id, lead_id, sent_to_client_on::text as sent from quotations order by id limit 1')
    await t.db.query("update leads set party_id = 'PTY-005' where id = $1", [q!.lead_id])
    await t.db.query('update quotations set sent_to_client_on = null where id = $1', [q!.id])
    expect((await call('POST', '/client/comments', 'client', { entityType: 'quotation', entityId: q!.id, body: 'Harga?' })).status).toBe(404)
    await t.db.query('update quotations set sent_to_client_on = current_date where id = $1', [q!.id])
    expect((await call('POST', '/client/comments', 'client', { entityType: 'quotation', entityId: q!.id, body: 'Harga?' })).status).toBe(201)
    const [doc] = await t.db.query<{ id: string }>("select id from documents where access_level = 'internal' and project_id in (select id from projects where party_id = 'PTY-005') limit 1")
    if (doc) expect((await call('GET', `/client/comments?entityType=document&entityId=${doc.id}`, 'client', undefined, false)).status).toBe(404)
  })

  test('portal roles stay out of the staff routes; a staff member without the module gets 403; a client stays out of others’', async () => {
    const cr = await clientCr()
    expect((await call('GET', `/comments?entityType=change-request&entityId=${cr}`, 'client', undefined, false)).status).toBe(403)
    expect((await call('GET', `/comments?entityType=change-request&entityId=${cr}`, 'vendor', undefined, false)).status).toBe(403)
    expect((await call('GET', `/client/comments?entityType=change-request&entityId=${cr}`, 'admin', undefined, false)).status).toBe(403)
  })
})

describe('attachments', () => {
  test('names only, on change requests; replay is one row; not on itineraries', async () => {
    const cr = await clientCr()
    const res = await t.call('POST', '/api/v1/client/attachments', { cookie: c.client, body: { entityType: 'change-request', entityId: cr, fileName: 'kamar.pdf' }, headers: { 'idempotency-key': `att-${cr}` } })
    expect(res.status).toBe(201)
    await t.call('POST', '/api/v1/client/attachments', { cookie: c.client, body: { entityType: 'change-request', entityId: cr, fileName: 'kamar.pdf' }, headers: { 'idempotency-key': `att-${cr}` } })
    const staff = (await call('GET', `/attachments?entityType=change-request&entityId=${cr}`, 'admin', undefined, false)).json.data
    expect(staff.map((a: { fileName: string }) => a.fileName)).toEqual(['kamar.pdf'])
    expect((await call('POST', '/client/attachments', 'client', { entityType: 'itinerary', entityId: 'PRJ-201', fileName: 'x.pdf' })).status).toBe(422)
    expect((await call('POST', '/client/attachments', 'client', { entityType: 'change-request', entityId: cr, fileName: ' ' })).status).toBe(400)
  })
})

describe('change-request drafts', () => {
  test('create, edit, list own only, submit → a change request (owner told), draft gone', async () => {
    const created = await call('POST', '/client/change-request-drafts', 'client', { projectId: 'PRJ-201', changeType: 'change-date', beforeSummary: '12 Okt' }, false)
    expect(created.status, JSON.stringify(created.json)).toBe(201)
    const id = created.json.data.id as string
    expect((await call('PATCH', `/client/change-request-drafts/${id}`, 'client', { afterSummary: '14 Okt' }, false)).json.data).toMatchObject({ beforeSummary: '12 Okt', afterSummary: '14 Okt' })
    expect((await call('GET', '/client/change-request-drafts', 'client', undefined, false)).json.data.some((d: { id: string }) => d.id === id)).toBe(true)
    const ownerId = await owner('PRJ-201')
    const before = await notes(ownerId)
    const submitted = await call('POST', `/client/change-request-drafts/${id}/submit`, 'client')
    expect(submitted.status, JSON.stringify(submitted.json)).toBe(201)
    expect(submitted.json.data).toMatchObject({ source: 'client', beforeSummary: '12 Okt', afterSummary: '14 Okt' })
    expect(await notes(ownerId)).toBe(before + 1)
    expect((await call('GET', '/client/change-request-drafts', 'client', undefined, false)).json.data.some((d: { id: string }) => d.id === id)).toBe(false)
  })

  test('an incomplete draft cannot be submitted (and stays); another party’s project 404; bad type 400; delete', async () => {
    const id = (await call('POST', '/client/change-request-drafts', 'client', { projectId: 'PRJ-201', beforeSummary: 'A' }, false)).json.data.id as string
    expect((await call('POST', `/client/change-request-drafts/${id}/submit`, 'client')).status).toBe(400)
    expect((await call('GET', '/client/change-request-drafts', 'client', undefined, false)).json.data.some((d: { id: string }) => d.id === id)).toBe(true)
    expect((await call('POST', '/client/change-request-drafts', 'client', { projectId: await foreignProject() }, false)).status).toBe(404)
    expect((await call('POST', '/client/change-request-drafts', 'client', { projectId: 'PRJ-201', changeType: 'teleport' }, false)).status).toBe(400)
    expect((await call('DELETE', `/client/change-request-drafts/${id}`, 'client', undefined, false)).status).toBe(200)
    expect((await call('DELETE', `/client/change-request-drafts/${id}`, 'client', undefined, false)).status).toBe(404)
    expect((await call('GET', '/client/change-request-drafts', 'admin', undefined, false)).status).toBe(403)
  })
})
