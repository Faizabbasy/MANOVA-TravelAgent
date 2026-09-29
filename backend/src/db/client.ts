import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import postgres from 'postgres'

/**
 * One small database interface over two drivers that speak the same SQL:
 *  - `postgres://` → postgres.js against a PostgreSQL server (production, shared dev/staging)
 *  - `pglite://`   → PGlite, PostgreSQL compiled to WASM running in-process (zero-infra local dev + tests)
 *
 * Both are configured to return identical JS types so code and tests behave the same on either engine:
 *  - int8 / numeric → string   (money is bigint minor units; never let it become a float)
 *  - date           → 'YYYY-MM-DD' string (business dates are calendar dates, not instants)
 *  - timestamptz    → Date
 *  - json / jsonb   → parsed value
 *
 * Writing JSON: bind `JSON.stringify(value)` as `$n::text::jsonb`. Binding it straight to `$n::jsonb` makes
 * postgres.js serialise the string again and store a JSON string instead of an object (PGlite does not),
 * so the text cast keeps both drivers identical.
 */

export type Row = Record<string, unknown>

export interface Queryable {
  query<T extends Row = Row>(text: string, params?: readonly unknown[]): Promise<T[]>
  /** Runs parameterless, possibly multi-statement SQL (migrations). */
  exec(sql: string): Promise<void>
}

export type DbEngine = 'postgres' | 'pglite'

export interface Db extends Queryable {
  readonly engine: DbEngine
  /** Runs `fn` in one transaction; commits when it resolves, rolls back when it throws. */
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>
  close(): Promise<void>
  /** PGlite only: gzipped tarball of the whole data directory (backup). */
  dumpDataDir?: () => Promise<Blob>
}

export interface OpenDbOptions {
  /** Postgres only: isolate a connection to one schema (used by the test suite). */
  searchPath?: string
  /** Postgres only: pool size. */
  max?: number
  /** PGlite only: initialise from a dumpDataDir() tarball (restore). The target must be new/empty. */
  loadDataDir?: Blob
}

const OID = { int8: 20, numeric: 1700, date: 1082 } as const
const keepText = (value: string) => value

export async function openDb(url: string, options: OpenDbOptions = {}): Promise<Db> {
  if (url.startsWith('pglite://')) return openPglite(url.slice('pglite://'.length), options.loadDataDir)
  return openPostgres(url, options)
}

async function openPglite(location: string, loadDataDir?: Blob): Promise<Db> {
  const options = { parsers: { [OID.int8]: keepText, [OID.numeric]: keepText, [OID.date]: keepText }, ...(loadDataDir ? { loadDataDir } : {}) }
  let pg: PGlite
  if (location === '' || location === 'memory') {
    pg = new PGlite(options)
  } else {
    const dataDir = resolve(location)
    mkdirSync(dataDir, { recursive: true })
    pg = new PGlite(dataDir, options)
  }
  await pg.waitReady

  const wrap = (q: Pick<PGlite, 'query' | 'exec'>): Queryable => ({
    async query<T extends Row>(text: string, params: readonly unknown[] = []) {
      const res = await q.query<T>(text, params as unknown[])
      return res.rows
    },
    async exec(sql: string) {
      await q.exec(sql)
    }
  })

  return {
    engine: 'pglite',
    ...wrap(pg),
    transaction: fn => pg.transaction(tx => fn(wrap(tx))),
    close: () => pg.close(),
    dumpDataDir: () => pg.dumpDataDir('gzip')
  }
}

async function openPostgres(url: string, options: OpenDbOptions): Promise<Db> {
  const sql = postgres(url, {
    max: options.max ?? 10,
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {},
    connection: options.searchPath ? { search_path: options.searchPath } : {},
    // int8 and numeric already come back as strings; only calendar dates need overriding.
    types: {
      calendarDate: { to: OID.date, from: [OID.date], serialize: (v: unknown) => String(v), parse: keepText }
    }
  })

  type Unsafe = Pick<postgres.Sql, 'unsafe'>
  const wrap = (q: Unsafe): Queryable => ({
    async query<T extends Row>(text: string, params: readonly unknown[] = []) {
      const rows = await q.unsafe(text, params as postgres.ParameterOrJSON<never>[])
      return Array.from(rows) as unknown as T[]
    },
    async exec(text: string) {
      await q.unsafe(text).simple()
    }
  })

  // Fail at boot, not on the first request.
  await sql`select 1`

  return {
    engine: 'postgres',
    ...wrap(sql),
    transaction: fn => sql.begin(tx => fn(wrap(tx))) as Promise<Awaited<ReturnType<typeof fn>>>,
    close: () => sql.end({ timeout: 5 })
  }
}
