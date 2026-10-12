import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { isIsoDate } from '../../shared/dates'
import { nextId, type IdPrefix } from '../../shared/ids'
import { parseAmountMinor } from '../../shared/money'

/**
 * Inventory (S11a): MANOVA-owned assets, their maintenance and checkouts. `in-use` is set only by a checkout, and an
 * asset is lent out at most once at a time. 'overdue' is never stored: an open checkout past its due date and an
 * unfinished maintenance past its date are reported as overdue from today's date. Admin and Super Admin write
 * (`inventory.manage-asset`). Asset values are operational figures, not Finance bookkeeping.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v === null || v === undefined ? null : String(v).slice(0, 10))

export const CATEGORIES = ['camera', 'production', 'property', 'vehicle', 'it'] as const
const CONDITIONS = ['excellent', 'good', 'needs-service', 'damaged']
const MANUAL_STATUSES = ['available', 'maintenance', 'retired']
const MAINTENANCE_TYPES = ['routine', 'repair', 'calibration', 'inspection']
const CODE_PREFIX: Record<(typeof CATEGORIES)[number], IdPrefix> = { camera: 'CAM-', production: 'PRD-', property: 'PRP-', vehicle: 'VHC-', it: 'IT-' }

/* ---------- reads ---------- */

export async function listAssets(db: Queryable, id?: string) {
  const rows = await db.query<Record<string, unknown>>(
    `select * from assets where ($1::text is null or id = $1) order by length(id), id`, [id ?? null])
  return rows.map(r => ({
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    category: r.category as string,
    brand: str(r.brand),
    serialNumber: str(r.serial_number),
    purchasedOn: day(r.purchased_on)!,
    purchasePriceMinor: str(r.purchase_price_minor),
    condition: r.condition as string,
    status: r.status as string,
    location: r.location as string,
    quantity: Number(r.quantity),
    note: str(r.note)
  }))
}

export async function listMaintenance(db: Queryable, id?: string) {
  const rows = await db.query<Record<string, unknown>>(
    `select *, (status <> 'completed' and scheduled_on < current_date) as overdue from asset_maintenance
      where ($1::text is null or id = $1) order by scheduled_on desc, id`, [id ?? null])
  return rows.map(r => ({
    id: r.id as string,
    assetId: r.asset_id as string,
    type: r.type as string,
    scheduledOn: day(r.scheduled_on)!,
    completedOn: day(r.completed_on),
    status: r.overdue ? 'overdue' : r.status as string,
    vendorName: str(r.vendor_name),
    costMinor: str(r.cost_minor),
    note: str(r.note),
    intervalDays: r.interval_days === null ? null : Number(r.interval_days)
  }))
}

export async function listCheckouts(db: Queryable, id?: string) {
  const rows = await db.query<Record<string, unknown>>(
    `select *, (status = 'checked-out' and due_on < current_date) as overdue from asset_checkouts
      where ($1::text is null or id = $1) order by checked_out_on desc, id`, [id ?? null])
  return rows.map(r => ({
    id: r.id as string,
    assetId: r.asset_id as string,
    projectId: str(r.project_id),
    borrowedBy: r.borrowed_by as string,
    checkedOutOn: day(r.checked_out_on)!,
    dueOn: day(r.due_on)!,
    returnedOn: day(r.returned_on),
    status: r.overdue ? 'overdue' : r.status as string,
    conditionOnReturn: str(r.condition_on_return),
    note: str(r.note)
  }))
}

/** Assets still out for a project — the closing gate (S11a). */
export async function outstandingProjectAssets(db: Queryable, projectId: string): Promise<string[]> {
  const rows = await db.query<{ name: string }>(
    `select a.name from asset_checkouts c join assets a on a.id = c.asset_id where c.project_id = $1 and c.status = 'checked-out' order by a.name`, [projectId])
  return rows.map(r => r.name)
}

/* ---------- validation ---------- */

type Input = Record<string, unknown>

function unknownKeys(input: Input, allowed: string[], fe: FieldErrors) {
  for (const k of Object.keys(input)) if (!allowed.includes(k)) fe[k] = ['Field ini tidak dikenal atau tidak bisa diubah di sini.']
}
function text(input: Input, key: string, fe: FieldErrors, required: boolean, max = 200): string | null | undefined {
  const v = input[key]
  if (v === undefined) { if (required) fe[key] = ['Wajib diisi.']; return undefined }
  if (v === null || v === '') { if (required) fe[key] = ['Wajib diisi.']; return null }
  if (typeof v !== 'string') { fe[key] = ['Harus berupa teks.']; return undefined }
  const s = v.trim()
  if (!s) { if (required) fe[key] = ['Wajib diisi.']; return null }
  if (s.length > max) { fe[key] = [`Maksimal ${max} karakter.`]; return undefined }
  return s
}
function oneOf(input: Input, key: string, values: readonly string[], fe: FieldErrors, required: boolean): string | undefined {
  const v = input[key]
  if (v === undefined) { if (required) fe[key] = ['Wajib diisi.']; return undefined }
  if (typeof v !== 'string' || !values.includes(v)) { fe[key] = [`Pilih salah satu: ${values.join(', ')}.`]; return undefined }
  return v
}
function date(input: Input, key: string, fe: FieldErrors, required: boolean): string | undefined {
  const v = input[key]
  if (v === undefined || v === null || v === '') { if (required) fe[key] = ['Wajib diisi.']; return undefined }
  if (typeof v !== 'string' || !isIsoDate(v)) { fe[key] = ['Tanggal harus berformat YYYY-MM-DD.']; return undefined }
  return v
}
function money(input: Input, key: string, fe: FieldErrors): bigint | null | undefined {
  const v = input[key]
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  try { return parseAmountMinor(v, key, { allowZero: true }) } catch (e) {
    if (e instanceof AppError) { Object.assign(fe, e.extra.fieldErrors); return undefined }
    throw e
  }
}
function int(input: Input, key: string, fe: FieldErrors, min: number, max: number, required: boolean): number | null | undefined {
  const v = input[key]
  if (v === undefined) { if (required) fe[key] = ['Wajib diisi.']; return undefined }
  if (v === null || v === '') { if (required) fe[key] = ['Wajib diisi.']; return null }
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) { fe[key] = [`Harus bilangan bulat ${min}–${max}.`]; return undefined }
  return v
}
const done = (fe: FieldErrors) => { if (Object.keys(fe).length) throw errors.validation(fe) }

/* ---------- assets ---------- */

const ASSET_FIELDS = ['name', 'category', 'brand', 'serialNumber', 'purchasedOn', 'purchasePriceMinor', 'condition', 'status', 'location', 'quantity', 'note']

export async function createAsset(tx: Queryable, actor: Actor, input: Input, requestId: string) {
  const fe: FieldErrors = {}
  unknownKeys(input, ASSET_FIELDS, fe)
  const v = {
    name: text(input, 'name', fe, true),
    category: oneOf(input, 'category', CATEGORIES, fe, true) as (typeof CATEGORIES)[number] | undefined,
    brand: text(input, 'brand', fe, false),
    serialNumber: text(input, 'serialNumber', fe, false),
    purchasedOn: date(input, 'purchasedOn', fe, true),
    price: money(input, 'purchasePriceMinor', fe),
    condition: oneOf(input, 'condition', CONDITIONS, fe, true),
    status: input.status === undefined ? 'available' : oneOf(input, 'status', MANUAL_STATUSES, fe, true),
    location: text(input, 'location', fe, true),
    quantity: int(input, 'quantity', fe, 1, 100_000, true),
    note: text(input, 'note', fe, false, 2000)
  }
  done(fe)
  const id = await nextId(tx, 'AST-')
  const code = await nextId(tx, CODE_PREFIX[v.category!])
  await tx.query(
    `insert into assets (id, code, name, category, brand, serial_number, purchased_on, purchase_price_minor, condition, status, location, quantity, note, changed_by_api_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())`,
    [id, code, v.name, v.category, v.brand ?? null, v.serialNumber ?? null, v.purchasedOn, v.price?.toString() ?? null, v.condition, v.status, v.location, v.quantity, v.note ?? null])
  await recordAudit(tx, { action: 'asset.created', actorUserId: actor.userId, entityType: 'asset', entityId: id, requestId, after: { code, name: v.name, category: v.category } })
  return { id }
}

const COLUMN: Record<string, string> = {
  name: 'name', brand: 'brand', serialNumber: 'serial_number', purchasedOn: 'purchased_on', purchasePriceMinor: 'purchase_price_minor',
  condition: 'condition', status: 'status', location: 'location', quantity: 'quantity', note: 'note'
}

export async function updateAsset(tx: Queryable, actor: Actor, id: string, input: Input, requestId: string) {
  const [a] = await tx.query<{ status: string; name: string }>('select status, name from assets where id = $1 for update', [id])
  if (!a) throw errors.notFound('Aset')
  const fe: FieldErrors = {}
  unknownKeys(input, ASSET_FIELDS.filter(k => k !== 'category'), fe)
  const patch: Record<string, unknown> = {}
  const set = (k: string, value: unknown) => { if (value !== undefined) patch[k] = value }
  set('name', text(input, 'name', fe, false))
  if (patch.name === null) fe.name = ['Wajib diisi.']
  set('brand', text(input, 'brand', fe, false))
  set('serialNumber', text(input, 'serialNumber', fe, false))
  if (input.purchasedOn !== undefined) set('purchasedOn', date(input, 'purchasedOn', fe, true))
  const price = money(input, 'purchasePriceMinor', fe)
  if (price !== undefined) patch.purchasePriceMinor = price === null ? null : price.toString()
  set('condition', input.condition === undefined ? undefined : oneOf(input, 'condition', CONDITIONS, fe, true))
  set('status', input.status === undefined ? undefined : oneOf(input, 'status', MANUAL_STATUSES, fe, true))
  set('location', text(input, 'location', fe, false))
  if (patch.location === null) fe.location = ['Wajib diisi.']
  set('quantity', input.quantity === undefined ? undefined : int(input, 'quantity', fe, 1, 100_000, true))
  set('note', text(input, 'note', fe, false, 2000))
  done(fe)
  if (patch.status !== undefined && a.status === 'in-use') throw rule(`"${a.name}" sedang dipinjam. Kembalikan dulu sebelum mengubah statusnya.`)
  const keys = Object.keys(patch)
  if (keys.length) {
    await tx.query(
      `update assets set ${keys.map((k, i) => `${COLUMN[k]} = $${i + 2}`).join(', ')}, changed_by_api_at = now(), updated_at = now() where id = $1`,
      [id, ...keys.map(k => patch[k])])
  }
  await recordAudit(tx, { action: 'asset.updated', actorUserId: actor.userId, entityType: 'asset', entityId: id, requestId, after: patch })
}

/* ---------- checkouts ---------- */

export async function checkoutAsset(tx: Queryable, actor: Actor, input: Input, requestId: string) {
  const fe: FieldErrors = {}
  unknownKeys(input, ['assetId', 'projectId', 'borrowedBy', 'dueOn', 'note'], fe)
  const assetId = text(input, 'assetId', fe, true)
  const projectId = text(input, 'projectId', fe, false)
  const borrowedBy = text(input, 'borrowedBy', fe, false) ?? actor.userId
  const dueOn = date(input, 'dueOn', fe, true)
  const note = text(input, 'note', fe, false, 2000)
  done(fe)
  const [{ today }] = await tx.query<{ today: string }>("select to_char(current_date, 'YYYY-MM-DD') as today") as [{ today: string }]
  if (dueOn! < today) throw errors.validation({ dueOn: ['Tanggal kembali tidak boleh sebelum hari ini.'] })

  const [a] = await tx.query<{ status: string; name: string }>('select status, name from assets where id = $1 for update', [assetId])
  if (!a) throw rule('Aset tidak ditemukan.')
  if (a.status !== 'available') throw rule(`"${a.name}" tidak tersedia untuk dipinjam (status ${a.status}).`)
  if (projectId) {
    const [p] = await tx.query<{ closed_at: unknown }>('select closed_at from projects where id = $1', [projectId])
    if (!p) throw rule('Project tidak ditemukan.')
    if (p.closed_at) throw rule('Project ini sudah ditutup.')
  }
  const [u] = await tx.query("select 1 from users where id = $1 and status = 'active' and role not in ('client', 'vendor')", [borrowedBy])
  if (!u) throw rule('Peminjam harus user internal yang aktif.')

  const id = await nextId(tx, 'ACO-')
  await tx.query(
    `insert into asset_checkouts (id, asset_id, project_id, borrowed_by, checked_out_on, due_on, status, note, changed_by_api_at)
     values ($1, $2, $3, $4, current_date, $5, 'checked-out', $6, now())`,
    [id, assetId, projectId ?? null, borrowedBy, dueOn, note ?? null])
  await tx.query("update assets set status = 'in-use', updated_at = now() where id = $1", [assetId])
  await recordAudit(tx, { action: 'asset.checked_out', actorUserId: actor.userId, entityType: 'asset', entityId: assetId, requestId,
    details: { checkoutId: id, projectId: projectId ?? null, borrowedBy, dueOn } })
  return { id }
}

export async function returnAsset(tx: Queryable, actor: Actor, id: string, input: Input, requestId: string) {
  const fe: FieldErrors = {}
  unknownKeys(input, ['condition', 'note'], fe)
  const condition = oneOf(input, 'condition', CONDITIONS, fe, true)
  done(fe)
  const [co] = await tx.query<{ asset_id: string; status: string }>('select asset_id, status from asset_checkouts where id = $1 for update', [id])
  if (!co) throw errors.notFound('Peminjaman aset')
  if (co.status === 'returned') throw rule('Aset ini sudah dikembalikan.')
  await tx.query(
    "update asset_checkouts set status = 'returned', returned_on = current_date, condition_on_return = $2, changed_by_api_at = now(), updated_at = now() where id = $1",
    [id, condition])
  await tx.query('update assets set condition = $2, status = $3, updated_at = now() where id = $1',
    [co.asset_id, condition, condition === 'damaged' ? 'maintenance' : 'available'])
  await recordAudit(tx, { action: 'asset.returned', actorUserId: actor.userId, entityType: 'asset', entityId: co.asset_id, requestId, details: { checkoutId: id, condition } })
}

/* ---------- maintenance ---------- */

export async function scheduleMaintenance(tx: Queryable, actor: Actor, input: Input, requestId: string) {
  const fe: FieldErrors = {}
  unknownKeys(input, ['assetId', 'type', 'scheduledOn', 'vendorName', 'costMinor', 'note', 'intervalDays'], fe)
  const assetId = text(input, 'assetId', fe, true)
  const type = oneOf(input, 'type', MAINTENANCE_TYPES, fe, true)
  const scheduledOn = date(input, 'scheduledOn', fe, true)
  const vendorName = text(input, 'vendorName', fe, false)
  const cost = money(input, 'costMinor', fe)
  const note = text(input, 'note', fe, false, 2000)
  const intervalDays = int(input, 'intervalDays', fe, 1, 3650, false)
  done(fe)
  const [a] = await tx.query('select 1 from assets where id = $1', [assetId])
  if (!a) throw rule('Aset tidak ditemukan.')
  const id = await nextId(tx, 'MNT-')
  await tx.query(
    `insert into asset_maintenance (id, asset_id, type, scheduled_on, status, vendor_name, cost_minor, note, interval_days, changed_by_api_at)
     values ($1, $2, $3, $4, 'scheduled', $5, $6, $7, $8, now())`,
    [id, assetId, type, scheduledOn, vendorName ?? null, cost?.toString() ?? null, note ?? null, intervalDays ?? null])
  await recordAudit(tx, { action: 'asset_maintenance.scheduled', actorUserId: actor.userId, entityType: 'asset', entityId: assetId, requestId, details: { maintenanceId: id, type, scheduledOn } })
  return { id }
}

export async function completeMaintenance(tx: Queryable, actor: Actor, id: string, requestId: string) {
  const [m] = await tx.query<{ asset_id: string; status: string }>('select asset_id, status from asset_maintenance where id = $1 for update', [id])
  if (!m) throw errors.notFound('Jadwal maintenance')
  if (m.status === 'completed') throw rule('Maintenance ini sudah selesai.')
  await tx.query("update asset_maintenance set status = 'completed', completed_on = current_date, changed_by_api_at = now(), updated_at = now() where id = $1", [id])
  await tx.query("update assets set status = 'available', condition = 'good', updated_at = now() where id = $1 and status = 'maintenance'", [m.asset_id])
  await recordAudit(tx, { action: 'asset_maintenance.completed', actorUserId: actor.userId, entityType: 'asset', entityId: m.asset_id, requestId, details: { maintenanceId: id } })
}
