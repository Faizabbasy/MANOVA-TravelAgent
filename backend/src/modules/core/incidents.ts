import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { actorName, recordProjectActivity } from './activities'
import { notify } from './notifications'

/**
 * Project incidents (S8; the communication log's `from` is a user id, like the demo data): open → investigating / escalated → resolved → closed. Escalation names the user it goes
 * to; the communication log is append-only; resolving needs a note. Every step lands in the project's activity log.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const SEVERITIES = ['low', 'medium', 'high', 'critical']
const BOOKING_TYPES = ['flight', 'hotel', 'transport', 'mice']
const TRANSITIONS: Record<string, string[]> = {
  open: ['investigating', 'escalated', 'resolved'],
  investigating: ['escalated', 'resolved'],
  escalated: ['investigating', 'resolved'],
  resolved: ['closed'],
  closed: []
}
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : str(v))
const exists = async (tx: Queryable, sql: string, params: unknown[]) => (await tx.query(sql, params)).length > 0

type LogEntry = { id: string; at: string; from: string; message: string }

export async function listIncidents(db: Queryable, filter: { id?: string; projectId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    'select * from incidents where ($1::text is null or id = $1) and ($2::text is null or project_id = $2) order by created_at desc, id desc',
    [filter.id ?? null, filter.projectId ?? null]
  )
  return rows.map(r => ({
    id: r.id as string,
    projectId: r.project_id as string,
    bookingType: str(r.booking_type),
    bookingId: str(r.booking_id),
    title: r.title as string,
    description: r.description as string,
    severity: r.severity as string,
    ownerId: r.owner_id as string,
    status: r.status as string,
    escalatedTo: str(r.escalated_to),
    communicationLog: r.communication_log as LogEntry[],
    resolutionNote: str(r.resolution_note),
    resolvedAt: iso(r.resolved_at),
    createdAt: iso(r.created_at)!
  }))
}

export type IncidentView = Awaited<ReturnType<typeof listIncidents>>[number]

const userExists = (tx: Queryable, id: unknown) => typeof id === 'string' && ID_PATTERN.test(id) ? exists(tx, 'select 1 from users where id = $1', [id]) : Promise.resolve(false)

export async function createIncident(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  if (!title || title.length > 200) problems.title = ['Judul insiden wajib diisi (maksimal 200 karakter).']
  if (!description || description.length > 2000) problems.description = ['Deskripsi insiden wajib diisi (maksimal 2000 karakter).']
  if (typeof input.severity !== 'string' || !SEVERITIES.includes(input.severity)) problems.severity = ['Tingkat insiden harus low, medium, high, atau critical.']
  if (!(await userExists(tx, input.ownerId))) problems.ownerId = ['PIC insiden tidak ditemukan.']
  let bookingType: string | null = null
  let bookingId: string | null = null
  if (input.bookingType !== undefined || input.bookingId !== undefined) {
    if (typeof input.bookingType !== 'string' || !BOOKING_TYPES.includes(input.bookingType) || typeof input.bookingId !== 'string' ||
      !(await exists(tx, 'select 1 from booking_refs where booking_type = $1 and booking_id = $2 and project_id = $3', [input.bookingType, input.bookingId, projectId])))
      problems.bookingId = ['Booking tidak ditemukan di project ini.']
    else { bookingType = input.bookingType; bookingId = input.bookingId }
  }
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'INC-')
  await tx.query(
    `insert into incidents (id, project_id, booking_type, booking_id, title, description, severity, owner_id, changed_by_api_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
    [id, projectId, bookingType, bookingId, title, description, input.severity, input.ownerId]
  )
  await recordProjectActivity(tx, { projectId, actorUserId: actor.userId, sourceAction: 'incident.created', sourceEntityId: id,
    message: `Insiden ${id} (${input.severity}) dicatat oleh ${await actorName(tx, actor.userId)}: ${title}.` })
  await recordAudit(tx, { action: 'incident.created', actorUserId: actor.userId, entityType: 'incident', entityId: id, requestId,
    after: { projectId, title, severity: input.severity, ownerId: input.ownerId, bookingType, bookingId } })
  return { id }
}

async function lockIncident(tx: Queryable, id: string) {
  const [row] = await tx.query<{ project_id: string; status: string; communication_log: LogEntry[] }>(
    'select project_id, status, communication_log from incidents where id = $1 for update', [id])
  if (!row) throw errors.notFound('Insiden')
  return row
}

function logEntry(id: string, log: LogEntry[], from: string, message: string): LogEntry {
  return { id: `${id}-COM-${log.length + 1}`, at: new Date().toISOString(), from, message: message.slice(0, 2000) }
}

async function step(tx: Queryable, actor: Actor, inc: { project_id: string }, id: string, what: string, action: string, requestId: string, after?: unknown) {
  await recordProjectActivity(tx, { projectId: inc.project_id, actorUserId: actor.userId, sourceAction: action, sourceEntityId: id,
    message: `Insiden ${id} ${what} oleh ${await actorName(tx, actor.userId)}.` })
  await recordAudit(tx, { action, actorUserId: actor.userId, entityType: 'incident', entityId: id, requestId, after })
}

export async function changeIncidentStatus(tx: Queryable, actor: Actor, id: string, to: unknown, requestId: string) {
  if (typeof to !== 'string' || !(to in TRANSITIONS) || to === 'resolved' || to === 'escalated')
    throw errors.validation({ to: ['Status tujuan tidak valid (resolve dan eskalasi punya aksi sendiri).'] })
  const inc = await lockIncident(tx, id)
  if (!TRANSITIONS[inc.status]!.includes(to)) throw rule(`Status insiden tidak bisa berubah dari ${inc.status} ke ${to}.`)
  await tx.query('update incidents set status = $2, changed_by_api_at = now(), updated_at = now() where id = $1', [id, to])
  await step(tx, actor, inc, id, `berubah status menjadi ${to}`, 'incident.status_changed', requestId, { from: inc.status, to })
}

export async function escalateIncident(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string) {
  if (!(await userExists(tx, input.to))) throw errors.validation({ to: ['Pilih user tujuan eskalasi.'] })
  const inc = await lockIncident(tx, id)
  if (!TRANSITIONS[inc.status]!.includes('escalated')) throw rule('Insiden ini tidak bisa dieskalasi dari status sekarang.')
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim() : null
  const target = await actorName(tx, input.to as string)
  const log = [...inc.communication_log, logEntry(id, inc.communication_log, actor.userId, `Dieskalasi ke ${target}${note ? `: ${note}` : '.'}`)]
  await tx.query(
    `update incidents set status = 'escalated', escalated_to = $2, communication_log = $3::text::jsonb, changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, input.to, JSON.stringify(log)])
  await step(tx, actor, inc, id, `dieskalasi ke ${target}`, 'incident.escalated', requestId, { to: input.to, note })
  // S9b: the person it is escalated to is notified.
  await notify(tx, { userId: input.to as string, actorUserId: actor.userId, type: 'escalation', title: `Incident ${id} dieskalasi kepada Anda`, body: `${note ?? 'Dieskalasi'} — oleh ${await actorName(tx, actor.userId)}.`, entityType: 'incident', entityId: id })
}

export async function addIncidentCommunication(tx: Queryable, actor: Actor, id: string, message: unknown, requestId: string) {
  const text = typeof message === 'string' ? message.trim() : ''
  if (!text) throw errors.validation({ message: ['Pesan wajib diisi.'] })
  const inc = await lockIncident(tx, id)
  if (inc.status === 'closed') throw rule('Insiden yang sudah ditutup tidak bisa ditambah catatan.')
  const log = [...inc.communication_log, logEntry(id, inc.communication_log, actor.userId, text)]
  await tx.query('update incidents set communication_log = $2::text::jsonb, changed_by_api_at = now(), updated_at = now() where id = $1', [id, JSON.stringify(log)])
  await recordAudit(tx, { action: 'incident.communication_added', actorUserId: actor.userId, entityType: 'incident', entityId: id, requestId })
}

export async function resolveIncident(tx: Queryable, actor: Actor, id: string, note: unknown, requestId: string) {
  const text = typeof note === 'string' ? note.trim() : ''
  if (!text) throw errors.validation({ note: ['Catatan resolusi wajib diisi.'] })
  const inc = await lockIncident(tx, id)
  if (!TRANSITIONS[inc.status]!.includes('resolved')) throw rule('Insiden ini sudah diselesaikan atau ditutup.')
  await tx.query(
    `update incidents set status = 'resolved', resolution_note = $2, resolved_at = now(), changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, text.slice(0, 2000)])
  await step(tx, actor, inc, id, 'diselesaikan', 'incident.resolved', requestId, { note: text })
}
