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
