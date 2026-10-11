import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'
import { changeUserRole, suspendUser } from '../src/modules/core/users'

/**
 * S10a: user administration (Super Admin only) and audit reads.
 * superAdmin = USR-010, admin = USR-002, adminSales = USR-001, adminMgmt = USR-003, finance = USR-008, client = USR-021.
 */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp({ config: { portalLogin: true } })
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 30_000)
afterAll(() => t.cleanup())

const call = (method: string, path: string, who: string, body?: unknown) => t.call(method, `/api/v1${path}`, { cookie: c[who], body })
type U = { id: string; role: string; status: string; suspendedReason: string | null; suspendedAt: string | null }

describe('users', () => {
  test('internal roles list users; portals 403; anonymous 401', async () => {
    const res = await call('GET', '/users', 'finance')
    expect(res.status).toBe(200)
    expect((res.json.data as U[]).map(u => u.id)).toEqual(expect.arrayContaining(['USR-001', 'USR-010', 'USR-021']))
    expect((await call('GET', '/users', 'client')).status).toBe(403)
    expect((await t.call('GET', '/api/v1/users')).status).toBe(401)
  })

  test('only the Super Admin suspends and reactivates; a reason is required; the suspended user is signed out', async () => {
    expect((await call('POST', '/users/USR-001/suspend', 'admin', { reason: 'Tes' })).status).toBe(403)
    expect((await call('POST', '/users/USR-001/suspend', 'superAdmin', { reason: ' ' })).status).toBe(400)
    expect((await call('POST', '/users/USR-010/suspend', 'superAdmin', { reason: 'Diri sendiri' })).status).toBe(422)
    const res = await call('POST', '/users/USR-001/suspend', 'superAdmin', { reason: 'Cuti panjang' })
    expect(res.status).toBe(200)
    expect(res.json.data).toMatchObject({ status: 'suspended', suspendedReason: 'Cuti panjang' })
    expect((await call('GET', '/auth/me', 'adminSales')).status).toBe(401)
    expect((await call('POST', '/users/USR-001/suspend', 'superAdmin', { reason: 'Lagi' })).status).toBe(422)
    const back = await call('POST', '/users/USR-001/reactivate', 'superAdmin')
    expect(back.json.data).toMatchObject({ status: 'active', suspendedReason: null })
    expect((await call('POST', '/users/USR-001/reactivate', 'superAdmin')).status).toBe(422)
    c.adminSales = await t.login(DEMO.adminSales)
    expect((await call('GET', '/auth/me', 'adminSales')).status).toBe(200)
  })

  test('only the Super Admin changes roles, among internal roles only; never their own; the user is signed out', async () => {
    expect((await call('PUT', '/users/USR-003/role', 'admin', { role: 'finance' })).status).toBe(403)
    expect((await call('PUT', '/users/USR-003/role', 'superAdmin', { role: 'client' })).status).toBe(400)
    expect((await call('PUT', '/users/USR-003/role', 'superAdmin', { role: 'manager' })).status).toBe(400)
    expect((await call('PUT', '/users/USR-021/role', 'superAdmin', { role: 'admin' })).status).toBe(422) // portal user
    expect((await call('PUT', '/users/USR-010/role', 'superAdmin', { role: 'admin' })).status).toBe(422) // own role
    const res = await call('PUT', '/users/USR-003/role', 'superAdmin', { role: 'finance' })
    expect(res.json.data).toMatchObject({ role: 'finance' })
    expect((await call('GET', '/auth/me', 'adminMgmt')).status).toBe(401)
    expect((await call('PUT', '/users/USR-003/role', 'superAdmin', { role: 'admin' })).json.data.role).toBe('admin')
    expect((await call('PUT', '/users/USR-999/role', 'superAdmin', { role: 'admin' })).status).toBe(404)
  })

  test('an actor no longer an active Super Admin in the database cannot change users (two Super Admins demoting each other)', async () => {
    const stale = { userId: 'USR-002', name: 'Doni', email: DEMO.admin, role: 'super-admin' as const, partyId: null, vendorId: null, sessionId: 'x' }
    await expect(t.db.transaction(tx => changeUserRole(tx, stale, 'USR-010', 'admin', 'req-stale'))).rejects.toMatchObject({ status: 403 })
    await expect(t.db.transaction(tx => suspendUser(tx, stale, 'USR-001', 'Tes', 'req-stale'))).rejects.toMatchObject({ status: 403 })
    const [u] = await t.db.query<{ role: string }>("select role from users where id = 'USR-010'")
    expect(u!.role).toBe('super-admin')
  })
})

describe('audit reads', () => {
  test('the activity center lists recent audit events as system events; finance cannot; portals cannot', async () => {
    const res = await call('GET', '/audit/events', 'admin')
    expect(res.status).toBe(200)
    const events = res.json.data as { id: string; module: string; type: string; message: string; userId: string | null; createdAt: string }[]
    expect(events.length).toBeGreaterThan(0)
    const suspension = events.find(e => e.type === 'user.suspended')!
    expect(suspension).toMatchObject({ module: 'user', userId: 'USR-010' })
    expect(suspension.id).toMatch(/^AUD-\d+$/)
    expect([...events.map(e => e.createdAt)].sort().reverse()).toEqual(events.map(e => e.createdAt))
    expect((await call('GET', '/audit/events', 'finance')).status).toBe(403)
    expect((await call('GET', '/audit/events', 'client')).status).toBe(403)
  })

  test('Finance audit events (and their reasons) are hidden from Admin, who has no Finance access', async () => {
    await t.db.query(
      "insert into audit_events (action, actor_user_id, entity_type, entity_id, request_id, reason) values ('finance.transaction_reversed', 'USR-008', 'transaction', 'TRX-1', 'req-fin', 'Salah input Rp 5.000.000')")
    const asAdmin = (await call('GET', '/audit/events', 'admin')).json.data as { module: string; message: string }[]
    expect(asAdmin.some(e => e.module === 'finance' || e.message.includes('Salah input'))).toBe(false)
    const asSuper = (await call('GET', '/audit/events', 'superAdmin')).json.data as { type: string }[]
    expect(asSuper.some(e => e.type === 'finance.transaction_reversed')).toBe(true)
  })

  test('the session log pairs logins with logouts', async () => {
    const res = await call('GET', '/audit/sessions', 'superAdmin')
    expect(res.status).toBe(200)
    const sessions = res.json.data as { userId: string; loginAt: string; logoutAt: string | null; status: string }[]
    expect(sessions.some(s => s.userId === 'USR-001')).toBe(true)
    expect(sessions.every(s => (s.status === 'ended') === (s.logoutAt !== null))).toBe(true)
    expect((await call('GET', '/audit/sessions', 'finance')).status).toBe(403)
  })
})
