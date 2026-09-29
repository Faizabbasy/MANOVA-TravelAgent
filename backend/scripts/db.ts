/**
 * Database CLI. Reads DATABASE_URL / APP_ENV like the server does.
 *
 *   bun run db:migrate [--to N]
 *   bun run db:rollback [--steps N | --to N] [--confirm-backup <file>]   (production requires a backup file)
 *   bun run db:status
 *   bun run db:seed:demo                                                  (refused in production)
 *   bun run db:seed:finance-demo                                          (after seed:demo; refused in production)
 *   bun run db:backup [--out <dir>]
 *   bun run db:restore <backup-file> --target <database-url>             (target must be empty)
 *   bun run db:rehearse [--source <url> --restore <url>]                 (scratch databases only)
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ConfigError, loadConfig, type AppConfig } from '../src/config/env'
import { backupDatabase, restoreDatabase, verifyChecksum } from '../src/db/backup'
import { openDb } from '../src/db/client'
import { migrateDown, migrateUp, migrationStatus } from '../src/db/migrator'
import { rehearseMigrations } from '../src/db/rehearsal'
import { DEFAULT_DEMO_PASSWORD, seedDemo } from '../src/db/seed-demo'
import { seedFinanceDemo } from '../src/db/seed-finance-demo'

const [command, ...rest] = process.argv.slice(2)

function flag(name: string): string | undefined {
  const i = rest.indexOf(`--${name}`)
  return i === -1 ? undefined : rest[i + 1]
}
function intFlag(name: string): number | undefined {
  const raw = flag(name)
  if (raw === undefined) return undefined
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) fail(`--${name} must be a non-negative integer`)
  return n
}
function fail(message: string): never {
  console.error(`error: ${message}`)
  process.exit(1)
}

function configOrExit(): AppConfig {
  try {
    return loadConfig()
  } catch (err) {
    fail(err instanceof ConfigError ? err.message : String(err))
  }
}
const config = configOrExit()

const redacted = config.databaseUrl.replace(/\/\/([^:@/]+):[^@]+@/, '//$1:***@')
const DEFAULT_BACKUP_DIR = resolve('.data/backups')

async function main() {
  switch (command) {
    case 'migrate': {
      const db = await openDb(config.databaseUrl)
      const applied = await migrateUp(db, { to: intFlag('to') })
      const status = await migrationStatus(db)
      console.log(applied.length
        ? `Applied ${applied.map(m => `${String(m.version).padStart(4, '0')}_${m.name}`).join(', ')}`
        : 'Nothing to migrate.')
      console.log(`Schema version ${status.current} on ${redacted}`)
      await db.close()
      return
    }
    case 'rollback': {
      if (config.appEnv === 'production') {
        const backup = flag('confirm-backup')
        if (!backup || !existsSync(backup)) fail('In production, pass --confirm-backup <existing backup file> before rolling back')
        verifyChecksum(backup) // must be an intact backup with its .sha256 sidecar, not just any file
      }
      const db = await openDb(config.databaseUrl)
      const to = intFlag('to')
      const reverted = await migrateDown(db, to !== undefined ? { to } : { steps: intFlag('steps') ?? 1 })
      console.log(reverted.length ? `Reverted ${reverted.map(m => `${String(m.version).padStart(4, '0')}_${m.name}`).join(', ')}` : 'Nothing to roll back.')
      await db.close()
      return
    }
    case 'status': {
      const db = await openDb(config.databaseUrl)
      const status = await migrationStatus(db)
      console.log(`Database: ${redacted} (${db.engine})`)
      console.log(`Current version: ${status.current}`)
      for (const a of status.applied) console.log(`  applied  ${String(a.version).padStart(4, '0')}_${a.name}  ${a.applied_at.toISOString()}`)
      for (const p of status.pending) console.log(`  pending  ${String(p.version).padStart(4, '0')}_${p.name}`)
      for (const problem of status.problems) console.log(`  PROBLEM  ${problem}`)
      await db.close()
      if (status.problems.length) process.exit(2)
      return
    }
    case 'seed:demo': {
      // Explicit opt-in: an unset APP_ENV would otherwise default to development.
      if (!['development', 'test'].includes(process.env.APP_ENV ?? '')) {
        fail('db:seed:demo needs APP_ENV=development (or test) set explicitly. It never runs against production.')
      }
      const db = await openDb(config.databaseUrl)
      const password = process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD
      const result = await seedDemo(db, { appEnv: config.appEnv, password })
      console.log(`Demo seed applied: ${JSON.stringify(result)}`)
      console.log(`Demo logins use the frontend fixture emails (e.g. budi.santoso@manova.id) with password from DEMO_PASSWORD${process.env.DEMO_PASSWORD ? '' : ` (default "${DEFAULT_DEMO_PASSWORD}")`}.`)
      await db.close()
      return
    }
    case 'seed:finance-demo': {
      if (!['development', 'test'].includes(process.env.APP_ENV ?? '')) {
        fail('db:seed:finance-demo needs APP_ENV=development (or test) set explicitly. It never runs against production.')
      }
      const db = await openDb(config.databaseUrl)
      const result = await seedFinanceDemo(db, { appEnv: config.appEnv })
      console.log(result.skipped
        ? `Finance demo seed: finance records already exist${result.policies ? `; added ${result.policies} cancellation policies` : ''}.`
        : `Finance demo seed applied: ${JSON.stringify(result)}`)
      await db.close()
      return
    }
    case 'backup': {
      const db = await openDb(config.databaseUrl)
      const result = await backupDatabase(db, config.databaseUrl, resolve(flag('out') ?? DEFAULT_BACKUP_DIR))
      console.log(`Backup written: ${result.file}\n  bytes  ${result.bytes}\n  sha256 ${result.sha256}`)
      await db.close()
      return
    }
    case 'restore': {
      const file = rest.find(a => !a.startsWith('--') && a !== flag('target'))
      const target = flag('target')
      if (!file || !target) fail('usage: db:restore <backup-file> --target <database-url>')
      const db = await restoreDatabase(resolve(file), target)
      const status = await migrationStatus(db, undefined, { readOnly: true })
      console.log(`Restored ${file} → schema version ${status.current}`)
      await db.close()
      return
    }
    case 'rehearse': {
      const sourceUrl = flag('source') ?? 'pglite://memory'
      const restoreUrl = flag('restore') ?? 'pglite://memory'
      const steps = await rehearseMigrations({
        appEnv: config.appEnv,
        sourceUrl,
        restoreUrl,
        backupDir: resolve(flag('out') ?? '.data/rehearsal'),
        log: line => console.log(`✓ ${line}`)
      })
      console.log(`Rehearsal passed (${steps.length} steps).`)
      return
    }
    default:
      fail(`unknown command "${command ?? ''}". Use migrate | rollback | status | seed:demo | seed:finance-demo | backup | restore | rehearse`)
  }
}

main().catch(err => {
  console.error(err instanceof Error ? `${err.name}: ${err.message}` : err)
  process.exit(1)
})
