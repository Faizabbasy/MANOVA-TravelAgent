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
