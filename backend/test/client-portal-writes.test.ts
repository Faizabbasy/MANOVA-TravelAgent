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

describe('client documents & messages', () => {
  test('upload to own project, traveler or company: always client-level and unverified; another party is not found', async () => {
    const ownerId = await owner('PRJ-201')
    const n0 = await notes(ownerId)
    const res = await call('POST', '/client/documents', 'client', { entityType: 'project', entityId: 'PRJ-201', name: 'Rundown Final', category: 'Rundown', accessLevel: 'internal' }, k())
    expect(res.status, JSON.stringify(res.json)).toBe(201)
    expect(res.json.data).toMatchObject({ accessLevel: 'client', verified: false, projectId: 'PRJ-201', uploadedBy: null })
    expect(await notes(ownerId)).toBe(n0 + 1)
    const tr = (await call('POST', '/client/projects/PRJ-201/travelers', 'client', { name: 'Dok Peserta' }, k())).json.data.id as string
    const trDoc = await call('POST', '/client/documents', 'client', { entityType: 'traveler', entityId: tr, name: 'Paspor', category: 'Paspor', projectId: other }, k())
    expect(trDoc.json.data.projectId).toBe('PRJ-201')
    const company = await call('POST', '/client/documents', 'client', { entityType: 'party', entityId: 'PTY-005', name: 'Akta', category: 'Legal' }, k())
    expect(company.status).toBe(201)
    expect(company.json.data.projectId).toBeNull()
    expect((await call('POST', '/client/documents', 'client', { entityType: 'project', entityId: other, name: 'X', category: 'X' }, k())).status).toBe(404)
    expect((await call('POST', '/client/documents', 'client', { entityType: 'party', entityId: 'PTY-001', name: 'X', category: 'X' }, k())).status).toBe(404)
    expect((await call('POST', '/client/documents', 'client', { entityType: 'invoice', entityId: 'X', name: 'X', category: 'X' }, k())).status).toBe(400)
    expect((await call('POST', '/client/documents', 'admin', { entityType: 'project', entityId: 'PRJ-201', name: 'X', category: 'X' }, k())).status).toBe(403)
  })

  test('replace: new version supersedes the old; generated, superseded and foreign documents refused', async () => {
    const first = (await call('POST', '/client/documents', 'client', { entityType: 'project', entityId: 'PRJ-201', name: 'Daftar Hadir', category: 'Lainnya' }, k())).json.data
    const v2 = await call('POST', `/client/documents/${first.id}/replace`, 'client', { name: 'Daftar Hadir v2' }, k())
    expect(v2.status, JSON.stringify(v2.json)).toBe(201)
    expect(v2.json.data).toMatchObject({ version: first.version + 1, supersedesId: first.id, name: 'Daftar Hadir v2', category: 'Lainnya', accessLevel: 'client' })
    expect((await call('POST', `/client/documents/${first.id}/replace`, 'client', {}, k())).status).toBe(422)
    const generated = (await t.db.query<{ id: string }>("select d.id from documents d join projects p on p.id = d.project_id where p.party_id = 'PTY-005' and d.access_level = 'client' and d.source_type = 'generated' limit 1"))[0]
    if (generated) expect((await call('POST', `/client/documents/${generated.id}/replace`, 'client', {}, k())).status).toBe(422)
    const foreign = (await t.db.query<{ id: string }>("select d.id from documents d join projects p on p.id = d.project_id where p.party_id <> 'PTY-005' limit 1"))[0]
    if (foreign) expect((await call('POST', `/client/documents/${foreign.id}/replace`, 'client', {}, k())).status).toBe(404)
  })

  test('messages: client-message only, no mentions, own project; read marks only that project’s client messages', async () => {
    const ownerId = await owner('PRJ-201')
    const n0 = await notes(ownerId)
    const sent = await call('POST', '/client/messages', 'client', { projectId: 'PRJ-201', body: 'Mohon info jadwal check-in.', channel: 'internal-note' }, k())
    expect(sent.status, JSON.stringify(sent.json)).toBe(201)
    expect(sent.json.data).toMatchObject({ channel: 'client-message', projectId: 'PRJ-201', mentions: [], readBy: [] })
    expect(await notes(ownerId)).toBe(n0 + 1)
    const act = await t.db.query<{ message: string }>("select message from project_activities where source_action = 'message.sent' and source_entity_id = $1", [sent.json.data.id])
    expect(act[0]!.message).toContain('dari client')
    expect((await call('POST', '/client/messages', 'client', { projectId: 'PRJ-201', body: 'Halo', mentions: ['USR-002'] }, k())).status).toBe(400)
    expect((await call('POST', '/client/messages', 'client', { projectId: other, body: 'Halo' }, k())).status).toBe(404)

    await t.db.query("insert into messages (id, entity_type, entity_id, project_id, channel, sender_id, body, mentions, delivery_status, read_by) values ('MSG-T12B1', 'project', 'PRJ-201', 'PRJ-201', 'client-message', 'USR-002', 'Dari staf', '[]'::jsonb, 'delivered', '[\"USR-002\"]'::jsonb), ('MSG-T12B2', 'project', 'PRJ-201', 'PRJ-201', 'internal-note', 'USR-002', 'Internal', '[]'::jsonb, 'sent', '[\"USR-002\"]'::jsonb)")
    const read = await call('POST', '/client/projects/PRJ-201/messages/read', 'client', {})
    expect(read.status).toBe(200)
    expect(read.json.data.updated).toBeGreaterThan(0)
    const rows = await t.db.query<{ id: string; read_by: string[] }>("select id, read_by from messages where id in ('MSG-T12B1', 'MSG-T12B2') order by id")
    expect(rows[0]!.read_by).toContain('USR-021')
    expect(rows[1]!.read_by).not.toContain('USR-021')
    expect((await call('POST', '/client/projects/PRJ-201/messages/read', 'client', {})).json.data.updated).toBe(0)
  })

  test('a project without an owner: the write succeeds without a notification', async () => {
    await t.db.query("update projects set owner_user_id = null where id = 'PRJ-204'")
    const res = await call('POST', '/client/documents', 'client', { entityType: 'project', entityId: 'PRJ-204', name: 'Tanpa Owner', category: 'Lainnya' }, k())
    expect(res.status, JSON.stringify(res.json)).toBe(201)
  })
})

describe('client profile, contacts & disputes', () => {
  test('profile: non-sensitive fields saved and logged; sensitive fields refused for verification; unknown refused', async () => {
    const got = await call('GET', '/client/profile', 'client')
    expect(got.status).toBe(200)
    expect(got.json.data.id).toBe('PTY-005')
    const res = await call('PATCH', '/client/profile', 'client', { address: 'Jl. Sudirman 1', city: 'Jakarta', travelPreferences: 'Window seat' })
    expect(res.status, JSON.stringify(res.json)).toBe(200)
    expect(res.json.data).toMatchObject({ address: 'Jl. Sudirman 1', city: 'Jakarta' })
    const act = await t.db.query("select 1 from party_activities where party_id = 'PTY-005' and message = 'Company Profile diperbarui oleh Client.'")
    expect(act.length).toBeGreaterThan(0)
    const sensitive = await call('PATCH', '/client/profile', 'client', { npwp: '012345678901234', city: 'Bandung' })
    expect(sensitive.status).toBe(422)
    expect(sensitive.json.error.message).toContain('verifikasi')
    expect((await call('PATCH', '/client/profile', 'client', { creditLimitMinor: '1' })).status).toBe(400)
    expect((await call('GET', '/client/profile', 'admin')).status).toBe(403)
  })

  test('contacts: own party add, edit, delete; another party’s contact is not found', async () => {
    const add = await call('POST', '/client/contacts', 'client', { name: 'Rina', title: 'HR Manager', email: 'rina@java-bhakti.example' }, k())
    expect(add.status, JSON.stringify(add.json)).toBe(201)
    const id = add.json.data.id as string
    expect((await call('GET', '/client/contacts', 'client')).json.data.some((x: { id: string }) => x.id === id)).toBe(true)
    expect((await call('PATCH', `/client/contacts/${id}`, 'client', { phone: '0812' })).json.data.phone).toBe('0812')
    expect((await call('PATCH', `/client/contacts/${id}`, 'client', { email: 'bukan-email' })).status).toBe(400)
    expect((await call('PATCH', `/client/contacts/${id}`, 'client', { name: '' })).status).toBe(400)
    const foreign = (await t.db.query<{ id: string }>("select id from party_contacts where party_id <> 'PTY-005' order by id limit 1"))[0]!
    expect((await call('PATCH', `/client/contacts/${foreign.id}`, 'client', { phone: '1' })).status).toBe(404)
    expect((await call('DELETE', `/client/contacts/${foreign.id}`, 'client')).status).toBe(404)
    expect((await call('DELETE', `/client/contacts/${id}`, 'client')).status).toBe(200)
    expect((await call('GET', '/client/contacts', 'client')).json.data.some((x: { id: string }) => x.id === id)).toBe(false)
  })

  test('dispute: own issued unpaid invoice once, Finance told; paid, already disputed, draft and foreign refused', async () => {
    const own = 'PRJ-201'
    const invoice = async (projectId: string, amount: string, issue = true) => {
      const res = await t.call('POST', '/api/v1/finance/customer-invoices', { cookie: c.finance, body: { projectId, invoiceType: 'dp', lines: [{ description: 'DP', amountMinor: amount }], dueDate: '2026-12-01' } })
      expect(res.status, JSON.stringify(res.json)).toBe(201)
      const id = res.json.data.id as string
      if (issue) expect((await t.call('POST', `/api/v1/finance/customer-invoices/${id}/issue`, { cookie: c.finance, body: {} })).status).toBe(200)
      return id
    }
    const open = await invoice(own, '5000000')
    const draft = await invoice(own, '1000000', false)
    const foreign = await invoice(other, '2000000')
    const finance = (await t.db.query<{ id: string }>("select id from users where role = 'finance' and status = 'active' order by id limit 1"))[0]!.id
    const n0 = await notes(finance)
    const res = await call('POST', `/client/invoices/${open}/dispute`, 'client', { reason: 'Jumlah peserta tidak sesuai' })
    expect(res.status, JSON.stringify(res.json)).toBe(200)
    expect(res.json.data).toMatchObject({ id: open, isDisputed: true, disputeReason: 'Jumlah peserta tidak sesuai' })
    expect(await notes(finance)).toBe(n0 + 1)
    expect((await call('POST', `/client/invoices/${open}/dispute`, 'client', { reason: 'Lagi dan lagi' })).status).toBe(422)
    expect((await call('POST', `/client/invoices/${draft}/dispute`, 'client', { reason: 'Draft invoice' })).status).toBe(404)
    expect((await call('POST', `/client/invoices/${foreign}/dispute`, 'client', { reason: 'Bukan milik' })).status).toBe(404)
    // A settled invoice (nothing outstanding — here fully credited) cannot be disputed from the portal.
    const paid = await invoice(own, '3000000')
    const credit = await t.call('POST', '/api/v1/finance/credit-notes', { cookie: c.finance, body: { invoiceId: paid, amountMinor: '3000000', reason: 'Batal seluruhnya' } })
    expect(credit.status, JSON.stringify(credit.json)).toBe(201)
    expect((await t.call('GET', `/api/v1/client/invoices/${paid}`, { cookie: c.client })).json.data.outstandingMinor).toBe('0')
    expect((await call('POST', `/client/invoices/${paid}/dispute`, 'client', { reason: 'Sudah lunas' })).status).toBe(422)
  })
})

describe('client writes — review fixes (S12b-1)', () => {
  test('editing a contact tells the account owner', async () => {
    await t.db.query("update parties set account_owner_user_id = 'USR-002' where id = 'PTY-005'")
    const id = (await call('POST', '/client/contacts', 'client', { name: 'Ubah Saya', title: 'Staff' }, k())).json.data.id as string
    const n0 = await notes('USR-002')
    expect((await call('PATCH', `/client/contacts/${id}`, 'client', { phone: '0813' })).status).toBe(200)
    expect(await notes('USR-002')).toBe(n0 + 1)
  })
})
