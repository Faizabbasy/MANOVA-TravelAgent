import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { PG_BIGINT_MAX } from '../../shared/money'
import { actorName, decidePendingChange, insertChangeEntry, recordProjectActivity } from './activities'
import { notify } from './notifications'
import { notifyInternal } from './client-writes'

/**
 * Change requests (S8; S12b-2 client steps): submitted → under-review → (a client request that costs something)
 * waiting-client-approval → approved / rejected → implemented; the client may cancel until it is decided. Each request
 * opens a pending change entry (`CHG-`) in the project's activity log in the same transaction; deciding the request
 * decides that entry.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const SOURCES = ['client', 'internal', 'supplier']
const CATEGORIES = ['traveler', 'itinerary', 'service', 'vendor', 'budget', 'other']
export const CHANGE_TYPES = ['add-participant', 'remove-participant', 'replace-participant', 'change-date', 'change-flight', 'change-hotel',
  'add-transportation', 'add-activity', 'upgrade-service', 'remove-service', 'change-itinerary', 'cancel-service', 'cancel-project']
/** The change entry's category for a portal change type. */
export const CHANGE_TYPE_CATEGORY: Record<string, string> = {
  'add-participant': 'traveler', 'remove-participant': 'traveler', 'replace-participant': 'traveler', 'change-date': 'itinerary',
  'change-flight': 'service', 'change-hotel': 'service', 'add-transportation': 'service', 'add-activity': 'itinerary', 'upgrade-service': 'service',
  'remove-service': 'service', 'change-itinerary': 'itinerary', 'cancel-service': 'service', 'cancel-project': 'other'
}
/** Undecided requests: they block project completion. */
export const PENDING_CHANGE_STATUSES = ['submitted', 'under-review', 'waiting-client-approval']
const ENTITY_TYPES = ['flight', 'hotel', 'transport', 'mice', 'itinerary', 'order', 'project']
const MINOR = /^(0|[1-9][0-9]{0,18})$/
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : str(v))

export async function listChangeRequests(db: Queryable, filter: { id?: string; projectId?: string; partyId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select * from change_requests where ($1::text is null or id = $1) and ($2::text is null or project_id = $2) and ($3::text is null or project_id in (select id from projects where party_id = $3))
      order by created_at desc, id desc`,
    [filter.id ?? null, filter.projectId ?? null, filter.partyId ?? null]
  )
  return rows.map(r => ({
    id: r.id as string,
    projectId: r.project_id as string,
    source: r.source as string,
    requestedBy: r.requested_by as string,
    submittedAt: iso(r.created_at)!,
    affectedEntities: r.affected_entities as { entityType: string; entityId: string }[],
    beforeSummary: r.before_summary as string,
    afterSummary: r.after_summary as string,
    operationalImpact: str(r.operational_impact),
    commercialImpactMinor: str(r.commercial_impact_minor),
    financialImpactNote: str(r.financial_impact_note),
    timelineImpactNote: str(r.timeline_impact_note),
    status: r.status as string,
    decidedBy: str(r.decided_by),
    decidedAt: iso(r.decided_at),
    rejectionReason: str(r.rejection_reason),
    implementedAt: iso(r.implemented_at),
    activityId: str(r.activity_id),
    changeType: str(r.change_type),
    cancellationFeeMinor: str(r.cancellation_fee_minor),
    clientDecidedBy: str(r.client_decided_by),
    clientDecidedAt: iso(r.client_decided_at),
    cancelReason: str(r.cancel_reason),
    cancelledAt: iso(r.cancelled_at)
  }))
}

export type ChangeRequestView = Awaited<ReturnType<typeof listChangeRequests>>[number]

const text = (v: unknown, field: string, problems: FieldErrors, required: boolean, label: string, max = 2000): string | null => {
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
    if (required) problems[field] = [`${label} wajib diisi.`]
    return null
  }
  if (typeof v !== 'string' || v.trim().length > max) { problems[field] = [`${label} harus teks, maksimal ${max} karakter.`]; return null }
  return v.trim()
}

export async function createChangeRequest(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (typeof input.source !== 'string' || !SOURCES.includes(input.source)) problems.source = ['Sumber perubahan harus client, internal, atau supplier.']
  let changeType: string | null = null
  if (input.changeType !== undefined && input.changeType !== null && input.changeType !== '') {
    if (typeof input.changeType !== 'string' || !CHANGE_TYPES.includes(input.changeType)) problems.changeType = ['Jenis perubahan tidak dikenal.']
    else changeType = input.changeType
  }
  const category = input.category === undefined ? (changeType ? CHANGE_TYPE_CATEGORY[changeType] : 'other') : input.category
  if (typeof category !== 'string' || !CATEGORIES.includes(category)) problems.category = ['Kategori perubahan tidak dikenal.']
  const before = text(input.beforeSummary, 'beforeSummary', problems, true, 'Kondisi sebelum')
  const after = text(input.afterSummary, 'afterSummary', problems, true, 'Kondisi sesudah')
  const operational = text(input.operationalImpact, 'operationalImpact', problems, false, 'Dampak operasional')
  const financialNote = text(input.financialImpactNote, 'financialImpactNote', problems, false, 'Catatan dampak finansial')
  const timelineNote = text(input.timelineImpactNote, 'timelineImpactNote', problems, false, 'Catatan dampak waktu')
  let commercial: string | null = null
  if (input.commercialImpactMinor !== undefined && input.commercialImpactMinor !== null && input.commercialImpactMinor !== '') {
    if (typeof input.commercialImpactMinor !== 'string' || !MINOR.test(input.commercialImpactMinor) || BigInt(input.commercialImpactMinor) > PG_BIGINT_MAX)
      problems.commercialImpactMinor = ['Dampak komersial harus angka bulat ≥ 0, dikirim sebagai teks.']
    else commercial = input.commercialImpactMinor
  }
  let affected: { entityType: string; entityId: string }[] = [{ entityType: 'project', entityId: projectId }]
  if (input.affectedEntities !== undefined) {
    const list = input.affectedEntities
    if (!Array.isArray(list) || list.length > 50 || !list.every(x => x && typeof x === 'object' && ENTITY_TYPES.includes((x as Record<string, unknown>).entityType as string) && typeof (x as Record<string, unknown>).entityId === 'string'))
      problems.affectedEntities = ['Entitas terdampak tidak valid.']
    else if (list.length) affected = list.map(x => ({ entityType: (x as Record<string, string>).entityType!, entityId: (x as Record<string, string>).entityId!.slice(0, 50) }))
  }
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'CR-')
  const activityId = await insertChangeEntry(tx, {
    projectId, category: category as string, reason: `${id}: ${before} → ${after}`, requestedBy: actor.userId, before, after,
    impact: operational, sourceAction: 'change_request.created', sourceEntityId: id
  })
  await tx.query(
    `insert into change_requests (id, project_id, source, requested_by, affected_entities, before_summary, after_summary, operational_impact, change_type,
                                  commercial_impact_minor, financial_impact_note, timeline_impact_note, activity_id, changed_by_api_at)
     values ($1, $2, $3, $4, $5::text::jsonb, $6, $7, $8, $13, $9, $10, $11, $12, now())`,
    [id, projectId, input.source, actor.userId, JSON.stringify(affected), before, after, operational, commercial, financialNote, timelineNote, activityId, changeType]
  )
  await recordAudit(tx, { action: 'change_request.created', actorUserId: actor.userId, entityType: 'change_request', entityId: id, requestId,
    after: { projectId, source: input.source, before, after, commercialImpactMinor: commercial } })
  return { id }
}

type LockedRequest = {
  project_id: string; status: string; activity_id: string | null; source: string; requested_by: string
  commercial_impact_minor: string | null; cancellation_fee_minor: string | null
}

async function lockRequest(tx: Queryable, id: string) {
  const [row] = await tx.query<LockedRequest>(
    `select project_id, status, activity_id, source, requested_by, commercial_impact_minor::text, cancellation_fee_minor::text
       from change_requests where id = $1 for update`, [id])
  if (!row) throw errors.notFound('Change request')
  return row
}

/** A client request with a commercial impact or a cancellation fee needs the client's approval (S12b-2). */
const hasCost = (cr: LockedRequest) => BigInt(cr.commercial_impact_minor ?? 0) > 0n || BigInt(cr.cancellation_fee_minor ?? 0) > 0n

async function logStep(tx: Queryable, actor: Actor, projectId: string, id: string, what: string, action: string) {
  await recordProjectActivity(tx, { projectId, actorUserId: actor.userId, sourceAction: action, sourceEntityId: id,
    message: `Change Request ${id} ${what} oleh ${await actorName(tx, actor.userId)}.` })
}

export async function reviewChangeRequest(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const cr = await lockRequest(tx, id)
  if (cr.status !== 'submitted') throw rule('Hanya change request berstatus submitted yang bisa mulai direview.')
  await tx.query("update change_requests set status = 'under-review', changed_by_api_at = now(), updated_at = now() where id = $1", [id])
  await logStep(tx, actor, cr.project_id, id, 'mulai direview', 'change_request.under_review')
  await recordAudit(tx, { action: 'change_request.under_review', actorUserId: actor.userId, entityType: 'change_request', entityId: id, requestId })
}

export async function decideChangeRequest(tx: Queryable, actor: Actor, id: string, decision: 'approved' | 'rejected', reasonInput: unknown, requestId: string) {
  const reason = typeof reasonInput === 'string' ? reasonInput.trim() : ''
  if (decision === 'rejected' && !reason) throw errors.validation({ reason: ['Alasan penolakan wajib diisi.'] })
  const cr = await lockRequest(tx, id)
  const waiting = cr.status === 'waiting-client-approval'
  if (cr.status !== 'submitted' && cr.status !== 'under-review' && !waiting) throw rule('Change request ini sudah diputuskan.')
  if (decision === 'approved' && !waiting && cr.source === 'client' && hasCost(cr)) throw rule('Change request ini punya biaya — kirim dampaknya ke client untuk disetujui.')
  // Staff close a request the client has not answered: reject it, or record the client's approval given outside the
  // portal (phone, e-mail — the portal is off in production) with a note saying how.
  if (decision === 'approved' && waiting && !reason) throw errors.validation({ reason: ['Catat bagaimana client menyetujui (mis. lewat telepon/email).'] })
  await tx.query(
    `update change_requests set status = $2, decided_by = $3, decided_at = now(), rejection_reason = $4, changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, decision, actor.userId, decision === 'rejected' ? reason.slice(0, 1000) : null])
  await decidePendingChange(tx, actor.userId, cr.activity_id, decision)
  const what = decision === 'rejected' ? `ditolak (${reason})` : waiting ? `disetujui atas nama client (${reason})` : 'disetujui'
  await logStep(tx, actor, cr.project_id, id, what, `change_request.${decision}`)
  if (cr.source === 'client') {
    await notifyProjectClients(tx, actor, cr.project_id, { title: `Change Request ${id} ${decision === 'approved' ? 'disetujui' : 'ditolak'}`,
      body: decision === 'rejected' ? reason : 'Perubahan akan kami laksanakan.' })
  }
  await recordAudit(tx, { action: `change_request.${decision}`, actorUserId: actor.userId, entityType: 'change_request', entityId: id, requestId, reason: reason || null })
}

/** The client users of the project's party (the people who answer in the portal); never the actor. */
async function notifyProjectClients(tx: Queryable, actor: Actor, projectId: string, n: { title: string; body: string }) {
  const clients = await tx.query<{ id: string }>(
    "select u.id from users u join projects p on p.party_id = u.party_id where p.id = $1 and u.role = 'client' and u.status = 'active' order by u.id", [projectId])
  for (const c of clients) await notify(tx, { userId: c.id, actorUserId: actor.userId, type: 'change', title: n.title, body: n.body, entityType: 'project', entityId: projectId })
}

const minor = (v: unknown, field: string, label: string, problems: FieldErrors): string | null => {
  if (v === undefined || v === null || v === '') return null
  if (typeof v !== 'string' || !MINOR.test(v) || BigInt(v) > PG_BIGINT_MAX) { problems[field] = [`${label} harus angka bulat ≥ 0, dikirim sebagai teks.`]; return null }
  return v
}

/** Staff fill in the impact of a client's request and ask the client to approve it (only when it costs something). */
export async function sendChangeRequestToClient(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string) {
  const problems: FieldErrors = {}
  const commercial = minor(input.commercialImpactMinor, 'commercialImpactMinor', 'Dampak komersial', problems)
  const fee = minor(input.cancellationFeeMinor, 'cancellationFeeMinor', 'Biaya pembatalan', problems)
  const timeline = text(input.timelineImpactNote, 'timelineImpactNote', problems, false, 'Catatan dampak waktu')
  const operational = text(input.operationalImpact, 'operationalImpact', problems, false, 'Dampak operasional')
  const financial = text(input.financialImpactNote, 'financialImpactNote', problems, false, 'Catatan dampak finansial')
  if (!Object.keys(problems).length && BigInt(commercial ?? 0) === 0n && BigInt(fee ?? 0) === 0n)
    problems.commercialImpactMinor = ['Isi dampak komersial atau biaya pembatalan. Tanpa biaya, setujui langsung.']
  if (Object.keys(problems).length) throw errors.validation(problems)
  const cr = await lockRequest(tx, id)
  if (cr.source !== 'client') throw rule('Hanya change request dari client yang dikirim ke client untuk disetujui.')
  if (cr.status !== 'submitted' && cr.status !== 'under-review') throw rule('Change request ini sudah diputuskan atau sedang menunggu client.')
  await tx.query(
    `update change_requests set status = 'waiting-client-approval', commercial_impact_minor = $2, cancellation_fee_minor = $3,
            timeline_impact_note = coalesce($4, timeline_impact_note), operational_impact = coalesce($5, operational_impact),
            financial_impact_note = coalesce($6, financial_impact_note), changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, commercial, fee, timeline, operational, financial])
  await logStep(tx, actor, cr.project_id, id, 'dikirim ke client untuk disetujui', 'change_request.sent_to_client')
  await notifyProjectClients(tx, actor, cr.project_id, { title: `Change Request ${id} menunggu persetujuan Anda`,
    body: `Dampak biaya telah dihitung${timeline ? ` — ${timeline}` : ''}. Mohon setujui atau tolak.` })
  await recordAudit(tx, { action: 'change_request.sent_to_client', actorUserId: actor.userId, entityType: 'change_request', entityId: id, requestId,
    after: { commercialImpactMinor: commercial, cancellationFeeMinor: fee } })
}

export async function implementChangeRequest(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const cr = await lockRequest(tx, id)
  if (cr.status !== 'approved') throw rule('Hanya change request yang sudah disetujui yang bisa ditandai diimplementasikan.')
  await tx.query("update change_requests set status = 'implemented', implemented_at = now(), changed_by_api_at = now(), updated_at = now() where id = $1", [id])
  await logStep(tx, actor, cr.project_id, id, 'diimplementasikan', 'change_request.implemented')
  await recordAudit(tx, { action: 'change_request.implemented', actorUserId: actor.userId, entityType: 'change_request', entityId: id, requestId })
}

/* ---------- client portal (S12b-2) ---------- */

async function clientRequest(tx: Queryable, partyId: string, id: string) {
  const [row] = await tx.query<{ project_id: string; status: string; activity_id: string | null; owner_user_id: string | null }>(
    `select cr.project_id, cr.status, cr.activity_id, p.owner_user_id from change_requests cr join projects p on p.id = cr.project_id
      where cr.id = $1 and p.party_id = $2 for update of cr`, [id, partyId])
  if (!row) throw errors.notFound('Change request')
  return row
}

export async function clientCreateChangeRequest(tx: Queryable, actor: Actor, partyId: string, projectId: string, input: Record<string, unknown>, requestId: string) {
  const [p] = await tx.query<{ status: string; owner_user_id: string | null; name: string }>('select status, owner_user_id, name from projects where id = $1 and party_id = $2', [projectId, partyId])
  if (!p) throw errors.notFound('Project')
  if (p.status === 'completed' || p.status === 'cancelled') throw rule('Project sudah selesai atau dibatalkan — tidak bisa mengajukan perubahan.')
  const { id } = await createChangeRequest(tx, actor, projectId, {
    source: 'client', changeType: input.changeType, category: input.category, beforeSummary: input.beforeSummary, afterSummary: input.afterSummary
  }, requestId)
  await notifyInternal(tx, actor, p.owner_user_id, { type: 'change', title: `Change Request baru dari client (${p.name})`, body: `${id}: ${String(input.afterSummary).trim()}`, entityType: 'project', entityId: projectId })
  return { id }
}

export async function clientDecideChangeRequest(tx: Queryable, actor: Actor, partyId: string, id: string, decision: 'approved' | 'rejected', reasonInput: unknown, requestId: string) {
  const reason = typeof reasonInput === 'string' ? reasonInput.trim() : ''
  if (decision === 'rejected' && !reason) throw errors.validation({ reason: ['Alasan penolakan wajib diisi.'] })
  const cr = await clientRequest(tx, partyId, id)
  if (cr.status !== 'waiting-client-approval') throw rule('Change request ini tidak sedang menunggu persetujuan Anda.')
  await tx.query(
    `update change_requests set status = $2, client_decided_by = $3, client_decided_at = now(), rejection_reason = $4, changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, decision, actor.userId, decision === 'rejected' ? reason.slice(0, 1000) : null])
  await decidePendingChange(tx, actor.userId, cr.activity_id, decision)
  await logStep(tx, actor, cr.project_id, id, decision === 'approved' ? 'disetujui client' : `ditolak client (${reason})`, `change_request.client_${decision}`)
  await notifyInternal(tx, actor, cr.owner_user_id, { type: 'change', title: `Change Request ${id} ${decision === 'approved' ? 'disetujui' : 'ditolak'} client`, body: reason || 'Client menyetujui dampak perubahan.', entityType: 'project', entityId: cr.project_id })
  await recordAudit(tx, { action: `change_request.client_${decision}`, actorUserId: actor.userId, entityType: 'change_request', entityId: id, requestId, reason: reason || null })
}

const CLIENT_CANCELLABLE = ['submitted', 'under-review', 'waiting-client-approval']

export async function clientCancelChangeRequest(tx: Queryable, actor: Actor, partyId: string, id: string, reasonInput: unknown, requestId: string) {
  const reason = typeof reasonInput === 'string' ? reasonInput.trim() : ''
  if (!reason) throw errors.validation({ reason: ['Alasan pembatalan wajib diisi.'] })
  const cr = await clientRequest(tx, partyId, id)
  if (!CLIENT_CANCELLABLE.includes(cr.status)) throw rule('Change request ini sudah diputuskan — tidak bisa dibatalkan.')
  await tx.query(
    `update change_requests set status = 'cancelled', cancel_reason = $2, cancelled_by = $3, cancelled_at = now(), changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, reason.slice(0, 1000), actor.userId])
  await decidePendingChange(tx, actor.userId, cr.activity_id, 'rejected')
  await logStep(tx, actor, cr.project_id, id, `dibatalkan client (${reason})`, 'change_request.cancelled')
  await notifyInternal(tx, actor, cr.owner_user_id, { type: 'change', title: `Change Request ${id} dibatalkan client`, body: reason, entityType: 'project', entityId: cr.project_id })
  await recordAudit(tx, { action: 'change_request.cancelled', actorUserId: actor.userId, entityType: 'change_request', entityId: id, requestId, reason })
}
