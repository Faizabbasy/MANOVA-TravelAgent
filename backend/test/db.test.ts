import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Db } from '../src/db/client'
import { checksumOf, loadMigrations, migrateDown, migrateUp, migrationStatus, type Migration } from '../src/db/migrator'
import { DEMO_CORE, SeedRefusedError, seedDemo } from '../src/db/seed-demo'
import { makeTestDb } from './helpers'

async function tableNames(db: Db): Promise<string[]> {
  const rows = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables where table_schema = current_schema() order by table_name`
  )
  return rows.map(r => r.table_name)
}

describe('driver parity', () => {
  let db: Db
  let cleanup: () => Promise<void>
  beforeAll(async () => ({ db, cleanup } = await makeTestDb()))
  afterAll(() => cleanup())

  test('int8/numeric come back as strings, date as YYYY-MM-DD, timestamptz as Date, jsonb parsed', async () => {
    const [row] = await db.query(
      `select '9007199254740993'::bigint as big, 12.50::numeric as num, '2026-10-05'::date as day, now() as ts, '{"a":1}'::jsonb as doc`
    )
    expect(row).toMatchObject({ big: '9007199254740993', num: '12.50', day: '2026-10-05', doc: { a: 1 } })
    expect(row!.ts).toBeInstanceOf(Date)
  })

  test('JSON written as $n::text::jsonb round-trips as an object on both drivers', async () => {
    // Regression: postgres.js re-serialises a string bound directly to ::jsonb, storing a JSON *string*.
    const [row] = await db.query<{ doc: unknown; kind: string }>(
      `select $1::text::jsonb as doc, jsonb_typeof($1::text::jsonb) as kind`,
      [JSON.stringify({ reason: 'bad_password' })]
    )
    expect(row).toEqual({ doc: { reason: 'bad_password' }, kind: 'object' })
  })

  test('a throwing transaction rolls back every statement', async () => {
    await db.exec('create table tx_probe (n int)')
    await expect(
      db.transaction(async tx => {
        await tx.query('insert into tx_probe values (1)')
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
    const [row] = await db.query<{ c: number }>('select count(*)::int as c from tx_probe')
    expect(row!.c).toBe(0)
    await db.exec('drop table tx_probe')
  })
})

describe('migration files', () => {
  test('are contiguous pairs with CRLF-independent checksums', () => {
    const migrations = loadMigrations()
    expect(migrations.map(m => m.version)).toEqual([1, 2, 3, 4, 5])
    expect(migrations.map(m => m.name)).toEqual(['foundation', 'core_references', 'identity', 'three_roles', 'commercial_references'])
    const m = migrations[0]!
    expect(checksumOf(m.up.replace(/\n/g, '\r\n'))).toBe(m.checksum)
  })

  test('reject a directory with an unpaired or misnamed file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mig-'))
    try {
      writeFileSync(join(dir, '0001_a.up.sql'), 'select 1;')
      expect(() => loadMigrations(dir)).toThrow('needs both')
      writeFileSync(join(dir, '0001_a.down.sql'), 'select 1;')
      writeFileSync(join(dir, 'oops.sql'), 'select 1;')
      expect(() => loadMigrations(dir)).toThrow('Unrecognised')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('migration runner', () => {
  let db: Db
  let cleanup: () => Promise<void>
  beforeAll(async () => ({ db, cleanup } = await makeTestDb()))
  afterAll(() => cleanup())

  test('fresh database: applies every migration once, then is a no-op', async () => {
    const applied = await migrateUp(db)
    expect(applied.map(m => m.version)).toEqual([1, 2, 3, 4, 5])
    expect(await migrateUp(db)).toEqual([])
    const status = await migrationStatus(db)
    expect(status).toMatchObject({ current: 5, pending: [], problems: [] })
    expect(await tableNames(db)).toEqual([
      'audit_events', 'booking_refs', 'parties', 'project_members', 'project_services', 'projects',
      'schema_migrations', 'service_orders', 'sessions', 'users', 'vendors'
    ])
  })

  test('rolls back step by step and to zero, leaving only the bookkeeping table', async () => {
    expect((await migrateDown(db, { steps: 2 })).map(m => m.version)).toEqual([5, 4])
    expect(await tableNames(db)).toContain('users')
    expect((await migrateDown(db)).map(m => m.version)).toEqual([3])
    expect(await tableNames(db)).not.toContain('users')
    expect((await migrateDown(db, { to: 0 })).map(m => m.version)).toEqual([2, 1])
    expect(await tableNames(db)).toEqual(['schema_migrations'])
    expect((await migrateUp(db)).map(m => m.version)).toEqual([1, 2, 3, 4, 5])
  })

  test('migrate --to stops at the requested version', async () => {
    await migrateDown(db, { to: 0 })
    expect((await migrateUp(db, { to: 2 })).map(m => m.version)).toEqual([1, 2])
    expect((await migrationStatus(db)).pending.map(m => m.version)).toEqual([3, 4, 5])
    await migrateUp(db)
  })

  test('0004 folds management/sales/operations users into admin, and down maps them back', async () => {
    const scratch = await makeTestDb()
    try {
      await migrateUp(scratch.db, { to: 3 })
      for (const [id, role] of [['U1', 'management'], ['U2', 'sales'], ['U3', 'operations'], ['U4', 'finance']] as const) {
        await scratch.db.query("insert into users (id, email, name, role) values ($1, $2, 'X', $3)", [id, id.toLowerCase() + '@x.id', role])
      }
      await migrateUp(scratch.db, { to: 4 })
      const roles = async () => (await scratch.db.query<{ id: string; role: string }>('select id, role from users order by id')).map(r => r.role)
      expect(await roles()).toEqual(['admin', 'admin', 'admin', 'finance'])
      await expect(scratch.db.query("insert into users (id, email, name, role) values ('U5', 'u5@x.id', 'X', 'sales')")).rejects.toThrow()
      await migrateDown(scratch.db, { to: 3 })
      expect(await roles()).toEqual(['operations', 'operations', 'operations', 'finance'])
    } finally {
      await scratch.cleanup()
    }
  })

  test('refuses to run when an applied migration file was edited (drift)', async () => {
    const edited: Migration[] = loadMigrations().map(m => (m.version === 2 ? { ...m, checksum: checksumOf(m.up + '-- edited') } : m))
    const status = await migrationStatus(db, edited)
    expect(status.problems[0]).toContain('checksum mismatch')
    await expect(migrateUp(db, { migrations: edited })).rejects.toThrow('Refusing to migrate')
  })

  test('refuses an out-of-order migration', async () => {
    const scratch = await makeTestDb()
    try {
      // Pretend 0003 landed before 0002 (e.g. a merge of two branches): record it without running it.
      const all = loadMigrations()
      await migrateUp(scratch.db, { to: 1 })
      await scratch.db.query('insert into schema_migrations (version, name, checksum) values (3, $1, $2)', [all[2]!.name, all[2]!.checksum])
      const status = await migrationStatus(scratch.db, all)
      expect(status.problems.join()).toContain('out of order')
      await expect(migrateUp(scratch.db)).rejects.toThrow('Refusing to migrate')
    } finally {
      await scratch.cleanup()
    }
  })
})

describe('database invariants', () => {
  let db: Db
  let cleanup: () => Promise<void>
  beforeAll(async () => {
    ;({ db, cleanup } = await makeTestDb())
    await migrateUp(db)
    await seedDemo(db, { appEnv: 'test', password: 'x' })
  })
  afterAll(() => cleanup())

  test('audit_events is append-only (UPDATE, DELETE and TRUNCATE are rejected)', async () => {
    await db.query(`insert into audit_events (action) values ('test.probe')`)
    await expect(db.query(`update audit_events set action = 'x.y'`)).rejects.toThrow('append-only')
    await expect(db.query('delete from audit_events')).rejects.toThrow('append-only')
    await expect(db.exec('truncate audit_events')).rejects.toThrow('append-only')
  })

  test('portal users must carry exactly their own scope; internal users none', async () => {
    const insert = (role: string, partyId: string | null, vendorId: string | null) =>
      db.query(`insert into users (id, email, name, role, party_id, vendor_id) values ($1, $2, 'X', $3, $4, $5)`,
        [`USR-T${Math.random()}`, `${crypto.randomUUID()}@x.id`, role, partyId, vendorId])
    await expect(insert('client', null, null)).rejects.toThrow()
    await expect(insert('vendor', 'PTY-001', null)).rejects.toThrow()
    await expect(insert('finance', 'PTY-001', null)).rejects.toThrow()
    await expect(insert('client', 'PTY-001', null)).resolves.toBeDefined()
  })

  test('emails are unique and stored lower-case', async () => {
    await expect(db.query(`insert into users (id, email, name, role) values ('USR-X1', 'Budi.Santoso@manova.id', 'X', 'sales')`)).rejects.toThrow()
    await expect(db.query(`insert into users (id, email, name, role) values ('USR-X2', 'budi.santoso@manova.id', 'X', 'sales')`)).rejects.toThrow()
  })

  test("a booking's service must belong to the booking's project", async () => {
    // SVC-1011 belongs to PRJ-101, not PRJ-102
    await expect(db.query(
      `insert into booking_refs (booking_type, booking_id, project_id, service_id) values ('flight', 'FLT-T1', 'PRJ-102', 'SVC-1011')`
    )).rejects.toThrow()
    await expect(db.query(
      `insert into booking_refs (booking_type, booking_id, project_id, service_id) values ('flight', 'FLT-T2', 'PRJ-101', 'SVC-1011')`
    )).resolves.toBeDefined()
  })

  test("booking types use the orchestration literals ('transport', not 'transportation')", async () => {
    await expect(db.query(
      `insert into booking_refs (booking_type, booking_id, project_id) values ('transportation', 'TRN-T1', 'PRJ-103')`
    )).rejects.toThrow()
  })
})

describe('demo seed', () => {
  let db: Db
  let cleanup: () => Promise<void>
  beforeAll(async () => {
    ;({ db, cleanup } = await makeTestDb())
    await migrateUp(db)
  })
  afterAll(() => cleanup())

  test('is refused in production', async () => {
    await expect(seedDemo(db, { appEnv: 'production' })).rejects.toBeInstanceOf(SeedRefusedError)
  })

  test('is idempotent and keeps the frontend fixture IDs', async () => {
    await seedDemo(db, { appEnv: 'test', password: 'x' })
    await seedDemo(db, { appEnv: 'test', password: 'x' })
    const count = async (t: string) => (await db.query<{ n: number }>(`select count(*)::int as n from ${t}`))[0]!.n
    expect(await count('projects')).toBe(DEMO_CORE.projects.length)
    expect(await count('users')).toBe(DEMO_CORE.users.length)
    expect(await count('booking_refs')).toBe(DEMO_CORE.bookingRefs.length)
    expect(await count('service_orders')).toBe(DEMO_CORE.serviceOrders.length)
    const ids = (await db.query<{ id: string }>('select id from projects order by id')).map(r => r.id)
    expect(ids).toEqual(['PRJ-101', 'PRJ-102', 'PRJ-103', 'PRJ-104', 'PRJ-201', 'PRJ-202', 'PRJ-203', 'PRJ-204'])
    const [client] = await db.query('select role, party_id, provenance from users where id = $1', ['USR-021'])
    expect(client).toEqual({ role: 'client', party_id: 'PTY-005', provenance: 'demo-fixture' })
  })

  test('refuses to run on a database that holds real (non-demo) data, and never overwrites it', async () => {
    const scratch = await makeTestDb()
    try {
      await migrateUp(scratch.db)
      // A real account that happens to share a fixture ID (e.g. imported production data)
      await scratch.db.query(
        `insert into users (id, email, name, role, password_hash, provenance) values ('USR-010', 'real.admin@corp.id', 'Real Admin', 'finance', 'real-hash', 'migration')`
      )
      await expect(seedDemo(scratch.db, { appEnv: 'development' })).rejects.toBeInstanceOf(SeedRefusedError)
      const [row] = await scratch.db.query('select email, role, password_hash from users where id = $1', ['USR-010'])
      expect(row).toEqual({ email: 'real.admin@corp.id', role: 'finance', password_hash: 'real-hash' })
    } finally {
      await scratch.cleanup()
    }
  })

  test('carries operational reference values only — no finance records (invoices, payments, balances)', () => {
    const keys = new Set<string>()
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') for (const [k, child] of Object.entries(v)) { keys.add(k); walk(child) }
    }
    walk(DEMO_CORE)
    expect([...keys].filter(k => /idr$|cost|balance|paid|invoice|payment|receipt|transaction|outstanding/i.test(k))).toEqual([])
    // The only money-like values are owned by Project/Booking (ADR-007): contract value and booking sell price.
    expect([...keys].filter(k => /minor/i.test(k)).sort()).toEqual(['contractValueMinor', 'sellAmountMinor'])
  })
})
