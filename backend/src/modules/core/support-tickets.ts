import { ROLE_IDS, hasCapability, type Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { actorName, recordProjectActivity } from './activities'
import { notifyInternal, ownProject } from './client-writes'
import { notify } from './notifications'

/**
 * Client support tickets (S12c-2). A ticket on a project goes to the project owner; without one it waits in the queue
 * (every active Admin is told). Staff reply to the client or write internal notes the client never sees, resolve and
 * close; the client confirms a resolution, reopens it with a reason, and rates it.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : str(v))

export const TICKET_CATEGORIES = ['reservation', 'participant', 'document', 'billing', 'operational', 'complaint', 'emergency', 'technical', 'service-quality']
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent']

export async function listTicketReplies(db: Queryable, ticketIds: string[], includeInternal: boolean) {
  if (!ticketIds.length) return []
  const rows = await db.query<Record<string, unknown>>(
    `select r.*, u.name as author_name, u.role as author_role from support_ticket_replies r join users u on u.id = r.author_user_id
      where r.ticket_id = any($1::text[]) and ($2 or not r.is_internal) order by r.created_at, r.id`, [ticketIds, includeInternal])
  return rows.map(r => ({
    id: r.id as string,
    ticketId: r.ticket_id as string,
    authorId: r.author_user_id as string,
    authorName: str(r.author_name),
    fromClient: r.author_role === 'client',
    message: r.message as string,
    attachmentName: str(r.attachment_name),
    internal: r.is_internal as boolean,
    createdAt: iso(r.created_at)!
  }))
}

export async function listSupportTickets(db: Queryable, filter: { id?: string; partyId?: string; status?: string; assignedTo?: string } = {}, includeInternal = true) {
  const rows = await db.query<Record<string, unknown>>(
    `select t.*, p.name as party_name, pr.name as project_name, a.name as assigned_to_name, cb.name as created_by_name
       from support_tickets t join parties p on p.id = t.party_id left join projects pr on pr.id = t.project_id
       left join users a on a.id = t.assigned_to left join users cb on cb.id = t.created_by
      where ($1::text is null or t.id = $1) and ($2::text is null or t.party_id = $2) and ($3::text is null or t.status = $3)
        and ($4::text is null or t.assigned_to = $4)
      order by t.created_at desc, t.id desc`,
    [filter.id ?? null, filter.partyId ?? null, filter.status ?? null, filter.assignedTo ?? null])
  const replies = await listTicketReplies(db, rows.map(r => r.id as string), includeInternal)
  return rows.map(r => ({
    id: r.id as string,
    partyId: r.party_id as string,
    partyName: r.party_name as string,
    projectId: str(r.project_id),
    projectName: str(r.project_name),
    category: r.category as string,
    priority: r.priority as string,
    status: r.status as string,
    subject: r.subject as string,
    description: r.description as string,
    attachmentName: str(r.attachment_name),
    createdBy: r.created_by as string,
    createdByName: str(r.created_by_name),
    assignedTo: str(r.assigned_to),
    assignedToName: str(r.assigned_to_name),
    resolutionNote: str(r.resolution_note),
    resolvedBy: str(r.resolved_by),
    resolvedAt: iso(r.resolved_at),
    resolutionRating: r.resolution_rating === null ? null : Number(r.resolution_rating),
    ratingNote: str(r.rating_note),
    reopenCount: Number(r.reopen_count),
    closedAt: iso(r.closed_at),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
    replies: replies.filter(x => x.ticketId === r.id)
  }))
}

export type SupportTicketView = Awaited<ReturnType<typeof listSupportTickets>>[number]

/** The client's view: no internal notes (already filtered) and no internal flags or staff ids except the handler's name. */
export const clientSupportTicket = (t: SupportTicketView) => ({
  ...t, assignedTo: null, resolvedBy: null, replies: t.replies.map(({ internal: _internal, ...reply }) => ({ ...reply, authorId: reply.fromClient ? reply.authorId : null }))
})

const text = (v: unknown, field: string, label: string, problems: FieldErrors, max: number, required = true) => {
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) { if (required) problems[field] = [`${label} wajib diisi.`]; return null }
  if (typeof v !== 'string' || v.trim().length > max) { problems[field] = [`${label} maksimal ${max} karakter.`]; return null }
  return v.trim()
}

const activeAdmins = async (tx: Queryable) => (await tx.query<{ id: string }>("select id from users where role = 'admin' and status = 'active' order by id")).map(r => r.id)

async function lockClientTicket(tx: Queryable, partyId: string, id: string) {
  const [row] = await tx.query<{ id: string; status: string; assigned_to: string | null; subject: string; project_id: string | null }>(
    'select id, status, assigned_to, subject, project_id from support_tickets where id = $1 and party_id = $2 for update', [id, partyId])
  if (!row) throw errors.notFound('Tiket')
  return row
}

/** Tells whoever handles the ticket — its assignee, or every active Admin while it waits in the queue. */
/** Roles that can open the staff inbox (`support.manage-ticket`). */
const HANDLER_ROLES = ROLE_IDS.filter(role => hasCapability(role, 'support.manage-ticket'))
/** The user when they are active and can work the inbox — otherwise null, so the ticket goes to the queue / the admins. */
async function handler(tx: Queryable, userId: string | null | undefined) {
  if (!userId) return null
  const [row] = await tx.query<{ id: string }>("select id from users where id = $1 and status = 'active' and role = any($2::text[])", [userId, HANDLER_ROLES])
  return row?.id ?? null
}
async function tellHandlers(tx: Queryable, actor: Actor, assignedTo: string | null, n: { title: string; body: string; ticketId: string }) {
  const current = await handler(tx, assignedTo)
  const targets = current ? [current] : await activeAdmins(tx)
  for (const userId of targets) await notifyInternal(tx, actor, userId, { type: 'assignment', title: n.title, body: n.body, entityType: 'support-ticket', entityId: n.ticketId })
}

export async function clientCreateTicket(tx: Queryable, actor: Actor, partyId: string, input: Record<string, unknown>, requestId: string) {
  const problems: FieldErrors = {}
  const subject = text(input.subject, 'subject', 'Subjek', problems, 200)
  const description = text(input.description, 'description', 'Deskripsi', problems, 4000)
  const attachment = text(input.attachmentName, 'attachmentName', 'Nama lampiran', problems, 200, false)
  if (typeof input.category !== 'string' || !TICKET_CATEGORIES.includes(input.category)) problems.category = ['Kategori tidak dikenal.']
  if (typeof input.priority !== 'string' || !TICKET_PRIORITIES.includes(input.priority)) problems.priority = ['Prioritas tidak dikenal.']
  if (Object.keys(problems).length) throw errors.validation(problems)
  const project = input.projectId ? await ownProject(tx, partyId, input.projectId) : null
  const assignedTo = await handler(tx, project?.ownerUserId)
  const id = await nextId(tx, 'TCK-')
  await tx.query(
    `insert into support_tickets (id, party_id, project_id, category, priority, status, subject, description, attachment_name, created_by, assigned_to)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, partyId, project?.id ?? null, input.category, input.priority, assignedTo ? 'assigned' : 'open', subject, description, attachment, actor.userId, assignedTo])
  const who = await actorName(tx, actor.userId)
  if (project) {
    await recordProjectActivity(tx, { projectId: project.id, actorUserId: actor.userId, sourceAction: 'support_ticket.created', sourceEntityId: id,
      message: `Tiket support ${id} (${input.category}, ${input.priority}) dibuat oleh client ${who}: ${subject}` })
  }
  await tellHandlers(tx, actor, assignedTo, { ticketId: id, title: `Tiket support baru ${id}${input.priority === 'urgent' ? ' (URGENT)' : ''}`, body: `${subject} — dari ${who}.` })
  if (input.category === 'billing') {
    const finance = await tx.query<{ id: string }>("select id from users where role = 'finance' and status = 'active' order by id")
    for (const u of finance) await notifyInternal(tx, actor, u.id, { type: 'reminder', title: `Tiket billing ${id}`, body: subject!, entityType: 'support-ticket', entityId: id })
  }
  await recordAudit(tx, { action: 'support_ticket.created', actorUserId: actor.userId, entityType: 'support_ticket', entityId: id, requestId,
    after: { partyId, projectId: project?.id ?? null, category: input.category, priority: input.priority, assignedTo } })
  return { id }
}

export async function clientReplyTicket(tx: Queryable, actor: Actor, partyId: string, id: string, input: Record<string, unknown>, requestId: string) {
  const problems: FieldErrors = {}
  const message = text(input.message, 'message', 'Pesan', problems, 4000)
  const attachment = text(input.attachmentName, 'attachmentName', 'Nama lampiran', problems, 200, false)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const ticket = await lockClientTicket(tx, partyId, id)
  if (ticket.status === 'closed') throw rule('Tiket ini sudah ditutup — buka kembali bila masalah belum selesai.')
  const replyId = await nextId(tx, 'TCKR-')
  await tx.query('insert into support_ticket_replies (id, ticket_id, author_user_id, message, attachment_name) values ($1, $2, $3, $4, $5)', [replyId, id, actor.userId, message, attachment])
  await tx.query(`update support_tickets set status = case when status = 'waiting-for-client' then 'in-progress' else status end, updated_at = now() where id = $1`, [id])
  await tellHandlers(tx, actor, ticket.assigned_to, { ticketId: id, title: `Balasan client di tiket ${id}`, body: message! })
  await recordAudit(tx, { action: 'support_ticket.client_replied', actorUserId: actor.userId, entityType: 'support_ticket', entityId: id, requestId, after: { replyId } })
  return { id: replyId }
}

export async function clientConfirmTicket(tx: Queryable, actor: Actor, partyId: string, id: string, requestId: string) {
  const ticket = await lockClientTicket(tx, partyId, id)
  if (ticket.status !== 'resolved') throw rule('Hanya tiket yang sudah diselesaikan yang bisa dikonfirmasi.')
  await tx.query("update support_tickets set status = 'closed', closed_at = now(), updated_at = now() where id = $1", [id])
  await recordAudit(tx, { action: 'support_ticket.confirmed', actorUserId: actor.userId, entityType: 'support_ticket', entityId: id, requestId })
}

export async function clientReopenTicket(tx: Queryable, actor: Actor, partyId: string, id: string, reasonInput: unknown, requestId: string) {
  const reason = typeof reasonInput === 'string' ? reasonInput.trim() : ''
  if (!reason) throw errors.validation({ reason: ['Alasan wajib diisi.'] })
  const ticket = await lockClientTicket(tx, partyId, id)
  if (ticket.status !== 'resolved' && ticket.status !== 'closed') throw rule('Hanya tiket yang sudah diselesaikan atau ditutup yang bisa dibuka kembali.')
  await tx.query("update support_tickets set status = 'reopened', reopen_count = reopen_count + 1, closed_at = null, updated_at = now() where id = $1", [id])
  const replyId = await nextId(tx, 'TCKR-')
  await tx.query('insert into support_ticket_replies (id, ticket_id, author_user_id, message) values ($1, $2, $3, $4)', [replyId, id, actor.userId, `Tiket dibuka kembali. Alasan: ${reason.slice(0, 2000)}`])
  await tellHandlers(tx, actor, ticket.assigned_to, { ticketId: id, title: `Tiket ${id} dibuka kembali client`, body: reason })
  await recordAudit(tx, { action: 'support_ticket.reopened', actorUserId: actor.userId, entityType: 'support_ticket', entityId: id, requestId, reason })
}

export async function clientRateTicket(tx: Queryable, actor: Actor, partyId: string, id: string, input: Record<string, unknown>, requestId: string) {
  const rating = input.rating
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) throw errors.validation({ rating: ['Rating 1–5.'] })
  const problems: FieldErrors = {}
  const note = text(input.note, 'note', 'Catatan', problems, 1000, false)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const ticket = await lockClientTicket(tx, partyId, id)
  if (ticket.status !== 'resolved' && ticket.status !== 'closed') throw rule('Rating diberikan setelah tiket diselesaikan.')
  await tx.query('update support_tickets set resolution_rating = $2, rating_note = $3, updated_at = now() where id = $1', [id, rating, note])
  await recordAudit(tx, { action: 'support_ticket.rated', actorUserId: actor.userId, entityType: 'support_ticket', entityId: id, requestId, after: { rating } })
}

/** Used by the staff side (Task 2) to tell the client who opened the ticket. */
export async function notifyTicketClient(tx: Queryable, actor: Actor, ticketId: string, n: { title: string; body: string }) {
  const [t] = await tx.query<{ created_by: string }>('select created_by from support_tickets where id = $1', [ticketId])
  if (t) await notify(tx, { userId: t.created_by, actorUserId: actor.userId, type: 'message', title: n.title, body: n.body, entityType: 'support-ticket', entityId: ticketId })
}

/* ---------- staff (support.manage-ticket) ---------- */

async function lockTicket(tx: Queryable, id: string) {
  const [row] = await tx.query<{ id: string; status: string; subject: string; assigned_to: string | null }>(
    'select id, status, subject, assigned_to from support_tickets where id = $1 for update', [id])
  if (!row) throw errors.notFound('Tiket')
  return row
}
const OPEN_STATUSES = ['open', 'assigned', 'in-progress', 'waiting-for-client', 'reopened']

export async function staffAssignTicket(tx: Queryable, actor: Actor, id: string, userIdInput: unknown, requestId: string) {
  const [user] = typeof userIdInput === 'string'
    ? await tx.query<{ id: string }>("select id from users where id = $1 and status = 'active' and role not in ('client', 'vendor')", [userIdInput])
    : []
  if (!user) throw errors.validation({ userId: ['Pilih staf internal yang aktif.'] })
  const ticket = await lockTicket(tx, id)
  if (!OPEN_STATUSES.includes(ticket.status)) throw rule('Tiket yang sudah diselesaikan atau ditutup tidak bisa ditugaskan ulang.')
  await tx.query(`update support_tickets set assigned_to = $2, status = case when status in ('open', 'reopened') then 'assigned' else status end, updated_at = now() where id = $1`, [id, user.id])
  await notifyInternal(tx, actor, user.id, { type: 'assignment', title: `Tiket ${id} ditugaskan kepada Anda`, body: ticket.subject, entityType: 'support-ticket', entityId: id })
  await recordAudit(tx, { action: 'support_ticket.assigned', actorUserId: actor.userId, entityType: 'support_ticket', entityId: id, requestId,
    before: { assignedTo: ticket.assigned_to }, after: { assignedTo: user.id } })
}

export async function staffSetTicketStatus(tx: Queryable, actor: Actor, id: string, to: unknown, requestId: string) {
  if (to !== 'in-progress' && to !== 'waiting-for-client') throw errors.validation({ to: ['Status harus in-progress atau waiting-for-client.'] })
  const ticket = await lockTicket(tx, id)
  if (!OPEN_STATUSES.includes(ticket.status)) throw rule('Tiket ini sudah diselesaikan atau ditutup.')
  await tx.query('update support_tickets set status = $2, updated_at = now() where id = $1', [id, to])
  if (to === 'waiting-for-client') await notifyTicketClient(tx, actor, id, { title: `Tiket ${id} menunggu tanggapan Anda`, body: ticket.subject })
  await recordAudit(tx, { action: 'support_ticket.status_changed', actorUserId: actor.userId, entityType: 'support_ticket', entityId: id, requestId,
    before: { status: ticket.status }, after: { status: to } })
}

export async function staffReplyTicket(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string) {
  const problems: FieldErrors = {}
  const message = text(input.message, 'message', 'Pesan', problems, 4000)
  const attachment = text(input.attachmentName, 'attachmentName', 'Nama lampiran', problems, 200, false)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const internal = input.internal === true
  const ticket = await lockTicket(tx, id)
  if (ticket.status === 'closed' && !internal) throw rule('Tiket ini sudah ditutup.')
  const replyId = await nextId(tx, 'TCKR-')
  await tx.query('insert into support_ticket_replies (id, ticket_id, author_user_id, message, attachment_name, is_internal) values ($1, $2, $3, $4, $5, $6)',
    [replyId, id, actor.userId, message, attachment, internal])
  // A reply to the client means someone is on it; an internal note changes nothing the client sees.
  if (!internal) await tx.query(`update support_tickets set status = case when status in ('open', 'assigned', 'reopened') then 'in-progress' else status end, updated_at = now() where id = $1`, [id])
  if (!internal) await notifyTicketClient(tx, actor, id, { title: `Balasan tim kami di tiket ${id}`, body: message! })
  await recordAudit(tx, { action: internal ? 'support_ticket.internal_note' : 'support_ticket.staff_replied', actorUserId: actor.userId, entityType: 'support_ticket', entityId: id, requestId, after: { replyId } })
  return { id: replyId }
}

export async function staffResolveTicket(tx: Queryable, actor: Actor, id: string, noteInput: unknown, requestId: string) {
  const note = typeof noteInput === 'string' ? noteInput.trim() : ''
  if (!note) throw errors.validation({ note: ['Catatan penyelesaian wajib diisi.'] })
  const ticket = await lockTicket(tx, id)
  if (!OPEN_STATUSES.includes(ticket.status)) throw rule('Tiket ini sudah diselesaikan atau ditutup.')
  await tx.query("update support_tickets set status = 'resolved', resolution_note = $2, resolved_by = $3, resolved_at = now(), updated_at = now() where id = $1",
    [id, note.slice(0, 4000), actor.userId])
  await notifyTicketClient(tx, actor, id, { title: `Tiket ${id} sudah diselesaikan`, body: `${note} — mohon konfirmasi, atau buka kembali bila belum beres.` })
  await recordAudit(tx, { action: 'support_ticket.resolved', actorUserId: actor.userId, entityType: 'support_ticket', entityId: id, requestId, reason: note })
}

export async function staffCloseTicket(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const ticket = await lockTicket(tx, id)
  if (ticket.status !== 'resolved') throw rule('Hanya tiket yang sudah diselesaikan yang bisa ditutup.')
  await tx.query("update support_tickets set status = 'closed', closed_at = now(), updated_at = now() where id = $1", [id])
  await recordAudit(tx, { action: 'support_ticket.closed', actorUserId: actor.userId, entityType: 'support_ticket', entityId: id, requestId })
}
