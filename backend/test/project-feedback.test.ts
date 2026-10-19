import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * S12c-2: trip feedback — the client saves a draft and submits it for a project that has departed (ongoing-trip) or
 * finished; CRM staff acknowledge it, flag a follow-up or close it. PTY-005: PRJ-201 planning, PRJ-202 ongoing-trip,
 * PRJ-203 completed.
 */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 60_000)
afterAll(() => t.cleanup())

const call = (method: string, path: string, who: string, body?: unknown) => t.call(method, `/api/v1${path}`, { cookie: c[who], body })
const notes = async (userId: string) => Number((await t.db.query<{ n: string }>('select count(*)::text as n from notifications where user_id = $1', [userId]))[0]!.n)
type Feedback = { id: string; projectId: string; status: string; overallExperience: number | null; recommendationScore: number | null; followUpNote: string | null }

describe('client trip feedback', () => {
  test('only for a departed or finished project of the client party', async () => {
    expect((await call('PUT', '/client/projects/PRJ-201/feedback', 'client', { overallExperience: 4 })).status).toBe(422)
    const foreign = (await t.db.query<{ id: string }>("select id from projects where party_id <> 'PTY-005' order by id limit 1"))[0]!.id
    expect((await call('PUT', `/client/projects/${foreign}/feedback`, 'client', { overallExperience: 4 })).status).toBe(404)
    expect((await call('PUT', '/client/projects/PRJ-203/feedback', 'admin', { overallExperience: 4 })).status).toBe(403)
  })

  test('draft, then submit (needs overall and recommendation); then locked; the owner is told', async () => {
    const draft = await call('PUT', '/client/projects/PRJ-203/feedback', 'client', { overallExperience: 5, hotelRating: 4, comment: 'Hotel bagus' })
    expect(draft.status, JSON.stringify(draft.json)).toBe(200)
    expect(draft.json.data).toMatchObject({ status: 'draft', overallExperience: 5, hotelRating: 4 })
    expect((await call('PUT', '/client/projects/PRJ-203/feedback', 'client', { hotelRating: 7 })).status).toBe(400)
    expect((await call('PUT', '/client/projects/PRJ-203/feedback', 'client', { recommendationScore: 11 })).status).toBe(400)
    expect((await call('POST', '/client/projects/PRJ-203/feedback/submit', 'client', {})).status).toBe(400) // no recommendation yet
    const owner = (await t.db.query<{ owner_user_id: string }>("select owner_user_id from projects where id = 'PRJ-203'"))[0]!.owner_user_id
    const n0 = await notes(owner)
    await call('PUT', '/client/projects/PRJ-203/feedback', 'client', { recommendationScore: 9 })
    const sent = await call('POST', '/client/projects/PRJ-203/feedback/submit', 'client', {})
    expect(sent.status, JSON.stringify(sent.json)).toBe(200)
    expect(sent.json.data).toMatchObject({ status: 'submitted', recommendationScore: 9 })
    expect(await notes(owner)).toBe(n0 + 1)
    expect((await call('PUT', '/client/projects/PRJ-203/feedback', 'client', { comment: 'ubah' })).status).toBe(422)
    const list = (await call('GET', '/client/feedback', 'client')).json.data as Feedback[]
    expect(list.find(f => f.projectId === 'PRJ-203')?.status).toBe('submitted')
  })
})

describe('staff review of trip feedback', () => {
  test('acknowledge, follow up with a note, close; CRM roles only', async () => {
    await call('PUT', '/client/projects/PRJ-202/feedback', 'client', { overallExperience: 2, recommendationScore: 3 })
    await call('POST', '/client/projects/PRJ-202/feedback/submit', 'client', {})
    const list = await call('GET', '/feedback?status=submitted', 'admin')
    expect(list.status).toBe(200)
    const fb = (list.json.data as Feedback[]).find(f => f.projectId === 'PRJ-202')!
    expect((await call('GET', '/feedback', 'client')).status).toBe(403)
    expect((await call('POST', `/feedback/${fb.id}/acknowledge`, 'finance', {})).status).toBe(403)
    expect((await call('POST', `/feedback/${fb.id}/follow-up`, 'admin', { note: ' ' })).status).toBe(400)
    expect((await call('POST', `/feedback/${fb.id}/follow-up`, 'admin', { note: 'Telepon client soal bus' })).json.data).toMatchObject({ status: 'follow-up-required', followUpNote: 'Telepon client soal bus' })
    expect((await call('POST', `/feedback/${fb.id}/close`, 'admin', { note: 'Sudah ditelepon, kompensasi diberikan' })).json.data.status).toBe('closed')
    expect((await call('POST', `/feedback/${fb.id}/acknowledge`, 'admin', {})).status).toBe(422)
  })
})
