import type { Queryable } from '../../db/client'
import { errors } from '../../http/errors'
import { nextId } from '../../shared/ids'

/**
 * In-app notifications (S9b). The server creates them inside the action that causes them (mention, task assignment,
 * incident escalation); each user reads, marks and removes only their own. Nobody is notified about their own action.
 */

const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : str(v))

export async function notify(tx: Queryable, n: { userId: string; actorUserId: string; type: string; title: string; body: string; entityType?: string | null; entityId?: string | null }) {
  if (n.userId === n.actorUserId) return
  const id = await nextId(tx, 'NOT-')
  await tx.query(
    'insert into notifications (id, user_id, type, title, body, entity_type, entity_id) values ($1, $2, $3, $4, $5, $6, $7)',
    [id, n.userId, n.type, n.title.slice(0, 200), n.body.slice(0, 2000), n.entityType ?? null, n.entityId ?? null]
  )
}

export async function listNotifications(db: Queryable, userId: string, id?: string) {
  const rows = await db.query<Record<string, unknown>>(
    `select id, user_id, type, title, body, entity_type, entity_id, category, read, created_at from notifications
      where user_id = $1 and ($2::text is null or id = $2) order by created_at desc, id desc`, [userId, id ?? null])
  return rows.map(r => ({
    id: r.id as string,
    userId: r.user_id as string,
    type: r.type as string,
    title: r.title as string,
    body: r.body as string,
    entityType: str(r.entity_type),
    entityId: str(r.entity_id),
    category: str(r.category),
    read: r.read as boolean,
    createdAt: iso(r.created_at)!
  }))
}

export async function markRead(tx: Queryable, userId: string, id: string) {
  const rows = await tx.query('update notifications set read = true where id = $1 and user_id = $2 returning id', [id, userId])
  if (!rows.length) throw errors.notFound('Notifikasi')
}

export async function markAllRead(tx: Queryable, userId: string) {
  await tx.query('update notifications set read = true where user_id = $1 and not read', [userId])
}

export async function removeNotification(tx: Queryable, userId: string, id: string) {
  const rows = await tx.query('delete from notifications where id = $1 and user_id = $2 returning id', [id, userId])
  if (!rows.length) throw errors.notFound('Notifikasi')
}
