import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { openDb, type Db } from './client'

/**
 * Backups (ADR-002). Two formats, one per engine:
 *  - PGlite:   gzipped tarball of the data directory (PGlite dumpDataDir)
 *  - Postgres: pg_dump custom format, restored with pg_restore in a single transaction
 * Each backup gets a `.sha256` sidecar; restore verifies it and refuses to write into a non-empty database.
 */

export class BackupError extends Error {
  override name = 'BackupError'
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function pgBinary(name: 'pg_dump' | 'pg_restore'): string {
  const dir = process.env.PG_BIN
  return dir ? join(dir, process.platform === 'win32' ? `${name}.exe` : name) : name
}

/** Splits the password out of a connection URL so it travels via PGPASSWORD, not the process list. */
function libpqTarget(databaseUrl: string): { url: string; env: Record<string, string> } {
  const u = new URL(databaseUrl)
  const password = decodeURIComponent(u.password)
  u.password = ''
  return { url: u.toString(), env: password ? { PGPASSWORD: password } : {} }
}

async function run(cmd: string[], env: Record<string, string> = {}): Promise<void> {
  const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe', env: { ...process.env, ...env } })
  const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
  if (code !== 0) throw new BackupError(`${cmd[0]} exited with ${code}: ${stderr.trim()}`)
}

export async function isDatabaseEmpty(db: Db): Promise<boolean> {
  const [row] = await db.query<{ n: number }>(
    `select count(*)::int as n from information_schema.tables where table_schema = current_schema()`
  )
  return (row?.n ?? 0) === 0
}

export interface BackupResult {
  file: string
  sha256: string
  bytes: number
}

export async function backupDatabase(db: Db, databaseUrl: string, outDir: string): Promise<BackupResult> {
  mkdirSync(outDir, { recursive: true })
  let file: string
  if (db.engine === 'pglite') {
    if (!db.dumpDataDir) throw new BackupError('This PGlite handle cannot dump its data directory')
    file = resolve(outDir, `manova-pglite-${stamp()}.tar.gz`)
    writeFileSync(file, new Uint8Array(await (await db.dumpDataDir()).arrayBuffer()))
  } else {
    file = resolve(outDir, `manova-postgres-${stamp()}.dump`)
    const target = libpqTarget(databaseUrl)
    await run([pgBinary('pg_dump'), '--format=custom', '--no-owner', '--no-privileges', `--file=${file}`, `--dbname=${target.url}`], target.env)
  }
  const bytes = readFileSync(file)
  const digest = sha256(bytes)
  writeFileSync(`${file}.sha256`, `${digest}  ${file.split(/[\\/]/).pop()}\n`)
  return { file, sha256: digest, bytes: bytes.length }
}

export function verifyChecksum(file: string): void {
  const sidecar = `${file}.sha256`
  if (!existsSync(sidecar)) throw new BackupError(`Missing checksum file ${sidecar}; refusing to restore an unverified backup`)
  const expected = readFileSync(sidecar, 'utf8').trim().split(/\s+/)[0]
  const actual = sha256(readFileSync(file))
  if (expected !== actual) throw new BackupError(`Checksum mismatch for ${file}: expected ${expected}, got ${actual}`)
}

/**
 * Restores `file` into `targetUrl`, which must be an empty database (Postgres) or a new/empty data
 * directory (PGlite). Returns an open handle to the restored database.
 */
export async function restoreDatabase(file: string, targetUrl: string): Promise<Db> {
  if (!existsSync(file)) throw new BackupError(`Backup file not found: ${file}`)
  verifyChecksum(file)

  if (targetUrl.startsWith('pglite://')) {
    if (!file.endsWith('.tar.gz')) throw new BackupError('A PGlite target needs a .tar.gz PGlite backup')
    const location = targetUrl.slice('pglite://'.length)
    if (location !== 'memory' && location !== '') {
      const dir = resolve(location)
      if (existsSync(dir) && readdirSync(dir).length > 0) throw new BackupError(`Restore target ${dir} is not empty`)
      mkdirSync(dirname(dir), { recursive: true })
    }
    return openDb(targetUrl, { loadDataDir: new Blob([readFileSync(file)]) })
  }

  if (!file.endsWith('.dump')) throw new BackupError('A Postgres target needs a .dump pg_dump backup')
  const db = await openDb(targetUrl)
  if (!(await isDatabaseEmpty(db))) {
    await db.close()
    throw new BackupError('Restore target database is not empty; restore only into a freshly created database')
  }
  try {
    const target = libpqTarget(targetUrl)
    await run([pgBinary('pg_restore'), '--no-owner', '--no-privileges', '--exit-on-error', '--single-transaction', `--dbname=${target.url}`, file], target.env)
  } catch (err) {
    await db.close()
    throw err
  }
  return db
}
