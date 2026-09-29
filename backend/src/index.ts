import { createApp } from './app'
import { purgeExpiredSessions } from './auth/sessions'
import { ConfigError, loadConfig } from './config/env'
import { openDb } from './db/client'
import { migrationStatus } from './db/migrator'

/**
 * Process entry point. Boot order: config → database → schema check → HTTP.
 * The server refuses to start on an unmigrated or drifted schema (run `bun run db:migrate`).
 */

let config
try {
  config = loadConfig()
} catch (err) {
  console.error(err instanceof ConfigError ? err.message : err)
  process.exit(1)
}

const db = await openDb(config.databaseUrl)
const status = await migrationStatus(db, undefined, { readOnly: true })
if (status.problems.length || status.pending.length) {
  console.error(
    [
      'Database schema is not ready:',
      ...status.problems.map(p => ` - ${p}`),
      ...(status.pending.length ? [` - ${status.pending.length} pending migration(s); run: bun run db:migrate`] : [])
    ].join('\n')
  )
  await db.close()
  process.exit(1)
}

const app = createApp({ db, config }).listen({ port: config.port, hostname: '0.0.0.0' })
console.log(`MANOVA API listening on http://localhost:${config.port} (env=${config.appEnv}, db=${db.engine}, schema=v${status.current})`)

const sweep = setInterval(() => {
  purgeExpiredSessions(db).catch(err => console.error('session sweep failed', err))
}, 60 * 60_000)

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`)
  clearInterval(sweep)
  await app.stop()
  await db.close()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
