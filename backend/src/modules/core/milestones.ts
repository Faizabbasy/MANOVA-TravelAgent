import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { PG_BIGINT_MAX } from '../../shared/money'

/**
 * Project milestones (S7c) with their deliverable checklist. Planned dates are only editable while the project is
 * still in Drafting (status draft/planning). Applying a template replaces every milestone of the project at once.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const STEP_KEYS = ['drafting', 'confirmed', 'start', 'departure', 'on-progress', 'done']
const DRAFTING = ['draft', 'planning']
const MINOR = /^(0|[1-9][0-9]{0,18})$/
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const blank = (v: unknown) => v === null || v === ''
const exists = async (tx: Queryable, sql: string, params: unknown[]) => (await tx.query(sql, params)).length > 0

type Deliverable = { id: string; label: string; done: boolean }

export async function listMilestones(db: Queryable, filter: { id?: string; projectId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select id, project_id, step_key, name, planned_on::text as planned_on, actual_on::text as actual_on, owner_id, status, note,
            budget_minor::text as budget_minor, deliverables
       from project_milestones where ($1::text is null or id = $1) and ($2::text is null or project_id = $2)
      order by planned_on, id`,
    [filter.id ?? null, filter.projectId ?? null]
  )
  return rows.map(r => ({
    id: r.id as string,
    projectId: r.project_id as string,
    stepKey: str(r.step_key),
    name: r.name as string,
    plannedDate: r.planned_on as string,
    actualDate: str(r.actual_on),
    ownerId: str(r.owner_id),
    status: r.status as string,
    note: str(r.note),
    budgetMinor: str(r.budget_minor),
    deliverables: (r.deliverables as Deliverable[]).map(d => ({ id: d.id, label: d.label, done: d.done }))
  }))
}

export type MilestoneView = Awaited<ReturnType<typeof listMilestones>>[number]

async function cleanMilestone(tx: Queryable, v: Record<string, unknown>, problems: FieldErrors, prefix = ''): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  const field = (name: string) => `${prefix}${name}`
  if (v.name !== undefined) {
    const name = typeof v.name === 'string' ? v.name.trim() : ''
    if (!name) problems[field('name')] = ['Nama milestone wajib diisi.']
    else if (name.length > 200) problems[field('name')] = ['Nama maksimal 200 karakter.']
    else out.name = name
  }
  if (v.plannedDate !== undefined) {
    if (typeof v.plannedDate !== 'string' || !isIsoDate(v.plannedDate)) problems[field('plannedDate')] = ['Tanggal rencana wajib diisi dengan format YYYY-MM-DD.']
    else out.planned_on = v.plannedDate
  }
  if (v.stepKey !== undefined) {
    if (blank(v.stepKey)) out.step_key = null
    else if (typeof v.stepKey !== 'string' || !STEP_KEYS.includes(v.stepKey)) problems[field('stepKey')] = ['Tahap workflow tidak dikenal.']
    else out.step_key = v.stepKey
  }
  if (v.ownerId !== undefined) {
    if (blank(v.ownerId)) out.owner_id = null
    else if (typeof v.ownerId !== 'string' || !ID_PATTERN.test(v.ownerId) || !(await exists(tx, 'select 1 from users where id = $1', [v.ownerId])))
      problems[field('ownerId')] = ['User tidak ditemukan.']
    else out.owner_id = v.ownerId
  }
  if (v.note !== undefined) {
    if (v.note === null) out.note = null
    else if (typeof v.note !== 'string' || v.note.trim().length > 1000) problems[field('note')] = ['Catatan harus teks, maksimal 1000 karakter.']
    else out.note = v.note.trim() || null
  }
  if (v.budgetMinor !== undefined) {
    if (blank(v.budgetMinor)) out.budget_minor = null
    else if (typeof v.budgetMinor !== 'string' || !MINOR.test(v.budgetMinor) || BigInt(v.budgetMinor) > PG_BIGINT_MAX)
      problems[field('budgetMinor')] = ['Budget harus angka bulat ≥ 0, dikirim sebagai teks (contoh "1500000").']
    else out.budget_minor = v.budgetMinor
  }
  return out
}

async function insertMilestone(tx: Queryable, projectId: string, values: Record<string, unknown>): Promise<string> {
  const id = await nextId(tx, 'PMS-')
  const cols = ['id', 'project_id', ...Object.keys(values)]
  await tx.query(`insert into project_milestones (${cols.join(', ')}, changed_by_api_at) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}, now())`,
    [id, projectId, ...Object.values(values)])
  return id
}

export async function createMilestone(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const values = await cleanMilestone(tx, input, problems)
  if (input.name === undefined) problems.name = ['Nama milestone wajib diisi.']
  if (input.plannedDate === undefined) problems.plannedDate = ['Tanggal rencana wajib diisi dengan format YYYY-MM-DD.']
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await insertMilestone(tx, projectId, values)
  await recordAudit(tx, { action: 'milestone.created', actorUserId: actor.userId, entityType: 'milestone', entityId: id, requestId, after: { projectId, ...values } })
  return { id }
}

async function lockMilestone(tx: Queryable, id: string) {
  const [row] = await tx.query<{ project_id: string; status: string; deliverables: Deliverable[]; project_status: string }>(
    `select m.project_id, m.status, m.deliverables, p.status as project_status
       from project_milestones m join projects p on p.id = m.project_id where m.id = $1 for update of m`, [id])
  if (!row) throw errors.notFound('Milestone')
  return row
}

export async function updateMilestone(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string) {
  const current = await lockMilestone(tx, id)
  const problems: FieldErrors = {}
  for (const k of ['id', 'projectId', 'status', 'actualDate', 'deliverables']) if (input[k] !== undefined) problems[k] = ['Tidak bisa diubah lewat edit milestone.']
  const values = await cleanMilestone(tx, input, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  if ('planned_on' in values && !DRAFTING.includes(current.project_status)) throw rule('Tanggal rencana terkunci setelah project lewat tahap Drafting.')
  const cols = Object.keys(values)
  if (!cols.length) return
  await tx.query(`update project_milestones set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, ...Object.values(values)])
  await recordAudit(tx, { action: 'milestone.updated', actorUserId: actor.userId, entityType: 'milestone', entityId: id, requestId, after: values })
}

export async function completeMilestone(tx: Queryable, actor: Actor, id: string, today: string, requestId: string) {
  const current = await lockMilestone(tx, id)
  if (current.status === 'completed' || current.status === 'cancelled') throw rule('Milestone ini sudah selesai atau dibatalkan.')
  await tx.query("update project_milestones set status = 'completed', actual_on = $2, changed_by_api_at = now(), updated_at = now() where id = $1", [id, today])
  await recordAudit(tx, { action: 'milestone.completed', actorUserId: actor.userId, entityType: 'milestone', entityId: id, requestId, after: { actualDate: today } })
}

async function saveDeliverables(tx: Queryable, id: string, deliverables: Deliverable[]) {
  await tx.query('update project_milestones set deliverables = $2::text::jsonb, changed_by_api_at = now(), updated_at = now() where id = $1', [id, JSON.stringify(deliverables)])
}

export async function addDeliverable(tx: Queryable, actor: Actor, id: string, label: unknown, requestId: string) {
  const text = typeof label === 'string' ? label.trim() : ''
  if (!text) throw errors.validation({ label: ['Nama deliverable wajib diisi.'] })
  if (text.length > 200) throw errors.validation({ label: ['Nama deliverable maksimal 200 karakter.'] })
  const current = await lockMilestone(tx, id)
  const prefix = `PMD-${id}-`
  const last = current.deliverables.reduce((max, d) => {
    const n = d.id.startsWith(prefix) ? Number(d.id.slice(prefix.length)) : 0
    return Number.isInteger(n) && n > max ? n : max
  }, 0)
  const deliverable = { id: `${prefix}${last + 1}`, label: text, done: false }
  await saveDeliverables(tx, id, [...current.deliverables, deliverable])
  await recordAudit(tx, { action: 'milestone.deliverable_added', actorUserId: actor.userId, entityType: 'milestone', entityId: id, requestId, after: deliverable })
}

export async function setDeliverableDone(tx: Queryable, actor: Actor, id: string, deliverableId: string, done: unknown, requestId: string) {
  if (typeof done !== 'boolean') throw errors.validation({ done: ['Harus ya/tidak.'] })
  const current = await lockMilestone(tx, id)
  if (!current.deliverables.some(d => d.id === deliverableId)) throw errors.notFound('Deliverable')
  await saveDeliverables(tx, id, current.deliverables.map(d => (d.id === deliverableId ? { ...d, done } : d)))
  await recordAudit(tx, { action: 'milestone.deliverable_set', actorUserId: actor.userId, entityType: 'milestone', entityId: id, requestId, after: { deliverableId, done } })
}

export async function removeDeliverable(tx: Queryable, actor: Actor, id: string, deliverableId: string, requestId: string) {
  const current = await lockMilestone(tx, id)
  if (!current.deliverables.some(d => d.id === deliverableId)) throw errors.notFound('Deliverable')
  await saveDeliverables(tx, id, current.deliverables.filter(d => d.id !== deliverableId))
  await recordAudit(tx, { action: 'milestone.deliverable_removed', actorUserId: actor.userId, entityType: 'milestone', entityId: id, requestId, before: { deliverableId } })
}

/** Template: every item is validated first; only then the project's milestones are replaced, in one transaction. */
export async function replaceMilestones(tx: Queryable, actor: Actor, projectId: string, items: unknown, requestId: string) {
  if (!Array.isArray(items) || !items.length) throw errors.validation({ milestones: ['Template harus berisi minimal satu milestone.'] })
  if (items.length > 100) throw errors.validation({ milestones: ['Maksimal 100 milestone.'] })
  const problems: FieldErrors = {}
  const rows: Record<string, unknown>[] = []
  for (const [i, raw] of items.entries()) {
    const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const picked = { name: item.name ?? '', plannedDate: item.plannedDate ?? '', stepKey: item.stepKey }
    rows.push(await cleanMilestone(tx, picked, problems, `milestones.${i}.`))
  }
  if (Object.keys(problems).length) throw errors.validation(problems)
  await tx.query('select id from projects where id = $1 for update', [projectId])
  const removed = await tx.query<{ id: string }>('delete from project_milestones where project_id = $1 returning id', [projectId])
  for (const values of rows) await insertMilestone(tx, projectId, values)
  await recordAudit(tx, { action: 'milestone.replaced', actorUserId: actor.userId, entityType: 'project', entityId: projectId, requestId,
    before: { milestoneIds: removed.map(r => r.id) }, after: { count: rows.length } })
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The standard milestones of a new project (ported from the frontend's `seedDefaultProjectMilestones`). */
export async function createDefaultMilestones(tx: Queryable, projectId: string, startDate: string, endDate: string, today: string) {
  const notBeforeToday = (iso: string) => (iso < today ? today : iso)
  const defaults: [string, string, string][] = [
    ['drafting', 'SPK / Handover Diterima', notBeforeToday(addDays(startDate, -60))],
    ['drafting', 'Finalisasi Itinerary', notBeforeToday(addDays(startDate, -45))],
    ['confirmed', 'Invoice DP Terbit', notBeforeToday(addDays(startDate, -40))],
    ['confirmed', 'Konfirmasi Vendor & Booking', notBeforeToday(addDays(startDate, -30))],
    ['start', 'Dokumen Traveler Lengkap', notBeforeToday(addDays(startDate, -14))],
    ['departure', 'Keberangkatan', notBeforeToday(startDate)],
    ['on-progress', 'Trip Selesai', notBeforeToday(endDate)],
    ['done', 'Laporan Akhir & Review Klien', notBeforeToday(addDays(endDate, 5))]
  ]
  for (const [stepKey, name, plannedOn] of defaults) await insertMilestone(tx, projectId, { step_key: stepKey, name, planned_on: plannedOn })
}
