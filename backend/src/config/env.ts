/**
 * Environment configuration. Parsed once at boot; invalid config fails fast with every problem listed,
 * so a misconfigured deploy never starts half-working.
 */

export const BUSINESS_TIMEZONE = 'Asia/Jakarta'
export const LEDGER_CURRENCY = 'IDR'

export type AppEnv = 'development' | 'test' | 'production'

export interface AppConfig {
  appEnv: AppEnv
  port: number
  /** `postgres://…` for a server database, `pglite://<dir>` or `pglite://memory` for embedded Postgres. */
  databaseUrl: string
  /** Browser origins allowed to call the API with credentials (CORS + CSRF origin check). */
  allowedOrigins: string[]
  sessionTtlHours: number
  cookieSecure: boolean
  /** Only honour `X-Forwarded-For` when the API sits behind a proxy we control. */
  trustProxy: boolean
  version: string
}

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid backend configuration:\n - ${problems.join('\n - ')}`)
    this.name = 'ConfigError'
  }
}

type Env = Record<string, string | undefined>

const APP_ENVS: AppEnv[] = ['development', 'test', 'production']

function parseBool(raw: string | undefined, fallback: boolean, name: string, problems: string[]): boolean {
  if (raw === undefined || raw === '') return fallback
  if (['1', 'true', 'yes'].includes(raw.toLowerCase())) return true
  if (['0', 'false', 'no'].includes(raw.toLowerCase())) return false
  problems.push(`${name} must be true/false (got "${raw}")`)
  return fallback
}

function parseIntInRange(raw: string | undefined, fallback: number, min: number, max: number, name: string, problems: string[]): number {
  if (raw === undefined || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < min || n > max) {
    problems.push(`${name} must be an integer between ${min} and ${max} (got "${raw}")`)
    return fallback
  }
  return n
}

export function loadConfig(env: Env = process.env): AppConfig {
  const problems: string[] = []

  const rawEnv = env.APP_ENV ?? (env.NODE_ENV === 'test' ? 'test' : 'development')
  const appEnv = (APP_ENVS as string[]).includes(rawEnv) ? (rawEnv as AppEnv) : 'development'
  if (!(APP_ENVS as string[]).includes(rawEnv)) problems.push(`APP_ENV must be one of ${APP_ENVS.join(', ')} (got "${rawEnv}")`)
  const isProd = appEnv === 'production'

  const port = parseIntInRange(env.PORT, 3000, 1, 65535, 'PORT', problems)

  const defaultDb = appEnv === 'test' ? 'pglite://memory' : isProd ? '' : 'pglite://.data/pglite'
  const databaseUrl = (env.DATABASE_URL ?? defaultDb).trim()
  if (!databaseUrl) {
    problems.push('DATABASE_URL is required in production')
  } else if (!/^(postgres|postgresql):\/\//.test(databaseUrl) && !databaseUrl.startsWith('pglite://')) {
    problems.push('DATABASE_URL must start with postgres://, postgresql:// or pglite://')
  } else if (isProd && databaseUrl.startsWith('pglite://')) {
    problems.push('Embedded PGlite is for local development and tests only; production needs a postgres:// DATABASE_URL')
  }

  const allowedOrigins = (env.APP_ORIGINS ?? (isProd ? '' : 'http://localhost:8080,http://127.0.0.1:8080'))
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean)
  for (const origin of allowedOrigins) {
    try {
      const u = new URL(origin)
      if (u.origin !== origin) problems.push(`APP_ORIGINS entry "${origin}" must be a bare origin like https://app.example.com`)
    } catch {
      problems.push(`APP_ORIGINS entry "${origin}" is not a valid URL`)
    }
  }
  if (isProd && allowedOrigins.length === 0) problems.push('APP_ORIGINS is required in production')

  const sessionTtlHours = parseIntInRange(env.SESSION_TTL_HOURS, 12, 1, 24 * 30, 'SESSION_TTL_HOURS', problems)
  const cookieSecure = parseBool(env.COOKIE_SECURE, isProd, 'COOKIE_SECURE', problems)
  if (isProd && !cookieSecure) problems.push('COOKIE_SECURE cannot be disabled in production')
  const trustProxy = parseBool(env.TRUST_PROXY, false, 'TRUST_PROXY', problems)

  if (problems.length) throw new ConfigError(problems)

  return {
    appEnv,
    port,
    databaseUrl,
    allowedOrigins,
    sessionTtlHours,
    cookieSecure,
    trustProxy,
    version: env.APP_VERSION ?? '0.1.0'
  }
}
