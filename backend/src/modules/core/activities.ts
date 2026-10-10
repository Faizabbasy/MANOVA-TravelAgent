import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'

/**
 * Project activity log (S7d). `ACT-` rows are written by server actions in their own transaction (booking status,
 * service marked changed, intentional duplicate booking, service order status, lead Won); `CHG-` rows are changes
 * logged by hand and approved or rejected. An automatic change entry (`is_change` without approval) is closed by
 * marking it reviewed.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const CATEGORIES = ['traveler', 'itinerary', 'service', 'vendor', 'budget', 'other']
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))

export async function listActivities(db: Queryable, filter: { id?: string; projectId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select id, project_id, message, is_change, reviewed, category, reason, requested_by, before_value, after_value, impact_note,
            approval_status, approved_by, actor_user_id, source_action,
            to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at
       from project_activities where ($1::text is null or id = $1) and ($2::text is null or project_id = $2)
      order by created_at desc, id desc`,
    [filter.id ?? null, filter.projectId ?? null]
  )
  return rows.map(r => ({
    id: r.id as string,
    projectId: r.project_id as string,
    message: r.message as string,
    isChange: r.is_change as boolean,
    reviewed: r.reviewed as boolean,
    createdAt: r.created_at as string,
    category: str(r.category),
    reason: str(r.reason),
    requestedBy: str(r.requested_by),
    beforeValue: str(r.before_value),
    afterValue: str(r.after_value),
    impactNote: str(r.impact_note),
    approvalStatus: str(r.approval_status),
    approvedBy: str(r.approved_by),
    actorUserId: str(r.actor_user_id),
    sourceAction: str(r.source_action)
  }))
}

export type ActivityView = Awaited<ReturnType<typeof listActivities>>[number]

/** The display name used in activity messages ("… oleh Doni Saputra"). */
export async function actorName(tx: Queryable, userId: string): Promise<string> {
  const [u] = await tx.query<{ name: string }>('select name from users where id = $1', [userId])
  return u?.name ?? userId
}

/** Appends one activity to a project's log, inside the caller's transaction. A change entry starts unreviewed. */
export async function recordProjectActivity(tx: Queryable, a: { projectId: string; message: string; isChange?: boolean; actorUserId: string; sourceAction: string; sourceEntityId?: string | null }): Promise<string> {
  const id = await nextId(tx, 'ACT-')
  await tx.query(
    `insert into project_activities (id, project_id, message, is_change, reviewed, actor_user_id, source_action, source_entity_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, a.projectId, a.message.slice(0, 2000), a.isChange === true, a.isChange !== true, a.actorUserId, a.sourceAction, a.sourceEntityId ?? null]
  )
  return id
}

const text = (v: unknown, field: string, problems: FieldErrors, max = 1000): string | null => {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string' || v.trim().length > max) { problems[field] = [`Harus teks, maksimal ${max} karakter.`]; return null }
  return v.trim() || null
}

export async function logChange(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (typeof input.category !== 'string' || !CATEGORIES.includes(input.category)) problems.category = ['Kategori perubahan tidak dikenal.']
  const reason = text(input.reason, 'reason', problems)
  if (!reason && !problems.reason) problems.reason = ['Alasan perubahan wajib diisi.']
  const before = text(input.beforeValue, 'beforeValue', problems)
  const after = text(input.afterValue, 'afterValue', problems)
  const impact = text(input.impactNote, 'impactNote', problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'CHG-')
  await tx.query(
    `insert into project_activities (id, project_id, message, is_change, reviewed, category, reason, requested_by, before_value, after_value,
                                     impact_note, approval_status, actor_user_id, source_action)
     values ($1, $2, $3, true, false, $4, $3, $5, $6, $7, $8, 'pending', $5, 'change.logged')`,
    [id, projectId, reason, input.category, actor.userId, before, after, impact]
  )
  await recordAudit(tx, { action: 'project_change.logged', actorUserId: actor.userId, entityType: 'project_activity', entityId: id, requestId,
    after: { projectId, category: input.category, reason } })
  return { id }
}

async function lockActivity(tx: Queryable, id: string) {
  const [row] = await tx.query<{ is_change: boolean; reviewed: boolean; approval_status: string | null }>(
    'select is_change, reviewed, approval_status from project_activities where id = $1 for update', [id])
  if (!row) throw errors.notFound('Aktivitas')
  return row
}

export async function decideChange(tx: Queryable, actor: Actor, id: string, decision: 'approved' | 'rejected', requestId: string) {
  const current = await lockActivity(tx, id)
  if (current.approval_status !== 'pending') throw rule('Perubahan ini tidak sedang menunggu approval.')
  await tx.query(
    `update project_activities set approval_status = $2, approved_by = $3, reviewed = true, reviewed_by = $3, reviewed_at = now() where id = $1`,
    [id, decision, actor.userId]
  )
  await recordAudit(tx, { action: decision === 'approved' ? 'project_change.approved' : 'project_change.rejected', actorUserId: actor.userId,
    entityType: 'project_activity', entityId: id, requestId })
}

export async function markReviewed(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const current = await lockActivity(tx, id)
  if (!current.is_change || current.approval_status !== null) throw rule('Hanya perubahan otomatis yang ditandai direview; perubahan manual disetujui atau ditolak.')
  if (current.reviewed) throw rule('Perubahan ini sudah direview.')
  await tx.query('update project_activities set reviewed = true, reviewed_by = $2, reviewed_at = now() where id = $1', [id, actor.userId])
  await recordAudit(tx, { action: 'project_change.reviewed', actorUserId: actor.userId, entityType: 'project_activity', entityId: id, requestId })
}
