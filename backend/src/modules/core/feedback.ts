import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { actorName, recordProjectActivity } from './activities'
import { notifyInternal, ownProject } from './client-writes'

/**
 * Trip feedback (S12c-2): one per project, given by the client once the trip has started (ongoing-trip) or ended
 * (completed) — a draft first, then submitted and locked. CRM staff acknowledge it, flag a follow-up (with a note) or
 * close it.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : str(v))
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

/** API field → column, with its allowed range. */
const SCORES: Record<string, { column: string; min: number; max: number }> = {
  overallExperience: { column: 'overall_experience', min: 1, max: 5 },
  recommendationScore: { column: 'recommendation_score', min: 0, max: 10 },
  salesResponsiveness: { column: 'sales_responsiveness', min: 1, max: 5 },
  proposalQuality: { column: 'proposal_quality', min: 1, max: 5 },
  itineraryQuality: { column: 'itinerary_quality', min: 1, max: 5 },
  hotelRating: { column: 'hotel_rating', min: 1, max: 5 },
  transportationRating: { column: 'transportation_rating', min: 1, max: 5 },
  tourLeaderRating: { column: 'tour_leader_rating', min: 1, max: 5 },
  operationSupportRating: { column: 'operation_support_rating', min: 1, max: 5 },
  reservationHandlingRating: { column: 'reservation_handling_rating', min: 1, max: 5 },
  communicationRating: { column: 'communication_rating', min: 1, max: 5 },
  issueResolutionRating: { column: 'issue_resolution_rating', min: 1, max: 5 },
  valueForMoneyRating: { column: 'value_for_money_rating', min: 1, max: 5 }
}
const TEXTS: Record<string, string> = { comment: 'comment', improvementSuggestion: 'improvement_suggestion' }
const DEPARTED = ['ongoing-trip', 'completed']

export async function listFeedback(db: Queryable, filter: { id?: string; projectId?: string; partyId?: string; status?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select f.*, p.name as project_name, pt.name as party_name, sb.name as submitted_by_name
       from project_feedback f join projects p on p.id = f.project_id join parties pt on pt.id = f.party_id
       left join users sb on sb.id = f.submitted_by
      where ($1::text is null or f.id = $1) and ($2::text is null or f.project_id = $2) and ($3::text is null or f.party_id = $3)
        and ($4::text is null or f.status = $4)
      order by coalesce(f.submitted_at, f.created_at) desc, f.id desc`,
    [filter.id ?? null, filter.projectId ?? null, filter.partyId ?? null, filter.status ?? null])
  return rows.map(r => ({
    id: r.id as string,
    projectId: r.project_id as string,
    projectName: r.project_name as string,
    partyId: r.party_id as string,
    partyName: r.party_name as string,
    status: r.status as string,
    ...Object.fromEntries(Object.entries(SCORES).map(([field, spec]) => [field, num(r[spec.column])])) as Record<keyof typeof SCORES, number | null>,
    comment: str(r.comment),
    improvementSuggestion: str(r.improvement_suggestion),
    testimonialConsent: r.testimonial_consent as boolean,
    submittedBy: str(r.submitted_by),
    submittedByName: str(r.submitted_by_name),
    submittedAt: iso(r.submitted_at),
    acknowledgedBy: str(r.acknowledged_by),
    acknowledgedAt: iso(r.acknowledged_at),
    followUpNote: str(r.follow_up_note),
    closedAt: iso(r.closed_at),
    createdAt: iso(r.created_at)!
  }))
}

export type FeedbackView = Awaited<ReturnType<typeof listFeedback>>[number]

/** The client's view: no staff ids or internal follow-up note. */
export const clientFeedback = (f: FeedbackView) => ({ ...f, acknowledgedBy: null, followUpNote: null })

function cleanValues(input: Record<string, unknown>, problems: FieldErrors) {
  const out: Record<string, unknown> = {}
  for (const [field, spec] of Object.entries(SCORES)) {
    const v = input[field]
    if (v === undefined) continue
    if (v === null) { out[spec.column] = null; continue }
    if (typeof v !== 'number' || !Number.isInteger(v) || v < spec.min || v > spec.max) problems[field] = [`Nilai ${spec.min}–${spec.max}.`]
    else out[spec.column] = v
  }
  for (const [field, column] of Object.entries(TEXTS)) {
    const v = input[field]
    if (v === undefined) continue
    if (v !== null && (typeof v !== 'string' || v.length > 4000)) problems[field] = ['Maksimal 4000 karakter.']
    else out[column] = typeof v === 'string' ? v.trim() || null : null
  }
  if (input.testimonialConsent !== undefined) {
    if (typeof input.testimonialConsent !== 'boolean') problems.testimonialConsent = ['Harus ya/tidak.']
    else out.testimonial_consent = input.testimonialConsent
  }
  return out
}

/** Saves (or starts) the client's draft for a departed or finished project of its own. */
export async function saveFeedbackDraft(tx: Queryable, actor: Actor, partyId: string, projectId: string, input: Record<string, unknown>, requestId: string) {
  const problems: FieldErrors = {}
  const values = cleanValues(input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const project = await ownProject(tx, partyId, projectId)
  if (!DEPARTED.includes(project.status)) throw rule('Feedback bisa diisi setelah perjalanan dimulai.')
  const [current] = await tx.query<{ id: string; status: string }>('select id, status from project_feedback where project_id = $1 for update', [project.id])
  if (current && current.status !== 'draft') throw rule('Feedback ini sudah dikirim.')
  let id = current?.id
  if (!id) {
    id = await nextId(tx, 'FBK-')
    await tx.query("insert into project_feedback (id, project_id, party_id, status, created_by) values ($1, $2, $3, 'draft', $4)", [id, project.id, partyId, actor.userId])
  }
  const cols = Object.keys(values)
  if (cols.length) await tx.query(`update project_feedback set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`, [id, ...Object.values(values)])
  await recordAudit(tx, { action: 'feedback.draft_saved', actorUserId: actor.userId, entityType: 'project_feedback', entityId: id, requestId })
  return { id }
}

export async function submitFeedback(tx: Queryable, actor: Actor, partyId: string, projectId: string, requestId: string) {
  const project = await ownProject(tx, partyId, projectId)
  const [current] = await tx.query<{ id: string; status: string; overall_experience: number | null; recommendation_score: number | null }>(
    'select id, status, overall_experience, recommendation_score from project_feedback where project_id = $1 for update', [project.id])
  if (!current) throw errors.validation({ overallExperience: ['Isi feedback dulu.'] })
  if (current.status !== 'draft') throw rule('Feedback ini sudah dikirim.')
  const problems: FieldErrors = {}
  if (current.overall_experience === null) problems.overallExperience = ['Nilai keseluruhan wajib diisi.']
  if (current.recommendation_score === null) problems.recommendationScore = ['Skor rekomendasi wajib diisi.']
  if (Object.keys(problems).length) throw errors.validation(problems)
  await tx.query("update project_feedback set status = 'submitted', submitted_by = $2, submitted_at = now(), updated_at = now() where id = $1", [current.id, actor.userId])
  const message = `Feedback perjalanan ${current.id} dikirim oleh client ${await actorName(tx, actor.userId)} (keseluruhan ${current.overall_experience}/5, rekomendasi ${current.recommendation_score}/10).`
  await recordProjectActivity(tx, { projectId: project.id, actorUserId: actor.userId, sourceAction: 'feedback.submitted', sourceEntityId: current.id, message })
  await notifyInternal(tx, actor, project.ownerUserId, { type: 'reminder', title: `Feedback client untuk ${project.name}`, body: message, entityType: 'project', entityId: project.id })
  await recordAudit(tx, { action: 'feedback.submitted', actorUserId: actor.userId, entityType: 'project_feedback', entityId: current.id, requestId })
}

/* ---------- staff (crm.manage-follow-up) ---------- */

async function lockFeedback(tx: Queryable, id: string) {
  const [row] = await tx.query<{ id: string; status: string }>('select id, status from project_feedback where id = $1 for update', [id])
  if (!row) throw errors.notFound('Feedback')
  return row
}

export async function acknowledgeFeedback(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const f = await lockFeedback(tx, id)
  if (f.status !== 'submitted') throw rule('Hanya feedback yang baru dikirim yang bisa ditandai diterima.')
  await tx.query("update project_feedback set status = 'acknowledged', acknowledged_by = $2, acknowledged_at = now(), updated_at = now() where id = $1", [id, actor.userId])
  await recordAudit(tx, { action: 'feedback.acknowledged', actorUserId: actor.userId, entityType: 'project_feedback', entityId: id, requestId })
}

export async function flagFeedbackFollowUp(tx: Queryable, actor: Actor, id: string, noteInput: unknown, requestId: string) {
  const note = typeof noteInput === 'string' ? noteInput.trim() : ''
  if (!note) throw errors.validation({ note: ['Catatan tindak lanjut wajib diisi.'] })
  const f = await lockFeedback(tx, id)
  if (f.status !== 'submitted' && f.status !== 'acknowledged') throw rule('Feedback ini sudah ditindaklanjuti atau ditutup.')
  await tx.query(`update project_feedback set status = 'follow-up-required', follow_up_note = $2, acknowledged_by = coalesce(acknowledged_by, $3),
                    acknowledged_at = coalesce(acknowledged_at, now()), updated_at = now() where id = $1`, [id, note.slice(0, 2000), actor.userId])
  await recordAudit(tx, { action: 'feedback.follow_up', actorUserId: actor.userId, entityType: 'project_feedback', entityId: id, requestId, reason: note })
}

export async function closeFeedback(tx: Queryable, actor: Actor, id: string, noteInput: unknown, requestId: string) {
  const note = typeof noteInput === 'string' ? noteInput.trim() : ''
  const f = await lockFeedback(tx, id)
  if (f.status === 'draft' || f.status === 'closed') throw rule('Feedback ini belum dikirim atau sudah ditutup.')
  await tx.query(`update project_feedback set status = 'closed', closed_at = now(),
                    follow_up_note = case when $2::text is null then follow_up_note else concat_ws(' — ', follow_up_note, $2::text) end, updated_at = now() where id = $1`,
    [id, note ? note.slice(0, 2000) : null])
  await recordAudit(tx, { action: 'feedback.closed', actorUserId: actor.userId, entityType: 'project_feedback', entityId: id, requestId, reason: note || null })
}
