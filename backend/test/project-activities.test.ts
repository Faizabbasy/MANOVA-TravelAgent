import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S7d: project activity log and change entries through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s7d-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })
type A = { id: string; projectId: string; message: string; isChange: boolean; reviewed: boolean; approvalStatus: string | null; requestedBy: string | null; approvedBy: string | null; category: string | null; sourceAction: string | null }
const activities = async (projectId: string) => (await call('GET', `/project-activities?projectId=${projectId}`, 'admin')).json.data as A[]

describe('change entries', () => {
  test('internal roles read; portals 403; anonymous 401', async () => {
    expect((await call('GET', '/project-activities?projectId=PRJ-101', 'finance')).status).toBe(200)
    expect((await call('GET', '/project-activities', 'client')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/project-activities')).status).toBe(401)
  })

  test('log a change (idempotent, validated); the requester is the signed-in user; finance cannot log', async () => {
    const k = key()
    const body = { category: 'itinerary', reason: 'Klien minta tambah city tour', beforeValue: '3 hari', afterValue: '4 hari', impactNote: 'Hotel +1 malam', requestedBy: 'USR-999' }
    const res = await call('POST', '/projects/PRJ-103/changes', 'admin', body, k)
    expect(res.status).toBe(201)
    expect(res.json.data).toMatchObject({ projectId: 'PRJ-103', isChange: true, reviewed: false, approvalStatus: 'pending', category: 'itinerary', message: 'Klien minta tambah city tour' })
    expect(res.json.data.id).toMatch(/^CHG-/)
    expect(res.json.data.requestedBy).not.toBe('USR-999')
    expect((await call('POST', '/projects/PRJ-103/changes', 'admin', body, k)).json.data.id).toBe(res.json.data.id)
    expect((await call('POST', '/projects/PRJ-103/changes', 'admin', { category: 'weather', reason: 'X' }, key())).status).toBe(400)
    expect((await call('POST', '/projects/PRJ-103/changes', 'admin', { category: 'other', reason: ' ' }, key())).status).toBe(400)
    expect((await call('POST', '/projects/PRJ-103/changes', 'finance', body, key())).status).toBe(403)
    expect((await call('POST', '/projects/PRJ-999/changes', 'admin', body, key())).status).toBe(404)
  })

  test('approve or reject once; a decided or manual change cannot be marked reviewed; unknown 404', async () => {
    const a = (await call('POST', '/projects/PRJ-103/changes', 'admin', { category: 'service', reason: 'Ganti maskapai' }, key())).json.data.id as string
    const approved = (await call('POST', `/project-activities/${a}/approve`, 'admin')).json.data as A
    expect(approved).toMatchObject({ approvalStatus: 'approved', reviewed: true })
    expect(approved.approvedBy).toBeTruthy()
    expect((await call('POST', `/project-activities/${a}/reject`, 'admin')).status).toBe(422)
    expect((await call('POST', `/project-activities/${a}/review`, 'admin')).status).toBe(422)
    const b = (await call('POST', '/projects/PRJ-103/changes', 'admin', { category: 'budget', reason: 'Tambah budget' }, key())).json.data.id as string
    expect((await call('POST', `/project-activities/${b}/approve`, 'finance')).status).toBe(403)
    expect(((await call('POST', `/project-activities/${b}/reject`, 'admin')).json.data as A).approvalStatus).toBe('rejected')
    expect((await call('POST', '/project-activities/CHG-99999/approve', 'admin')).status).toBe(404)
    expect((await activities('PRJ-103')).some(x => x.id === b)).toBe(true)
  })
})
