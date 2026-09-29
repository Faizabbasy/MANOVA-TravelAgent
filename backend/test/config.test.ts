import { describe, expect, test } from 'bun:test'
import { ConfigError, loadConfig } from '../src/config/env'

describe('loadConfig', () => {
  test('development defaults to an embedded PGlite data directory and the Nuxt dev origins', () => {
    const c = loadConfig({})
    expect(c.appEnv).toBe('development')
    expect(c.port).toBe(3000)
    expect(c.databaseUrl).toBe('pglite://.data/pglite')
    expect(c.allowedOrigins).toEqual(['http://localhost:8080', 'http://127.0.0.1:8080'])
    expect(c.cookieSecure).toBe(false)
    expect(c.sessionTtlHours).toBe(12)
  })

  test('test env defaults to in-memory PGlite', () => {
    expect(loadConfig({ APP_ENV: 'test' }).databaseUrl).toBe('pglite://memory')
  })

  test('production requires a postgres DATABASE_URL and secure cookies', () => {
    const c = loadConfig({ APP_ENV: 'production', DATABASE_URL: 'postgres://u:p@db:5432/manova', APP_ORIGINS: 'https://app.manova.id' })
    expect(c.cookieSecure).toBe(true)
    expect(c.allowedOrigins).toEqual(['https://app.manova.id'])
  })

  test('production refuses PGlite, missing DB and insecure cookies — reporting every problem at once', () => {
    try {
      loadConfig({ APP_ENV: 'production', DATABASE_URL: 'pglite://.data/pglite', COOKIE_SECURE: 'false' })
      throw new Error('expected ConfigError')
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError)
      const problems = (err as ConfigError).problems.join('\n')
      expect(problems).toContain('Embedded PGlite')
      expect(problems).toContain('COOKIE_SECURE')
    }
    expect(() => loadConfig({ APP_ENV: 'production', APP_ORIGINS: 'https://a.b' })).toThrow('DATABASE_URL is required')
  })

  test('one-click demo login is on in development/test, off in production and cannot be forced on there', () => {
    expect(loadConfig({}).demoLogin).toBe(true)
    expect(loadConfig({ APP_ENV: 'test' }).demoLogin).toBe(true)
    const prod = { APP_ENV: 'production', DATABASE_URL: 'postgres://u:p@db/m', APP_ORIGINS: 'https://app.manova.id' }
    expect(loadConfig(prod).demoLogin).toBe(false)
    expect(() => loadConfig({ ...prod, DEMO_LOGIN: 'true' })).toThrow('DEMO_LOGIN cannot be enabled in production')
  })

  test('portal logins are off unless PORTAL_LOGIN=true', () => {
    expect(loadConfig({}).portalLogin).toBe(false)
    expect(loadConfig({ PORTAL_LOGIN: 'true' }).portalLogin).toBe(true)
  })

  test('production never falls back to localhost origins', () => {
    expect(() => loadConfig({ APP_ENV: 'production', DATABASE_URL: 'postgres://u:p@db/m' })).toThrow('APP_ORIGINS is required')
  })

  test('rejects malformed values', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow('PORT')
    expect(() => loadConfig({ APP_ENV: 'staging' })).toThrow('APP_ENV')
    expect(() => loadConfig({ DATABASE_URL: 'mysql://x' })).toThrow('DATABASE_URL')
    expect(() => loadConfig({ APP_ORIGINS: 'https://app.example.com/path' })).toThrow('bare origin')
    expect(() => loadConfig({ SESSION_TTL_HOURS: '0' })).toThrow('SESSION_TTL_HOURS')
  })
})
