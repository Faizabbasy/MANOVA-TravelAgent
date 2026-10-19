import { hasModuleLevel, type Actor, type ModuleKey } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { notifyInternal } from './client-writes'
import { notify } from './notifications'

/**
 * S12c-5: comments and attachment names on client-facing records (change request, quotation, document, a project's
 * itinerary, travel request), shared by the client portal and staff. A client only reaches its own party's records;
 * the other side is told about each new comment or attachment.
 */
export const COMMENT_ENTITIES = ['change-request', 'quotation', 'document', 'itinerary', 'travel-request'] as const
export const ATTACHMENT_ENTITIES = ['change-request', 'quotation', 'travel-request'] as const
export type CollabEntity = typeof COMMENT_ENTITIES[number]

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/

/** The module a staff member needs (VIEW) to read or comment on each kind of record. */
const STAFF_MODULE: Record<CollabEntity, ModuleKey> = {
  'change-request': 'operations', quotation: 'sales', document: 'documents', itinerary: 'operations', 'travel-request': 'sales'
}

export interface CollabTarget {
  entityType: CollabEntity
  entityId: string
  partyId: string | null
  /** The internal user who handles the record on MANOVA's side (told when the client writes). */
  handlerUserId: string | null
  label: string
}

type TargetRow = { party_id: string | null; handler: string | null; label: string }

/** Finds the record; a client (`partyId`) only finds its own party's client-visible records. Unknown → 404. */
export async function resolveCollabTarget(db: Queryable, entityType: unknown, entityId: unknown, partyId?: string): Promise<CollabTarget> {
  if (typeof entityType !== 'string' || !(COMMENT_ENTITIES as readonly string[]).includes(entityType)) throw errors.validation({ entityType: ['Jenis data tidak dikenal.'] })
  if (typeof entityId !== 'string' || !ID_PATTERN.test(entityId)) throw errors.notFound('Data')
  const type = entityType as CollabEntity
  const party = partyId ?? null
  let row: TargetRow | undefined
  switch (type) {
    case 'change-request':
      [row] = await db.query<TargetRow>(`select p.party_id, p.owner_user_id as handler, 'Change Request ' || c.id as label
                                from change_requests c join projects p on p.id = c.project_id
                               where c.id = $1 and ($2::text is null or p.party_id = $2)`, [entityId, party])
      break
    case 'itinerary':
      [row] = await db.query<TargetRow>(`select party_id, owner_user_id as handler, 'itinerary ' || name as label from projects
                               where id = $1 and ($2::text is null or party_id = $2)`, [entityId, party])
      break
    case 'quotation':
      [row] = await db.query<TargetRow>(`select l.party_id, coalesce(l.handed_over_to, l.owner_user_id) as handler, 'quotation ' || q.id as label
                                from quotations q join leads l on l.id = q.lead_id
                               where q.id = $1 and ($2::text is null or (l.party_id = $2 and q.sent_to_client_on is not null))`, [entityId, party])
      break
    case 'document':
      [row] = await db.query<TargetRow>(`select coalesce(p.party_id, case when d.entity_type = 'party' then d.entity_id end) as party_id, p.owner_user_id as handler,
                                     'dokumen ' || d.name as label
                                from documents d left join projects p on p.id = d.project_id
                               where d.id = $1 and ($2::text is null or (d.access_level = 'client'
                                     and (p.party_id = $2 or (d.entity_type = 'party' and d.entity_id = $2))))`, [entityId, party])
      break
    case 'travel-request':
      [row] = await db.query<TargetRow>(`select t.party_id, coalesce(t.reviewer_user_id, pa.account_owner_user_id) as handler, 'travel request ' || t.id as label
                                from travel_requests t join parties pa on pa.id = t.party_id
                               where t.id = $1 and ($2::text is null or t.party_id = $2)`, [entityId, party])
      break
  }
  if (!row) throw errors.notFound('Data')
  return { entityType: type, entityId, partyId: row.party_id, handlerUserId: row.handler, label: row.label }
}

/** Staff side: portal roles never pass, and the member needs VIEW on the record's module. */
export function assertStaffCollab(actor: Actor, entityType: unknown) {
  const type = (COMMENT_ENTITIES as readonly string[]).includes(entityType as string) ? entityType as CollabEntity : null
  if (actor.role === 'client' || actor.role === 'vendor' || (type && !hasModuleLevel(actor.role, STAFF_MODULE[type], 'VIEW'))) throw errors.forbidden()
}

const text = (v: unknown, field: string, label: string, max: number) => {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) throw errors.validation({ [field]: [`${label} wajib diisi.`] })
  if (s.length > max) throw errors.validation({ [field]: [`${label} maksimal ${max} karakter.`] })
  return s
}

/** The client users of the record's party (staff wrote) or its handler — else every active admin (the client wrote). */
async function tellOtherSide(tx: Queryable, actor: Actor, target: CollabTarget, fromClient: boolean, title: string, body: string) {
  const entity = { entityType: target.entityType === 'itinerary' ? 'project' : target.entityType, entityId: target.entityId }
  if (!fromClient) {
    if (!target.partyId) return
    const clients = await tx.query<{ id: string }>("select id from users where party_id = $1 and role = 'client' and status = 'active' order by id", [target.partyId])
    for (const c of clients) await notify(tx, { userId: c.id, actorUserId: actor.userId, type: 'message', title, body, ...entity })
    return
  }
  const targets = target.handlerUserId ? [target.handlerUserId]
    : (await tx.query<{ id: string }>("select id from users where role = 'admin' and status = 'active' order by id")).map(r => r.id)
  for (const userId of targets) await notifyInternal(tx, actor, userId, { type: 'message', title, body, ...entity })
}

/* ---------- comments ---------- */

export async function listComments(db: Queryable, entityType: CollabEntity, entityId: string) {
  const rows = await db.query<Record<string, unknown>>(
    `select c.id, c.entity_type, c.entity_id, c.author_user_id, u.name as author_name, c.from_client, c.body, c.created_at
       from entity_comments c join users u on u.id = c.author_user_id
      where c.entity_type = $1 and c.entity_id = $2 order by c.created_at, c.id`, [entityType, entityId])
  return rows.map(r => ({
    id: r.id as string,
    entityType: r.entity_type as CollabEntity,
    entityId: r.entity_id as string,
    authorId: r.author_user_id as string,
    authorName: r.author_name as string,
    fromClient: r.from_client as boolean,
    body: r.body as string,
    createdAt: (r.created_at as Date).toISOString()
  }))
}

/** Clients see who wrote by name only — staff user ids stay internal. */
export const clientComment = <T extends { authorId: string | null; fromClient: boolean }>(c: T): T => ({ ...c, authorId: c.fromClient ? c.authorId : null })

export async function addComment(tx: Queryable, actor: Actor, target: CollabTarget, bodyInput: unknown, requestId: string) {
  const body = text(bodyInput, 'body', 'Komentar', 4000)
  const fromClient = actor.role === 'client'
  const id = await nextId(tx, 'CMT-')
  await tx.query('insert into entity_comments (id, entity_type, entity_id, author_user_id, from_client, body) values ($1, $2, $3, $4, $5, $6)',
    [id, target.entityType, target.entityId, actor.userId, fromClient, body])
  await tellOtherSide(tx, actor, target, fromClient, `Komentar baru di ${target.label}`, body)
  await recordAudit(tx, { action: 'comment.created', actorUserId: actor.userId, entityType: target.entityType, entityId: target.entityId, requestId, after: { commentId: id, fromClient } })
  return { id }
}

/* ---------- attachments (name only, ADR-005) ---------- */

export function assertAttachmentEntity(target: CollabTarget) {
  if (!(ATTACHMENT_ENTITIES as readonly string[]).includes(target.entityType)) throw rule('Lampiran tidak tersedia untuk jenis data ini.')
}

export async function listAttachments(db: Queryable, entityType: CollabEntity, entityId: string) {
  const rows = await db.query<Record<string, unknown>>(
    `select a.id, a.entity_type, a.entity_id, a.file_name, a.uploaded_by, u.name as uploaded_by_name, a.from_client, a.created_at
       from entity_attachments a join users u on u.id = a.uploaded_by
      where a.entity_type = $1 and a.entity_id = $2 order by a.created_at, a.id`, [entityType, entityId])
  return rows.map(r => ({
    id: r.id as string,
    entityType: r.entity_type as CollabEntity,
    entityId: r.entity_id as string,
    fileName: r.file_name as string,
    uploadedBy: r.uploaded_by as string,
    uploadedByName: r.uploaded_by_name as string,
    fromClient: r.from_client as boolean,
    uploadedAt: (r.created_at as Date).toISOString()
  }))
}

export const clientAttachment = <T extends { uploadedBy: string | null; fromClient: boolean }>(a: T): T => ({ ...a, uploadedBy: a.fromClient ? a.uploadedBy : null })

export async function addAttachment(tx: Queryable, actor: Actor, target: CollabTarget, fileNameInput: unknown, requestId: string) {
  assertAttachmentEntity(target)
  const fileName = text(fileNameInput, 'fileName', 'Nama file', 200)
  const fromClient = actor.role === 'client'
  const id = await nextId(tx, 'ATT-')
  await tx.query('insert into entity_attachments (id, entity_type, entity_id, file_name, uploaded_by, from_client) values ($1, $2, $3, $4, $5, $6)',
    [id, target.entityType, target.entityId, fileName, actor.userId, fromClient])
  await tellOtherSide(tx, actor, target, fromClient, `Lampiran baru di ${target.label}`, fileName)
  await recordAudit(tx, { action: 'attachment.added', actorUserId: actor.userId, entityType: target.entityType, entityId: target.entityId, requestId, after: { attachmentId: id, fileName } })
  return { id }
}

/* ---------- change-request drafts (client) ---------- */

export async function listChangeRequestDrafts(db: Queryable, partyId: string, id?: string) {
  const rows = await db.query<Record<string, unknown>>(
    `select d.id, d.project_id, p.name as project_name, d.created_by, d.change_type, d.before_summary, d.after_summary, d.created_at, d.updated_at
       from change_request_drafts d join projects p on p.id = d.project_id
      where d.party_id = $1 and ($2::text is null or d.id = $2) order by d.updated_at desc, d.id`, [partyId, id ?? null])
  return rows.map(r => ({
    id: r.id as string,
    projectId: r.project_id as string,
    projectName: r.project_name as string,
    createdBy: r.created_by as string,
    changeType: (r.change_type as string | null) ?? null,
    beforeSummary: r.before_summary as string,
    afterSummary: r.after_summary as string,
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString()
  }))
}

function draftValues(input: Record<string, unknown>, changeTypes: readonly string[]) {
  const problems: FieldErrors = {}
  const out: Record<string, unknown> = {}
  if (input.changeType !== undefined) {
    if (input.changeType !== null && (typeof input.changeType !== 'string' || !changeTypes.includes(input.changeType))) problems.changeType = ['Jenis perubahan tidak dikenal.']
    else out.change_type = input.changeType
  }
  for (const [field, column] of [['beforeSummary', 'before_summary'], ['afterSummary', 'after_summary']] as const) {
    const v = input[field]
    if (v === undefined) continue
    if (typeof v !== 'string' || v.length > 4000) problems[field] = ['Maksimal 4000 karakter.']
    else out[column] = v
  }
  if (Object.keys(problems).length) throw errors.validation(problems)
  return out
}

/** Creates (no id) or updates the client's own draft; a draft is only kept for a project that can still change. */
export async function saveChangeRequestDraft(tx: Queryable, actor: Actor, partyId: string, id: string | null, input: Record<string, unknown>, changeTypes: readonly string[], requestId: string) {
  const values = draftValues(input, changeTypes)
  if (id) {
    const [d] = await tx.query<{ id: string }>('select id from change_request_drafts where id = $1 and party_id = $2 for update', [id, partyId])
    if (!d) throw errors.notFound('Draft')
    const cols = Object.keys(values)
    if (cols.length) await tx.query(`update change_request_drafts set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`, [id, ...Object.values(values)])
    await recordAudit(tx, { action: 'change_request_draft.saved', actorUserId: actor.userId, entityType: 'change_request_draft', entityId: id, requestId })
    return { id }
  }
  const [p] = await tx.query<{ status: string }>('select status from projects where id = $1 and party_id = $2', [input.projectId, partyId])
  if (typeof input.projectId !== 'string' || !p) throw errors.notFound('Project')
  if (p.status === 'completed' || p.status === 'cancelled') throw rule('Project sudah selesai atau dibatalkan — tidak bisa mengajukan perubahan.')
  const newId = await nextId(tx, 'CRD-')
  await tx.query(`insert into change_request_drafts (id, project_id, party_id, created_by, change_type, before_summary, after_summary)
                  values ($1, $2, $3, $4, $5, $6, $7)`,
    [newId, input.projectId, partyId, actor.userId, values.change_type ?? null, values.before_summary ?? '', values.after_summary ?? ''])
  await recordAudit(tx, { action: 'change_request_draft.saved', actorUserId: actor.userId, entityType: 'change_request_draft', entityId: newId, requestId })
  return { id: newId }
}

export async function deleteChangeRequestDraft(tx: Queryable, actor: Actor, partyId: string, id: string, requestId: string) {
  const deleted = await tx.query('delete from change_request_drafts where id = $1 and party_id = $2 returning id', [id, partyId])
  if (!deleted.length) throw errors.notFound('Draft')
  await recordAudit(tx, { action: 'change_request_draft.deleted', actorUserId: actor.userId, entityType: 'change_request_draft', entityId: id, requestId })
}

/** The draft's fields, locked for submission (the caller creates the change request, then removes the draft). */
export async function takeChangeRequestDraft(tx: Queryable, partyId: string, id: string) {
  const [d] = await tx.query<{ project_id: string; change_type: string | null; before_summary: string; after_summary: string }>(
    'select project_id, change_type, before_summary, after_summary from change_request_drafts where id = $1 and party_id = $2 for update', [id, partyId])
  if (!d) throw errors.notFound('Draft')
  return d
}
