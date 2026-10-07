import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S6a: leads, client quotations and Won through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s6a-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })

// Needs the S6a demo seed (Task 7).
describe.skip('lead reads', () => {
  test('internal roles read leads with activities and won project; portals 403; anonymous 401; unknown 404', async () => {
    const list = await call('GET', '/leads', 'finance')
    expect(list.status).toBe(200)
    const won = (list.json.data as { id: string; wonProjectId: string | null; quotationId: string | null; activities: unknown[] }[]).find(l => l.id === 'LED-009')!
    expect(won.wonProjectId).toBe('PRJ-101')
    expect(won.quotationId).toBe('QUO-001')
    const one = (await call('GET', '/leads/LED-001', 'admin')).json.data
    expect(one.activities.length).toBeGreaterThanOrEqual(3)
    expect(one.serviceScope).toEqual(['mice', 'hotel', 'transportation'])
    expect((await call('GET', '/leads', 'client')).status).toBe(403)
    expect((await call('GET', '/leads', 'vendor')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/leads')).status).toBe(401)
    expect((await call('GET', '/leads/LED-999', 'admin')).status).toBe(404)
  })

  test('quotations show the current version and the version history', async () => {
    const q = (await call('GET', '/quotations/QUO-005', 'admin')).json.data
    expect(q).toMatchObject({ currentVersion: 2, status: 'submitted', amountMinor: '180000000' })
    expect(q.versions.map((v: { version: number; status: string; amountMinor: string }) => `${v.version}:${v.status}:${v.amountMinor}`)).toEqual(['1:superseded:150000000', '2:submitted:180000000'])
    expect((await call('GET', '/quotations?leadId=LED-020', 'finance')).json.data[0].serviceBreakdown).toHaveLength(2)
    expect((await call('GET', '/quotations', 'client')).status).toBe(403)
  })
})

describe('lead reads (empty)', () => {
  test('lists answer for internal roles, 403 for portals, 401 anonymous, 404 unknown', async () => {
    expect((await call('GET', '/leads', 'finance')).status).toBe(200)
    expect((await call('GET', '/quotations', 'admin')).status).toBe(200)
    expect((await call('GET', '/leads', 'client')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/leads')).status).toBe(401)
    expect((await call('GET', '/leads/LED-999', 'admin')).status).toBe(404)
    expect((await call('GET', '/quotations/QUO-999', 'admin')).status).toBe(404)
  })
})

describe('lead writes', () => {
  test('create is idempotent, validates, and needs sales.manage-lead', async () => {
    const k = key()
    const body = { name: 'PT Uji Coba', companyName: 'PT Uji Coba', source: 'website', phone: '0811-1', serviceScope: ['flight'] }
    const first = await call('POST', '/leads', 'admin', body, k)
    expect(first.status).toBe(201)
    const firstId = first.json.data.id as string
    expect(first.json.data).toMatchObject({ stage: 'new', archived: false, serviceScope: ['flight'] })
    const again = await call('POST', '/leads', 'admin', body, k)
    expect(again.json.data.id).toBe(firstId)
    expect((await call('POST', '/leads', 'admin', { name: '', source: 'fax' }, key())).status).toBe(400)
    expect((await call('POST', '/leads', 'admin', body)).status).toBe(400) // Idempotency-Key required
    expect((await call('POST', '/leads', 'finance', body, key())).status).toBe(403)
  })

  test('patch edits requirements, stage new to contacted only; won or archived leads refuse with 422', async () => {
    const id = (await call('POST', '/leads', 'admin', { name: 'Lead Patch', source: 'email' }, key())).json.data.id as string
    const patched = await call('PATCH', `/leads/${id}`, 'admin', { destination: 'Bali', travelStartDate: '2026-12-01', travelEndDate: '2026-12-03', stage: 'contacted', b2c: { b2cAdultCount: 2 } })
    expect(patched.json.data).toMatchObject({ destination: 'Bali', stage: 'contacted', b2c: { b2cAdultCount: 2 } })
    expect((await call('PATCH', `/leads/${id}`, 'admin', { stage: 'qualified' })).status).toBe(400)
    expect((await call('PATCH', `/leads/${id}`, 'admin', { partyId: 'PTY-001' })).status).toBe(400)
    expect((await call('PATCH', `/leads/${id}`, 'admin', { travelStartDate: '2026-12-09' })).status).toBe(400) // after end
    // A won lead (a project points at it) is read-only.
    await t.db.query("insert into leads (id, name, source, owner_user_id) values ('LED-W1', 'Won', 'website', 'USR-001') on conflict do nothing")
    await t.db.query("update projects set lead_id = 'LED-W1' where id = 'PRJ-203'")
    expect((await call('PATCH', '/leads/LED-W1', 'admin', { destination: 'X' })).status).toBe(422)
    expect((await call('POST', '/leads/LED-W1/archive', 'admin', {})).status).toBe(422)
    expect((await call('POST', `/leads/${id}/archive`, 'admin', { reason: 'Tidak responsif' })).json.data.archived).toBe(true)
    expect((await call('PATCH', `/leads/${id}`, 'admin', { destination: 'X' })).status).toBe(422)
    expect((await call('POST', `/leads/${id}/reopen`, 'admin')).json.data.archived).toBe(false)
  })

  test('unqualify needs a reason; merge archives the duplicate and notes both leads', async () => {
    const a = (await call('POST', '/leads', 'admin', { name: 'Dup A', source: 'whatsapp' }, key())).json.data.id as string
    const b = (await call('POST', '/leads', 'admin', { name: 'Dup B', source: 'whatsapp' }, key())).json.data.id as string
    expect((await call('POST', `/leads/${a}/unqualify`, 'admin', {})).status).toBe(400)
    const unq = (await call('POST', `/leads/${a}/unqualify`, 'admin', { reason: 'Budget tidak cocok' })).json.data
    expect(unq).toMatchObject({ stage: 'unqualified', unqualifiedReason: 'Budget tidak cocok' })
    expect((await call('POST', `/leads/${a}/merge`, 'admin', { intoLeadId: a })).status).toBe(422)
    const merged = (await call('POST', `/leads/${a}/merge`, 'admin', { intoLeadId: b })).json.data
    expect(merged).toMatchObject({ archived: true, mergedInto: b })
    expect(merged.activities.at(-1).message).toContain(b)
    const target = (await call('GET', `/leads/${b}`, 'admin')).json.data
    expect(target.activities.at(-1).message).toContain(a)
    expect((await call('POST', `/leads/${b}/merge`, 'admin', { intoLeadId: a })).status).toBe(422) // target archived
  })

  test('activities and follow-ups: add, mark done; finance 403', async () => {
    const id = (await call('POST', '/leads', 'admin', { name: 'Lead Aktivitas', source: 'event' }, key())).json.data.id as string
    const withAct = (await call('POST', `/leads/${id}/activities`, 'admin', { type: 'follow-up', message: 'Telepon lagi', dueOn: '2026-11-01' })).json.data
    const act = withAct.activities[0]
    expect(act).toMatchObject({ type: 'follow-up', dueOn: '2026-11-01', doneOn: null })
    expect((await call('POST', `/leads/${id}/activities/${act.id}/done`, 'admin')).json.data.activities[0].doneOn).toBeTruthy()
    expect((await call('POST', `/leads/${id}/activities`, 'admin', { type: 'gossip', message: 'x' })).status).toBe(400)
    expect((await call('POST', `/leads/${id}/activities`, 'finance', { type: 'call', message: 'x' })).status).toBe(403)
  })
})

const fullRequirements = (extra: Record<string, unknown> = {}) => ({
  serviceCategory: 'corporate-travel', destination: 'Tokyo', travelStartDate: '2026-12-01', travelEndDate: '2026-12-05',
  travelerEstimate: 12, serviceScope: ['flight', 'hotel'], requirementSummary: 'Kunjungan bisnis', handedOverTo: 'USR-001', ...extra
})

describe('qualify', () => {
  test('missing fields answer 422 with the list; complete lead links a new prospect customer and notes', async () => {
    const id = (await call('POST', '/leads', 'admin', { name: 'Budi', companyName: 'PT Qualify Baru S6', source: 'referral' }, key())).json.data.id as string
    const refused = await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'company' })
    expect(refused.status).toBe(422)
    expect(refused.json.error.details.missing).toContain('Destinasi belum diisi')
    await call('PATCH', `/leads/${id}`, 'admin', fullRequirements())
    const lead = (await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'company' })).json.data
    expect(lead.stage).toBe('qualified')
    expect(lead.qualifiedOn).toBeTruthy()
    const party = (await call('GET', `/parties/${lead.partyId}`, 'admin')).json.data
    expect(party).toMatchObject({ name: 'PT Qualify Baru S6', lifecycleStatus: 'prospect', partyType: 'company', accountOwnerUserId: 'USR-001' })
    expect(lead.activities.map((a: { message: string }) => a.message)).toContain('Lead Qualified')
    // Qualify again: unchanged, no second customer.
    expect((await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'company' })).json.data.partyId).toBe(lead.partyId)
  })

  test('an existing customer with the same name (any case) is reused', async () => {
    const existing = (await call('GET', '/parties/PTY-001', 'admin')).json.data as { id: string; name: string }
    const id = (await call('POST', '/leads', 'admin', { name: 'Kontak', companyName: existing.name.toUpperCase(), source: 'email', ...fullRequirements() }, key())).json.data.id as string
    expect((await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'company' })).json.data.partyId).toBe('PTY-001')
  })

  test('B2C individual travel needs no Account Executive and creates a client; finance 403; unknown partyId 400', async () => {
    const id = (await call('POST', '/leads', 'admin', { name: 'Ibu Sinta Qualify', source: 'instagram', ...fullRequirements({ serviceCategory: 'individual-travel', handedOverTo: null }) }, key())).json.data.id as string
    expect((await call('POST', `/leads/${id}/qualify`, 'finance', { customerKind: 'individual' })).status).toBe(403)
    expect((await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'individual', partyId: 'PTY-999' })).status).toBe(400)
    const lead = (await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'individual' })).json.data
    expect((await call('GET', `/parties/${lead.partyId}`, 'admin')).json.data).toMatchObject({ partyType: 'individual', lifecycleStatus: 'client' })
  })
})
