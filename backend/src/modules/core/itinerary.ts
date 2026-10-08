import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { PG_BIGINT_MAX } from '../../shared/money'

/**
 * Daily itinerary items (S7b). The server owns them; versions, comments and client approval stay in the hidden
 * client portal (ADR-006). A vendor amount only exists next to its vendor: clearing the vendor clears the amount.
 */

const SERVICE_TYPES = ['flight', 'hotel', 'transportation', 'mice', 'additional']
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
const MINOR = /^(0|[1-9][0-9]{0,18})$/
const TEXT: Record<string, string> = { description: 'description', timezone: 'timezone', location: 'location' }
const FORBIDDEN = ['id', 'projectId']
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))

export async function listItineraryItems(db: Queryable, filter: { id?: string; projectId?: string } = {}) {
  const rows = await db.query<Record<string, unknown>>(
    `select id, project_id, date::text as date, time, title, description, service_type, group_id, timezone, location,
            visible_to_client, vendor_id, vendor_amount_minor::text as vendor_amount_minor
       from itinerary_items where ($1::text is null or id = $1) and ($2::text is null or project_id = $2)
      order by date, time nulls first, id`,
    [filter.id ?? null, filter.projectId ?? null]
  )
  return rows.map(r => ({
    id: r.id as string,
    projectId: r.project_id as string,
    date: r.date as string,
    time: str(r.time),
    title: r.title as string,
    description: str(r.description),
    serviceType: str(r.service_type),
    groupId: str(r.group_id),
    timezone: str(r.timezone),
    location: str(r.location),
    visibleToClient: r.visible_to_client as boolean,
    vendorId: str(r.vendor_id),
    vendorAmountMinor: str(r.vendor_amount_minor)
  }))
}

export type ItineraryItemView = Awaited<ReturnType<typeof listItineraryItems>>[number]

const exists = async (tx: Queryable, sql: string, params: unknown[]) => (await tx.query(sql, params)).length > 0
const blank = (v: unknown) => v === null || v === ''

async function cleanItem(tx: Queryable, projectId: string, v: Record<string, unknown>, problems: FieldErrors): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const k of FORBIDDEN) if (v[k] !== undefined) problems[k] = ['Tidak bisa diubah lewat item itinerary.']
  if (v.date !== undefined) {
    if (typeof v.date !== 'string' || !isIsoDate(v.date)) problems.date = ['Tanggal wajib diisi dengan format YYYY-MM-DD.']
    else out.date = v.date
  }
  if (v.title !== undefined) {
    const title = typeof v.title === 'string' ? v.title.trim() : ''
    if (!title) problems.title = ['Judul wajib diisi.']
    else if (title.length > 200) problems.title = ['Judul maksimal 200 karakter.']
    else out.title = title
  }
  if (v.time !== undefined) {
    if (blank(v.time)) out.time = null
    else if (typeof v.time !== 'string' || !TIME.test(v.time)) problems.time = ['Jam harus format HH:MM (00:00–23:59).']
    else out.time = v.time
  }
  for (const [field, column] of Object.entries(TEXT)) {
    const x = v[field]
    if (x === undefined) continue
    if (x === null) out[column] = null
    else if (typeof x !== 'string' || x.trim().length > 500) problems[field] = ['Harus teks, maksimal 500 karakter.']
    else out[column] = x.trim() || null
  }
  if (v.serviceType !== undefined) {
    if (blank(v.serviceType)) out.service_type = null
    else if (typeof v.serviceType !== 'string' || !SERVICE_TYPES.includes(v.serviceType)) problems.serviceType = ['Jenis layanan tidak dikenal.']
    else out.service_type = v.serviceType
  }
  if (v.groupId !== undefined) {
    if (blank(v.groupId)) out.group_id = null
    else if (typeof v.groupId !== 'string' || !ID_PATTERN.test(v.groupId) ||
      !(await exists(tx, 'select 1 from traveler_groups where id = $1 and project_id = $2', [v.groupId, projectId]))) problems.groupId = ['Grup tidak ditemukan di project ini.']
    else out.group_id = v.groupId
  }
  if (v.visibleToClient !== undefined) {
    if (typeof v.visibleToClient !== 'boolean') problems.visibleToClient = ['Harus ya/tidak.']
    else out.visible_to_client = v.visibleToClient
  }
  if (v.vendorId !== undefined) {
    if (blank(v.vendorId)) out.vendor_id = null
    else if (typeof v.vendorId !== 'string' || !ID_PATTERN.test(v.vendorId) ||
      !(await exists(tx, 'select 1 from vendors where id = $1', [v.vendorId]))) problems.vendorId = ['Vendor tidak ditemukan.']
    else out.vendor_id = v.vendorId
  }
  if (v.vendorAmountMinor !== undefined) {
    if (blank(v.vendorAmountMinor)) out.vendor_amount_minor = null
    else if (typeof v.vendorAmountMinor !== 'string' || !MINOR.test(v.vendorAmountMinor) || BigInt(v.vendorAmountMinor) > PG_BIGINT_MAX)
      problems.vendorAmountMinor = ['Nominal vendor harus angka bulat ≥ 0, dikirim sebagai teks (contoh "1500000").']
    else out.vendor_amount_minor = v.vendorAmountMinor
  }
  return out
}

/** A vendor amount needs a vendor; clearing the vendor clears its amount. */
function checkVendor(values: Record<string, unknown>, current: { vendor_id: string | null; vendor_amount_minor: string | null }, problems: FieldErrors) {
  const vendor = 'vendor_id' in values ? values.vendor_id : current.vendor_id
  if (vendor === null && 'vendor_id' in values) values.vendor_amount_minor = null
  const amount = 'vendor_amount_minor' in values ? values.vendor_amount_minor : current.vendor_amount_minor
  if (amount !== null && vendor === null && !problems.vendorId) problems.vendorAmountMinor = ['Nominal vendor hanya bisa diisi bila vendor dipilih.']
}

export async function createItineraryItem(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const values = await cleanItem(tx, projectId, input, problems)
  if (input.date === undefined) problems.date = ['Tanggal wajib diisi dengan format YYYY-MM-DD.']
  if (input.title === undefined) problems.title = ['Judul wajib diisi.']
  checkVendor(values, { vendor_id: null, vendor_amount_minor: null }, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'ITIN-')
  const cols = ['id', 'project_id', ...Object.keys(values)]
  await tx.query(`insert into itinerary_items (${cols.join(', ')}, changed_by_api_at) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}, now())`,
    [id, projectId, ...Object.values(values)])
  await recordAudit(tx, { action: 'itinerary_item.created', actorUserId: actor.userId, entityType: 'itinerary_item', entityId: id, requestId, after: { projectId, ...values } })
  return { id }
}

async function lockItem(tx: Queryable, id: string) {
  const [row] = await tx.query<{ project_id: string; vendor_id: string | null; vendor_amount_minor: string | null }>(
    'select project_id, vendor_id, vendor_amount_minor::text as vendor_amount_minor from itinerary_items where id = $1 for update', [id])
  if (!row) throw errors.notFound('Item itinerary')
  return row
}

export async function updateItineraryItem(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string) {
  const current = await lockItem(tx, id)
  const problems: FieldErrors = {}
  const values = await cleanItem(tx, current.project_id, input, problems)
  checkVendor(values, current, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const cols = Object.keys(values)
  if (!cols.length) return
  await tx.query(`update itinerary_items set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, changed_by_api_at = now(), updated_at = now() where id = $1`,
    [id, ...Object.values(values)])
  await recordAudit(tx, { action: 'itinerary_item.updated', actorUserId: actor.userId, entityType: 'itinerary_item', entityId: id, requestId, after: values })
}

export async function deleteItineraryItem(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const current = await lockItem(tx, id)
  await tx.query('delete from itinerary_items where id = $1', [id])
  await recordAudit(tx, { action: 'itinerary_item.deleted', actorUserId: actor.userId, entityType: 'itinerary_item', entityId: id, requestId, before: { projectId: current.project_id } })
}
