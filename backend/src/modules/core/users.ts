import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'

/**
 * User administration (S10a, Super Admin only through `admin.manage-users`). A suspension carries its reason and signs
 * the user out at once; a role change moves only between internal roles and also signs the user out so the new
 * permissions apply. Nobody changes their own account here, and the last active Super Admin cannot be suspended or
 * demoted (defensive: the actor is an active Super Admin, so another one always exists when the target is one).
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const INTERNAL_ROLES = ['super-admin', 'admin', 'finance']
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : str(v))

export async function listUsers(db: Queryable, id?: string) {
  const rows = await db.query<Record<string, unknown>>(
    `select id, name, email, role, status, suspended_reason, suspended_at, party_id, vendor_id from users
      where ($1::text is null or id = $1) order by id`, [id ?? null])
  return rows.map(r => ({
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    role: r.role as string,
    status: r.status as string,
    suspendedReason: str(r.suspended_reason),
    suspendedAt: iso(r.suspended_at),
    clientPartyId: str(r.party_id),
    vendorId: str(r.vendor_id)
  }))
}

async function lockUser(tx: Queryable, actor: Actor, id: string) {
  const [u] = await tx.query<{ role: string; status: string }>('select role, status from users where id = $1 for update', [id])
  if (!u) throw errors.notFound('User')
  if (id === actor.userId) throw rule('Akun sendiri tidak bisa diubah dari sini.')
  return u
}

async function assertNotLastSuperAdmin(tx: Queryable, id: string) {
  const [{ n }] = await tx.query<{ n: number }>("select count(*)::int as n from users where role = 'super-admin' and status = 'active' and id <> $1", [id]) as [{ n: number }]
  if (n === 0) throw rule('Super Admin aktif terakhir tidak bisa dinonaktifkan atau diturunkan.')
}

const endSessions = (tx: Queryable, id: string) => tx.query('delete from sessions where user_id = $1', [id])

export async function suspendUser(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, requestId: string) {
  const reason = typeof reasonInput === 'string' ? reasonInput.trim() : ''
  if (!reason) throw errors.validation({ reason: ['Alasan penonaktifan wajib diisi.'] })
  if (reason.length > 500) throw errors.validation({ reason: ['Alasan maksimal 500 karakter.'] })
  const u = await lockUser(tx, actor, id)
  if (u.status === 'suspended') throw rule('User ini sudah dinonaktifkan.')
  if (u.role === 'super-admin') await assertNotLastSuperAdmin(tx, id)
  await tx.query(
    "update users set status = 'suspended', suspended_reason = $2, suspended_at = now(), changed_by_api_at = now(), updated_at = now() where id = $1", [id, reason])
  await endSessions(tx, id)
  await recordAudit(tx, { action: 'user.suspended', actorUserId: actor.userId, entityType: 'user', entityId: id, requestId, reason })
}

export async function reactivateUser(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const u = await lockUser(tx, actor, id)
  if (u.status !== 'suspended') throw rule('User ini sudah aktif.')
  await tx.query(
    "update users set status = 'active', suspended_reason = null, suspended_at = null, changed_by_api_at = now(), updated_at = now() where id = $1", [id])
  await recordAudit(tx, { action: 'user.reactivated', actorUserId: actor.userId, entityType: 'user', entityId: id, requestId })
}

export async function changeUserRole(tx: Queryable, actor: Actor, id: string, roleInput: unknown, requestId: string) {
  if (typeof roleInput !== 'string' || !INTERNAL_ROLES.includes(roleInput)) throw errors.validation({ role: ['Role harus super-admin, admin, atau finance.'] })
  const u = await lockUser(tx, actor, id)
  if (!INTERNAL_ROLES.includes(u.role)) throw rule('Role user portal (client/vendor) tidak bisa diubah dari sini.')
  if (u.role === roleInput) return
  if (u.role === 'super-admin') await assertNotLastSuperAdmin(tx, id)
  await tx.query('update users set role = $2, changed_by_api_at = now(), updated_at = now() where id = $1', [id, roleInput])
  await endSessions(tx, id)
  await recordAudit(tx, { action: 'user.role_changed', actorUserId: actor.userId, entityType: 'user', entityId: id, requestId,
    before: { role: u.role }, after: { role: roleInput } })
}
