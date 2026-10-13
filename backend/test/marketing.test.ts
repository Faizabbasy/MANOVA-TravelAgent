import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'
import { hasCapability } from '../src/auth/rbac'
import { businessDateOf } from '../src/shared/dates'

/** S11b: marketing content schedule and development. Admin and Super Admin write (`marketing.manage-content`). */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

let keySeq = 0
const call = (method: string, path: string, who: string, body?: unknown, key = true) =>
  t.call(method, `/api/v1${path}`, { cookie: c[who], body, headers: key && method === 'POST' ? { 'idempotency-key': `mkt-test-${++keySeq}-key` } : {} })
type Schedule = { id: string; publishDate: string; platform: string; title: string; status: string; campaignId: string | null; note: string | null }
type Idea = { id: string; title: string; stage: string; platform: string; ownerId: string | null; note: string | null; updatedOn: string }

describe('capability', () => {
  test('only Admin (and Super Admin) manage content', () => {
    expect(hasCapability('admin', 'marketing.manage-content')).toBe(true)
    expect(hasCapability('finance', 'marketing.manage-content')).toBe(false)
  })
})

describe('reading', () => {
  test('internal roles read; portals 403; anonymous 401', async () => {
    for (const path of ['/content-schedule', '/content-development']) {
      expect((await call('GET', path, 'finance')).status).toBe(200)
      expect((await call('GET', path, 'client')).status).toBe(403)
      expect((await t.call('GET', `/api/v1${path}`)).status).toBe(401)
    }
  })
})

describe('content schedule', () => {
  test('Admin schedules and updates content; finance 403; validation; Idempotency-Key required', async () => {
    const res = await call('POST', '/content-schedule', 'admin', { publishDate: '2026-11-03', platform: 'instagram', title: 'Promo akhir tahun', status: 'scheduled', campaignId: 'CMP-001' })
    expect(res.status).toBe(201)
    const s = res.json.data as Schedule
    expect(s).toMatchObject({ publishDate: '2026-11-03', platform: 'instagram', status: 'scheduled', campaignId: 'CMP-001' })
    expect(s.id).toMatch(/^CTS-\d+$/)
    const body = { publishDate: '2026-11-04', platform: 'tiktok', title: 'X', status: 'draft' }
    expect((await call('POST', '/content-schedule', 'finance', body)).status).toBe(403)
    expect((await call('POST', '/content-schedule', 'admin', body, false)).status).toBe(400)
    expect((await call('POST', '/content-schedule', 'admin', { ...body, platform: 'myspace' })).status).toBe(400)
    expect((await call('POST', '/content-schedule', 'admin', { ...body, title: ' ' })).status).toBe(400)
    expect((await call('POST', '/content-schedule', 'admin', { ...body, publishDate: '2026-13-01' })).status).toBe(400)
    expect((await call('POST', '/content-schedule', 'admin', { ...body, extra: 1 })).status).toBe(400)
    const upd = await call('PATCH', `/content-schedule/${s.id}`, 'admin', { status: 'published', note: 'Tayang pagi' })
    expect(upd.status).toBe(200)
    expect(upd.json.data).toMatchObject({ status: 'published', note: 'Tayang pagi', title: 'Promo akhir tahun' })
    expect((await call('PATCH', `/content-schedule/${s.id}`, 'admin', { status: 'archived' })).status).toBe(400)
    expect((await call('PATCH', `/content-schedule/${s.id}`, 'finance', { status: 'draft' })).status).toBe(403)
    expect((await call('PATCH', '/content-schedule/CTS-999', 'admin', { status: 'draft' })).status).toBe(404)
    const [audit] = await t.db.query<{ actor_user_id: string }>("select actor_user_id from audit_events where action = 'content.scheduled' and entity_id = $1", [s.id])
    expect(audit!.actor_user_id).toBe('USR-002')
  })
})

describe('content development', () => {
  test('Admin adds an idea and moves it through the stages; the owner must be an internal user; updatedOn is today', async () => {
    const res = await call('POST', '/content-development', 'admin', { title: 'Reel destinasi', stage: 'idea', platform: 'instagram', ownerId: 'USR-001' })
    expect(res.status).toBe(201)
    const idea = res.json.data as Idea
    expect(idea).toMatchObject({ stage: 'idea', ownerId: 'USR-001', updatedOn: businessDateOf(new Date()) })
    expect(idea.id).toMatch(/^CTD-\d+$/)
    expect((await call('POST', '/content-development', 'admin', { title: 'X', stage: 'idea', platform: 'email', ownerId: 'USR-021' })).status).toBe(422) // portal user
    expect((await call('POST', '/content-development', 'admin', { title: 'X', stage: 'published', platform: 'email' })).status).toBe(400)
    expect((await call('POST', '/content-development', 'finance', { title: 'X', stage: 'idea', platform: 'email' })).status).toBe(403)
    const moved = await call('PATCH', `/content-development/${idea.id}`, 'admin', { stage: 'review' })
    expect(moved.json.data).toMatchObject({ stage: 'review', title: 'Reel destinasi', ownerId: 'USR-001' })
    expect((await call('PATCH', `/content-development/${idea.id}`, 'admin', { ownerId: null })).json.data.ownerId).toBeNull()
    expect((await t.db.query("select 1 from audit_events where action = 'content_idea.updated' and entity_id = $1", [idea.id])).length).toBe(2)
  })
})
