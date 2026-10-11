import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/** S8: change requests, incidents and non-Finance cancellations through the API. */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let n = 0
const key = () => `s8-key-${++n}-abcdef`
const call = (method: string, path: string, who: string, body?: unknown, k?: string | null) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: k ? { 'idempotency-key': k } : {} })
type Activity = { id: string; approvalStatus: string | null; sourceAction: string | null; message: string }
const activities = async (projectId: string) => (await call('GET', `/project-activities?projectId=${projectId}`, 'admin')).json.data as Activity[]

describe('change requests', () => {
  test('internal roles read; portals 403; anonymous 401', async () => {
    expect((await call('GET', '/change-requests?projectId=PRJ-103', 'finance')).status).toBe(200)
    expect((await call('GET', '/change-requests', 'client')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/change-requests')).status).toBe(401)
  })

  test('create (idempotent) opens a pending change entry; review, approve and implement decide it once', async () => {
    const k = key()
    const body = { source: 'client', category: 'itinerary', beforeSummary: 'City tour 1 hari', afterSummary: 'City tour 2 hari', operationalImpact: 'Bus +1 hari', commercialImpactMinor: '2500000', requestedBy: 'USR-999' }
    const res = await call('POST', '/projects/PRJ-103/change-requests', 'admin', body, k)
    expect(res.status).toBe(201)
    const cr = res.json.data as { id: string; status: string; activityId: string; requestedBy: string; commercialImpactMinor: string }
    expect(cr).toMatchObject({ status: 'submitted', commercialImpactMinor: '2500000' })
    expect(cr.requestedBy).not.toBe('USR-999')
    expect((await call('POST', '/projects/PRJ-103/change-requests', 'admin', body, k)).json.data.id).toBe(cr.id)
    const entry = (await activities('PRJ-103')).find(a => a.id === cr.activityId)!
    expect(entry.approvalStatus).toBe('pending')
    expect((await call('POST', `/change-requests/${cr.id}/implement`, 'admin')).status).toBe(422)
    expect((await call('POST', `/change-requests/${cr.id}/review`, 'finance')).status).toBe(403)
    expect(((await call('POST', `/change-requests/${cr.id}/review`, 'admin')).json.data).status).toBe('under-review')
    expect((await call('POST', `/change-requests/${cr.id}/review`, 'admin')).status).toBe(422)
    expect(((await call('POST', `/change-requests/${cr.id}/approve`, 'admin')).json.data).status).toBe('approved')
    expect((await activities('PRJ-103')).find(a => a.id === cr.activityId)!.approvalStatus).toBe('approved')
    expect(((await call('POST', `/change-requests/${cr.id}/implement`, 'admin')).json.data).status).toBe('implemented')
    expect((await call('POST', `/change-requests/${cr.id}/approve`, 'admin')).status).toBe(422)
  })

  test('validation, reject needs a reason and rejects the change entry; finance cannot create; unknown project 404', async () => {
    const bad = async (b: unknown) => (await call('POST', '/projects/PRJ-103/change-requests', 'admin', b, key())).status
    expect(await bad({ source: 'partner', beforeSummary: 'A', afterSummary: 'B' })).toBe(400)
    expect(await bad({ source: 'internal', beforeSummary: ' ', afterSummary: 'B' })).toBe(400)
    expect(await bad({ source: 'internal', beforeSummary: 'A', afterSummary: 'B', commercialImpactMinor: '-1' })).toBe(400)
    expect((await call('POST', '/projects/PRJ-103/change-requests', 'finance', { source: 'internal', beforeSummary: 'A', afterSummary: 'B' }, key())).status).toBe(403)
    expect((await call('POST', '/projects/PRJ-999/change-requests', 'admin', { source: 'internal', beforeSummary: 'A', afterSummary: 'B' }, key())).status).toBe(404)
    const cr = (await call('POST', '/projects/PRJ-103/change-requests', 'admin', { source: 'internal', beforeSummary: 'Hotel A', afterSummary: 'Hotel B' }, key())).json.data as { id: string; activityId: string }
    expect((await call('POST', `/change-requests/${cr.id}/reject`, 'admin', { reason: ' ' })).status).toBe(400)
    expect(((await call('POST', `/change-requests/${cr.id}/reject`, 'admin', { reason: 'Hotel B penuh' })).json.data)).toMatchObject({ status: 'rejected', rejectionReason: 'Hotel B penuh' })
    expect((await activities('PRJ-103')).find(a => a.id === cr.activityId)!.approvalStatus).toBe('rejected')
    expect((await call('POST', '/change-requests/CR-99999/approve', 'admin')).status).toBe(404)
  })
})
