import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { ALLOWED_ORIGIN, DEMO, makeTestApp, TEST_PASSWORD, type TestApp } from './helpers'

let t: TestApp
beforeAll(async () => {
  t = await makeTestApp()
})
afterAll(() => t.cleanup())

describe('health', () => {
  test('liveness needs nothing', async () => {
    const res = await t.call('GET', '/health')
    expect(res.status).toBe(200)
    expect(res.json.data).toEqual({ status: 'ok' })
  })

  test('readiness reports database and schema state', async () => {
    const res = await t.call('GET', '/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.json.data).toMatchObject({
      status: 'ok',
      service: 'manova-backend',
      timezone: 'Asia/Jakarta',
      database: { reachable: true, schemaVersion: 3, latestVersion: 3, pendingMigrations: 0, migrationProblems: 0 }
    })
  })

  test('readiness is 503 on an unmigrated database', async () => {
    const bare = await makeTestApp({ migrate: false })
    try {
      const res = await bare.call('GET', '/api/v1/health')
      expect(res.status).toBe(503)
      expect(res.json.data.status).toBe('degraded')
      expect(res.json.data.database).toMatchObject({ reachable: true, schemaVersion: 0, pendingMigrations: 3 })
    } finally {
      await bare.cleanup()
    }
  })
})

describe('HTTP conventions', () => {
  test('every response carries a request ID that matches the body meta', async () => {
    const res = await t.call('GET', '/api/v1/auth/me')
    const id = res.headers.get('x-request-id')
    expect(id).toMatch(/^req_[0-9a-f-]{36}$/)
    expect(res.json.meta.requestId).toBe(id)
  })

  test('a well-formed incoming X-Request-Id is propagated; a malformed one is replaced', async () => {
    const kept = await t.call('GET', '/health', { headers: { 'x-request-id': 'nuxt-abc-12345678' } })
    expect(kept.headers.get('x-request-id')).toBe('nuxt-abc-12345678')
    const replaced = await t.call('GET', '/health', { headers: { 'x-request-id': 'bad id <script>' } })
    expect(replaced.headers.get('x-request-id')).toMatch(/^req_/)
  })

  test('unknown routes use the error envelope', async () => {
    const res = await t.call('GET', '/api/v1/nope')
    expect(res.status).toBe(404)
    expect(res.json.error.code).toBe('ROUTE_NOT_FOUND')
    expect(res.json.meta.requestId).toBeString()
  })

  test('security headers are set', async () => {
    const res = await t.call('GET', '/health')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
  })

  test('CORS answers only allowed origins, with credentials', async () => {
    const pre = await t.call('OPTIONS', '/api/v1/auth/login', { headers: { origin: ALLOWED_ORIGIN, 'access-control-request-method': 'POST' } })
    expect(pre.status).toBe(204)
    expect(pre.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN)
    expect(pre.headers.get('access-control-allow-credentials')).toBe('true')
    expect(pre.headers.get('access-control-allow-headers')).toContain('idempotency-key')

    const evil = await t.call('OPTIONS', '/api/v1/auth/login', { headers: { origin: 'https://evil.example' } })
    expect(evil.status).toBe(403)
    expect(evil.headers.get('access-control-allow-origin')).toBeNull()
  })

  test('state-changing requests from a foreign origin are rejected before reaching handlers (CSRF)', async () => {
    const foreign = await t.call('POST', '/api/v1/auth/logout', { headers: { origin: 'https://evil.example' } })
    expect(foreign.status).toBe(403)
    expect(foreign.json.error.code).toBe('CSRF_ORIGIN_REJECTED')
    const crossSite = await t.call('POST', '/api/v1/auth/logout', { headers: { 'sec-fetch-site': 'cross-site' } })
    expect(crossSite.status).toBe(403)
    const allowed = await t.call('POST', '/api/v1/auth/logout', { headers: { origin: ALLOWED_ORIGIN } })
    expect(allowed.status).toBe(200)
  })
})

describe('authentication', () => {
  test('login sets an HttpOnly SameSite=Lax session cookie and returns the server-side identity', async () => {
    const res = await t.call('POST', '/api/v1/auth/login', { body: { email: ' Budi.Santoso@MANOVA.id ', password: TEST_PASSWORD } })
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie')!
    expect(cookie).toMatch(/^manova_session=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=43200$/)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.json.data.user).toEqual({ id: 'USR-008', name: 'Budi Santoso', email: 'budi.santoso@manova.id', role: 'finance', roleLabel: 'Finance & ACC', kind: 'internal' })
    expect(res.json.data.permissions.modules['finance-acc']).toBe('MANAGE')
    expect(res.json.data.permissions.capabilities).toContain('finance.post-cash')
    expect(res.json.data.permissions.canViewFullFinancials).toBe(true)
  })

  test('the database stores only a hash of the session token', async () => {
    const cookie = await t.login(DEMO.sales)
    const token = cookie.split('=')[1]!
    const rows = await t.db.query('select id from sessions where id = $1', [token])
    expect(rows).toHaveLength(0)
    const [hashed] = await t.db.query<{ n: number }>(`select count(*)::int as n from sessions where user_id = 'USR-001'`)
    expect(hashed!.n).toBeGreaterThan(0)
  })

  test('wrong password and unknown email are indistinguishable', async () => {
    const wrong = await t.call('POST', '/api/v1/auth/login', { body: { email: DEMO.management, password: 'nope' } })
    const unknown = await t.call('POST', '/api/v1/auth/login', { body: { email: 'ghost@manova.id', password: 'nope' } })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.json.error).toEqual(unknown.json.error)
    expect(wrong.json.error).toEqual({ code: 'INVALID_CREDENTIALS', message: 'Email atau kata sandi salah.' })
  })

  test('validation errors are field-level and in Indonesian', async () => {
    const missing = await t.call('POST', '/api/v1/auth/login', { body: { email: DEMO.finance } })
    expect(missing.status).toBe(400)
    expect(missing.json.error.code).toBe('VALIDATION_FAILED')
    expect(missing.json.error.fieldErrors.password).toEqual(['Kata sandi wajib diisi.'])

    const malformed = await t.call('POST', '/api/v1/auth/login', { body: { email: 'not-an-email', password: 'x' } })
    expect(malformed.json.error.fieldErrors).toEqual({ email: ['Format email tidak valid.'] })

    const badJson = await t.call('POST', '/api/v1/auth/login', { rawBody: '{oops' })
    expect(badJson.status).toBe(400)
    expect(badJson.json.error.code).toBe('INVALID_JSON')
  })

  test('/auth/me requires a valid session', async () => {
    expect((await t.call('GET', '/api/v1/auth/me')).status).toBe(401)
    expect((await t.call('GET', '/api/v1/auth/me', { cookie: 'manova_session=forged-token' })).status).toBe(401)
    expect((await t.call('GET', '/api/v1/auth/me', { cookie: `manova_session=${'A'.repeat(43)}` })).status).toBe(401)
    const cookie = await t.login(DEMO.client)
    const me = await t.call('GET', '/api/v1/auth/me', { cookie })
    expect(me.status).toBe(200)
    expect(me.json.data.scope).toEqual({ partyId: 'PTY-005', vendorId: null })
    expect(me.json.data.permissions.capabilities).toEqual([])
  })

  test('logout revokes the session server-side and clears the cookie', async () => {
    const cookie = await t.login(DEMO.operations)
    const out = await t.call('POST', '/api/v1/auth/logout', { cookie })
    expect(out.status).toBe(200)
    expect(out.headers.get('set-cookie')).toContain('Max-Age=0')
    expect((await t.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(401)
  })

  test('suspending a user ends their existing sessions and blocks login', async () => {
    await t.addUser({ id: 'USR-T-SUSP', email: 'suspend.me@manova.id', role: 'sales' })
    const cookie = await t.login('suspend.me@manova.id')
    await t.db.query(`update users set status = 'suspended' where id = 'USR-T-SUSP'`)
    expect((await t.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(401)
    const again = await t.call('POST', '/api/v1/auth/login', { body: { email: 'suspend.me@manova.id', password: TEST_PASSWORD } })
    expect(again.status).toBe(401)
    expect(again.json.error.code).toBe('INVALID_CREDENTIALS')
  })

  test('expired sessions are rejected', async () => {
    const cookie = await t.login(DEMO.management)
    await t.db.query(`update sessions set created_at = now() - interval '2 days', expires_at = now() - interval '1 second' where user_id = 'USR-003'`)
    expect((await t.call('GET', '/api/v1/auth/me', { cookie })).status).toBe(401)
  })

  test('five failed attempts lock that email for the window (429 + Retry-After), even with the right password', async () => {
    await t.addUser({ id: 'USR-T-LOCK', email: 'lock.me@manova.id', role: 'sales' })
    for (let i = 0; i < 5; i++) {
      expect((await t.call('POST', '/api/v1/auth/login', { body: { email: 'lock.me@manova.id', password: 'wrong' } })).status).toBe(401)
    }
    const locked = await t.call('POST', '/api/v1/auth/login', { body: { email: 'lock.me@manova.id', password: TEST_PASSWORD } })
    expect(locked.status).toBe(429)
    expect(locked.json.error.code).toBe('TOO_MANY_ATTEMPTS')
    expect(Number(locked.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  test('parallel guesses cannot bypass the throttle (attempts are counted before verification)', async () => {
    await t.addUser({ id: 'USR-T-PAR', email: 'parallel@manova.id', role: 'sales' })
    const results = await Promise.all(
      Array.from({ length: 20 }, () => t.call('POST', '/api/v1/auth/login', { body: { email: 'parallel@manova.id', password: 'wrong' } }))
    )
    const statuses = results.map(r => r.status)
    expect(statuses.filter(s => s === 401)).toHaveLength(5)
    expect(statuses.filter(s => s === 429)).toHaveLength(15)
  })

  test('a malformed session cookie is simply "not signed in" (401, not 500)', async () => {
    const res = await t.call('GET', '/api/v1/auth/me', { cookie: 'manova_session=%E0%A4%A' })
    expect(res.status).toBe(401)
  })

  test('logins, failures and logouts are audited without secrets', async () => {
    const rows = await t.db.query<{ action: string; details: unknown }>(
      `select action, details from audit_events where action like 'auth.%' order by id`
    )
    const actions = new Set(rows.map(r => r.action))
    expect(actions).toEqual(new Set(['auth.login', 'auth.login_failed', 'auth.logout']))
    expect(JSON.stringify(rows)).not.toContain(TEST_PASSWORD)
    expect(rows.find(r => r.action === 'auth.login_failed')!.details).toHaveProperty('reason')
  })
})
