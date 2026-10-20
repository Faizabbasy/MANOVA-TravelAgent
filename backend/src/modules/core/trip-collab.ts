import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { notifyInternal, ownProject } from './client-writes'
import { notify } from './notifications'

/**
 * S12c-4: itinerary versions and trip announcements. Staff publish a version = a frozen snapshot of the project's
 * client-visible itinerary items (no vendor data); the newest version supersedes the older ones; the client approves
 * it or asks for a revision. Announcements are one-way per project; the client confirms those that ask for it.
 */
const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const iso = (v: unknown) => (v ? (v as Date).toISOString() : null)
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))

async function staffProject(tx: Queryable, projectId: string) {
  const [p] = await tx.query<{ id: string; name: string; party_id: string | null }>('select id, name, party_id from projects where id = $1', [projectId])
  if (!p) throw errors.notFound('Project')
  return p
}

async function tellClients(tx: Queryable, actor: Actor, partyId: string | null, n: { title: string; body: string; entityType: string; entityId: string }) {
  if (!partyId) return
  const clients = await tx.query<{ id: string }>("select id from users where party_id = $1 and role = 'client' and status = 'active' order by id", [partyId])
  for (const c of clients) await notify(tx, { userId: c.id, actorUserId: actor.userId, type: 'reminder', ...n })
}

/* ---------- itinerary versions ---------- */

export async function listItineraryVersions(db: Queryable, filter: { id?: string; projectId?: string; partyId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select v.*, p.name as project_name, cu.name as created_by_name, du.name as decided_by_name
       from itinerary_versions v join projects p on p.id = v.project_id
       join users cu on cu.id = v.created_by left join users du on du.id = v.decided_by
      where ($1::text is null or v.id = $1) and ($2::text is null or v.project_id = $2) and ($3::text is null or p.party_id = $3)
      order by v.project_id, v.version_number desc`, [filter.id ?? null, filter.projectId ?? null, filter.partyId ?? null])
  return rows.map(r => ({
    id: r.id as string,
    projectId: r.project_id as string,
    projectName: r.project_name as string,
    versionNumber: Number(r.version_number),
    status: r.status as string,
    items: r.items as Record<string, unknown>[],
    note: str(r.note),
    revisionComment: str(r.revision_comment),
    createdBy: r.created_by as string | null,
    createdByName: r.created_by_name as string,
    createdAt: iso(r.created_at)!,
    decidedBy: str(r.decided_by),
    decidedByName: str(r.decided_by_name),
    decidedAt: iso(r.decided_at)
  }))
}
type VersionView = Awaited<ReturnType<typeof listItineraryVersions>>[number]
export const clientItineraryVersion = (v: VersionView) => ({ ...v, createdBy: null })

/** Only what the client may see of each item — vendor and cost stay internal. */
const SNAPSHOT_SQL = `select coalesce(jsonb_agg(jsonb_build_object('id', id, 'date', date::text, 'time', time, 'title', title, 'description', description,
                        'serviceType', service_type, 'timezone', timezone, 'location', location) order by date, time nulls first, id), '[]'::jsonb) as items
                      from itinerary_items where project_id = $1 and visible_to_client`

export async function publishItineraryVersion(tx: Queryable, actor: Actor, projectId: string, noteInput: unknown, requestId: string) {
  const p = await staffProject(tx, projectId)
  await tx.query('select id from projects where id = $1 for update', [projectId])
  const [{ items }] = await tx.query<{ items: unknown[] }>(SNAPSHOT_SQL, [projectId]) as [{ items: unknown[] }]
  if (!items.length) throw rule('Belum ada item itinerary yang terlihat oleh client.')
  const note = typeof noteInput === 'string' ? noteInput.trim().slice(0, 2000) || null : null
  const [{ next }] = await tx.query<{ next: number }>('select coalesce(max(version_number), 0) + 1 as next from itinerary_versions where project_id = $1', [projectId]) as [{ next: number }]
  await tx.query("update itinerary_versions set status = 'superseded' where project_id = $1 and status <> 'superseded'", [projectId])
  const id = await nextId(tx, 'ITV-')
  await tx.query(`insert into itinerary_versions (id, project_id, version_number, status, items, note, created_by)
                  values ($1, $2, $3, 'waiting-approval', $4::text::jsonb, $5, $6)`, [id, projectId, Number(next), JSON.stringify(items), note, actor.userId])
  await tellClients(tx, actor, p.party_id, { title: `Itinerary v${next} menunggu persetujuan`, body: note ?? `${p.name} — mohon tinjau itinerary terbaru.`, entityType: 'itinerary', entityId: projectId })
  await recordAudit(tx, { action: 'itinerary_version.published', actorUserId: actor.userId, entityType: 'itinerary_version', entityId: id, requestId, after: { projectId, versionNumber: Number(next) } })
  return { id }
}

export async function clientDecideItineraryVersion(tx: Queryable, actor: Actor, partyId: string, id: string, decision: 'approved' | 'revision-requested', commentInput: unknown, requestId: string) {
  const comment = typeof commentInput === 'string' ? commentInput.trim() : ''
  if (decision === 'revision-requested' && !comment) throw errors.validation({ comment: ['Jelaskan revisi yang Anda butuhkan.'] })
  const [v] = await tx.query<{ status: string; project_id: string; version_number: number; created_by: string }>(
    `select v.status, v.project_id, v.version_number, v.created_by from itinerary_versions v join projects p on p.id = v.project_id
      where v.id = $1 and p.party_id = $2 for update of v`, [id, partyId])
  if (!v) throw errors.notFound('Versi itinerary')
  if (v.status !== 'waiting-approval') throw rule('Versi itinerary ini tidak sedang menunggu persetujuan Anda.')
  await tx.query('update itinerary_versions set status = $2, revision_comment = $3, decided_by = $4, decided_at = now() where id = $1',
    [id, decision, decision === 'revision-requested' ? comment.slice(0, 2000) : null, actor.userId])
  const project = await ownProject(tx, partyId, v.project_id)
  // Review fix: the owner and whoever published the version; if neither is an active staff member, every active admin.
  const candidates = [project.ownerUserId, v.created_by].filter((u): u is string => Boolean(u))
  const active = candidates.length
    ? (await tx.query<{ id: string }>("select id from users where id = any($1::text[]) and status = 'active' and role not in ('client', 'vendor') order by id", [candidates])).map(r => r.id)
    : []
  const targets = active.length ? active : (await tx.query<{ id: string }>("select id from users where role = 'admin' and status = 'active' order by id")).map(r => r.id)
  for (const userId of targets) {
    await notifyInternal(tx, actor, userId, {
      type: 'change',
      title: decision === 'approved' ? `Itinerary v${v.version_number} disetujui client` : `Client minta revisi itinerary v${v.version_number}`,
      body: decision === 'approved' ? project.name : comment,
      entityType: 'project',
      entityId: v.project_id
    })
  }
  await recordAudit(tx, { action: `itinerary_version.${decision}`, actorUserId: actor.userId, entityType: 'itinerary_version', entityId: id, requestId, reason: comment || null })
}

/* ---------- trip announcements ---------- */

export async function listAnnouncements(db: Queryable, filter: { id?: string; projectId?: string; partyId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select a.*, p.name as project_name, u.name as published_by_name
       from trip_announcements a join projects p on p.id = a.project_id join users u on u.id = a.published_by
      where ($1::text is null or a.id = $1) and ($2::text is null or a.project_id = $2) and ($3::text is null or p.party_id = $3)
      order by a.published_at desc, a.id desc`, [filter.id ?? null, filter.projectId ?? null, filter.partyId ?? null])
  const ids = rows.map(r => r.id as string)
  const confirmations = ids.length ? await db.query<{ announcement_id: string; user_id: string; name: string; confirmed_at: Date }>(
    `select c.announcement_id, c.user_id, u.name, c.confirmed_at from trip_announcement_confirmations c join users u on u.id = c.user_id
      where c.announcement_id = any($1::text[]) order by c.confirmed_at, c.user_id`, [ids]) : []
  return rows.map(r => ({
    id: r.id as string,
    projectId: r.project_id as string,
    projectName: r.project_name as string,
    title: r.title as string,
    message: r.message as string,
    requiresConfirmation: r.requires_confirmation as boolean,
    publishedBy: r.published_by as string | null,
    publishedByName: r.published_by_name as string,
    publishedAt: iso(r.published_at)!,
    confirmations: confirmations.filter(c => c.announcement_id === r.id).map(c => ({ userId: c.user_id, name: c.name, confirmedAt: c.confirmed_at.toISOString() }))
  }))
}
type AnnouncementView = Awaited<ReturnType<typeof listAnnouncements>>[number]
/** The client sees who of its own company confirmed, and whether it did itself; staff ids stay internal. */
export const clientAnnouncement = (a: AnnouncementView, userId: string) => ({ ...a, publishedBy: null, confirmedByMe: a.confirmations.some(c => c.userId === userId) })

export async function publishAnnouncement(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, requestId: string) {
  const problems: FieldErrors = {}
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const message = typeof input.message === 'string' ? input.message.trim() : ''
  if (!title || title.length > 200) problems.title = ['Judul wajib diisi (maks. 200 karakter).']
  if (!message || message.length > 4000) problems.message = ['Isi pengumuman wajib diisi (maks. 4000 karakter).']
  if (input.requiresConfirmation !== undefined && typeof input.requiresConfirmation !== 'boolean') problems.requiresConfirmation = ['Harus ya/tidak.']
  if (Object.keys(problems).length) throw errors.validation(problems)
  const p = await staffProject(tx, projectId)
  const id = await nextId(tx, 'ANN-')
  await tx.query('insert into trip_announcements (id, project_id, title, message, requires_confirmation, published_by) values ($1, $2, $3, $4, $5, $6)',
    [id, projectId, title, message, input.requiresConfirmation === true, actor.userId])
  await tellClients(tx, actor, p.party_id, { title: `Pengumuman: ${title}`, body: message, entityType: 'project', entityId: projectId })
  await recordAudit(tx, { action: 'trip_announcement.published', actorUserId: actor.userId, entityType: 'trip_announcement', entityId: id, requestId })
  return { id }
}

/** Idempotent: confirming again keeps the first confirmation. */
export async function confirmAnnouncement(tx: Queryable, actor: Actor, partyId: string, id: string, requestId: string) {
  const [a] = await tx.query<{ requires_confirmation: boolean }>(
    'select a.requires_confirmation from trip_announcements a join projects p on p.id = a.project_id where a.id = $1 and p.party_id = $2', [id, partyId])
  if (!a) throw errors.notFound('Pengumuman')
  if (!a.requires_confirmation) throw rule('Pengumuman ini hanya informasi — tidak perlu dikonfirmasi.')
  const inserted = await tx.query('insert into trip_announcement_confirmations (announcement_id, user_id) values ($1, $2) on conflict do nothing returning user_id', [id, actor.userId])
  if (inserted.length) await recordAudit(tx, { action: 'trip_announcement.confirmed', actorUserId: actor.userId, entityType: 'trip_announcement', entityId: id, requestId })
}
