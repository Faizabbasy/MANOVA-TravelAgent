import { createHash } from 'node:crypto'
import type { Db } from '../db/client'
import { isRoleId, type Actor } from './rbac'

/**
 * Opaque server sessions (ADR-003). The cookie holds a random 256-bit token; the database stores only its
 * SHA-256, so a leaked sessions table cannot be replayed. Expiry is absolute; logout deletes the row;
 * suspending a user invalidates their sessions immediately because lookup joins on users.status.
 */

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export function sessionCookieName(secure: boolean): string {
  // The __Host- prefix makes browsers refuse the cookie unless it is Secure, Path=/ and host-only.
  return secure ? '__Host-manova_session' : 'manova_session'
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function newToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
}

export async function createSession(
  db: Db,
  userId: string,
  options: { ttlHours: number; ip: string | null; userAgent: string | null }
): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const token = newToken()
  const sessionId = hashToken(token)
  const expiresAt = new Date(Date.now() + options.ttlHours * 3_600_000)
  await db.query(
    'insert into sessions (id, user_id, expires_at, ip, user_agent) values ($1, $2, $3, $4, $5)',
    [sessionId, userId, expiresAt.toISOString(), options.ip, options.userAgent?.slice(0, 512) ?? null]
  )
  return { token, sessionId, expiresAt }
}

interface SessionRow extends Record<string, unknown> {
  session_id: string
  expires_at: Date
  user_id: string
  name: string
  email: string
  role: string
  party_id: string | null
  vendor_id: string | null
}

export async function resolveSession(db: Db, token: string | undefined): Promise<(Actor & { expiresAt: Date }) | null> {
  if (!token || !TOKEN_PATTERN.test(token)) return null
  const [row] = await db.query<SessionRow>(
    `select s.id as session_id, s.expires_at, u.id as user_id, u.name, u.email, u.role, u.party_id, u.vendor_id
       from sessions s
       join users u on u.id = s.user_id
      where s.id = $1 and s.expires_at > now() and u.status = 'active'`,
    [hashToken(token)]
  )
  if (!row || !isRoleId(row.role)) return null
  return {
    sessionId: row.session_id,
    expiresAt: row.expires_at,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    partyId: row.party_id,
    vendorId: row.vendor_id
  }
}

export async function revokeSession(db: Db, sessionId: string): Promise<void> {
  await db.query('delete from sessions where id = $1', [sessionId])
}

export async function purgeExpiredSessions(db: Db): Promise<number> {
  const rows = await db.query('delete from sessions where expires_at <= now() returning id')
  return rows.length
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    // Session tokens are base64url, so no URL-decoding: a malformed %-sequence must read as "no session", not a 500.
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return undefined
}

export function sessionCookie(name: string, token: string, options: { maxAgeSeconds: number; secure: boolean }): string {
  return [
    `${name}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${options.maxAgeSeconds}`,
    ...(options.secure ? ['Secure'] : [])
  ].join('; ')
}

export function clearedSessionCookie(name: string, secure: boolean): string {
  return sessionCookie(name, '', { maxAgeSeconds: 0, secure })
}
