import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { PG_BIGINT_MAX } from '../../shared/money'
import { actorName, decidePendingChange, insertChangeEntry, recordProjectActivity } from './activities'

/**
 * Change requests (S8), internal flow: submitted → under-review → approved / rejected → implemented. Each request
 * opens a pending change entry (`CHG-`) in the project's activity log in the same transaction; deciding the request
 * decides that entry. The client portal's own steps (availability, costing, client approval) stay local (ADR-006).
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const SOURCES = ['client', 'internal', 'supplier']
const CATEGORIES = ['traveler', 'itinerary', 'service', 'vendor', 'budget', 'other']
const ENTITY_TYPES = ['flight', 'hotel', 'transport', 'mice', 'itinerary', 'order', 'project']
const MINOR = /^(0|[1-9][0-9]{0,18})$/
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : str(v))

export async function listChangeRequests(db: Queryable, filter: { id?: string; projectId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select * from change_requests where ($1::text is null or id = $1) and ($2::text is null or project_id = $2) order by created_at desc, id desc`,
    [filter.id ?? null, filter.projectId ?? null]
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
    activityId: str(r.activity_id)
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
  const category = input.category === undefined ? 'other' : input.category
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
    `insert into change_requests (id, project_id, source, requested_by, affected_entities, before_summary, after_summary, operational_impact,
                                  commercial_impact_minor, financial_impact_note, timeline_impact_note, activity_id, changed_by_api_at)
     values ($1, $2, $3, $4, $5::text::jsonb, $6, $7, $8, $9, $10, $11, $12, now())`,
    [id, projectId, input.source, actor.userId, JSON.stringify(affected), before, after, operational, commercial, financialNote, timelineNote, activityId]
  )
  await recordAudit(tx, { action: 'change_request.created', actorUserId: actor.userId, entityType: 'change_request', entityId: id, requestId,
    after: { projectId, source: input.source, before, after, commercialImpactMinor: commercial } })
  return { id }
}

async function lockRequest(tx: Queryable, id: string) {
  const [row] = await tx.query<{ project_id: string; status: string; activity_id: string | null }>(
    'select project_id, status, activity_id from change_requests where id = $1 for update', [id])
  if (!row) throw errors.notFound('Change request')
  return row
}

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
  if (cr.status !== 'submitted' && cr.status !== 'under-review') throw rule('Change request ini sudah diputuskan.')
  await tx.query(
    `update change_requests set status = $2, decided_by = $3, decided_at = now(), rejection_reason = $4, changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, decision, actor.userId, decision === 'rejected' ? reason.slice(0, 1000) : null])
  await decidePendingChange(tx, actor.userId, cr.activity_id, decision)
  await logStep(tx, actor, cr.project_id, id, decision === 'approved' ? 'disetujui' : `ditolak (${reason})`, `change_request.${decision}`)
  await recordAudit(tx, { action: `change_request.${decision}`, actorUserId: actor.userId, entityType: 'change_request', entityId: id, requestId, reason: reason || null })
}

export async function implementChangeRequest(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const cr = await lockRequest(tx, id)
  if (cr.status !== 'approved') throw rule('Hanya change request yang sudah disetujui yang bisa ditandai diimplementasikan.')
  await tx.query("update change_requests set status = 'implemented', implemented_at = now(), changed_by_api_at = now(), updated_at = now() where id = $1", [id])
  await logStep(tx, actor, cr.project_id, id, 'diimplementasikan', 'change_request.implemented')
  await recordAudit(tx, { action: 'change_request.implemented', actorUserId: actor.userId, entityType: 'change_request', entityId: id, requestId })
}
