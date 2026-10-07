import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { SERVICE_TYPES } from '../core/booking-rules'
import { LEAD_ROW_SQL, LEAD_SOURCES, SERVICE_CATEGORIES, URGENCIES, type LeadRow } from './lead-rules'
import { wonProjectId } from './repository'

/**
 * Lead writes (S6a). A lead that became a project (Won) or is archived is read-only; stage moves beyond
 * new ↔ contacted only through qualify / unqualify.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const ACTIVITY_TYPES = ['call', 'meeting', 'email', 'note', 'follow-up'] as const

type FieldKind = 'text' | 'longtext' | 'date' | 'int' | 'bool' | 'user' | 'source' | 'category' | 'urgency' | 'scope' | 'b2c'

/** API field → column, with its kind. `stage` is limited separately. */
const FIELDS: Record<string, { column: string; kind: FieldKind }> = {
  name: { column: 'name', kind: 'text' },
  companyName: { column: 'company_name', kind: 'text' },
  title: { column: 'title', kind: 'text' },
  source: { column: 'source', kind: 'source' },
  handedOverTo: { column: 'handed_over_to', kind: 'user' },
  phone: { column: 'phone', kind: 'text' },
  email: { column: 'email', kind: 'text' },
  qualificationNotes: { column: 'qualification_notes', kind: 'longtext' },
  expectedCloseDate: { column: 'expected_close_date', kind: 'date' },
  serviceCategory: { column: 'service_category', kind: 'category' },
  destination: { column: 'destination', kind: 'text' },
  travelStartDate: { column: 'travel_start_date', kind: 'date' },
  travelEndDate: { column: 'travel_end_date', kind: 'date' },
  travelerEstimate: { column: 'traveler_estimate', kind: 'int' },
  serviceScope: { column: 'service_scope', kind: 'scope' },
  requirementSummary: { column: 'requirement_summary', kind: 'longtext' },
  budgetRange: { column: 'budget_range', kind: 'text' },
  dateFlexible: { column: 'date_flexible', kind: 'bool' },
  decisionMaker: { column: 'decision_maker', kind: 'text' },
  urgency: { column: 'urgency', kind: 'urgency' },
  specialRequestNote: { column: 'special_request_note', kind: 'longtext' },
  b2c: { column: 'b2c', kind: 'b2c' }
}

async function clean(tx: Queryable, input: Record<string, unknown>, problems: FieldErrors): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const [field, spec] of Object.entries(FIELDS)) {
    const v = input[field]
    if (v === undefined) continue
    if (v === null || v === '') {
      if (field === 'name' || field === 'source') problems[field] = ['Wajib diisi.']
      else out[spec.column] = spec.kind === 'scope' ? '[]' : spec.kind === 'b2c' ? '{}' : null
      continue
    }
    switch (spec.kind) {
      case 'text':
      case 'longtext': {
        const max = spec.kind === 'text' ? 200 : 2000
        if (typeof v !== 'string' || v.trim().length > max) problems[field] = [`Harus teks, maksimal ${max} karakter.`]
        else if (!v.trim() && field === 'name') problems[field] = ['Wajib diisi.']
        else out[spec.column] = v.trim() || null
        break
      }
      case 'date':
        if (typeof v !== 'string' || !isIsoDate(v)) problems[field] = ['Tanggal harus format YYYY-MM-DD.']
        else out[spec.column] = v
        break
      case 'int':
        if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 100_000) problems[field] = ['Minimal 1.']
        else out[spec.column] = v
        break
      case 'bool':
        if (typeof v !== 'boolean') problems[field] = ['Harus ya/tidak.']
        else out[spec.column] = v
        break
      case 'user': {
        const found = typeof v === 'string' && ID_PATTERN.test(v) &&
          (await tx.query("select 1 from users where id = $1 and role in ('admin', 'super-admin') and status = 'active'", [v])).length > 0
        if (!found) problems[field] = ['Pengguna tidak ditemukan.']
        else out[spec.column] = v
        break
      }
      case 'source':
        if (!(LEAD_SOURCES as readonly unknown[]).includes(v)) problems[field] = ['Sumber lead tidak dikenal.']
        else out[spec.column] = v
        break
      case 'category':
        if (!(SERVICE_CATEGORIES as readonly unknown[]).includes(v)) problems[field] = ['Jenis kebutuhan tidak dikenal.']
        else out[spec.column] = v
        break
      case 'urgency':
        if (!(URGENCIES as readonly unknown[]).includes(v)) problems[field] = ['Urgensi tidak dikenal.']
        else out[spec.column] = v
        break
      case 'scope': {
        const scope = Array.isArray(v) ? [...new Set(v)] : null
        if (!scope || scope.some(s => !(SERVICE_TYPES as readonly unknown[]).includes(s))) problems[field] = [`Layanan harus salah satu dari: ${SERVICE_TYPES.join(', ')}.`]
        else out[spec.column] = JSON.stringify(scope)
        break
      }
      case 'b2c':
        if (typeof v !== 'object' || Array.isArray(v) || JSON.stringify(v).length > 4000) problems[field] = ['Data B2C tidak valid.']
        else out[spec.column] = JSON.stringify(v)
        break
    }
  }
  return out
}

const JSON_COLUMNS = new Set(['service_scope', 'b2c'])
const placeholder = (column: string, i: number) => (JSON_COLUMNS.has(column) ? `$${i}::text::jsonb` : `$${i}`)

export async function lockLead(tx: Queryable, id: string): Promise<LeadRow & { merged_into: string | null }> {
  const [lead] = await tx.query<LeadRow & { merged_into: string | null }>(`select ${LEAD_ROW_SQL}, merged_into from leads where id = $1 for update`, [id])
  if (!lead) throw errors.notFound('Lead')
  return lead
}

export async function touchLead(tx: Queryable, id: string, today: string) {
  await tx.query('update leads set last_updated_on = $2, updated_at = now() where id = $1', [id, today])
}

async function assertOpen(tx: Queryable, lead: LeadRow, what: string) {
  const won = await wonProjectId(tx, lead.id)
  if (won) throw rule(`Lead ini sudah menjadi project ${won} — tidak bisa ${what}.`)
  if (lead.archived) throw rule(`Lead ini diarsip — buka kembali sebelum ${what}.`)
}

export async function insertLeadActivity(tx: Queryable, leadId: string, type: string, message: string, ownerUserId: string, today: string, dueOn: string | null = null): Promise<string> {
  const id = await nextId(tx, 'LACT-')
  await tx.query('insert into lead_activities (id, lead_id, type, message, owner_user_id, activity_date, due_on) values ($1, $2, $3, $4, $5, $6, $7)',
    [id, leadId, type, message, ownerUserId, today, dueOn])
  return id
}

function checkPeriod(start: string | null | undefined, end: string | null | undefined) {
  if (start && end && start > end) throw errors.validation({ travelEndDate: ['Tanggal selesai tidak boleh sebelum tanggal mulai.'] })
}

export async function createLead(tx: Queryable, actor: Actor, input: Record<string, unknown>, today: string, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (input.name === undefined) problems.name = ['Nama lead wajib diisi.']
  if (input.source === undefined) problems.source = ['Sumber lead wajib diisi.']
  if (input.stage !== undefined && input.stage !== 'new' && input.stage !== 'contacted') problems.stage = ['Lead baru hanya bisa new atau contacted.']
  const values = await clean(tx, input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  checkPeriod(values.travel_start_date as string | undefined, values.travel_end_date as string | undefined)

  const id = await nextId(tx, 'LED-')
  const cols = ['id', 'owner_user_id', 'stage', 'created_on', 'last_updated_on', ...Object.keys(values)]
  const vals = [id, actor.userId, input.stage ?? 'new', today, today, ...Object.values(values)]
  await tx.query(`insert into leads (${cols.join(', ')}) values (${cols.map((c, i) => placeholder(c, i + 1)).join(', ')})`, vals)
  await recordAudit(tx, { action: 'lead.created', actorUserId: actor.userId, entityType: 'lead', entityId: id, requestId, after: { name: values.name, source: values.source } })
  return { id }
}

const FORBIDDEN_PATCH = ['id', 'partyId', 'archived', 'mergedInto', 'ownerUserId', 'qualifiedOn', 'unqualifiedReason', 'archiveReason']

export async function updateLead(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, today: string, requestId: string): Promise<void> {
  const problems: FieldErrors = {}
  for (const k of FORBIDDEN_PATCH) if (input[k] !== undefined) problems[k] = ['Tidak bisa diubah lewat edit lead.']
  if (input.stage !== undefined && input.stage !== 'new' && input.stage !== 'contacted') problems.stage = ['Stage hanya bisa diubah antara new dan contacted; pakai Qualify / Unqualify.']
  const values = await clean(tx, input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const lead = await lockLead(tx, id)
  await assertOpen(tx, lead, 'diubah')
  if (input.stage !== undefined && lead.stage !== 'new' && lead.stage !== 'contacted') throw rule('Stage lead yang sudah qualified/unqualified diubah lewat Qualify / Unqualify.')
  checkPeriod(
    'travel_start_date' in values ? values.travel_start_date as string | null : lead.travel_start_date,
    'travel_end_date' in values ? values.travel_end_date as string | null : lead.travel_end_date
  )
  if (input.stage !== undefined) values.stage = input.stage
  const cols = Object.keys(values)
  if (!cols.length) return
  await tx.query(
    `update leads set ${cols.map((c, i) => `${c} = ${placeholder(c, i + 2)}`).join(', ')}, last_updated_on = $${cols.length + 2}, updated_at = now() where id = $1`,
    [id, ...Object.values(values), today]
  )
  await recordAudit(tx, { action: 'lead.updated', actorUserId: actor.userId, entityType: 'lead', entityId: id, requestId, after: Object.fromEntries(Object.keys(input).map(k => [k, input[k]])) })
}

function reasonOf(value: unknown, required: boolean): string | null {
  const s = typeof value === 'string' ? value.trim().slice(0, 1000) : ''
  if (!s && required) throw errors.validation({ reason: ['Alasan wajib diisi.'] })
  return s || null
}

export async function archiveLead(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, today: string, requestId: string) {
  const reason = reasonOf(reasonInput, false)
  const lead = await lockLead(tx, id)
  await assertOpen(tx, lead, 'diarsip')
  await tx.query('update leads set archived = true, archive_reason = $2, last_updated_on = $3, updated_at = now() where id = $1', [id, reason, today])
  await recordAudit(tx, { action: 'lead.archived', actorUserId: actor.userId, entityType: 'lead', entityId: id, requestId, reason })
}

export async function reopenLead(tx: Queryable, actor: Actor, id: string, today: string, requestId: string) {
  const lead = await lockLead(tx, id)
  if (!lead.archived) return
  if (lead.merged_into) throw rule(`Lead ini duplikat dari ${lead.merged_into} — buka lead itu.`)
  await tx.query('update leads set archived = false, archive_reason = null, last_updated_on = $2, updated_at = now() where id = $1', [id, today])
  await recordAudit(tx, { action: 'lead.reopened', actorUserId: actor.userId, entityType: 'lead', entityId: id, requestId })
}

export async function unqualifyLead(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, today: string, requestId: string) {
  const reason = reasonOf(reasonInput, true)!
  const lead = await lockLead(tx, id)
  await assertOpen(tx, lead, 'di-unqualify')
  await tx.query("update leads set stage = 'unqualified', unqualified_reason = $2, last_updated_on = $3, updated_at = now() where id = $1", [id, reason, today])
  await insertLeadActivity(tx, id, 'note', `Lead ditandai Unqualified. Catatan: ${reason}`, actor.userId, today)
  await recordAudit(tx, { action: 'lead.unqualified', actorUserId: actor.userId, entityType: 'lead', entityId: id, requestId, reason })
}

export async function mergeLead(tx: Queryable, actor: Actor, id: string, intoInput: unknown, today: string, requestId: string) {
  if (typeof intoInput !== 'string' || !ID_PATTERN.test(intoInput)) throw errors.validation({ intoLeadId: ['Pilih lead tujuan.'] })
  if (intoInput === id) throw rule('Lead tidak bisa digabung ke dirinya sendiri.')
  const dup = await lockLead(tx, id)
  const into = await lockLead(tx, intoInput)
  await assertOpen(tx, dup, 'digabung')
  if (into.archived) throw rule('Lead tujuan diarsip — pilih lead yang aktif.')
  await tx.query('update leads set archived = true, merged_into = $2, archive_reason = $3, last_updated_on = $4, updated_at = now() where id = $1',
    [id, into.id, `Duplikat dari ${into.id}`, today])
  await insertLeadActivity(tx, id, 'note', `Ditandai sebagai duplikat, digabung ke ${into.id} (${into.name}).`, actor.userId, today)
  await insertLeadActivity(tx, into.id, 'note', `Menerima merge dari lead duplikat ${id} (${dup.name}).`, actor.userId, today)
  await touchLead(tx, into.id, today)
  await recordAudit(tx, { action: 'lead.merged', actorUserId: actor.userId, entityType: 'lead', entityId: id, requestId, after: { mergedInto: into.id } })
}

export async function addLeadActivity(tx: Queryable, actor: Actor, leadId: string, input: Record<string, unknown>, today: string, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  if (!(ACTIVITY_TYPES as readonly unknown[]).includes(input.type)) problems.type = ['Jenis aktivitas tidak dikenal.']
  const message = typeof input.message === 'string' ? input.message.trim() : ''
  if (!message) problems.message = ['Isi aktivitas wajib diisi.']
  else if (message.length > 2000) problems.message = ['Maksimal 2000 karakter.']
  let dueOn: string | null = null
  if (input.dueOn !== undefined && input.dueOn !== null) {
    if (typeof input.dueOn !== 'string' || !isIsoDate(input.dueOn)) problems.dueOn = ['Tanggal harus format YYYY-MM-DD.']
    else dueOn = input.dueOn
  }
  if (Object.keys(problems).length) throw errors.validation(problems)
  await lockLead(tx, leadId)
  const id = await insertLeadActivity(tx, leadId, input.type as string, message, actor.userId, today, dueOn)
  await touchLead(tx, leadId, today)
  await recordAudit(tx, { action: 'lead.activity_added', actorUserId: actor.userId, entityType: 'lead', entityId: leadId, requestId, after: { activityId: id, type: input.type, dueOn } })
  return { id }
}

export async function completeLeadActivity(tx: Queryable, actor: Actor, leadId: string, activityId: string, today: string, requestId: string) {
  const done = await tx.query<{ id: string }>('update lead_activities set done_on = coalesce(done_on, $3) where id = $1 and lead_id = $2 returning id', [activityId, leadId, today])
  if (!done.length) throw errors.notFound('Aktivitas')
  await touchLead(tx, leadId, today)
  await recordAudit(tx, { action: 'lead.activity_done', actorUserId: actor.userId, entityType: 'lead', entityId: leadId, requestId, after: { activityId } })
}
