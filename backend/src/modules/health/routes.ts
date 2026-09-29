import { Elysia } from 'elysia'
import type { AppDeps } from '../../app-deps'
import { BUSINESS_TIMEZONE } from '../../config/env'
import { loadMigrations, migrationStatus } from '../../db/migrator'
import { ok } from '../../http/envelope'

/**
 * `/health`        liveness: the process is up (no dependencies touched; for container restarts)
 * `/api/v1/health` readiness: database reachable and schema fully migrated; 503 otherwise
 */
export function healthRoutes(deps: AppDeps) {
  const migrations = loadMigrations()

  return new Elysia()
    .get('/health', ({ request }) => ok(request, { status: 'ok' }))
    .get('/api/v1/health', async ({ request, set }) => {
      let database: { engine: string; reachable: boolean; schemaVersion?: number; latestVersion: number; pendingMigrations?: number; migrationProblems?: number }
      try {
        const status = await migrationStatus(deps.db, migrations, { readOnly: true })
        database = {
          engine: deps.db.engine,
          reachable: true,
          schemaVersion: status.current,
          latestVersion: migrations.length,
          pendingMigrations: status.pending.length,
          migrationProblems: status.problems.length
        }
      } catch {
        database = { engine: deps.db.engine, reachable: false, latestVersion: migrations.length }
      }
      const ready = database.reachable && database.pendingMigrations === 0 && database.migrationProblems === 0
      if (!ready) set.status = 503
      set.headers['cache-control'] = 'no-store'
      const base = { status: ready ? 'ok' : 'degraded', service: 'manova-backend', time: new Date().toISOString(), timezone: BUSINESS_TIMEZONE }
      // Unauthenticated endpoint: in production expose readiness only, not version/environment/engine.
      if (deps.config.appEnv === 'production') {
        const { engine: _engine, ...readiness } = database
        return ok(request, { ...base, database: readiness })
      }
      return ok(request, { ...base, version: deps.config.version, environment: deps.config.appEnv, database })
    })
}
