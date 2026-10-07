import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Db } from '../src/db/client'
import { checksumOf, loadMigrations, migrateDown, migrateUp, migrationStatus, type Migration } from '../src/db/migrator'
import { DEMO_CORE, SeedRefusedError, seedDemo } from '../src/db/seed-demo'
import { makeTestDb } from './helpers'
import { nextId, syncIdSequences } from '../src/shared/ids'

/** Derived from the migration files so adding a migration does not rewrite these tests. */
const ALL_VERSIONS = loadMigrations().map(m => m.version)
const LATEST = ALL_VERSIONS.length

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
    expect(migrations.map(m => m.version)).toEqual(Array.from({ length: LATEST }, (_, i) => i + 1))
    expect(migrations.map(m => m.name).slice(0, 6)).toEqual(['foundation', 'core_references', 'identity', 'three_roles', 'commercial_references', 'finance_money_core'])
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
    expect(applied.map(m => m.version)).toEqual(ALL_VERSIONS)
    expect(await migrateUp(db)).toEqual([])
    const status = await migrationStatus(db)
    expect(status).toMatchObject({ current: LATEST, pending: [], problems: [] })
    expect(await tableNames(db)).toEqual(expect.arrayContaining([
      'audit_events', 'bank_accounts', 'booking_refs', 'financial_transactions', 'idempotency_keys', 'parties', 'project_members',
      'project_services', 'projects', 'schema_migrations', 'service_orders', 'sessions', 'transfers', 'users', 'vendors'
    ]))
  })

  test('rolls back step by step and to zero, leaving only the bookkeeping table', async () => {
    expect((await migrateDown(db, { to: 3 })).map(m => m.version)).toEqual(ALL_VERSIONS.filter(v => v > 3).reverse())
    expect(await tableNames(db)).toContain('users')
    expect((await migrateDown(db)).map(m => m.version)).toEqual([3])
    expect(await tableNames(db)).not.toContain('users')
    expect((await migrateDown(db, { to: 0 })).map(m => m.version)).toEqual([2, 1])
    expect(await tableNames(db)).toEqual(['schema_migrations'])
    expect((await migrateUp(db)).map(m => m.version)).toEqual(ALL_VERSIONS)
  })

  test('migrate --to stops at the requested version', async () => {
    await migrateDown(db, { to: 0 })
    expect((await migrateUp(db, { to: 2 })).map(m => m.version)).toEqual([1, 2])
    expect((await migrationStatus(db)).pending.map(m => m.version)).toEqual(ALL_VERSIONS.filter(v => v > 2))
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
    expect(ids).toEqual(DEMO_CORE.projects.map(p => p.id).sort())
    expect(await count('sales_order_refs')).toBe(DEMO_CORE.salesOrders.length)
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

  test('project operational columns and id sequences follow the seed', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [p] = await db.query<{ characteristic: string; service_scope: string[]; traveler_count: number }>(
        "select characteristic, service_scope, traveler_count from projects where id = 'PRJ-103'"
      )
      const fixture = DEMO_CORE.projects.find(x => x.id === 'PRJ-103')!
      expect(p).toEqual({ characteristic: fixture.characteristic!, service_scope: fixture.serviceScope!, traveler_count: fixture.travelerCount! })
      const seq = await db.query<{ prefix: string; last_value: number }>("select prefix, last_value from id_sequences where prefix in ('PRJ-', 'PTY-') order by prefix")
      const maxOf = (ids: string[], prefix: string) => Math.max(...ids.filter(id => id.startsWith(prefix)).map(id => Number(id.slice(prefix.length))))
      expect(seq).toEqual([
        { prefix: 'PRJ-', last_value: maxOf(DEMO_CORE.projects.map(x => x.id), 'PRJ-') },
        { prefix: 'PTY-', last_value: maxOf(DEMO_CORE.parties.map(x => x.id), 'PTY-') }
      ])
      expect(await nextId(db, 'PRJ-')).toBe(`PRJ-${seq[0]!.last_value + 1}`)
    } finally {
      await cleanup()
    }
  })

  test('customer profile, contacts and activities follow the seed', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [p] = await db.query<{ city: string | null; credit_limit_minor: string | null; account_owner_user_id: string | null }>(
        "select city, credit_limit_minor, account_owner_user_id from parties where id = 'PTY-001'"
      )
      const fixture = DEMO_CORE.parties.find(x => x.id === 'PTY-001')!
      expect(p).toEqual({ city: fixture.city ?? null, credit_limit_minor: fixture.creditLimitMinor ?? null, account_owner_user_id: fixture.accountOwnerUserId ?? null })
      const [counts] = await db.query<{ contacts: string; activities: string }>(
        'select (select count(*) from party_contacts) as contacts, (select count(*) from party_activities) as activities'
      )
      expect(counts).toEqual({ contacts: String(DEMO_CORE.partyContacts!.length), activities: String(DEMO_CORE.partyActivities!.length) })
      const seq = await db.query<{ prefix: string }>("select prefix from id_sequences where prefix in ('CP-', 'PACT-') order by prefix")
      expect(seq.map(s => s.prefix)).toEqual(['CP-', 'PACT-'])
      expect(await nextId(db, 'CP-')).toMatch(/^CP-\d{3,}$/)
    } finally {
      await cleanup()
    }
  })
  test('vendor profile, contacts, products and documents follow the seed', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [v] = await db.query<{ contact_name: string | null; category: string | null }>("select contact_name, category from vendors where id = 'VND-002'")
      const fixture = DEMO_CORE.vendors.find(x => x.id === 'VND-002')!
      expect(v).toEqual({ contact_name: fixture.contactName ?? null, category: fixture.category ?? null })
      const [counts] = await db.query<{ c: string; p: string; d: string }>(
        'select (select count(*) from vendor_contacts) as c, (select count(*) from vendor_products) as p, (select count(*) from vendor_documents) as d'
      )
      expect(counts).toEqual({ c: String(DEMO_CORE.vendorContacts!.length), p: String(DEMO_CORE.vendorProducts!.length), d: String(DEMO_CORE.vendorDocuments!.length) })
      expect(await nextId(db, 'VND-')).toBe(`VND-${String(Math.max(...DEMO_CORE.vendors.map(x => Number(x.id.slice(4)))) + 1).padStart(3, '0')}`)
    } finally {
      await cleanup()
    }
  })

  test('services and bookings carry label, status and details after 0022', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [svc] = await db.query<{ label: string; status: string }>("select label, status from project_services where id = 'SVC-1011'")
      expect(svc!.label).not.toBe('')
      expect(svc!.status).toMatch(/^(not-started|sourcing|quoted|pending-confirmation|confirmed|changed|completed|cancelled)$/)
      const [b] = await db.query<{ status: string; details: unknown }>("select status, details from booking_refs where booking_type = 'flight' and booking_id = 'FLT-1011'")
      expect(typeof b!.status).toBe('string')
      expect(typeof b!.details).toBe('object')
      await expect(db.query("update booking_refs set status = 'issued' where booking_type = 'hotel' and booking_id = 'HTL-1033'")).rejects.toThrow()
      // Inserts that leave label/status out get the default of their type.
      await db.query("insert into booking_refs (booking_type, booking_id, project_id) values ('mice', 'MICE-T9', 'PRJ-101')")
      const [m] = await db.query<{ status: string }>("select status from booking_refs where booking_id = 'MICE-T9'")
      expect(m!.status).toBe('planning')
      await db.query("insert into project_services (id, project_id, service_type) values ('SVC-T9', 'PRJ-101', 'transportation')")
      const [s] = await db.query<{ label: string }>("select label from project_services where id = 'SVC-T9'")
      expect(s!.label).toBe('Transportation')
      const seqs = await db.query<{ prefix: string; last_value: number }>("select prefix, last_value from id_sequences where prefix in ('SVC-','FLT-','HTL-','TRN-','MICE-') order by prefix")
      expect(seqs.map(x => x.prefix)).toEqual(['FLT-', 'HTL-', 'MICE-', 'SVC-', 'TRN-'])
      expect(seqs.every(x => x.last_value > 0)).toBe(true)
    } finally {
      await cleanup()
    }
  })

  test('seed fills services and bookings from the fixtures (S4a)', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [svc] = await db.query<{ label: string; status: string; booking_reference: string | null }>("select label, status, booking_reference from project_services where id = 'SVC-1011'")
      const fx = DEMO_CORE.projectServices.find(s => s.id === 'SVC-1011')!
      expect(fx.label).toBeTruthy()
      expect(svc).toEqual({ label: fx.label!, status: fx.status!, booking_reference: fx.bookingReference ?? null })
      const [b] = await db.query<{ status: string; reference: string | null; details: Record<string, unknown> }>("select status, reference, details from booking_refs where booking_type = 'flight' and booking_id = 'FLT-1011'")
      const fb = DEMO_CORE.bookingRefs.find(x => x.bookingId === 'FLT-1011')!
      expect(fb.status).toBeTruthy()
      expect(b!.status).toBe(fb.status!)
      expect(b!.reference).toBe(fb.reference ?? null)
      expect(Array.isArray(b!.details.segments)).toBe(true)
      expect('status' in b!.details).toBe(false)
      const [mice] = await db.query<{ sell_amount_minor: string | null }>("select sell_amount_minor from booking_refs where booking_type = 'mice' limit 1")
      expect(mice!.sell_amount_minor).toBe(DEMO_CORE.bookingRefs.find(x => x.bookingType === 'mice')!.sellAmountMinor)
    } finally {
      await cleanup()
    }
  })

  test('quotations, service order status and booking attempts exist after 0023', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [so] = await db.query<{ status: string; line_items: unknown }>("select status, line_items from service_orders where id = 'SO-101F'")
      expect(typeof so!.status).toBe('string')
      expect(Array.isArray(so!.line_items)).toBe(true)
      await expect(db.query("update service_orders set status = 'lost' where id = 'SO-101F'")).rejects.toThrow()
      await db.query("insert into vendor_quotations (id, vendor_id, project_id, service_id, service_type, amount_minor, submitted_on) values ('VQ-T1', 'VND-001', 'PRJ-101', 'SVC-1011', 'flight', 1000, '2026-10-01')")
      await expect(db.query("insert into vendor_quotations (id, vendor_id, project_id, service_id, service_type, amount_minor, submitted_on) values ('VQ-T2', 'VND-001', 'PRJ-102', 'SVC-1011', 'flight', 1000, '2026-10-01')")).rejects.toThrow() // service of another project
      await expect(db.query("insert into vendor_quotations (id, vendor_id, project_id, service_type, amount_minor, submitted_on) values ('VQ-T3', 'VND-001', 'PRJ-101', 'flight', 0, '2026-10-01')")).rejects.toThrow() // amount > 0
      await db.query("insert into booking_attempts (id, booking_type, booking_id, outcome) values ('BAT-T1', 'flight', 'FLT-1011', 'failed')")
      await expect(db.query("insert into booking_attempts (id, booking_type, booking_id, outcome) values ('BAT-T2', 'flight', 'FLT-1011', 'maybe')")).rejects.toThrow()
      const seqs = await db.query<{ prefix: string }>("select prefix from id_sequences where prefix in ('VQ-','SO-','BAT-') order by prefix")
      expect(seqs.map(s => s.prefix)).toEqual(['BAT-', 'SO-', 'VQ-'])
    } finally {
      await cleanup()
    }
  })

  test('demo travelers, groups and rooms are seeded; a re-seed keeps user edits', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [counts] = await db.query<{ t: number; g: number; r: number }>('select (select count(*)::int from travelers) as t, (select count(*)::int from traveler_groups) as g, (select count(*)::int from room_assignments) as r')
      expect(counts).toEqual({ t: 44, g: 8, r: 8 })
      await db.query("update travelers set dietary_restrictions = 'Halal', changed_by_api_at = now() where id = 'TRV-1012'")
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      expect((await db.query<{ d: string }>("select dietary_restrictions as d from travelers where id = 'TRV-1012'"))[0]!.d).toBe('Halal')
    } finally {
      await cleanup()
    }
  })

  test('travelers, groups and rooms exist after 0027', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      await db.query("insert into traveler_groups (id, project_id, name) values ('GRP-T1', 'PRJ-101', 'Tim A')")
      await db.query("insert into travelers (id, project_id, group_id, name) values ('TRV-T1', 'PRJ-101', 'GRP-T1', 'Uji')")
      await expect(db.query("insert into travelers (id, project_id, name, cancelled) values ('TRV-T2', 'PRJ-101', 'Uji', true)")).rejects.toThrow() // cancel needs a reason
      await db.query(`insert into room_assignments (id, project_id, group_id, room_label, room_type, traveler_ids) values ('ROOM-T1', 'PRJ-101', 'GRP-T1', 'Twin 1', 'twin', '["TRV-T1"]')`)
      await expect(db.query("insert into room_assignments (id, project_id, group_id, room_label, room_type) values ('ROOM-T2', 'PRJ-101', 'GRP-T1', 'X', 'villa')")).rejects.toThrow()
      const seqs = await db.query<{ prefix: string }>("select prefix from id_sequences where prefix in ('GRP-','TRV-','ROOM-') order by prefix")
      expect(seqs.map(s => s.prefix)).toEqual(['GRP-', 'ROOM-', 'TRV-'])
    } finally {
      await cleanup()
    }
  })

  test('a Group Trip booking whose DP Finance confirmed before S6b becomes paid, and a re-seed keeps it', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      // Seed on the full schema (syncIdSequences knows every table), then step back to before the backfill.
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      await migrateDown(db, { to: 25 })
      // A participant invoice issued by the pre-S6b confirm-dp (order status was not touched then).
      await db.query(
        `insert into customer_invoices (id, project_id, party_id, sales_order_id, invoice_type, status, total_minor, issue_date, due_date, created_by, number, issued_at)
         values ('CINV-T1', 'PRJ-205', 'PTY-011', 'SLO-007', 'dp', 'issued', 3500000, '2026-08-20', '2026-09-01', 'USR-001', 'INV-T-1', now())`)
      await migrateUp(db)
      const [so] = await db.query<{ status: string; paid_on: string }>("select status, paid_on::text as paid_on from sales_order_refs where id = 'SLO-007'")
      expect(so).toEqual({ status: 'paid', paid_on: '2026-08-20' })
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      expect((await db.query<{ status: string }>("select status from sales_order_refs where id = 'SLO-007'"))[0]!.status).toBe('paid')
    } finally {
      await cleanup()
    }
  })

  test('all demo sales orders are seeded with status; a re-seed keeps statuses the API changed', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const rows = await db.query<{ id: string; status: string; project_id: string | null }>('select id, status, project_id from sales_order_refs order by id')
      expect(rows).toHaveLength(13)
      expect(rows.find(r => r.id === 'SLO-001')).toEqual({ id: 'SLO-001', status: 'draft', project_id: null })
      expect(rows.find(r => r.id === 'SLO-006')!.status).toBe('paid')
      await db.query("update sales_order_refs set status = 'cancelled', status_reason = 'Batal', status_changed_at = now() where id = 'SLO-007'")
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [after] = await db.query<{ status: string; status_reason: string }>("select status, status_reason from sales_order_refs where id = 'SLO-007'")
      expect(after).toEqual({ status: 'cancelled', status_reason: 'Batal' })
    } finally {
      await cleanup()
    }
  })

  test('sales orders carry status and trip details after 0025; standalone orders have no project', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      await db.query("insert into sales_order_refs (id, party_id, price_minor, traveler_count, destination, travel_start_date, travel_end_date) values ('SLO-T1', 'PTY-006', 1000, 2, 'Bali', '2026-12-01', '2026-12-03')")
      const [row] = await db.query<{ status: string; project_id: string | null }>("select status, project_id from sales_order_refs where id = 'SLO-T1'")
      expect(row).toEqual({ status: 'draft', project_id: null })
      await expect(db.query("update sales_order_refs set status = 'lost' where id = 'SLO-T1'")).rejects.toThrow()
      await expect(db.query("insert into sales_order_refs (id, party_id, price_minor, traveler_count, travel_start_date, travel_end_date) values ('SLO-T2', 'PTY-006', 1000, 1, '2026-12-05', '2026-12-01')")).rejects.toThrow()
      const [seq] = await db.query<{ prefix: string }>("select prefix from id_sequences where prefix = 'SLO-'")
      expect(seq?.prefix).toBe('SLO-')
    } finally {
      await cleanup()
    }
  })

  test('leads and quotation versions exist after 0024', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      await db.query("insert into leads (id, name, source, owner_user_id) values ('LED-T1', 'Uji', 'website', 'USR-001')")
      await expect(db.query("insert into leads (id, name, source, owner_user_id) values ('LED-T2', 'Uji', 'fax', 'USR-001')")).rejects.toThrow()
      await expect(db.query("insert into leads (id, name, source, owner_user_id, travel_start_date, travel_end_date) values ('LED-T3', 'Uji', 'website', 'USR-001', '2026-10-05', '2026-10-01')")).rejects.toThrow()
      await db.query("insert into quotations (id, lead_id) values ('QUO-T1', 'LED-T1')")
      await expect(db.query("insert into quotations (id, lead_id) values ('QUO-T2', 'LED-T1')")).rejects.toThrow() // one per lead
      await db.query("insert into quotation_versions (quotation_id, version, amount_minor) values ('QUO-T1', 1, 1000)")
      await expect(db.query("insert into quotation_versions (quotation_id, version, amount_minor) values ('QUO-T1', 2, 0)")).rejects.toThrow()
      await expect(db.query("insert into quotation_versions (quotation_id, version, amount_minor, status) values ('QUO-T1', 3, 10, 'won')")).rejects.toThrow()
      await db.query("insert into lead_activities (id, lead_id, type, message, owner_user_id) values ('LACT-T1', 'LED-T1', 'call', 'Halo', 'USR-001')")
      const seqs = await db.query<{ prefix: string }>("select prefix from id_sequences where prefix in ('LED-','LACT-','QUO-') order by prefix")
      expect(seqs.map(s => s.prefix)).toEqual(['LACT-', 'LED-', 'QUO-'])
    } finally {
      await cleanup()
    }
  })

  test('new lead and quotation IDs never reuse one an existing project already points at (staging before 0024)', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      await migrateDown(db, { to: 23 })
      await db.query("update projects set lead_id = 'LED-200', source_quotation_id = 'QUO-090' where id = 'PRJ-101'")
      await migrateUp(db)
      expect(await nextId(db, 'LED-')).toBe('LED-201')
      expect(await nextId(db, 'QUO-')).toBe('QUO-091')
      // A later seed keeps the counters above those references too.
      await db.query("update id_sequences set last_value = 0 where prefix in ('LED-', 'QUO-')")
      await syncIdSequences(db)
      expect(await nextId(db, 'LED-')).toBe('LED-201')
    } finally {
      await cleanup()
    }
  })

  test('demo leads and quotations are seeded; a re-seed keeps user versions and stages', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [leadCount] = await db.query<{ n: number }>('select count(*)::int as n from leads')
      expect(leadCount!.n).toBe(31)
      const v = await db.query<{ version: number; status: string }>("select version, status from quotation_versions where quotation_id = 'QUO-005' order by version")
      expect(v.map(r => `${r.version}:${r.status}`)).toEqual(['1:superseded', '2:submitted'])
      // New project rows are checked against leads (FK NOT VALID only skips rows that existed before 0024).
      await expect(db.query("update projects set lead_id = 'LED-NOPE' where id = 'PRJ-101'")).rejects.toThrow()
      await db.query("update quotation_versions set status = 'superseded' where quotation_id = 'QUO-010' and version = 1")
      await db.query("insert into quotation_versions (quotation_id, version, amount_minor) values ('QUO-010', 2, 80000000)")
      await db.query("update quotations set current_version = 2 where id = 'QUO-010'")
      await db.query("update leads set stage = 'unqualified' where id = 'LED-002'")
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const after = await db.query<{ version: number; status: string }>("select version, status from quotation_versions where quotation_id = 'QUO-010' order by version")
      expect(after.map(r => `${r.version}:${r.status}`)).toEqual(['1:superseded', '2:draft'])
      expect((await db.query<{ current_version: number }>("select current_version from quotations where id = 'QUO-010'"))[0]!.current_version).toBe(2)
      expect((await db.query<{ stage: string }>("select stage from leads where id = 'LED-002'"))[0]!.stage).toBe('unqualified')
    } finally {
      await cleanup()
    }
  })

  test('seed fills quotations, service order status and booking attempts (S4b)', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [counts] = await db.query<{ q: string; a: string }>('select (select count(*) from vendor_quotations) as q, (select count(*) from booking_attempts) as a')
      expect(counts).toEqual({ q: String(DEMO_CORE.vendorQuotations!.length), a: String(DEMO_CORE.bookingAttempts!.length) })
      expect(DEMO_CORE.vendorQuotations!.length).toBeGreaterThan(10)
      expect(DEMO_CORE.bookingAttempts!.length).toBeGreaterThan(0)
      const [so] = await db.query<{ status: string; net_cost_minor: string }>("select status, net_cost_minor from service_orders where id = 'SO-101F'")
      expect(so).toEqual({ status: 'fulfilled', net_cost_minor: '90000000' })
      expect(await nextId(db, 'VQ-')).toBe(`VQ-${String(Math.max(...DEMO_CORE.vendorQuotations!.map(q => Number(q.id.slice(3)))) + 1).padStart(3, '0')}`)
    } finally {
      await cleanup()
    }
  })

  test('re-running the seed after API writes keeps their quotation and service order state (S4b)', async () => {
    const { db, cleanup } = await makeTestDb()
    try {
      await migrateUp(db)
      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      // As the API leaves things: the fixture accepted quotation of SVC-2051 superseded by a new one, and the
      // fixture order SO-205T cancelled and replaced by a new active order for the same service + vendor.
      const [fx] = await db.query<{ id: string; vendor_id: string }>("select id, vendor_id from vendor_quotations where service_id = 'SVC-2051' and status = 'accepted'")
      await db.query("update vendor_quotations set status = 'rejected', decision_reason = 'Diganti quotation lain.' where id = $1", [fx!.id])
      await db.query("insert into vendor_quotations (id, vendor_id, project_id, service_id, service_type, amount_minor, status, submitted_on) values ('VQ-T9', $1, 'PRJ-205', 'SVC-2051', 'transportation', 5000, 'accepted', '2026-10-07')", [fx!.vendor_id])
      const [so] = await db.query<{ vendor_id: string }>("select vendor_id from service_orders where id = 'SO-205T'")
      await db.query("update service_orders set status = 'cancelled', status_reason = 'Vendor layanan diganti.' where id = 'SO-205T'")
      await db.query("insert into service_orders (id, vendor_id, project_id, service_id, status) values ('SO-T9', $1, 'PRJ-205', 'SVC-2051', 'draft')", [so!.vendor_id])

      await seedDemo(db, { appEnv: 'test', password: 'x-password-123' })
      const [q] = await db.query<{ status: string }>('select status from vendor_quotations where id = $1', [fx!.id])
      expect(q!.status).toBe('rejected')
      const [o] = await db.query<{ status: string }>("select status from service_orders where id = 'SO-205T'")
      expect(o!.status).toBe('cancelled')
    } finally {
      await cleanup()
    }
  })

  test('carries operational reference values only — no finance records (invoices, payments, balances)', () => {
    const keys = new Set<string>()
    const detailKeys = new Set<string>()
    const walk = (v: unknown, into: Set<string>): void => {
      if (Array.isArray(v)) v.forEach(x => walk(x, into))
      // S4a: a booking's `details` is its UI-owned working document (option prices, BOQ lines, penalties) —
      // checked below for finance records only, not for prices. S6a: a quotation version's `content` is the Sales
      // commercial offer (discount, tax, estimated cost/margin) — same treatment.
      else if (v && typeof v === 'object') for (const [k, child] of Object.entries(v)) { into.add(k); walk(child, k === 'details' || k === 'content' ? detailKeys : into) }
    }
    walk(DEMO_CORE, keys)
    // `paymentTerms` on a quotation is the offered term ("DP 30%"), not a payment record.
    expect([...detailKeys].filter(k => k !== 'paymentTerms' && /invoice|payment|receipt|transaction|outstanding|balance|paid/i.test(k))).toEqual([])
    // `paymentTerm` is a CRM billing term ("30 hari"), not a payment record; `netCostMinor` is the booking's net cost (Booking module, S4a).
    expect([...keys].filter(k => k !== 'paymentTerm' && k !== 'netCostMinor' && /idr$|cost|balance|paid|invoice|payment|receipt|transaction|outstanding/i.test(k))).toEqual([])
    // The only money-like values are owned by Project/Booking/Sales (ADR-007): contract value, service budget,
    // booking sell price and net cost, and the price of a Group Trip participant booking. S4b: vendor quotation amount (Procurement).
    expect([...keys].filter(k => /minor/i.test(k)).sort()).toEqual(['amountMinor', 'budgetMinor', 'contractValueMinor', 'creditLimitMinor', 'netCostMinor', 'priceMinor', 'sellAmountMinor'])
  })
})
