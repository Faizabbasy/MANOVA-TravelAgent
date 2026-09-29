import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Db } from './client'

/**
 * Plain-SQL migration runner (ADR-002).
 *
 * `migrations/NNNN_name.up.sql` + `NNNN_name.down.sql`, applied in version order, one transaction each.
 * `schema_migrations` records version + checksum; a changed file that was already applied is reported as
 * drift and blocks further migration instead of silently diverging between environments.
 */

export const MIGRATIONS_DIR = resolve(import.meta.dir, '../../migrations')

const FILE_PATTERN = /^(\d{4})_([a-z0-9_]+)\.(up|down)\.sql$/
// Serialises concurrent migrators (two app instances booting, CI + dev) on the same database.
const LOCK_SQL = `select pg_advisory_xact_lock(hashtext('manova.schema_migrations'))`

export interface Migration {
  version: number
  name: string
  up: string
  down: string
  checksum: string
}

export interface AppliedMigration {
  version: number
  name: string
  checksum: string
  applied_at: Date
}

export interface MigrationStatus {
  current: number
  applied: AppliedMigration[]
  pending: Migration[]
  problems: string[]
}

export class MigrationError extends Error {
  override name = 'MigrationError'
}

/** Git on Windows may check SQL out with CRLF; the checksum must not depend on that. */
function normalize(sql: string): string {
  return sql.replace(/\r\n/g, '\n').trim() + '\n'
}

export function checksumOf(sql: string): string {
  return createHash('sha256').update(normalize(sql)).digest('hex')
}

export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  const byVersion = new Map<number, { name: string; up?: string; down?: string }>()
  for (const file of readdirSync(dir).sort()) {
    const match = FILE_PATTERN.exec(file)
    if (!match) {
      if (file.endsWith('.sql')) throw new MigrationError(`Unrecognised migration file name: ${file}`)
      continue
    }
    const [, versionText, name, direction] = match as unknown as [string, string, string, 'up' | 'down']
    const version = Number(versionText)
    const entry = byVersion.get(version) ?? { name }
    if (entry.name !== name) throw new MigrationError(`Version ${versionText} is used by two names: ${entry.name}, ${name}`)
    entry[direction] = normalize(readFileSync(join(dir, file), 'utf8'))
    byVersion.set(version, entry)
  }

  const migrations = [...byVersion.entries()]
    .sort(([a], [b]) => a - b)
    .map(([version, entry]) => {
      if (!entry.up || !entry.down) throw new MigrationError(`Migration ${version}_${entry.name} needs both .up.sql and .down.sql`)
      return { version, name: entry.name, up: entry.up, down: entry.down, checksum: checksumOf(entry.up) }
    })

  migrations.forEach((m, i) => {
    if (m.version !== i + 1) throw new MigrationError(`Migration versions must be contiguous from 0001; found ${String(m.version).padStart(4, '0')} at position ${i + 1}`)
  })
  return migrations
}

async function ensureTable(db: Db): Promise<void> {
  await db.exec(`
    create table if not exists schema_migrations (
      version    integer primary key,
      name       text not null,
      checksum   text not null,
      applied_at timestamptz not null default now()
    )`)
}

/** `readOnly` (health checks) never creates the bookkeeping table; a missing table reads as "nothing applied". */
export async function migrationStatus(
  db: Db,
  migrations: Migration[] = loadMigrations(),
  options: { readOnly?: boolean } = {}
): Promise<MigrationStatus> {
  let tableExists = true
  if (options.readOnly) {
    const [row] = await db.query<{ exists: boolean }>(`select to_regclass('schema_migrations') is not null as exists`)
    tableExists = Boolean(row?.exists)
  } else {
    await ensureTable(db)
  }
  const applied = tableExists
    ? await db.query<AppliedMigration & Record<string, unknown>>('select version, name, checksum, applied_at from schema_migrations order by version')
    : []
  const known = new Map(migrations.map(m => [m.version, m]))
  const appliedVersions = new Set(applied.map(a => a.version))
  const problems: string[] = []

  for (const a of applied) {
    const file = known.get(a.version)
    if (!file) problems.push(`Applied migration ${a.version}_${a.name} has no file in this checkout`)
    else if (file.checksum !== a.checksum) problems.push(`Migration ${a.version}_${a.name} was edited after it was applied (checksum mismatch)`)
  }

  const current = applied.length ? Math.max(...applied.map(a => a.version)) : 0
  const pending = migrations.filter(m => !appliedVersions.has(m.version))
  for (const m of pending) {
    if (m.version < current) problems.push(`Migration ${m.version}_${m.name} is older than the applied version ${current} (out of order)`)
  }

  return { current, applied, pending, problems }
}

function assertHealthy(status: MigrationStatus): void {
  if (status.problems.length) throw new MigrationError(`Refusing to migrate:\n - ${status.problems.join('\n - ')}`)
}

/** Applies pending migrations up to `to` (default: latest). Returns the versions applied. */
export async function migrateUp(db: Db, options: { to?: number; migrations?: Migration[] } = {}): Promise<Migration[]> {
  const migrations = options.migrations ?? loadMigrations()
  const status = await migrationStatus(db, migrations)
  assertHealthy(status)

  const applied: Migration[] = []
  for (const m of status.pending) {
    if (options.to !== undefined && m.version > options.to) break
    const didApply = await db.transaction(async tx => {
      await tx.query(LOCK_SQL)
      const already = await tx.query('select 1 from schema_migrations where version = $1', [m.version])
      if (already.length) return false
      await tx.exec(m.up)
      await tx.query('insert into schema_migrations (version, name, checksum) values ($1, $2, $3)', [m.version, m.name, m.checksum])
      return true
    })
    if (didApply) applied.push(m)
  }
  return applied
}

/** Rolls back the newest `steps` migrations, or down to (but not including) version `to`. */
export async function migrateDown(db: Db, options: { steps?: number; to?: number; migrations?: Migration[] } = {}): Promise<Migration[]> {
  const migrations = options.migrations ?? loadMigrations()
  const status = await migrationStatus(db, migrations)
  assertHealthy(status)

  const byVersion = new Map(migrations.map(m => [m.version, m]))
  const newestFirst = [...status.applied].sort((a, b) => b.version - a.version)
  const targets = options.to !== undefined
    ? newestFirst.filter(a => a.version > options.to!)
    : newestFirst.slice(0, options.steps ?? 1)

  const rolledBack: Migration[] = []
  for (const a of targets) {
    const m = byVersion.get(a.version)!
    await db.transaction(async tx => {
      await tx.query(LOCK_SQL)
      await tx.exec(m.down)
      await tx.query('delete from schema_migrations where version = $1', [m.version])
    })
    rolledBack.push(m)
  }
  return rolledBack
}
