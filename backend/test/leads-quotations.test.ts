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

describe('lead reads', () => {
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

async function qualifiedLead(name: string): Promise<string> {
  const id = (await call('POST', '/leads', 'admin', {
    name, companyName: name, source: 'website', serviceCategory: 'corporate-travel', destination: 'Bali', travelStartDate: '2026-12-01',
    travelEndDate: '2026-12-03', travelerEstimate: 10, serviceScope: ['flight'], requirementSummary: 'Outing', handedOverTo: 'USR-001'
  }, key())).json.data.id as string
  await call('POST', `/leads/${id}/qualify`, 'admin', { customerKind: 'company' })
  return id
}

describe('client quotations', () => {
  test('create v1 draft (one per lead, idempotent); edit only while draft; submit, withdraw, resubmit', async () => {
    const lead = await qualifiedLead('PT Quotation Satu S6')
    const k = key()
    const body = { amountMinor: '50000000', serviceBreakdown: [{ service: 'flight', amountMinor: '50000000' }] }
    const created = await call('POST', `/leads/${lead}/quotation`, 'admin', body, k)
    expect(created.status).toBe(201)
    const q = created.json.data.id as string
    expect(created.json.data).toMatchObject({ currentVersion: 1, status: 'draft', amountMinor: '50000000' })
    expect((await call('POST', `/leads/${lead}/quotation`, 'admin', body, k)).json.data.id).toBe(q)
    expect((await call('POST', `/leads/${lead}/quotation`, 'admin', { amountMinor: '1' }, key())).status).toBe(409)
    expect((await call('PATCH', `/quotations/${q}`, 'admin', { paymentTerms: 'DP 30%', amountMinor: '0' })).status).toBe(400)
    expect((await call('PATCH', `/quotations/${q}`, 'admin', { paymentTerms: 'DP 30%' })).json.data.paymentTerms).toBe('DP 30%')
    expect((await call('POST', `/quotations/${q}/submit`, 'adminSales')).json.data.status).toBe('submitted')
    expect((await call('PATCH', `/quotations/${q}`, 'admin', { paymentTerms: 'Lunas' })).status).toBe(422)
    expect((await call('POST', `/quotations/${q}/withdraw`, 'admin')).json.data.status).toBe('draft')
    expect((await call('POST', `/quotations/${q}/submit`, 'adminSales')).json.data.submittedBy).toBeTruthy()
  })

  test('approve by someone else and self-approval are both recorded; reject needs a note; finance 403', async () => {
    const lead = await qualifiedLead('PT Quotation Dua S6')
    const q = (await call('POST', `/leads/${lead}/quotation`, 'admin', { amountMinor: '70000000' }, key())).json.data.id as string
    await call('POST', `/quotations/${q}/submit`, 'adminSales')
    expect((await call('POST', `/quotations/${q}/approve`, 'finance')).status).toBe(403)
    expect((await call('POST', `/quotations/${q}/reject`, 'adminMgmt', {})).status).toBe(400)
    const rejected = (await call('POST', `/quotations/${q}/reject`, 'adminMgmt', { note: 'Margin terlalu tipis' })).json.data
    expect(rejected).toMatchObject({ status: 'rejected', decisionNote: 'Margin terlalu tipis' })
    const [byOther] = await t.db.query<{ details: { selfApproved: boolean } }>(
      "select details from audit_events where action = 'quotation.rejected' and entity_id = $1 order by id desc limit 1", [q])
    expect(byOther!.details.selfApproved).toBe(false)
    const v2 = (await call('POST', `/quotations/${q}/revise`, 'adminSales', { amountMinor: '75000000' })).json.data
    expect(v2.versions.map((v: { version: number; status: string }) => `${v.version}:${v.status}`)).toEqual(['1:rejected', '2:draft'])
    await call('POST', `/quotations/${q}/submit`, 'adminSales')
    expect((await call('POST', `/quotations/${q}/approve`, 'adminSales', { note: 'OK' })).json.data.status).toBe('approved')
    const [audit] = await t.db.query<{ details: { selfApproved: boolean } }>(
      "select details from audit_events where action = 'quotation.approved' and entity_id = $1 order by id desc limit 1", [q])
    expect(audit!.details.selfApproved).toBe(true)
  })

  test('revise locks the old version; send needs an approved latest version; revise from draft is 422', async () => {
    const lead = await qualifiedLead('PT Quotation Tiga S6')
    const q = (await call('POST', `/leads/${lead}/quotation`, 'admin', { amountMinor: '10000000', inclusions: 'Tiket' }, key())).json.data.id as string
    expect((await call('POST', `/quotations/${q}/revise`, 'admin')).status).toBe(422)
    expect((await call('POST', `/quotations/${q}/send`, 'admin')).status).toBe(422)
    await call('POST', `/quotations/${q}/submit`, 'admin')
    await call('POST', `/quotations/${q}/approve`, 'adminMgmt')
    expect((await call('POST', `/quotations/${q}/send`, 'admin')).json.data.sentToClientOn).toBeTruthy()
    const revised = (await call('POST', `/quotations/${q}/revise`, 'admin')).json.data
    expect(revised).toMatchObject({ currentVersion: 2, status: 'draft', inclusions: 'Tiket', sentToClientOn: null })
    expect(revised.versions[0]).toMatchObject({ version: 1, status: 'superseded', amountMinor: '10000000' })
  })

  test('only qualified non-B2C leads get a quotation', async () => {
    const lead = (await call('POST', '/leads', 'admin', { name: 'Belum Qualify', source: 'website' }, key())).json.data.id as string
    expect((await call('POST', `/leads/${lead}/quotation`, 'admin', { amountMinor: '1000' }, key())).status).toBe(422)
  })
})

describe('won', () => {
  test('creates the project with the approved value; second click returns it; later revisions keep the contract value', async () => {
    const lead = await qualifiedLead('PT Won S6')
    const q = (await call('POST', `/leads/${lead}/quotation`, 'admin', { amountMinor: '123000000' }, key())).json.data.id as string
    expect((await call('POST', `/leads/${lead}/won`, 'admin', {}, key())).status).toBe(422) // draft
    await call('POST', `/quotations/${q}/submit`, 'admin')
    await call('POST', `/quotations/${q}/approve`, 'adminMgmt')
    expect((await call('POST', `/leads/${lead}/won`, 'finance', {}, key())).status).toBe(403)
    const won = await call('POST', `/leads/${lead}/won`, 'admin', {}, key())
    expect(won.status).toBe(201)
    const projectId = won.json.data.project.id as string
    const partyId = won.json.data.project.partyId as string
    expect(won.json.data.project).toMatchObject({ contractValueMinor: '123000000', leadId: lead, sourceQuotationId: q })
    expect(won.json.data.lead.wonProjectId).toBe(projectId)
    expect((await call('GET', `/parties/${partyId}`, 'admin')).json.data.lifecycleStatus).toBe('client')
    // S7d: the new project's activity log says where it came from.
    const log = (await call('GET', `/project-activities?projectId=${projectId}`, 'admin')).json.data as { message: string; sourceAction: string }[]
    expect(log.find(x => x.sourceAction === 'lead.won')!.message).toContain(`dari Lead ${lead}`)
    const again = await call('POST', `/leads/${lead}/won`, 'admin', {}, key())
    expect(again.status).toBe(200)
    expect(again.json.data.project.id).toBe(projectId)
    await call('POST', `/quotations/${q}/revise`, 'admin', { amountMinor: '999000000' })
    expect((await call('GET', `/projects/${projectId}`, 'admin')).json.data.contractValueMinor).toBe('123000000')
    expect((await call('PATCH', `/leads/${lead}`, 'admin', { destination: 'X' })).status).toBe(422)
  })

  test('missing travel data answers 422 with the list', async () => {
    const lead = await qualifiedLead('PT Won Kurang S6')
    const q = (await call('POST', `/leads/${lead}/quotation`, 'admin', { amountMinor: '1000000' }, key())).json.data.id as string
    await call('POST', `/quotations/${q}/submit`, 'admin')
    await call('POST', `/quotations/${q}/approve`, 'admin')
    await t.db.query('update leads set destination = null where id = $1', [lead])
    const refused = await call('POST', `/leads/${lead}/won`, 'admin', {}, key())
    expect(refused.status).toBe(422)
    expect(refused.json.error.details.missing).toContain('Destinasi belum diisi')
  })
})

describe('lead b2c fields', () => {
  test('a b2c patch merges keys (null removes one) so seeded group-trip links survive the form', async () => {
    const id = (await call('POST', '/leads', 'admin', { name: 'B2C Merge', source: 'instagram', b2c: { projectId: 'PRJ-205', b2cAdultCount: 1 } }, key())).json.data.id as string
    const patched = (await call('PATCH', `/leads/${id}`, 'admin', { b2c: { b2cAdultCount: 3, b2cChildCount: 1 } })).json.data
    expect(patched.b2c).toEqual({ projectId: 'PRJ-205', b2cAdultCount: 3, b2cChildCount: 1 })
    expect((await call('PATCH', `/leads/${id}`, 'admin', { b2c: { b2cChildCount: null } })).json.data.b2c).toEqual({ projectId: 'PRJ-205', b2cAdultCount: 3 })
  })
})
