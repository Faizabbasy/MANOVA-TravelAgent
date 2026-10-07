import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO_CORE } from '../src/db/seed-demo'
import { DEMO, makeTestApp, type TestApp } from './helpers'

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

const FIRST_PTY = `PTY-${String(Math.max(...DEMO_CORE.parties.map(p => Number(p.id.slice(4)))) + 1).padStart(3, '0')}`
let n = 0
const key = () => `party-key-${++n}-abcdef`
const post = (who: string, body: unknown, k: string | null = key()) =>
  t.call('POST', '/api/v1/parties', { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

describe('POST /parties', () => {
  test('admin creates a prospect company with a server id', async () => {
    const res = await post('admin', { name: 'PT Uji Pelanggan', partyType: 'company', industry: 'Energi', city: 'Bandung', npwp: '01.234.567.8-901.000', accountOwnerUserId: 'USR-001' })
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ id: FIRST_PTY, name: 'PT Uji Pelanggan', lifecycleStatus: 'prospect', partyType: 'company', city: 'Bandung', accountOwnerUserId: 'USR-001', provenance: 'manual', creditLimitMinor: null })
    const [a] = await t.db.query<{ n: string }>("select count(*) as n from audit_events where action = 'party.created' and entity_id = $1", [FIRST_PTY])
    expect(a!.n).toBe('1')
  })

  test('same key = one customer; key required', async () => {
    const k = key()
    const a = await post('admin', { name: 'PT Sekali', partyType: 'company' }, k)
    const b = await post('admin', { name: 'PT Sekali', partyType: 'company' }, k)
    expect(b.json.data.id).toBe(a.json.data.id)
    expect((await post('admin', { name: 'PT Tanpa Kunci', partyType: 'company' }, null)).status).toBe(400)
  })

  test('validation names each bad field', async () => {
    const res = await post('admin', { name: ' ', partyType: 'robot', email: 'bukan-email', npwp: '123', companyType: 'pabrik', accountOwnerUserId: 'USR-999', creditLimitMinor: '5' })
    expect(res.status).toBe(400)
    expect(Object.keys(res.json.error.fieldErrors).sort()).toEqual(['accountOwnerUserId', 'companyType', 'creditLimitMinor', 'email', 'name', 'npwp', 'partyType'])
  })

  test('individual customers can be clients from the start; finance 403; anonymous 401', async () => {
    const res = await post('admin', { name: 'Budi Wisatawan', partyType: 'individual', lifecycleStatus: 'client' })
    expect(res.json.data).toMatchObject({ partyType: 'individual', lifecycleStatus: 'client' })
    expect((await post('finance', { name: 'X', partyType: 'company' })).status).toBe(403)
    expect((await t.call('POST', '/api/v1/parties', { body: { name: 'X', partyType: 'company' }, headers: { 'idempotency-key': key() } })).status).toBe(401)
  })
})

describe('PATCH /parties/:id', () => {
  test('admin edits the profile; audit keeps before/after', async () => {
    const res = await t.call('PATCH', '/api/v1/parties/PTY-002', { cookie: c.admin, body: { city: 'Malang', billingName: 'PT Alam Raya Group Tbk', poRequired: true } })
    expect(res.status).toBe(200)
    expect(res.json.data).toMatchObject({ city: 'Malang', billingName: 'PT Alam Raya Group Tbk', poRequired: true })
    const [audit] = await t.db.query<{ before: Record<string, unknown>; after: Record<string, unknown> }>(
      "select before, after from audit_events where action = 'party.updated' and entity_id = 'PTY-002' order by id desc limit 1"
    )
    expect(audit!.after).toMatchObject({ city: 'Malang', poRequired: true })
  })

  test('credit limit, lifecycle and id cannot be patched; unknown 404; finance 403', async () => {
    for (const body of [{ creditLimitMinor: '1' }, { lifecycleStatus: 'client' }, { id: 'PTY-X' }]) {
      expect((await t.call('PATCH', '/api/v1/parties/PTY-002', { cookie: c.admin, body })).status, JSON.stringify(body)).toBe(400)
    }
    expect((await t.call('PATCH', '/api/v1/parties/PTY-999', { cookie: c.admin, body: { city: 'X' } })).status).toBe(404)
    expect((await t.call('PATCH', '/api/v1/parties/PTY-002', { cookie: c.finance, body: { city: 'X' } })).status).toBe(403)
  })
})

describe('PUT /parties/:id/credit-limit', () => {
  test('finance sets and clears it with a reason; admin 403; reason required', async () => {
    const set = await t.call('PUT', '/api/v1/parties/PTY-002/credit-limit', { cookie: c.finance, body: { creditLimitMinor: '900000000', reason: 'Review tahunan' } })
    expect(set.status).toBe(200)
    expect(set.json.data.creditLimitMinor).toBe('900000000')
    const cleared = await t.call('PUT', '/api/v1/parties/PTY-002/credit-limit', { cookie: c.superAdmin, body: { creditLimitMinor: null, reason: 'Tanpa batas' } })
    expect(cleared.json.data.creditLimitMinor).toBeNull()
    expect((await t.call('PUT', '/api/v1/parties/PTY-002/credit-limit', { cookie: c.finance, body: { creditLimitMinor: '1' } })).status).toBe(400)
    expect((await t.call('PUT', '/api/v1/parties/PTY-002/credit-limit', { cookie: c.admin, body: { creditLimitMinor: '1', reason: 'x' } })).status).toBe(403)
    const [audit] = await t.db.query<{ reason: string }>("select reason from audit_events where action = 'party.credit_limit_changed' and entity_id = 'PTY-002' order by id limit 1")
    expect(audit!.reason).toBe('Review tahunan')
  })

  test('GET shows the profile; client sees itself without credit limit', async () => {
    const res = await t.call('GET', '/api/v1/parties/PTY-005', { cookie: c.client })
    expect(res.status).toBe(200)
    expect(res.json.data.creditLimitMinor ?? null).toBeNull()
  })
})

describe('contacts and activities', () => {
  test('admin adds a contact; list shows it; client of another company gets 404', async () => {
    const res = await t.call('POST', '/api/v1/parties/PTY-002/contacts', { cookie: c.admin, body: { name: 'Rina', title: 'Travel Manager', email: 'rina@alam.example' } })
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ id: expect.stringMatching(/^CP-\d+$/), partyId: 'PTY-002', name: 'Rina', title: 'Travel Manager' })
    const list = await t.call('GET', '/api/v1/parties/PTY-002/contacts', { cookie: c.finance })
    expect(list.json.data.map((x: { name: string }) => x.name)).toContain('Rina')
    expect((await t.call('GET', '/api/v1/parties/PTY-002/contacts', { cookie: c.client })).status).toBe(404)
    expect((await t.call('POST', '/api/v1/parties/PTY-002/contacts', { cookie: c.admin, body: { name: '', title: '' } })).status).toBe(400)
    expect((await t.call('POST', '/api/v1/parties/PTY-002/contacts', { cookie: c.finance, body: { name: 'X', title: 'Y' } })).status).toBe(403)
    const all = await t.call('GET', '/api/v1/party-contacts', { cookie: c.finance })
    expect(all.json.data.length).toBeGreaterThan(1)
    expect((await t.call('GET', '/api/v1/party-contacts', { cookie: c.client })).status).toBe(403)
  })

  test('admin and finance log activities (owner = caller); list by lead', async () => {
    const a = await t.call('POST', '/api/v1/parties/PTY-002/activities', { cookie: c.admin, body: { type: 'call', message: 'Konfirmasi jadwal', leadId: 'LED-900' } })
    expect(a.status).toBe(201)
    expect(a.json.data).toMatchObject({ id: expect.stringMatching(/^PACT-\d+$/), type: 'call', leadId: 'LED-900', activityDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
    const f = await t.call('POST', '/api/v1/parties/PTY-002/activities', { cookie: c.finance, body: { type: 'note', message: 'Tagihan dikirim' } })
    expect(f.status).toBe(201)
    expect(f.json.data.ownerUserId).not.toBe(a.json.data.ownerUserId)
    const byLead = await t.call('GET', '/api/v1/party-activities?leadId=LED-900', { cookie: c.finance })
    expect(byLead.json.data.map((x: { id: string }) => x.id)).toEqual([a.json.data.id])
    expect((await t.call('POST', '/api/v1/parties/PTY-002/activities', { cookie: c.admin, body: { type: 'gossip', message: 'x' } })).status).toBe(400)
  })
})

describe('won lead promotes the customer', () => {
  test('a project created from a lead turns a prospect into a client; finance can bill it', async () => {
    const party = await post('admin', { name: 'PT Prospek Baru', partyType: 'company' })
    const id = party.json.data.id as string
    const project = await t.call('POST', '/api/v1/projects', {
      cookie: c.admin, headers: { 'idempotency-key': key() },
      body: { name: 'Trip Prospek', partyId: id, leadId: 'LED-003', destination: 'Bali', travelStartDate: '2027-05-01', travelEndDate: '2027-05-04', serviceScope: ['hotel'], travelerCount: 5, contractValueMinor: '100000000' }
    })
    expect(project.status).toBe(201)
    expect((await t.call('GET', `/api/v1/parties/${id}`, { cookie: c.admin })).json.data.lifecycleStatus).toBe('client')
    const [audit] = await t.db.query<{ n: string }>("select count(*) as n from audit_events where action = 'party.promoted_to_client' and entity_id = $1", [id])
    expect(audit!.n).toBe('1')
    const draft = await t.call('POST', '/api/v1/finance/customer-invoices', { cookie: c.finance, body: { projectId: project.json.data.id, invoiceType: 'dp', lines: [{ description: 'DP', amountMinor: '30000000' }], dueDate: '2027-04-01' } })
    expect(draft.status).toBe(201)
  })
})
