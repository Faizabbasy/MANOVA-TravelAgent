import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { notify } from './notifications'

/**
 * Project tasks (S7c). A task without a project is a general to-do from the global Tasks page. Blocking is separate
 * from the status (a task can be in progress and blocked) and always carries a reason.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const STATUSES = ['not-started', 'in-progress', 'pending-confirmation', 'done', 'overdue']
const FORBIDDEN = ['id', 'projectId', 'isBlocked', 'blockedReason']
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const blank = (v: unknown) => v === null || v === ''
const exists = async (tx: Queryable, sql: string, params: unknown[]) => (await tx.query(sql, params)).length > 0

export async function listTasks(db: Queryable, filter: { id?: string; projectId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select id, project_id, title, status, due_on::text as due_on, is_milestone, depends_on, assigned_to, is_blocked, blocked_reason
       from project_tasks where ($1::text is null or id = $1) and ($2::text is null or project_id = $2)
      order by due_on nulls last, id`,
    [filter.id ?? null, filter.projectId ?? null]
  )
  return rows.map(r => ({
    id: r.id as string,
    projectId: str(r.project_id),
    title: r.title as string,
    status: r.status as string,
    dueAt: str(r.due_on),
    isMilestone: r.is_milestone as boolean,
    dependsOnTaskId: str(r.depends_on),
    assignedTo: str(r.assigned_to),
    isBlocked: r.is_blocked as boolean,
    blockedReason: str(r.blocked_reason)
  }))
}

export type TaskView = Awaited<ReturnType<typeof listTasks>>[number]

async function cleanTask(tx: Queryable, projectId: string | null, v: Record<string, unknown>, problems: FieldErrors, selfId?: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  if (v.title !== undefined) {
    const title = typeof v.title === 'string' ? v.title.trim() : ''
    if (!title) problems.title = ['Judul task wajib diisi.']
    else if (title.length > 200) problems.title = ['Judul maksimal 200 karakter.']
    else out.title = title
  }
  if (v.status !== undefined) {
    if (typeof v.status !== 'string' || !STATUSES.includes(v.status)) problems.status = ['Status task tidak dikenal.']
    else out.status = v.status
  }
  if (v.dueAt !== undefined) {
    if (blank(v.dueAt)) out.due_on = null
    else if (typeof v.dueAt !== 'string' || !isIsoDate(v.dueAt)) problems.dueAt = ['Tenggat harus format YYYY-MM-DD.']
    else out.due_on = v.dueAt
  }
  if (v.isMilestone !== undefined) {
    if (typeof v.isMilestone !== 'boolean') problems.isMilestone = ['Harus ya/tidak.']
    else out.is_milestone = v.isMilestone
  }
  if (v.dependsOnTaskId !== undefined) {
    if (blank(v.dependsOnTaskId)) out.depends_on = null
    else if (typeof v.dependsOnTaskId !== 'string' || !ID_PATTERN.test(v.dependsOnTaskId) || v.dependsOnTaskId === selfId ||
      !(await exists(tx, 'select 1 from project_tasks where id = $1 and project_id is not distinct from $2', [v.dependsOnTaskId, projectId])))
      problems.dependsOnTaskId = ['Task prasyarat harus task lain di project yang sama.']
    else out.depends_on = v.dependsOnTaskId
  }
  if (v.assignedTo !== undefined) {
    if (blank(v.assignedTo)) out.assigned_to = null
    else if (typeof v.assignedTo !== 'string' || !ID_PATTERN.test(v.assignedTo) || !(await exists(tx, 'select 1 from users where id = $1', [v.assignedTo])))
      problems.assignedTo = ['User tidak ditemukan.']
    else out.assigned_to = v.assignedTo
  }
  return out
}

/** S9b: the new assignee hears about it (not when the actor assigns themself). */
async function notifyAssignee(tx: Queryable, actor: Actor, userId: string, title: string, projectId: string | null) {
  await notify(tx, { userId, actorUserId: actor.userId, type: 'assignment', title: 'Anda ditugaskan pada task baru', body: `Task "${title}" ditugaskan kepada Anda.`, entityType: projectId ? 'project' : null, entityId: projectId })
}

export async function createTask(tx: Queryable, actor: Actor, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  let projectId: string | null = null
  if (!blank(input.projectId) && input.projectId !== undefined) {
    if (typeof input.projectId !== 'string' || !ID_PATTERN.test(input.projectId) || !(await exists(tx, 'select 1 from projects where id = $1', [input.projectId])))
      problems.projectId = ['Project tidak ditemukan.']
    else projectId = input.projectId
  }
  const values = await cleanTask(tx, projectId, input, problems)
  if (input.title === undefined) problems.title = ['Judul task wajib diisi.']
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'TSK-')
  const cols = ['id', 'project_id', ...Object.keys(values)]
  await tx.query(`insert into project_tasks (${cols.join(', ')}, changed_by_api_at) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}, now())`,
    [id, projectId, ...Object.values(values)])
  if (values.assigned_to) await notifyAssignee(tx, actor, values.assigned_to as string, values.title as string, projectId)
  await recordAudit(tx, { action: 'task.created', actorUserId: actor.userId, entityType: 'task', entityId: id, requestId, after: { projectId, ...values } })
  return { id }
}

async function lockTask(tx: Queryable, id: string) {
  const [row] = await tx.query<{ project_id: string | null; is_blocked: boolean; assigned_to: string | null; title: string }>('select project_id, is_blocked, assigned_to, title from project_tasks where id = $1 for update', [id])
  if (!row) throw errors.notFound('Task')
  return row
}

export async function updateTask(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string) {
  const current = await lockTask(tx, id)
  const problems: FieldErrors = {}
  for (const k of FORBIDDEN) if (input[k] !== undefined) problems[k] = ['Tidak bisa diubah lewat edit task.']
  const values = await cleanTask(tx, current.project_id, input, problems, id)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const cols = Object.keys(values)
  if (!cols.length) return
  await tx.query(`update project_tasks set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, ...Object.values(values)])
  if (values.assigned_to && values.assigned_to !== current.assigned_to) await notifyAssignee(tx, actor, values.assigned_to as string, (values.title as string | undefined) ?? current.title, current.project_id)
  await recordAudit(tx, { action: 'task.updated', actorUserId: actor.userId, entityType: 'task', entityId: id, requestId, after: values })
}

export async function blockTask(tx: Queryable, actor: Actor, id: string, reason: unknown, requestId: string) {
  const text = typeof reason === 'string' ? reason.trim() : ''
  if (!text) throw errors.validation({ reason: ['Alasan blokir wajib diisi.'] })
  if (text.length > 500) throw errors.validation({ reason: ['Alasan maksimal 500 karakter.'] })
  const current = await lockTask(tx, id)
  if (current.is_blocked) throw rule('Task ini sudah diblokir.')
  await tx.query('update project_tasks set is_blocked = true, blocked_reason = $2, changed_by_api_at = now(), updated_at = now() where id = $1', [id, text])
  await recordAudit(tx, { action: 'task.blocked', actorUserId: actor.userId, entityType: 'task', entityId: id, requestId, after: { reason: text } })
}

export async function unblockTask(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const current = await lockTask(tx, id)
  if (!current.is_blocked) throw rule('Task ini tidak sedang diblokir.')
  await tx.query('update project_tasks set is_blocked = false, blocked_reason = null, changed_by_api_at = now(), updated_at = now() where id = $1', [id])
  await recordAudit(tx, { action: 'task.unblocked', actorUserId: actor.userId, entityType: 'task', entityId: id, requestId })
}
