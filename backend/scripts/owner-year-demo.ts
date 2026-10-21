/** Standalone LOCAL persistent demo. Never uses DATABASE_URL/.env or the application database. */
import { resolve } from 'node:path'
import { createApp } from '../src/app'
import { loadConfig } from '../src/config/env'
import { openDb } from '../src/db/client'
import { migrateUp } from '../src/db/migrator'
import { seedOwnerYearDemo } from '../src/db/seed-owner-year-demo'
import { DirectoryBlobStore } from '../src/files/blob-store'

if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') throw new Error('Demo cannot run in production.')
const args = process.argv.slice(2)
if (args.some(a => !['--port', '--seed-only'].includes(a) && !/^\d+$/.test(a))) throw new Error('Only --port N and --seed-only are supported. No reset/delete option exists.')
const portIndex = args.indexOf('--port')
const port = portIndex < 0 ? 3000 : Number(args[portIndex + 1])
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid demo port.')
const root = resolve(import.meta.dir, '../.data/owner-year-demo-v1')
const databaseUrl = `pglite://${root}/database`
const config = loadConfig({ APP_ENV: 'development', DATABASE_URL: databaseUrl, PORT: String(port), APP_ORIGINS: 'http://localhost:8080,http://127.0.0.1:8080', DEMO_LOGIN: 'true', PORTAL_LOGIN: 'false', COOKIE_SECURE: 'false' })
const db = await openDb(databaseUrl)
let app: ReturnType<typeof createApp> | undefined
try {
  await migrateUp(db)
  const summary = await seedOwnerYearDemo(db, { appEnv: 'development', log: console.log })
  console.log(JSON.stringify({ demo: 'FIKTIF / TEST_ONLY', storage: root, ...summary }, null, 2))
  if (args.includes('--seed-only')) await db.close()
  else {
    app = createApp({ db, config, blobs: new DirectoryBlobStore(resolve(root, 'private-blobs')) }).listen({ hostname: '127.0.0.1', port })
    console.log(`Persistent demo API ready: http://127.0.0.1:${port}. Use Super Admin or Finance demo login. Restart keeps your transactions.`)
    const stop = async () => { await app?.stop(); await db.close(); process.exit(0) }
    process.on('SIGINT', () => void stop()); process.on('SIGTERM', () => void stop())
  }
} catch (error) {
  console.error(error)
  await db.close()
  process.exitCode = 1
}
