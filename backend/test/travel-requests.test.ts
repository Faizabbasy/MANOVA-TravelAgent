import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S12c-3: client travel requests (sales review → lead) and approvals staff ask a client for. Client USR-021 (PTY-005). */

let t: TestApp
const c: Record<string, string> = {}
let n = 0
beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 60_000)
afterAll(() => t.cleanup())

const call = (method: string, path: string, who: string, body?: unknown) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: { 'idempotency-key': `trq-${++n}-${Date.now()}` } })
const notes = async (userId: string) => Number((await t.db.query<{ n: string }>('select count(*)::text as n from notifications where user_id = $1', [userId]))[0]!.n)
const admins = async () => (await t.db.query<{ id: string }>("select id from users where role = 'admin' and status = 'active' order by id")).map(r => r.id)
const draft = (over: Record<string, unknown> = {}) => ({ requestName: 'Outing Bali', destination: 'Bali', serviceScope: ['flight', 'hotel'], estimatedParticipants: 30, estimatedBudgetIdr: 150000000, travelStartDate: '2026-12-01', travelEndDate: '2026-12-04', ...over })
const create = async (over: Record<string, unknown> = {}) => (await call('POST', '/client/travel-requests', 'client', draft(over))).json.data as { id: string; status: string }

describe('client travel requests', () => {
  test('create a draft, edit it, submit — the account owner (or every admin) is told; activities record each step', async () => {
    const res = await call('POST', '/client/travel-requests', 'client', draft())
    expect(res.status, JSON.stringify(res.json)).toBe(201)
    expect(res.json.data).toMatchObject({ status: 'draft', requestName: 'Outing Bali', serviceScope: ['flight', 'hotel'], estimatedBudgetIdr: 150000000 })
    const id = res.json.data.id as string
    expect((await call('PATCH', `/client/travel-requests/${id}`, 'client', { purpose: 'Gathering', hotelRequirement: { starRating: '4' } })).json.data)
      .toMatchObject({ purpose: 'Gathering', hotelRequirement: { starRating: '4' } })
    const ownerId = (await t.db.query<{ account_owner_user_id: string | null }>("select account_owner_user_id from parties where id = 'PTY-005'"))[0]!.account_owner_user_id
    const targets = ownerId ? [ownerId] : await admins()
    const before = await Promise.all(targets.map(notes))
    const submitted = await call('POST', `/client/travel-requests/${id}/submit`, 'client')
    expect(submitted.status, JSON.stringify(submitted.json)).toBe(200)
    expect(submitted.json.data.status).toBe('submitted')
    expect((await Promise.all(targets.map(notes))).every((v, i) => v === before[i]! + 1)).toBe(true)
    expect(submitted.json.data.activities.length).toBeGreaterThanOrEqual(2)
    expect((await call('PATCH', `/client/travel-requests/${id}`, 'client', { purpose: 'x' })).status).toBe(422)
  })

  test('submit needs name, destination and a service; validation; duplicate; cancel needs a reason; terminal stays', async () => {
    const empty = await create({ destination: '', serviceScope: [] })
    expect((await call('POST', `/client/travel-requests/${empty.id}/submit`, 'client')).status).toBe(400)
    expect((await call('POST', '/client/travel-requests', 'client', draft({ requestName: ' ' }))).status).toBe(400)
    expect((await call('POST', '/client/travel-requests', 'client', draft({ serviceScope: ['spaceship'] }))).status).toBe(400)
    expect((await call('POST', '/client/travel-requests', 'client', draft({ travelStartDate: '2026-12-05', travelEndDate: '2026-12-01' }))).status).toBe(400)
    const copy = await call('POST', `/client/travel-requests/${empty.id}/duplicate`, 'client')
    expect(copy.json.data).toMatchObject({ status: 'draft', requestName: 'Outing Bali (Copy)' })
    expect((await call('POST', `/client/travel-requests/${empty.id}/cancel`, 'client', { reason: ' ' })).status).toBe(400)
    expect((await call('POST', `/client/travel-requests/${empty.id}/cancel`, 'client', { reason: 'Batal' })).json.data.status).toBe('cancelled')
    expect((await call('POST', `/client/travel-requests/${empty.id}/cancel`, 'client', { reason: 'Lagi' })).status).toBe(422)
  })

  test('sales reviews: under review, asks for clarification (client told), client answers, sales converts to a lead', async () => {
    const { id } = await create()
    await call('POST', `/client/travel-requests/${id}/submit`, 'client')
    expect((await call('POST', `/travel-requests/${id}/review`, 'admin')).json.data).toMatchObject({ status: 'under-review' })
    expect((await call('POST', `/travel-requests/${id}/clarify`, 'admin', {})).status).toBe(400)
    const before = await notes('USR-021')
    expect((await call('POST', `/travel-requests/${id}/clarify`, 'admin', { note: 'Berapa kamar?' })).json.data).toMatchObject({ status: 'need-clarification', clarificationNote: 'Berapa kamar?' })
    expect(await notes('USR-021')).toBe(before + 1)
    expect((await call('PATCH', `/client/travel-requests/${id}`, 'client', { estimatedParticipants: 32 })).status).toBe(200)
    const answered = await call('POST', `/client/travel-requests/${id}/clarification`, 'client', { message: '16 kamar twin' })
    expect(answered.json.data.status).toBe('submitted')
    expect(answered.json.data.activities.some((a: { message: string }) => a.message.includes('16 kamar twin'))).toBe(true)
    const converted = await call('POST', `/travel-requests/${id}/convert`, 'admin')
    expect(converted.status, JSON.stringify(converted.json)).toBe(200)
    expect(converted.json.data.status).toBe('converted-to-lead')
    const [lead] = await t.db.query<{ source: string; destination: string; traveler_estimate: number }>('select source, destination, traveler_estimate from leads where id = $1', [converted.json.data.leadId])
    expect(lead).toMatchObject({ source: 'client-portal', destination: 'Bali', traveler_estimate: 32 })
    expect((await call('POST', `/travel-requests/${id}/convert`, 'admin')).status).toBe(422)
    expect((await call('POST', `/client/travel-requests/${id}/cancel`, 'client', { reason: 'x' })).status).toBe(422)
  })

  test('close needs a reason; drafts are not in the staff list; roles', async () => {
    const { id } = await create()
    expect((await call('GET', '/travel-requests', 'admin')).json.data.some((r: { id: string }) => r.id === id)).toBe(false)
    await call('POST', `/client/travel-requests/${id}/submit`, 'client')
    expect((await call('GET', '/travel-requests', 'admin')).json.data.some((r: { id: string }) => r.id === id)).toBe(true)
    expect((await call('POST', `/travel-requests/${id}/close`, 'admin', {})).status).toBe(400)
    expect((await call('POST', `/travel-requests/${id}/review`, 'finance')).status).toBe(403)
    expect((await call('GET', '/travel-requests', 'client')).status).toBe(403)
    expect((await call('GET', '/client/travel-requests', 'admin')).status).toBe(403)
    expect((await call('POST', `/travel-requests/${id}/close`, 'admin', { reason: 'Di luar layanan' })).json.data.status).toBe('closed')
  })

  test('attachments and comments work on a travel request (S12c-5 resolver)', async () => {
    const { id } = await create()
    expect((await call('POST', '/client/attachments', 'client', { entityType: 'travel-request', entityId: id, fileName: 'rundown.pdf' })).status).toBe(201)
    expect((await call('POST', '/client/comments', 'client', { entityType: 'travel-request', entityId: id, body: 'Mohon dicek' })).status).toBe(201)
    expect((await call('GET', `/comments?entityType=travel-request&entityId=${id}`, 'admin')).json.data[0].body).toBe('Mohon dicek')
  })
})

describe('client approvals', () => {
  test('staff ask, the client approves / rejects (reason) / asks a revision (reason); owner told; decided once', async () => {
    const before = await notes('USR-021')
    const res = await call('POST', '/projects/PRJ-201/client-approvals', 'admin', { entityType: 'rooming-list', title: 'Rooming list final', description: '16 twin', expiresOn: '2026-10-30' })
    expect(res.status, JSON.stringify(res.json)).toBe(201)
    expect(res.json.data).toMatchObject({ status: 'pending', entityType: 'rooming-list', projectId: 'PRJ-201' })
    expect(await notes('USR-021')).toBe(before + 1)
    const id = res.json.data.id as string
    expect((await call('GET', '/client/approvals', 'client')).json.data.some((a: { id: string; requestedBy: string | null }) => a.id === id && a.requestedBy === null)).toBe(true)
    const ownerId = (await t.db.query<{ owner_user_id: string }>("select owner_user_id from projects where id = 'PRJ-201'"))[0]!.owner_user_id
    const ownerBefore = await notes(ownerId)
    expect((await call('POST', `/client/approvals/${id}/approve`, 'client', { comment: 'OK' })).json.data).toMatchObject({ status: 'approved', decisionComment: 'OK' })
    expect(await notes(ownerId)).toBe(ownerBefore + 1)
    expect((await call('POST', `/client/approvals/${id}/reject`, 'client', { reason: 'x' })).status).toBe(422)

    const second = (await call('POST', '/projects/PRJ-201/client-approvals', 'admin', { entityType: 'additional-charge', title: 'Tambahan bus', amountIdr: 2500000 })).json.data.id as string
    expect((await call('POST', `/client/approvals/${second}/reject`, 'client', {})).status).toBe(400)
    expect((await call('POST', `/client/approvals/${second}/request-revision`, 'client', { reason: 'Terlalu mahal' })).json.data).toMatchObject({ status: 'revision-requested', reason: 'Terlalu mahal' })
  })

  test('validation, other parties and roles', async () => {
    expect((await call('POST', '/projects/PRJ-201/client-approvals', 'admin', { entityType: 'change-request', title: 'x' })).status).toBe(400)
    expect((await call('POST', '/projects/PRJ-201/client-approvals', 'admin', { entityType: 'final-report', title: ' ' })).status).toBe(400)
    expect((await call('POST', '/projects/PRJ-201/client-approvals', 'finance', { entityType: 'final-report', title: 'Laporan' })).status).toBe(403)
    expect((await call('POST', '/projects/PRJ-201/client-approvals', 'client', { entityType: 'final-report', title: 'Laporan' })).status).toBe(403)
    const foreign = (await t.db.query<{ id: string }>("select id from projects where party_id <> 'PTY-005' order by id limit 1"))[0]!.id
    const other = (await call('POST', `/projects/${foreign}/client-approvals`, 'admin', { entityType: 'final-report', title: 'Laporan' })).json.data.id as string
    expect((await call('POST', `/client/approvals/${other}/approve`, 'client', {})).status).toBe(404)
    expect((await call('GET', '/client/approvals', 'client')).json.data.some((a: { id: string }) => a.id === other)).toBe(false)
    expect((await call('GET', `/client-approvals?projectId=${foreign}`, 'admin')).json.data.some((a: { id: string }) => a.id === other)).toBe(true)
  })
})
