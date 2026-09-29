import type { Queryable } from '../db/client'

/**
 * Appends one row to the append-only audit trail (a DB trigger rejects UPDATE/DELETE/TRUNCATE).
 * Pass the transaction handle when the audited change is transactional, so both commit or neither does.
 * Never put secrets or full bank account numbers in before/after/details.
 */
export interface AuditEntry {
  action: string
  actorUserId?: string | null
  entityType?: string | null
  entityId?: string | null
  requestId?: string | null
  ip?: string | null
  userAgent?: string | null
  reason?: string | null
  before?: unknown
  after?: unknown
  details?: unknown
}

const json = (value: unknown) => (value === undefined ? null : JSON.stringify(value))

export async function recordAudit(q: Queryable, e: AuditEntry): Promise<void> {
  await q.query(
    `insert into audit_events
       (action, actor_user_id, entity_type, entity_id, request_id, ip, user_agent, reason, before, after, details)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::text::jsonb, $10::text::jsonb, $11::text::jsonb)`,
    [
      e.action,
      e.actorUserId ?? null,
      e.entityType ?? null,
      e.entityId ?? null,
      e.requestId ?? null,
      e.ip ?? null,
      e.userAgent?.slice(0, 512) ?? null,
      e.reason ?? null,
      json(e.before),
      json(e.after),
      json(e.details)
    ]
  )
}
