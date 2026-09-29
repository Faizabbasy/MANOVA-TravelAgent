import { Elysia, t } from 'elysia'
import type { AppDeps } from '../app-deps'
import { clientInfo, type ClientInfo } from '../http/client-info'
import { ID_PATTERN, ok, requestIdOf } from '../http/envelope'
import { AppError, errors } from '../http/errors'
import { recordAudit } from '../shared/audit'
import type { AuthContext, SessionActor } from './context'
import { LoginThrottle } from './login-throttle'
import { verifyAgainstDummy, verifyPassword } from './password'
import { canRoleSignIn, isRoleId, permissionsOf, ROLE_DEFINITIONS, type Actor } from './rbac'
import { clearedSessionCookie, createSession, revokeSession, sessionCookie } from './sessions'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** What the frontend needs to render the signed-in shell. Permissions are advisory there, enforced here. */
export function meDto(actor: Actor, expiresAt: Date) {
  const role = ROLE_DEFINITIONS[actor.role]
  const permissions = permissionsOf(actor.role)
  return {
    user: { id: actor.userId, name: actor.name, email: actor.email, role: actor.role, roleLabel: role.label, kind: role.kind },
    scope: { partyId: actor.partyId, vendorId: actor.vendorId },
    permissions: { ...permissions, canViewFullFinancials: role.canViewFullFinancials },
    session: { expiresAt: expiresAt.toISOString() }
  }
}

interface LoginUserRow extends Record<string, unknown> {
  id: string
  name: string
  email: string
  role: Actor['role']
  party_id: string | null
  vendor_id: string | null
  status: string
  password_hash: string | null
}

export function authRoutes(deps: AppDeps, auth: AuthContext) {
  const throttle = deps.throttle ?? new LoginThrottle()
  const { db, config } = deps

  /** Creates the session, audits it, sets the cookie and returns the `me` payload. */
  async function startSession(
    user: LoginUserRow,
    context: { request: Request; client: ClientInfo; set: { headers: Record<string, string | number> }; action: 'auth.login' | 'auth.demo_login' }
  ) {
    const { request, client, set, action } = context
    const session = await createSession(db, user.id, { ttlHours: config.sessionTtlHours, ...client })
    await recordAudit(db, { action, actorUserId: user.id, entityType: 'user', entityId: user.id, requestId: requestIdOf(request), ...client })
    set.headers['set-cookie'] = sessionCookie(auth.cookieName, session.token, {
      maxAgeSeconds: config.sessionTtlHours * 3600,
      secure: config.cookieSecure
    })
    set.headers['cache-control'] = 'no-store'
    const actor: Actor = {
      userId: user.id, name: user.name, email: user.email, role: user.role,
      partyId: user.party_id, vendorId: user.vendor_id, sessionId: session.sessionId
    }
    return ok(request, meDto(actor, session.expiresAt))
  }

  return new Elysia({ prefix: '/api/v1/auth' })
    .post(
      '/login',
      async ({ body, request, server, set }) => {
        const requestId = requestIdOf(request)
        const client = clientInfo(request, server, config.trustProxy)
        const email = body.email.trim().toLowerCase()

        if (!EMAIL_PATTERN.test(email)) throw errors.validation({ email: ['Format email tidak valid.'] })

        // Counted before the (slow) password check so concurrent guesses cannot bypass the limit.
        const retryAfter = throttle.consume(client.ip, email)
        if (retryAfter > 0) {
          throw new AppError(429, 'TOO_MANY_ATTEMPTS', `Terlalu banyak percobaan masuk. Coba lagi dalam ${Math.ceil(retryAfter / 60)} menit.`, {
            headers: { 'retry-after': String(retryAfter) }
          })
        }

        const [user] = await db.query<LoginUserRow>(
          'select id, name, email, role, party_id, vendor_id, status, password_hash from users where email = $1',
          [email]
        )
        const valid = user && user.status === 'active' && user.password_hash
          ? await verifyPassword(body.password, user.password_hash)
          : await verifyAgainstDummy(body.password)

        if (!valid || !user) {
          await recordAudit(db, {
            action: 'auth.login_failed',
            actorUserId: null,
            entityType: 'user',
            entityId: user?.id ?? null,
            requestId,
            ...client,
            details: { reason: !user ? 'unknown_email' : user.status !== 'active' ? 'inactive_user' : 'bad_password' }
          })
          // One message for every failure mode, so the endpoint cannot be used to discover accounts.
          throw new AppError(401, 'INVALID_CREDENTIALS', 'Email atau kata sandi salah.')
        }

        throttle.reset(client.ip, email)
        if (!canRoleSignIn(user.role, config.portalLogin)) {
          await recordAudit(db, {
            action: 'auth.login_failed', actorUserId: null, entityType: 'user', entityId: user.id, requestId, ...client,
            details: { reason: 'role_disabled' }
          })
          throw new AppError(403, 'ROLE_DISABLED', 'Akses portal sedang dinonaktifkan. Hubungi admin MANOVA.')
        }
        return startSession(user, { request, client, set, action: 'auth.login' })
      },
      {
        body: t.Object({
          email: t.String({ maxLength: 254, error: 'Email wajib diisi.' }),
          password: t.String({ minLength: 1, maxLength: 256, error: 'Kata sandi wajib diisi.' })
        })
      }
    )
    /**
     * One-click sign-in for the demo accounts on the login page. Development/demo only: DEMO_LOGIN is off
     * (and cannot be turned on) in production, and only active `demo-fixture` users of a role that may sign
     * in are accepted — never a real account.
     */
    .post(
      '/demo-login',
      async ({ body, request, server, set }) => {
        if (!config.demoLogin) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Endpoint tidak ditemukan.')
        if (!ID_PATTERN.test(body.userId)) throw errors.notFound('Akun demo')
        const [user] = await db.query<LoginUserRow>(
          `select id, name, email, role, party_id, vendor_id, status, password_hash
             from users where id = $1 and provenance = 'demo-fixture' and status = 'active'`,
          [body.userId]
        )
        if (!user || !isRoleId(user.role) || !canRoleSignIn(user.role, config.portalLogin)) throw errors.notFound('Akun demo')
        return startSession(user, { request, client: clientInfo(request, server, config.trustProxy), set, action: 'auth.demo_login' })
      },
      { body: t.Object({ userId: t.String({ maxLength: 128, error: 'Pilih akun demo.' }) }) }
    )
    .post('/logout', async ({ request, server, set }) => {
      const actor: SessionActor | null = await auth.actorOf(request)
      if (actor) {
        await revokeSession(db, actor.sessionId)
        await recordAudit(db, {
          action: 'auth.logout', actorUserId: actor.userId, entityType: 'user', entityId: actor.userId,
          requestId: requestIdOf(request), ...clientInfo(request, server, config.trustProxy)
        })
      }
      set.headers['set-cookie'] = clearedSessionCookie(auth.cookieName, config.cookieSecure)
      return ok(request, { signedOut: true })
    })
    .get('/me', async ({ request, set }) => {
      const actor = await auth.requireActor(request)
      set.headers['cache-control'] = 'no-store'
      return ok(request, meDto(actor, actor.expiresAt))
    })
}
