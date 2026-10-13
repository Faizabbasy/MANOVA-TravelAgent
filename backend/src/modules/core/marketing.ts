import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { todayBusinessDate } from '../finance/common'

/**
 * Marketing content (S11b): the publishing schedule per platform and the development pipeline of content ideas.
 * Admin and Super Admin write (`marketing.manage-content`). Campaigns are still a frontend mock, so a schedule entry
 * keeps `campaignId` as a plain reference.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10))

const PLATFORMS = ['instagram', 'tiktok', 'website', 'email', 'youtube', 'linkedin']
const SCHEDULE_STATUSES = ['draft', 'scheduled', 'published']
const STAGES = ['idea', 'draft', 'review', 'ready']

type Input = Record<string, unknown>

/** Reads one field: `undefined` = not sent, `null` = cleared; errors collect in `fe`. */
function field(input: Input, key: string, fe: FieldErrors, kind: 'text' | 'long' | 'date' | string[], required: boolean): string | null | undefined {
  const v = input[key]
  if (v === undefined) { if (required) fe[key] = ['Wajib diisi.']; return undefined }
  if (v === null || (typeof v === 'string' && !v.trim())) { if (required) fe[key] = ['Wajib diisi.']; return null }
  if (typeof v !== 'string') { fe[key] = ['Harus berupa teks.']; return undefined }
  const s = v.trim()
  if (Array.isArray(kind)) { if (!kind.includes(s)) fe[key] = [`Pilih salah satu: ${kind.join(', ')}.`]; return s }
  if (kind === 'date') { if (!isIsoDate(s)) fe[key] = ['Tanggal harus berformat YYYY-MM-DD.']; return s }
  const max = kind === 'long' ? 2000 : 200
  if (s.length > max) fe[key] = [`Maksimal ${max} karakter.`]
  return s
}
function unknownKeys(input: Input, allowed: string[], fe: FieldErrors) {
  for (const k of Object.keys(input)) if (!allowed.includes(k)) fe[k] = ['Field ini tidak dikenal.']
}
const done = (fe: FieldErrors) => { if (Object.keys(fe).length) throw errors.validation(fe) }

/** Applies the sent fields as `column = $n`; the column names come from this module only. */
async function patchRow(tx: Queryable, table: string, id: string, values: Record<string, unknown>, extra = '') {
  const cols = Object.keys(values)
  await tx.query(
    `update ${table} set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}${cols.length ? ', ' : ''}${extra}changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, ...cols.map(c => values[c])])
}

/* ---------- schedule ---------- */

const SCHEDULE_FIELDS = { publishDate: 'publish_date', platform: 'platform', title: 'title', status: 'status', campaignId: 'campaign_id', note: 'note' } as const

export async function listContentSchedule(db: Queryable, id?: string) {
  const rows = await db.query<Record<string, unknown>>(
    'select * from content_schedule where ($1::text is null or id = $1) order by publish_date, id', [id ?? null])
  return rows.map(r => ({
    id: r.id as string,
    publishDate: day(r.publish_date),
    platform: r.platform as string,
    title: r.title as string,
    status: r.status as string,
    campaignId: str(r.campaign_id),
    note: str(r.note)
  }))
}

function readSchedule(input: Input, creating: boolean) {
  const fe: FieldErrors = {}
  unknownKeys(input, Object.keys(SCHEDULE_FIELDS), fe)
  const v = {
    publish_date: field(input, 'publishDate', fe, 'date', creating),
    platform: field(input, 'platform', fe, PLATFORMS, creating),
    title: field(input, 'title', fe, 'text', creating),
    status: field(input, 'status', fe, SCHEDULE_STATUSES, creating),
    campaign_id: field(input, 'campaignId', fe, 'text', false),
    note: field(input, 'note', fe, 'long', false)
  }
  for (const k of ['publish_date', 'platform', 'title', 'status'] as const) {
    if (v[k] === null) fe[Object.entries(SCHEDULE_FIELDS).find(([, col]) => col === k)![0]] = ['Wajib diisi.']
  }
  done(fe)
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined))
}

export async function createContentSchedule(tx: Queryable, actor: Actor, input: Input, requestId: string) {
  const v = readSchedule(input, true)
  const id = await nextId(tx, 'CTS-')
  await tx.query(
    `insert into content_schedule (id, publish_date, platform, title, status, campaign_id, note, changed_by_api_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())`,
    [id, v.publish_date, v.platform, v.title, v.status, v.campaign_id ?? null, v.note ?? null])
  await recordAudit(tx, { action: 'content.scheduled', actorUserId: actor.userId, entityType: 'content', entityId: id, requestId, after: v })
  return { id }
}

export async function updateContentSchedule(tx: Queryable, actor: Actor, id: string, input: Input, requestId: string) {
  const [row] = await tx.query('select 1 from content_schedule where id = $1 for update', [id])
  if (!row) throw errors.notFound('Jadwal konten')
  const v = readSchedule(input, false)
  await patchRow(tx, 'content_schedule', id, v)
  await recordAudit(tx, { action: 'content.updated', actorUserId: actor.userId, entityType: 'content', entityId: id, requestId, after: v })
}

/* ---------- development ---------- */

const IDEA_FIELDS = ['title', 'stage', 'platform', 'ownerId', 'note']

export async function listContentDevelopment(db: Queryable, id?: string) {
  const rows = await db.query<Record<string, unknown>>(
    'select * from content_development where ($1::text is null or id = $1) order by updated_on desc, id', [id ?? null])
  return rows.map(r => ({
    id: r.id as string,
    title: r.title as string,
    stage: r.stage as string,
    platform: r.platform as string,
    ownerId: str(r.owner_id),
    note: str(r.note),
    updatedOn: day(r.updated_on)
  }))
}

async function readIdea(tx: Queryable, input: Input, creating: boolean) {
  const fe: FieldErrors = {}
  unknownKeys(input, IDEA_FIELDS, fe)
  const v = {
    title: field(input, 'title', fe, 'text', creating),
    stage: field(input, 'stage', fe, STAGES, creating),
    platform: field(input, 'platform', fe, PLATFORMS, creating),
    owner_id: field(input, 'ownerId', fe, 'text', false),
    note: field(input, 'note', fe, 'long', false)
  }
  if (v.title === null) fe.title = ['Wajib diisi.']
  if (v.stage === null) fe.stage = ['Wajib diisi.']
  if (v.platform === null) fe.platform = ['Wajib diisi.']
  done(fe)
  if (v.owner_id) {
    const [u] = await tx.query("select 1 from users where id = $1 and status = 'active' and role not in ('client', 'vendor')", [v.owner_id])
    if (!u) throw rule('PIC konten harus user internal yang aktif.')
  }
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined))
}

export async function createContentIdea(tx: Queryable, actor: Actor, input: Input, requestId: string) {
  const v = await readIdea(tx, input, true)
  const id = await nextId(tx, 'CTD-')
  await tx.query(
    `insert into content_development (id, title, stage, platform, owner_id, note, updated_on, changed_by_api_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())`,
    [id, v.title, v.stage, v.platform, v.owner_id ?? null, v.note ?? null, todayBusinessDate()])
  await recordAudit(tx, { action: 'content_idea.created', actorUserId: actor.userId, entityType: 'content_idea', entityId: id, requestId, after: v })
  return { id }
}

export async function updateContentIdea(tx: Queryable, actor: Actor, id: string, input: Input, requestId: string) {
  const [row] = await tx.query('select 1 from content_development where id = $1 for update', [id])
  if (!row) throw errors.notFound('Konten')
  const v = await readIdea(tx, input, false)
  await patchRow(tx, 'content_development', id, { ...v, updated_on: todayBusinessDate() })
  await recordAudit(tx, { action: 'content_idea.updated', actorUserId: actor.userId, entityType: 'content_idea', entityId: id, requestId, after: v })
}
