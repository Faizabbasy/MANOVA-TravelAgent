import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { createLead } from '../sales/lead-writes'
import { SERVICE_TYPES } from './booking-rules'
import { notifyInternal, ownProject } from './client-writes'
import { notify } from './notifications'

/**
 * S12c-3: a client's travel request (draft → submitted → sales review → clarification ⇄ answer → lead) and the
 * approvals staff ask a client for on a project (rooming list, extra charge, completion…). The old portal mock that
 * turned a request into a lead and an approved quotation instantly is gone — sales decides.
 */
const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const DATE = /^\d{4}-\d{2}-\d{2}$/
const EDITABLE = ['draft', 'need-clarification']
const OPEN = ['submitted', 'under-review', 'need-clarification', 'proposal-preparation']
const REQUIREMENTS = { flightRequirement: 'flight_requirement', hotelRequirement: 'hotel_requirement', transportationRequirement: 'transportation_requirement', miceRequirement: 'mice_requirement' } as const
const TEXTS = { requestName: 'request_name', tripType: 'trip_type', purpose: 'purpose', destination: 'destination', currency: 'currency', additionalServicesNote: 'additional_services_note' } as const
const JSON_COLUMNS = new Set(['service_scope', ...Object.values(REQUIREMENTS)])

const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const day = (v: unknown) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10))
const iso = (v: unknown) => (v ? (v as Date).toISOString() : null)

/* ---------- reads ---------- */

export async function listTravelRequests(db: Queryable, filter: { id?: string; partyId?: string; status?: string; staff?: boolean } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select t.*, pa.name as party_name, ru.name as reviewer_name
       from travel_requests t join parties pa on pa.id = t.party_id left join users ru on ru.id = t.reviewer_user_id
      where ($1::text is null or t.id = $1) and ($2::text is null or t.party_id = $2) and ($3::text is null or t.status = $3)
        and (not $4 or t.status <> 'draft')
      order by coalesce(t.submitted_at, t.created_at) desc, t.id desc`,
    [filter.id ?? null, filter.partyId ?? null, filter.status ?? null, filter.staff ?? false])
  const ids = rows.map(r => r.id as string)
  const acts = ids.length ? await db.query<Record<string, unknown>>(
    `select a.id, a.travel_request_id, a.actor_user_id, u.name as actor_name, a.from_client, a.message, a.created_at
       from travel_request_activities a join users u on u.id = a.actor_user_id
      where a.travel_request_id = any($1::text[]) order by a.created_at desc, a.id desc`, [ids]) : []
  return rows.map(r => ({
    id: r.id as string,
    partyId: r.party_id as string,
    partyName: r.party_name as string,
    requestName: r.request_name as string,
    contactPersonId: str(r.contact_person_id),
    tripType: str(r.trip_type),
    purpose: str(r.purpose),
    destination: r.destination as string,
    travelStartDate: day(r.travel_start_date),
    travelEndDate: day(r.travel_end_date),
    dateFlexible: r.date_flexible as boolean,
    estimatedParticipants: r.estimated_participants === null ? null : Number(r.estimated_participants),
    estimatedBudgetIdr: r.estimated_budget_idr === null ? null : Number(r.estimated_budget_idr),
    currency: str(r.currency),
    serviceScope: r.service_scope as string[],
    flightRequirement: (r.flight_requirement ?? null) as Record<string, unknown> | null,
    hotelRequirement: (r.hotel_requirement ?? null) as Record<string, unknown> | null,
    transportationRequirement: (r.transportation_requirement ?? null) as Record<string, unknown> | null,
    miceRequirement: (r.mice_requirement ?? null) as Record<string, unknown> | null,
    additionalServicesNote: str(r.additional_services_note),
    status: r.status as string,
    reviewerUserId: str(r.reviewer_user_id),
    reviewerName: str(r.reviewer_name),
    clarificationNote: str(r.clarification_note),
    leadId: str(r.lead_id),
    cancelReason: str(r.cancel_reason),
    closeReason: str(r.close_reason),
    createdBy: r.created_by as string,
    submittedAt: iso(r.submitted_at),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
    activities: acts.filter(a => a.travel_request_id === r.id).map(a => ({
      id: a.id as string,
      actorId: a.actor_user_id as string,
      actorName: a.actor_name as string,
      fromClient: a.from_client as boolean,
      message: a.message as string,
      createdAt: iso(a.created_at)!
    }))
  }))
}
export type TravelRequestView = Awaited<ReturnType<typeof listTravelRequests>>[number]

/** The client sees MANOVA's people by name only; the lead id stays internal. */
export const clientTravelRequest = (t: TravelRequestView) => ({
  ...t, reviewerUserId: null, leadId: null, activities: t.activities.map(a => ({ ...a, actorId: a.fromClient ? a.actorId : null }))
})

/* ---------- client ---------- */

function values(input: Record<string, unknown>, problems: FieldErrors) {
  const out: Record<string, unknown> = {}
  for (const [field, column] of Object.entries(TEXTS)) {
    const v = input[field]
    if (v === undefined) continue
    if (v !== null && (typeof v !== 'string' || v.length > (field === 'additionalServicesNote' || field === 'purpose' ? 4000 : 200))) { problems[field] = ['Teks terlalu panjang.']; continue }
    const s = typeof v === 'string' ? v.trim() : ''
    if (field === 'requestName' && !s) { problems[field] = ['Nama permintaan wajib diisi.']; continue }
    out[column] = field === 'destination' ? s : (s || null)
  }
  for (const [field, column] of [['travelStartDate', 'travel_start_date'], ['travelEndDate', 'travel_end_date']] as const) {
    const v = input[field]
    if (v === undefined) continue
    if (v !== null && v !== '' && (typeof v !== 'string' || !DATE.test(v))) problems[field] = ['Tanggal harus YYYY-MM-DD.']
    else out[column] = v || null
  }
  if (input.dateFlexible !== undefined) {
    if (typeof input.dateFlexible !== 'boolean') problems.dateFlexible = ['Harus ya/tidak.']
    else out.date_flexible = input.dateFlexible
  }
  for (const [field, column] of [['estimatedParticipants', 'estimated_participants'], ['estimatedBudgetIdr', 'estimated_budget_idr']] as const) {
    const v = input[field]
    if (v === undefined) continue
    if (v !== null && (typeof v !== 'number' || !Number.isInteger(v) || v < (field === 'estimatedParticipants' ? 1 : 0) || v > 1e13)) problems[field] = ['Harus angka bulat yang wajar.']
    else out[column] = v
  }
  if (input.serviceScope !== undefined) {
    const scope = input.serviceScope
    if (!Array.isArray(scope) || scope.some(s => !(SERVICE_TYPES as readonly unknown[]).includes(s))) problems.serviceScope = [`Layanan harus salah satu dari: ${SERVICE_TYPES.join(', ')}.`]
    else out.service_scope = JSON.stringify([...new Set(scope)])
  }
  for (const [field, column] of Object.entries(REQUIREMENTS)) {
    const v = input[field]
    if (v === undefined) continue
    if (v !== null && (typeof v !== 'object' || Array.isArray(v) || JSON.stringify(v).length > 2000)) problems[field] = ['Detail kebutuhan tidak valid.']
    else out[column] = v === null ? null : JSON.stringify(v)
  }
  if (input.contactPersonId !== undefined) out.contact_person_id = input.contactPersonId || null
  const start = out.travel_start_date as string | undefined
  const end = out.travel_end_date as string | undefined
  if (start && end && start > end) problems.travelEndDate = ['Tanggal selesai tidak boleh sebelum tanggal mulai.']
  return out
}

async function checkContact(tx: Queryable, partyId: string, out: Record<string, unknown>) {
  if (!out.contact_person_id) return
  const [ok] = await tx.query('select 1 from party_contacts where id = $1 and party_id = $2', [out.contact_person_id, partyId])
  if (!ok) throw errors.validation({ contactPersonId: ['Kontak tidak ditemukan di perusahaan Anda.'] })
}

const placeholder = (column: string, i: number) => (JSON_COLUMNS.has(column) ? `$${i}::text::jsonb` : `$${i}`)

async function logActivity(tx: Queryable, actor: Actor, id: string, message: string) {
  const actId = await nextId(tx, 'TRQA-')
  await tx.query('insert into travel_request_activities (id, travel_request_id, actor_user_id, from_client, message) values ($1, $2, $3, $4, $5)',
    [actId, id, actor.userId, actor.role === 'client', message.slice(0, 4000)])
}

async function lockOwn(tx: Queryable, partyId: string, id: string) {
  const [r] = await tx.query<{ id: string; status: string; request_name: string; destination: string; service_scope: string[]; reviewer_user_id: string | null }>(
    'select id, status, request_name, destination, service_scope, reviewer_user_id from travel_requests where id = $1 and party_id = $2 for update', [id, partyId])
  if (!r) throw errors.notFound('Travel request')
  return r
}

/** The reviewer, else the customer's account owner, else every active admin. */
async function tellSales(tx: Queryable, actor: Actor, partyId: string, reviewer: string | null, title: string, body: string, id: string) {
  const [pa] = await tx.query<{ account_owner_user_id: string | null }>('select account_owner_user_id from parties where id = $1', [partyId])
  const target = reviewer ?? pa?.account_owner_user_id ?? null
  const active = target ? (await tx.query("select 1 from users where id = $1 and status = 'active' and role not in ('client', 'vendor')", [target])).length > 0 : false
  const targets = active ? [target!] : (await tx.query<{ id: string }>("select id from users where role = 'admin' and status = 'active' order by id")).map(r => r.id)
  for (const userId of targets) await notifyInternal(tx, actor, userId, { type: 'assignment', title, body, entityType: 'travel-request', entityId: id })
}

async function tellClients(tx: Queryable, actor: Actor, partyId: string, title: string, body: string, entityType: string, entityId: string) {
  const clients = await tx.query<{ id: string }>("select id from users where party_id = $1 and role = 'client' and status = 'active' order by id", [partyId])
  for (const c of clients) await notify(tx, { userId: c.id, actorUserId: actor.userId, type: 'reminder', title, body, entityType, entityId })
}

export async function clientCreateTravelRequest(tx: Queryable, actor: Actor, partyId: string, input: Record<string, unknown>, requestId: string) {
  const problems: FieldErrors = {}
  if (input.requestName === undefined) problems.requestName = ['Nama permintaan wajib diisi.']
  const out = values(input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  await checkContact(tx, partyId, out)
  const id = await nextId(tx, 'TRQ-')
  const cols = ['id', 'party_id', 'status', 'created_by', ...Object.keys(out)]
  await tx.query(`insert into travel_requests (${cols.join(', ')}) values (${cols.map((c, i) => placeholder(c, i + 1)).join(', ')})`,
    [id, partyId, 'draft', actor.userId, ...Object.values(out)])
  await logActivity(tx, actor, id, 'Draft travel request dibuat.')
  await recordAudit(tx, { action: 'travel_request.created', actorUserId: actor.userId, entityType: 'travel_request', entityId: id, requestId })
  return { id }
}

export async function clientUpdateTravelRequest(tx: Queryable, actor: Actor, partyId: string, id: string, input: Record<string, unknown>, requestId: string) {
  const r = await lockOwn(tx, partyId, id)
  if (!EDITABLE.includes(r.status)) throw rule('Travel request ini sudah dikirim — tunggu tinjauan tim kami.')
  const problems: FieldErrors = {}
  const out = values(input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  await checkContact(tx, partyId, out)
  const cols = Object.keys(out)
  if (cols.length) {
    await tx.query(`update travel_requests set ${cols.map((c, i) => `${c} = ${placeholder(c, i + 2)}`).join(', ')}, updated_at = now() where id = $1`, [id, ...Object.values(out)])
  }
  const [dates] = await tx.query<{ ok: boolean }>('select (travel_end_date is null or travel_start_date is null or travel_end_date >= travel_start_date) as ok from travel_requests where id = $1', [id])
  if (!dates!.ok) throw errors.validation({ travelEndDate: ['Tanggal selesai tidak boleh sebelum tanggal mulai.'] })
  await recordAudit(tx, { action: 'travel_request.updated', actorUserId: actor.userId, entityType: 'travel_request', entityId: id, requestId })
}

export async function clientDuplicateTravelRequest(tx: Queryable, actor: Actor, partyId: string, id: string, requestId: string) {
  await lockOwn(tx, partyId, id)
  const newId = await nextId(tx, 'TRQ-')
  await tx.query(
    `insert into travel_requests (id, party_id, request_name, contact_person_id, trip_type, purpose, destination, travel_start_date, travel_end_date, date_flexible,
                                  estimated_participants, estimated_budget_idr, currency, service_scope, flight_requirement, hotel_requirement,
                                  transportation_requirement, mice_requirement, additional_services_note, status, created_by)
     select $2, party_id, left(request_name || ' (Copy)', 200), contact_person_id, trip_type, purpose, destination, travel_start_date, travel_end_date, date_flexible,
            estimated_participants, estimated_budget_idr, currency, service_scope, flight_requirement, hotel_requirement,
            transportation_requirement, mice_requirement, additional_services_note, 'draft', $3
       from travel_requests where id = $1`, [id, newId, actor.userId])
  await logActivity(tx, actor, newId, `Duplikat dari ${id}.`)
  await recordAudit(tx, { action: 'travel_request.created', actorUserId: actor.userId, entityType: 'travel_request', entityId: newId, requestId, after: { duplicateOf: id } })
  return { id: newId }
}

export async function clientCancelTravelRequest(tx: Queryable, actor: Actor, partyId: string, id: string, reasonInput: unknown, requestId: string) {
  const reason = typeof reasonInput === 'string' ? reasonInput.trim() : ''
  if (!reason) throw errors.validation({ reason: ['Alasan pembatalan wajib diisi.'] })
  const r = await lockOwn(tx, partyId, id)
  if (!['draft', ...OPEN].includes(r.status)) throw rule('Travel request ini sudah selesai diproses.')
  await tx.query("update travel_requests set status = 'cancelled', cancel_reason = $2, updated_at = now() where id = $1", [id, reason.slice(0, 2000)])
  await logActivity(tx, actor, id, `Dibatalkan oleh client. Alasan: ${reason}`)
  if (r.status !== 'draft') await tellSales(tx, actor, partyId, r.reviewer_user_id, `Travel request ${id} dibatalkan client`, reason, id)
  await recordAudit(tx, { action: 'travel_request.cancelled', actorUserId: actor.userId, entityType: 'travel_request', entityId: id, requestId, reason })
}

export async function clientSubmitTravelRequest(tx: Queryable, actor: Actor, partyId: string, id: string, requestId: string) {
  const r = await lockOwn(tx, partyId, id)
  if (r.status !== 'draft') throw rule('Hanya draft yang bisa dikirim — untuk klarifikasi, kirim jawaban Anda.')
  const problems: FieldErrors = {}
  if (!r.request_name.trim()) problems.requestName = ['Nama permintaan wajib diisi.']
  if (!r.destination.trim()) problems.destination = ['Destinasi wajib diisi.']
  if (!r.service_scope.length) problems.serviceScope = ['Pilih minimal satu layanan.']
  if (Object.keys(problems).length) throw errors.validation(problems)
  await tx.query("update travel_requests set status = 'submitted', submitted_at = now(), updated_at = now() where id = $1", [id])
  await logActivity(tx, actor, id, 'Travel request dikirim ke tim MANOVA.')
  await tellSales(tx, actor, partyId, r.reviewer_user_id, `Travel request baru ${id}`, `${r.request_name} — ${r.destination}`, id)
  await recordAudit(tx, { action: 'travel_request.submitted', actorUserId: actor.userId, entityType: 'travel_request', entityId: id, requestId })
}

export async function clientAnswerClarification(tx: Queryable, actor: Actor, partyId: string, id: string, messageInput: unknown, requestId: string) {
  const message = typeof messageInput === 'string' ? messageInput.trim() : ''
  if (!message) throw errors.validation({ message: ['Jawaban wajib diisi.'] })
  const r = await lockOwn(tx, partyId, id)
  if (r.status !== 'need-clarification') throw rule('Travel request ini tidak sedang menunggu klarifikasi.')
  await tx.query("update travel_requests set status = 'submitted', updated_at = now() where id = $1", [id])
  await logActivity(tx, actor, id, `Client menjawab klarifikasi: ${message}`)
  await tellSales(tx, actor, partyId, r.reviewer_user_id, `Jawaban klarifikasi travel request ${id}`, message, id)
  await recordAudit(tx, { action: 'travel_request.clarified', actorUserId: actor.userId, entityType: 'travel_request', entityId: id, requestId })
}

/* ---------- staff (sales.manage-lead) ---------- */

async function lockAny(tx: Queryable, id: string) {
  const [r] = await tx.query<Record<string, unknown> & { status: string; party_id: string; request_name: string }>('select * from travel_requests where id = $1 for update', [id])
  if (!r || r.status === 'draft') throw errors.notFound('Travel request')
  return r
}

export async function staffReviewTravelRequest(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const r = await lockAny(tx, id)
  if (r.status !== 'submitted') throw rule('Hanya travel request yang baru masuk yang bisa mulai ditinjau.')
  await tx.query("update travel_requests set status = 'under-review', reviewer_user_id = $2, updated_at = now() where id = $1", [id, actor.userId])
  await logActivity(tx, actor, id, 'Tim MANOVA mulai meninjau permintaan Anda.')
  await recordAudit(tx, { action: 'travel_request.reviewing', actorUserId: actor.userId, entityType: 'travel_request', entityId: id, requestId })
}

export async function staffAskClarification(tx: Queryable, actor: Actor, id: string, noteInput: unknown, requestId: string) {
  const note = typeof noteInput === 'string' ? noteInput.trim() : ''
  if (!note) throw errors.validation({ note: ['Pertanyaan klarifikasi wajib diisi.'] })
  const r = await lockAny(tx, id)
  if (r.status !== 'submitted' && r.status !== 'under-review') throw rule('Klarifikasi hanya untuk permintaan yang sedang ditinjau.')
  await tx.query("update travel_requests set status = 'need-clarification', clarification_note = $2, reviewer_user_id = coalesce(reviewer_user_id, $3), updated_at = now() where id = $1",
    [id, note.slice(0, 2000), actor.userId])
  await logActivity(tx, actor, id, `Butuh klarifikasi: ${note}`)
  await tellClients(tx, actor, r.party_id, `Travel request ${id} butuh klarifikasi`, note, 'travel-request', id)
  await recordAudit(tx, { action: 'travel_request.clarification_asked', actorUserId: actor.userId, entityType: 'travel_request', entityId: id, requestId, reason: note })
}

/** A new lead (source client-portal) from the request; sales qualifies it with the customer and quotes as usual. */
export async function staffConvertTravelRequest(tx: Queryable, actor: Actor, id: string, today: string, requestId: string) {
  const r = await lockAny(tx, id)
  if (!['submitted', 'under-review', 'proposal-preparation'].includes(r.status)) throw rule('Travel request ini tidak bisa dijadikan lead pada status sekarang.')
  const [pa] = await tx.query<{ name: string }>('select name from parties where id = $1', [r.party_id])
  const [creator] = await tx.query<{ name: string; email: string | null }>('select name, email from users where id = $1', [r.created_by])
  const scope = r.service_scope as string[]
  const { id: leadId } = await createLead(tx, actor, {
    name: creator?.name ?? pa!.name,
    companyName: pa!.name,
    title: String(r.request_name).slice(0, 200),
    source: 'client-portal',
    ...(creator?.email ? { email: creator.email } : {}),
    serviceCategory: scope.includes('mice') ? 'mice-event' : 'corporate-travel',
    destination: (r.destination as string) || undefined,
    ...(r.travel_start_date ? { travelStartDate: day(r.travel_start_date) } : {}),
    ...(r.travel_end_date ? { travelEndDate: day(r.travel_end_date) } : {}),
    ...(r.estimated_participants ? { travelerEstimate: Number(r.estimated_participants) } : {}),
    serviceScope: scope,
    dateFlexible: r.date_flexible as boolean,
    requirementSummary: [`Travel request ${id} dari ${pa!.name} (${r.party_id}).`, r.purpose, r.additional_services_note].filter(Boolean).join('\n').slice(0, 4000)
  }, today, requestId)
  await tx.query("update travel_requests set status = 'converted-to-lead', lead_id = $2, reviewer_user_id = coalesce(reviewer_user_id, $3), updated_at = now() where id = $1", [id, leadId, actor.userId])
  await logActivity(tx, actor, id, 'Permintaan Anda diteruskan ke tim sales — quotation akan disiapkan.')
  await tellClients(tx, actor, r.party_id, `Travel request ${id} diproses`, 'Tim kami sedang menyiapkan quotation untuk Anda.', 'travel-request', id)
  await recordAudit(tx, { action: 'travel_request.converted', actorUserId: actor.userId, entityType: 'travel_request', entityId: id, requestId, after: { leadId } })
  return { leadId }
}

export async function staffCloseTravelRequest(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, requestId: string) {
  const reason = typeof reasonInput === 'string' ? reasonInput.trim() : ''
  if (!reason) throw errors.validation({ reason: ['Alasan penutupan wajib diisi.'] })
  const r = await lockAny(tx, id)
  if (!OPEN.includes(r.status)) throw rule('Travel request ini sudah selesai diproses.')
  await tx.query("update travel_requests set status = 'closed', close_reason = $2, updated_at = now() where id = $1", [id, reason.slice(0, 2000)])
  await logActivity(tx, actor, id, `Ditutup oleh tim MANOVA. Alasan: ${reason}`)
  await tellClients(tx, actor, r.party_id, `Travel request ${id} ditutup`, reason, 'travel-request', id)
  await recordAudit(tx, { action: 'travel_request.closed', actorUserId: actor.userId, entityType: 'travel_request', entityId: id, requestId, reason })
}

/* ---------- client approvals ---------- */

export const APPROVAL_TYPES = ['participant-list', 'rooming-list', 'additional-charge', 'cancellation-charge', 'project-completion', 'final-report', 'berita-acara'] as const

export async function listClientApprovals(db: Queryable, filter: { id?: string; partyId?: string; projectId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select a.*, p.name as project_name, ru.name as requested_by_name, du.name as decided_by_name
       from client_approvals a join projects p on p.id = a.project_id
       join users ru on ru.id = a.requested_by left join users du on du.id = a.decided_by
      where ($1::text is null or a.id = $1) and ($2::text is null or a.party_id = $2) and ($3::text is null or a.project_id = $3)
      order by a.requested_at desc, a.id desc`, [filter.id ?? null, filter.partyId ?? null, filter.projectId ?? null])
  return rows.map(r => ({
    id: r.id as string,
    projectId: r.project_id as string,
    projectName: r.project_name as string,
    partyId: r.party_id as string,
    entityType: r.entity_type as string,
    title: r.title as string,
    description: str(r.description),
    amountIdr: r.amount_idr === null ? null : Number(r.amount_idr),
    status: r.status as string,
    requestedBy: r.requested_by as string | null,
    requestedByName: r.requested_by_name as string,
    requestedAt: iso(r.requested_at)!,
    expiresOn: day(r.expires_on),
    decidedBy: str(r.decided_by),
    decidedByName: str(r.decided_by_name),
    decidedAt: iso(r.decided_at),
    decisionComment: str(r.decision_comment),
    reason: str(r.reason)
  }))
}
type ApprovalView = Awaited<ReturnType<typeof listClientApprovals>>[number]
export const clientApprovalView = (a: ApprovalView) => ({ ...a, requestedBy: null })

export async function staffRequestApproval(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, requestId: string) {
  const problems: FieldErrors = {}
  if (typeof input.entityType !== 'string' || !(APPROVAL_TYPES as readonly string[]).includes(input.entityType)) problems.entityType = ['Jenis persetujuan tidak dikenal (perubahan & itinerary punya alurnya sendiri).']
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!title || title.length > 200) problems.title = ['Judul wajib diisi (maks. 200 karakter).']
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 4000) || null : null
  const amount = input.amountIdr
  if (amount !== undefined && amount !== null && (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0 || amount > 1e13)) problems.amountIdr = ['Nominal harus angka bulat ≥ 0.']
  const expires = input.expiresOn
  if (expires !== undefined && expires !== null && expires !== '' && (typeof expires !== 'string' || !DATE.test(expires))) problems.expiresOn = ['Tanggal harus YYYY-MM-DD.']
  if (Object.keys(problems).length) throw errors.validation(problems)
  const [p] = await tx.query<{ party_id: string | null; name: string }>('select party_id, name from projects where id = $1', [projectId])
  if (!p) throw errors.notFound('Project')
  if (!p.party_id) throw rule('Project ini belum terhubung ke customer.')
  const id = await nextId(tx, 'CAP-')
  await tx.query(`insert into client_approvals (id, project_id, party_id, entity_type, title, description, amount_idr, status, requested_by, expires_on)
                  values ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)`,
    [id, projectId, p.party_id, input.entityType, title, description, amount ?? null, actor.userId, expires || null])
  await tellClients(tx, actor, p.party_id, `Persetujuan diminta: ${title}`, `${p.name} — mohon tinjau di Approval Center.`, 'approval', id)
  await recordAudit(tx, { action: 'client_approval.requested', actorUserId: actor.userId, entityType: 'client_approval', entityId: id, requestId, after: { projectId, entityType: input.entityType } })
  return { id }
}

export async function clientDecideApproval(tx: Queryable, actor: Actor, partyId: string, id: string, decision: 'approved' | 'rejected' | 'revision-requested', input: Record<string, unknown>, requestId: string) {
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  const comment = typeof input.comment === 'string' ? input.comment.trim() : ''
  if (decision !== 'approved' && !reason) throw errors.validation({ reason: ['Alasan wajib diisi.'] })
  const [a] = await tx.query<{ status: string; project_id: string; requested_by: string; title: string }>(
    'select status, project_id, requested_by, title from client_approvals where id = $1 and party_id = $2 for update', [id, partyId])
  if (!a) throw errors.notFound('Persetujuan')
  if (a.status !== 'pending') throw rule('Persetujuan ini sudah diputuskan.')
  await tx.query(`update client_approvals set status = $2, decided_by = $3, decided_at = now(), decision_comment = $4, reason = $5 where id = $1`,
    [id, decision, actor.userId, comment.slice(0, 2000) || null, decision === 'approved' ? null : reason.slice(0, 2000)])
  const project = await ownProject(tx, partyId, a.project_id)
  const label = decision === 'approved' ? 'disetujui' : decision === 'rejected' ? 'ditolak' : 'diminta revisi'
  const body = decision === 'approved' ? (comment || a.title) : reason
  for (const userId of new Set([project.ownerUserId, a.requested_by].filter((u): u is string => Boolean(u)))) {
    await notifyInternal(tx, actor, userId, { type: 'change', title: `Persetujuan "${a.title}" ${label} client`, body, entityType: 'project', entityId: a.project_id })
  }
  await recordAudit(tx, { action: `client_approval.${decision}`, actorUserId: actor.userId, entityType: 'client_approval', entityId: id, requestId, reason: reason || null })
}
