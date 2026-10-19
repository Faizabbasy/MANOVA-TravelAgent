import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { businessDateOf, isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { actorName, recordProjectActivity } from './activities'
import { notify } from './notifications'

/**
 * Document metadata and messages (S9). A document is its metadata (no file storage, like the UI today); an uploaded
 * one starts at version 1 with the actor as uploader. A message's sender is the actor; delivery is simulated
 * (internal note → sent, client/supplier → delivered). Client-portal versions, comments and read state stay local.
 */

const ENTITY_TYPES = ['project', 'party', 'vendor', 'traveler', 'quotation', 'flight', 'hotel', 'transport', 'mice', 'invoice', 'change-request', 'incident', 'travel-request', 'approval']
const ACCESS = ['internal', 'client', 'supplier']
const CHANNELS = ['internal-note', 'client-message', 'supplier-message']
const DELIVERY = ['email', 'whatsapp']
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : str(v))
const exists = async (tx: Queryable, sql: string, params: unknown[]) => (await tx.query(sql, params)).length > 0

/** `partyId` (S12a, client portal): client-visible documents of that party's projects or of the party itself. */
export async function listDocuments(db: Queryable, filter: { id?: string; projectId?: string; partyId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select id, entity_type, entity_id, project_id, name, category, version, access_level, source_type, preview_route, uploaded_by,
            uploaded_on::text as uploaded_on, generated_on::text as generated_on, expires_on::text as expires_on, supersedes_id,
            verified, verified_by, verified_on::text as verified_on
       from documents where ($1::text is null or id = $1) and ($2::text is null or project_id = $2)
        and ($3::text is null or (access_level = 'client' and (project_id in (select id from projects where party_id = $3)
                                                             or (entity_type = 'party' and entity_id = $3))))
      order by coalesce(uploaded_on, generated_on) desc nulls last, id desc`,
    [filter.id ?? null, filter.projectId ?? null, filter.partyId ?? null]
  )
  return rows.map(r => ({
    id: r.id as string,
    entityType: r.entity_type as string,
    entityId: r.entity_id as string,
    projectId: str(r.project_id),
    name: r.name as string,
    category: r.category as string,
    version: Number(r.version),
    accessLevel: r.access_level as string,
    sourceType: r.source_type as string,
    previewRoute: str(r.preview_route),
    uploadedBy: str(r.uploaded_by),
    uploadedAt: str(r.uploaded_on),
    generatedAt: str(r.generated_on),
    expiresAt: str(r.expires_on),
    supersedesId: str(r.supersedes_id),
    verified: r.verified as boolean,
    verifiedBy: str(r.verified_by),
    verifiedAt: str(r.verified_on)
  }))
}

/** `partyId` (S12a, client portal): only client messages of that party's projects. */
export async function listMessages(db: Queryable, filter: { id?: string; projectId?: string; partyId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select id, entity_type, entity_id, project_id, channel, sender_id, body, mentions, delivery_status, delivery_channel, attachment_name, read_by, sent_at
       from messages where ($1::text is null or id = $1) and ($2::text is null or project_id = $2)
        and ($3::text is null or project_id in (select id from projects where party_id = $3)) and ($3::text is null or channel = 'client-message')
      order by sent_at, id`,
    [filter.id ?? null, filter.projectId ?? null, filter.partyId ?? null]
  )
  return rows.map(r => ({
    id: r.id as string,
    entityType: r.entity_type as string,
    entityId: r.entity_id as string,
    projectId: str(r.project_id),
    channel: r.channel as string,
    senderId: r.sender_id as string,
    body: r.body as string,
    mentions: r.mentions as string[],
    sentAt: iso(r.sent_at)!,
    deliveryStatus: r.delivery_status as string,
    deliveryChannel: str(r.delivery_channel),
    attachmentName: str(r.attachment_name),
    readBy: r.read_by as string[]
  }))
}

/** Shared checks: entity type/id and an optional project that must exist. */
async function target(tx: Queryable, input: Record<string, unknown>, problems: FieldErrors) {
  if (typeof input.entityType !== 'string' || !ENTITY_TYPES.includes(input.entityType)) problems.entityType = ['Jenis entitas tidak dikenal.']
  if (typeof input.entityId !== 'string' || !input.entityId.trim() || input.entityId.length > 50) problems.entityId = ['Entitas wajib diisi.']
  let projectId: string | null = null
  if (input.projectId !== undefined && input.projectId !== null && input.projectId !== '') {
    if (typeof input.projectId !== 'string' || !ID_PATTERN.test(input.projectId) || !(await exists(tx, 'select 1 from projects where id = $1', [input.projectId])))
      problems.projectId = ['Project tidak ditemukan.']
    else projectId = input.projectId
  }
  return projectId
}

const text = (v: unknown, field: string, label: string, problems: FieldErrors, max: number) => {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) { problems[field] = [`${label} wajib diisi.`]; return '' }
  if (s.length > max) { problems[field] = [`${label} maksimal ${max} karakter.`]; return '' }
  return s
}

export async function createDocument(tx: Queryable, actor: Actor, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const projectId = await target(tx, input, problems)
  const name = text(input.name, 'name', 'Nama dokumen', problems, 200)
  const category = text(input.category, 'category', 'Kategori', problems, 100)
  if (typeof input.accessLevel !== 'string' || !ACCESS.includes(input.accessLevel)) problems.accessLevel = ['Akses harus internal, client, atau supplier.']
  let expires: string | null = null
  if (input.expiresOn !== undefined && input.expiresOn !== null && input.expiresOn !== '') {
    if (typeof input.expiresOn !== 'string' || !isIsoDate(input.expiresOn)) problems.expiresOn = ['Tanggal kedaluwarsa harus format YYYY-MM-DD.']
    else expires = input.expiresOn
  }
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'DOC-')
  await tx.query(
    `insert into documents (id, entity_type, entity_id, project_id, name, category, access_level, source_type, uploaded_by, uploaded_on, expires_on)
     values ($1, $2, $3, $4, $5, $6, $7, 'uploaded', $8, $9, $10)`,
    [id, input.entityType, (input.entityId as string).trim(), projectId, name, category, input.accessLevel, actor.userId, businessDateOf(new Date()), expires]
  )
  await recordAudit(tx, { action: 'document.created', actorUserId: actor.userId, entityType: 'document', entityId: id, requestId,
    after: { entityType: input.entityType, entityId: input.entityId, projectId, name, category, accessLevel: input.accessLevel } })
  return { id }
}

export async function sendMessage(tx: Queryable, actor: Actor, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const projectId = await target(tx, input, problems)
  if (typeof input.channel !== 'string' || !CHANNELS.includes(input.channel)) problems.channel = ['Kanal pesan tidak dikenal.']
  const body = text(input.body, 'body', 'Isi pesan', problems, 4000)
  let mentions: string[] = []
  if (input.mentions !== undefined && input.mentions !== null) {
    const list = input.mentions
    if (!Array.isArray(list) || list.length > 20 || !list.every(x => typeof x === 'string' && ID_PATTERN.test(x))) problems.mentions = ['Daftar mention tidak valid.']
    else {
      const unique = [...new Set(list as string[])]
      const found = unique.length ? await tx.query<{ id: string }>("select id from users where id = any($1::text[]) and role not in ('client', 'vendor')", [unique]) : []
      if (found.length !== unique.length) problems.mentions = ['User yang di-mention tidak ditemukan (hanya user internal).']
      else mentions = unique
    }
  }
  const internal = input.channel === 'internal-note'
  let deliveryChannel: string | null = internal ? null : 'email'
  if (!internal && input.deliveryChannel !== undefined && input.deliveryChannel !== null) {
    if (typeof input.deliveryChannel !== 'string' || !DELIVERY.includes(input.deliveryChannel)) problems.deliveryChannel = ['Kanal kirim harus email atau whatsapp.']
    else deliveryChannel = input.deliveryChannel
  }
  const attachment = typeof input.attachmentName === 'string' && input.attachmentName.trim() ? input.attachmentName.trim().slice(0, 200) : null
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'MSG-')
  await tx.query(
    `insert into messages (id, entity_type, entity_id, project_id, channel, sender_id, body, mentions, delivery_status, delivery_channel, attachment_name, read_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8::text::jsonb, $9, $10, $11, $12::text::jsonb)`,
    [id, input.entityType, (input.entityId as string).trim(), projectId, input.channel, actor.userId, body, JSON.stringify(mentions),
      internal ? 'sent' : 'delivered', deliveryChannel, attachment, JSON.stringify([actor.userId])]
  )
  // A message that leaves the company (client / supplier) is part of the project's history.
  if (projectId && !internal) {
    // S12b-1: a client writes in its own portal — the line names it as the sender, not as the recipient.
    const fromClient = actor.role === 'client'
    await recordProjectActivity(tx, { projectId, actorUserId: actor.userId, sourceAction: 'message.sent', sourceEntityId: id,
      message: fromClient
        ? `Pesan ${id} dari client dikirim oleh ${await actorName(tx, actor.userId)}.`
        : `Pesan ${id} ke ${input.channel === 'client-message' ? 'client' : 'supplier'} dikirim oleh ${await actorName(tx, actor.userId)} (${deliveryChannel}).` })
  }
  // S9b: each mentioned user gets a notification (never the sender).
  const sender = await actorName(tx, actor.userId)
  for (const userId of mentions) {
    await notify(tx, { userId, actorUserId: actor.userId, type: 'mention', title: `Anda disebut oleh ${sender} (${id})`, body, entityType: input.entityType as string, entityId: (input.entityId as string).trim() })
  }
  await recordAudit(tx, { action: 'message.sent', actorUserId: actor.userId, entityType: 'message', entityId: id, requestId,
    after: { entityType: input.entityType, entityId: input.entityId, projectId, channel: input.channel, mentions } })
  return { id }
}
