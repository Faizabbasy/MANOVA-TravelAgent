import type { AppEnv } from '../config/env'
import { backupDatabase, isDatabaseEmpty, restoreDatabase } from './backup'
import { openDb, type Db } from './client'
import { loadMigrations, migrateDown, migrateUp, migrationStatus } from './migrator'
import { seedDemo } from './seed-demo'

/**
 * Migration + backup/restore rehearsal on scratch databases (docs/.../03 "Migrasi aman" step 6):
 * fresh → up → seed → down to zero → up again → seed → backup → restore elsewhere → compare.
 * Throws on the first mismatch; returns a step log for the phase report.
 */

const TABLES = ['parties', 'vendors', 'projects', 'project_services', 'booking_refs', 'service_orders', 'users', 'project_members', 'audit_events'] as const

async function tableCounts(db: Db): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const table of TABLES) {
    const [row] = await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)
    out[table] = row?.n ?? -1
  }
  return out
}

async function userTableCount(db: Db): Promise<number> {
  const [row] = await db.query<{ n: number }>(
    `select count(*)::int as n from information_schema.tables where table_schema = current_schema() and table_name <> 'schema_migrations'`
  )
  return row?.n ?? -1
}

const same = (a: Record<string, number>, b: Record<string, number>) => JSON.stringify(a) === JSON.stringify(b)

export async function rehearseMigrations(options: {
  appEnv: AppEnv
  sourceUrl: string
  restoreUrl: string
  backupDir: string
  log?: (line: string) => void
}): Promise<string[]> {
  if (options.appEnv === 'production') throw new Error('Rehearsal is destructive and never runs with APP_ENV=production')
  const steps: string[] = []
  const log = (line: string) => { steps.push(line); options.log?.(line) }
  const total = loadMigrations().length

  const db = await openDb(options.sourceUrl)
  try {
    if (!(await isDatabaseEmpty(db))) throw new Error('Rehearsal source must be an empty scratch database')

    const up1 = await migrateUp(db)
    log(`fresh migrate up: applied ${up1.map(m => m.version).join(', ')} (${up1.length}/${total})`)
    await seedDemo(db, { appEnv: options.appEnv })
    const seeded = await tableCounts(db)
    log(`demo seed: ${JSON.stringify(seeded)}`)

    const down = await migrateDown(db, { to: 0 })
    const left = await userTableCount(db)
    if (left !== 0) throw new Error(`After full rollback ${left} table(s) remain`)
    log(`rollback to 0: reverted ${down.map(m => m.version).join(', ')}; 0 domain tables remain`)

    const up2 = await migrateUp(db)
    await seedDemo(db, { appEnv: options.appEnv })
    const reseeded = await tableCounts(db)
    if (!same(seeded, reseeded)) throw new Error(`Re-applied schema + seed differs: ${JSON.stringify(reseeded)}`)
    log(`re-apply ${up2.length} migration(s) + seed: counts identical`)

    const backup = await backupDatabase(db, options.sourceUrl, options.backupDir)
    log(`backup: ${backup.file} (${backup.bytes} bytes, sha256 ${backup.sha256.slice(0, 16)}…)`)

    const restored = await restoreDatabase(backup.file, options.restoreUrl)
    try {
      const restoredCounts = await tableCounts(restored)
      if (!same(seeded, restoredCounts)) throw new Error(`Restored counts differ: ${JSON.stringify(restoredCounts)}`)
      const status = await migrationStatus(restored, undefined, { readOnly: true })
      if (status.current !== total || status.pending.length || status.problems.length) {
        throw new Error(`Restored schema not current: v${status.current}, pending ${status.pending.length}, problems ${status.problems.join('; ')}`)
      }
      log(`restore into fresh target: counts identical, schema v${status.current}, checksums verified`)
    } finally {
      await restored.close()
    }
  } finally {
    await db.close()
  }
  return steps
}
