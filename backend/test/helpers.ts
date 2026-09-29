import { createApp } from '../src/app'
import { LoginThrottle } from '../src/auth/login-throttle'
import { hashPassword } from '../src/auth/password'
import { loadConfig, type AppConfig } from '../src/config/env'
import { openDb, type Db } from '../src/db/client'
import { migrateUp } from '../src/db/migrator'
import { seedDemo } from '../src/db/seed-demo'

/**
 * Test databases: in-memory PGlite by default (no infrastructure needed). Set TEST_DATABASE_URL to a
 * PostgreSQL server to run the same suite against it; each test file then gets its own throwaway schema.
 */

export const TEST_PASSWORD = 'test-password-123'
export const ALLOWED_ORIGIN = 'http://localhost:8080'

export const DEMO = {
  superAdmin: 'admin@manova.id',
  management: 'sari.wijaya@manova.id',
  sales: 'rani.kusuma@manova.id',
  finance: 'budi.santoso@manova.id',
  operations: 'doni.saputra@manova.id',
  vendor: 'hasan.alfarizi@pt-abc.example',
  client: 'dimas.pratama@java-bhakti.example'
} as const

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...loadConfig({ APP_ENV: 'test' }), ...overrides }
}

export async function makeTestDb(): Promise<{ db: Db; url: string; cleanup: () => Promise<void> }> {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    const db = await openDb('pglite://memory')
    return { db, url: 'pglite://memory', cleanup: () => db.close() }
  }
  const schema = `t_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
  const admin = await openDb(url, { max: 1 })
  await admin.exec(`create schema ${schema}`)
  const db = await openDb(url, { searchPath: schema, max: 4 })
  return {
    db,
    url,
    cleanup: async () => {
      await db.close()
      await admin.exec(`drop schema ${schema} cascade`)
      await admin.close()
    }
  }
}

interface CallOptions {
  body?: unknown
  rawBody?: string
  cookie?: string
  headers?: Record<string, string>
}

export async function makeTestApp(options: { migrate?: boolean; seed?: boolean; config?: Partial<AppConfig> } = {}) {
  const { db, cleanup } = await makeTestDb()
  if (options.migrate !== false) await migrateUp(db)
  if (options.migrate !== false && options.seed !== false) await seedDemo(db, { appEnv: 'test', password: TEST_PASSWORD })
  const config = testConfig(options.config)
  const app = createApp({ db, config, throttle: new LoginThrottle() })

  async function call(method: string, path: string, opts: CallOptions = {}) {
    const headers: Record<string, string> = { ...opts.headers }
    if (opts.cookie) headers.cookie = opts.cookie
    let body: string | undefined
    if (opts.rawBody !== undefined) body = opts.rawBody
    else if (opts.body !== undefined) body = JSON.stringify(opts.body)
    if (body !== undefined) headers['content-type'] ??= 'application/json'
    const res = await app.handle(new Request(`http://localhost${path}`, { method, headers, body }))
    const text = await res.text()
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    return { status: res.status, headers: res.headers, json, text }
  }

  /** Signs in and returns the `name=value` pair to send back as a Cookie header. */
  async function login(email: string, password = TEST_PASSWORD): Promise<string> {
    const res = await call('POST', '/api/v1/auth/login', { body: { email, password } })
    if (res.status !== 200) throw new Error(`login ${email} failed: ${res.status} ${res.text}`)
    return res.headers.get('set-cookie')!.split(';')[0]!
  }

  /** Adds a login for an arbitrary role/scope (e.g. a vendor that owns services). */
  async function addUser(user: { id: string; email: string; role: string; partyId?: string; vendorId?: string; status?: string }) {
    await db.query(
      `insert into users (id, email, name, role, party_id, vendor_id, status, password_hash) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [user.id, user.email, `Test ${user.id}`, user.role, user.partyId ?? null, user.vendorId ?? null, user.status ?? 'active', await hashPassword(TEST_PASSWORD)]
    )
  }

  return { app, db, config, call, login, addUser, cleanup }
}

export type TestApp = Awaited<ReturnType<typeof makeTestApp>>
