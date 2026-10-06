import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO_CORE } from '../src/db/seed-demo'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** First server ID continues after the highest fixture ID (PRJ-501/502 exist), never inside the fixture range. */
const FIRST_ID = `PRJ-${Math.max(...DEMO_CORE.projects.map(p => Number(p.id.slice(4)))) + 1}`

let t: TestApp
const c: Record<string, string> = {}

beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let keyN = 0
const key = () => `test-key-${++keyN}-abcdef`
const valid = (over: Record<string, unknown> = {}) => ({
  name: 'Uji Coba Tokyo', partyId: 'PTY-002', destination: 'Tokyo, Jepang',
  travelStartDate: '2027-03-10', travelEndDate: '2027-03-15', characteristic: 'normal',
  serviceScope: ['flight', 'hotel'], travelerCount: 12, contractValueMinor: '450000000', ...over
})
const post = (who: string, body: unknown, k: string | null = key()) =>
  t.call('POST', '/api/v1/projects', { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

describe('POST /projects', () => {
  test('admin creates a draft project with a server id after the fixtures', async () => {
    const res = await post('admin', valid())
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({
      id: FIRST_ID, name: 'Uji Coba Tokyo', partyId: 'PTY-002', status: 'draft', provenance: 'manual',
      characteristic: 'normal', serviceScope: ['flight', 'hotel'], travelerCount: 12, contractValueMinor: '450000000',
      ownerUserId: expect.any(String), isGroupTrip: false
    })
    expect(res.json.data.teamUserIds).toEqual([res.json.data.ownerUserId])
    const [audit] = await t.db.query<{ n: string }>("select count(*) as n from audit_events where action = 'project.created' and entity_id = $1", [FIRST_ID])
    expect(audit!.n).toBe('1')
  })

  test('the same idempotency key creates one project', async () => {
    const k = key()
    const a = await post('admin', valid({ name: 'Sekali Saja' }), k)
    const b = await post('admin', valid({ name: 'Sekali Saja' }), k)
    expect(b.status).toBe(201)
    expect(b.json.data.id).toBe(a.json.data.id)
    expect(b.headers.get('idempotent-replayed')).toBe('true')
  })

  test('idempotency key is required', async () => {
    const res = await post('admin', valid(), null)
    expect(res.status).toBe(400)
    expect(res.json.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED')
  })

  test('validation names each bad field', async () => {
    const res = await post('admin', valid({ name: ' ', destination: '', travelStartDate: '2027-03-20', travelEndDate: '2027-03-10', travelerCount: 0, serviceScope: ['boat'], contractValueMinor: '-5', characteristic: 'wild' }))
    expect(res.status).toBe(400)
    expect(Object.keys(res.json.error.fieldErrors).sort()).toEqual(['characteristic', 'contractValueMinor', 'destination', 'name', 'serviceScope', 'travelEndDate', 'travelerCount'])
  })

  test('a customer that is not on the server is a 422 the UI can explain', async () => {
    const res = await post('admin', valid({ partyId: 'PTY-999' }))
    expect(res.status).toBe(422)
    expect(res.json.error.message).toContain('Customer belum tersimpan di server')
    // Saving a customer to the server arrives with the Customer stage (S1); the message must not ask for it now.
    expect(res.json.error.message).toContain('baru ada di data lokal')
    expect(res.json.error.message).not.toContain('Simpan customer ini dulu')
  })

  test('group trip uses the placeholder party, created when missing', async () => {
    const res = await post('admin', valid({ partyId: undefined, isGroupTrip: true, name: 'Open Trip Bali' }))
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ partyId: 'PTY-009', isGroupTrip: true })
    await t.db.query("update projects set party_id = 'PTY-001' where party_id = 'PTY-009'")
    await t.db.query("update sales_order_refs set party_id = 'PTY-001' where party_id = 'PTY-009'")
    await t.db.query("delete from parties where id = 'PTY-009'")
    const again = await post('admin', valid({ partyId: undefined, isGroupTrip: true, name: 'Open Trip Lombok' }))
    expect(again.status).toBe(201)
    expect(again.json.data.partyId).toMatch(/^PTY-0[3-9][0-9]$/)
    const [party] = await t.db.query<{ name: string; party_type: string }>('select name, party_type from parties where id = $1', [again.json.data.partyId])
    expect(party).toEqual({ name: 'MANOVA Group Trip (Internal)', party_type: 'individual' })
  })

  test('finance cannot create projects; anonymous gets 401', async () => {
    expect((await post('finance', valid())).status).toBe(403)
    expect((await t.call('POST', '/api/v1/projects', { body: valid(), headers: { 'idempotency-key': key() } })).status).toBe(401)
  })
})

describe('PATCH /projects/:id', () => {
  test('admin edits header and field contacts; audit keeps before/after', async () => {
    const res = await t.call('PATCH', '/api/v1/projects/PRJ-101', {
      cookie: c.admin, body: { destination: 'Cebu, Filipina', travelerCount: 7, tourLeaderName: 'Andi', meetingPoint: 'Terminal 3' }
    })
    expect(res.status).toBe(200)
    expect(res.json.data).toMatchObject({ destination: 'Cebu, Filipina', travelerCount: 7, tourLeaderName: 'Andi', meetingPoint: 'Terminal 3' })
    const [audit] = await t.db.query<{ before: Record<string, unknown>; after: Record<string, unknown> }>(
      "select before, after from audit_events where action = 'project.updated' and entity_id = 'PRJ-101' order by id desc limit 1"
    )
    expect(audit!.before).toMatchObject({ destination: 'Manila, Filipina' })
    expect(audit!.after).toMatchObject({ destination: 'Cebu, Filipina', travelerCount: 7 })
  })

  test('status, customer and contract value cannot be patched', async () => {
    for (const body of [{ status: 'confirmed' }, { partyId: 'PTY-002' }, { contractValueMinor: '1' }]) {
      const res = await t.call('PATCH', '/api/v1/projects/PRJ-101', { cookie: c.admin, body })
      expect(res.status, JSON.stringify(body)).toBe(400)
    }
  })

  test('dates stay ordered against the stored value', async () => {
    const res = await t.call('PATCH', '/api/v1/projects/PRJ-101', { cookie: c.admin, body: { travelEndDate: '2026-01-01' } })
    expect(res.status).toBe(400)
    expect(res.json.error.fieldErrors).toHaveProperty('travelEndDate')
  })

  test('finance 403, client outside scope 404', async () => {
    expect((await t.call('PATCH', '/api/v1/projects/PRJ-101', { cookie: c.finance, body: { name: 'X' } })).status).toBe(403)
    expect((await t.call('PATCH', '/api/v1/projects/PRJ-999', { cookie: c.admin, body: { name: 'X' } })).status).toBe(404)
  })
})

describe('PUT /projects/:id/contract-value and finance', () => {
  test('a new project is billable at once; contract value cannot drop below what is billed', async () => {
    const created = await post('admin', valid({ name: 'Integrasi Finance', contractValueMinor: '200000000' }))
    const id = created.json.data.id as string
    const draft = await t.call('POST', '/api/v1/finance/customer-invoices', {
      cookie: c.finance, body: { projectId: id, invoiceType: 'dp', lines: [{ description: 'DP 50%', amountMinor: '100000000' }], dueDate: '2027-02-01' }
    })
    expect(draft.status).toBe(201)
    const issued = await t.call('POST', `/api/v1/finance/customer-invoices/${draft.json.data.id}/issue`, { cookie: c.finance, body: { dueDate: '2027-02-01' } })
    expect(issued.status).toBe(200)
    const summary = await t.call('GET', `/api/v1/projects/${id}/finance-summary`, { cookie: c.finance })
    expect(summary.json.data).toMatchObject({ contractValueMinor: '200000000', receivable: { invoicedMinor: '100000000', uninvoicedMinor: '100000000' } })

    const tooLow = await t.call('PUT', `/api/v1/projects/${id}/contract-value`, { cookie: c.finance, body: { contractValueMinor: '90000000', reason: 'Diskon' } })
    expect(tooLow.status).toBe(422)
    expect(tooLow.json.error.message).toContain('Rp')

    const ok = await t.call('PUT', `/api/v1/projects/${id}/contract-value`, { cookie: c.finance, body: { contractValueMinor: '150000000', reason: 'Peserta berkurang' } })
    expect(ok.status).toBe(200)
    expect(ok.json.data.contractValueMinor).toBe('150000000')
    const [audit] = await t.db.query<{ reason: string; before: Record<string, string>; after: Record<string, string> }>(
      "select reason, before, after from audit_events where action = 'project.contract_value_changed' and entity_id = $1", [id]
    )
    expect(audit).toEqual({ reason: 'Peserta berkurang', before: { contractValueMinor: '200000000' }, after: { contractValueMinor: '150000000' } })
  })

  test('reason is required; admin cannot change it; super-admin can', async () => {
    expect((await t.call('PUT', '/api/v1/projects/PRJ-104/contract-value', { cookie: c.finance, body: { contractValueMinor: '1000' } })).status).toBe(400)
    expect((await t.call('PUT', '/api/v1/projects/PRJ-104/contract-value', { cookie: c.admin, body: { contractValueMinor: '1000', reason: 'x' } })).status).toBe(403)
    expect((await t.call('PUT', '/api/v1/projects/PRJ-104/contract-value', { cookie: c.superAdmin, body: { contractValueMinor: '125000000', reason: 'Revisi kontrak' } })).status).toBe(200)
  })
})

describe('one project per won lead', () => {
  test('a second project for the same lead is refused, even with a new idempotency key', async () => {
    const first = await post('admin', valid({ name: 'Won Pertama', leadId: 'LED-777' }))
    expect(first.status).toBe(201)
    const second = await post('admin', valid({ name: 'Won Kedua', leadId: 'LED-777' }))
    expect(second.status).toBe(409)
    expect(second.json.error.message).toContain(first.json.data.id)
  })
})
