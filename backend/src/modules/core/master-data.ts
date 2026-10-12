import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId, type IdPrefix } from '../../shared/ids'

/**
 * Master data (S10b): 16 reference categories in one table, the fields of each category validated here, and the
 * organization profile (a singleton). Admin and Super Admin write (`admin.manage-master-data`). The categories are
 * references and configuration only: no booking, invoice or ID counter reads them as a rule.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v))

type Field =
  | { key: string; kind: 'text' | 'long'; required: boolean }
  | { key: string; kind: 'code'; pattern: RegExp; hint: string }
  | { key: string; kind: 'int' | 'number'; min: number; max: number; required: boolean }

const text = (key: string, required = true): Field => ({ key, kind: 'text', required })
const long = (key: string, required = true): Field => ({ key, kind: 'long', required })
const int = (key: string, min: number, max: number, required = true): Field => ({ key, kind: 'int', min, max, required })
const percent = (key: string): Field => ({ key, kind: 'number', min: 0, max: 100, required: true })
const labelled: Field[] = [text('label'), long('description', false)]

export const CATEGORIES = {
  'project-type': { prefix: 'PT-', label: 'Tipe Project', fields: labelled },
  'service-type': { prefix: 'ST-', label: 'Tipe Layanan', fields: labelled },
  destination: { prefix: 'DST-', label: 'Destinasi', fields: labelled },
  'vendor-category': { prefix: 'VC-', label: 'Kategori Vendor', fields: labelled },
  airport: { prefix: 'APT-', label: 'Airport', fields: [{ key: 'iataCode', kind: 'code', pattern: /^[A-Z]{3}$/, hint: 'Kode IATA bandara 3 huruf.' }, text('name'), text('city')] },
  airline: { prefix: 'ALN-', label: 'Airline', fields: [{ key: 'iataCode', kind: 'code', pattern: /^[A-Z0-9]{2}$/, hint: 'Kode IATA maskapai 2 karakter.' }, text('name')] },
  hotel: { prefix: 'MHTL-', label: 'Hotel', fields: [text('name'), text('city'), int('starRating', 1, 5, false)] },
  currency: { prefix: 'CUR-', label: 'Currency', fields: [{ key: 'code', kind: 'code', pattern: /^[A-Z]{3}$/, hint: 'Kode currency 3 huruf.' }, text('name'), text('symbol')] },
  'tax-rule': { prefix: 'TAX-', label: 'Tax Rule', fields: [text('name'), percent('ratePercent'), text('appliesTo')] },
  'payment-term': { prefix: 'PTM-', label: 'Payment Term', fields: [text('label'), int('daysDue', 0, 365)] },
  'cancellation-rule': { prefix: 'CXR-', label: 'Cancellation Rule', fields: [text('name'), int('daysBeforeDeparture', 0, 365), percent('penaltyPercent'), text('appliesToBookingType')] },
  'numbering-scheme': { prefix: 'NUM-', label: 'Numbering Scheme', fields: [text('entityType'), text('prefix'), text('nextNumberPreview')] },
  'document-template': { prefix: 'DTPL-', label: 'Document Template', fields: [text('name'), text('category'), text('appliesToDocumentCategory'), long('bodyPreview')] },
  'readiness-gate': { prefix: 'RGC-', label: 'Readiness Gate', fields: [text('name'), long('description'), text('appliesToModule')] },
  'assignment-rule': { prefix: 'ASR-', label: 'Assignment Rule', fields: [text('name'), long('description'), text('triggerCondition'), text('targetRole')] },
  'milestone-template': { prefix: 'MTPL-', label: 'Milestone Template', fields: labelled }
} satisfies Record<string, { prefix: IdPrefix; label: string; fields: Field[] }>

export type MasterCategory = keyof typeof CATEGORIES
export const isMasterCategory = (v: string): v is MasterCategory => Object.hasOwn(CATEGORIES, v)

const MAX = { text: 200, long: 2000 }

/** Builds the stored `data` from a full set of values; unknown keys, wrong types and out-of-range numbers are 400. */
function validateRecord(category: MasterCategory, input: Record<string, unknown>, id: string): Record<string, unknown> {
  const fields: Field[] = CATEGORIES[category].fields
  const known = new Set(fields.map(f => f.key))
  if (category === 'milestone-template') known.add('items')
  const fe: FieldErrors = {}
  const data: Record<string, unknown> = {}
  for (const k of Object.keys(input)) if (!known.has(k)) fe[k] = ['Field ini tidak dikenal.']
  for (const f of fields) {
    const v = input[f.key]
    if (f.kind === 'text' || f.kind === 'long') {
      const s = typeof v === 'string' ? v.trim() : v === undefined || v === null ? '' : null
      if (s === null) fe[f.key] = ['Harus berupa teks.']
      else if (!s) { if (f.required) fe[f.key] = ['Wajib diisi.'] }
      else if (s.length > MAX[f.kind]) fe[f.key] = [`Maksimal ${MAX[f.kind]} karakter.`]
      else data[f.key] = s
    } else if (f.kind === 'code') {
      const s = typeof v === 'string' ? v.trim().toUpperCase() : ''
      if (!s) fe[f.key] = ['Wajib diisi.']
      else if (!f.pattern.test(s)) fe[f.key] = [f.hint]
      else data[f.key] = s
    } else if (f.kind === 'int' || f.kind === 'number') {
      if (v === undefined || v === null || v === '') { if (f.required) fe[f.key] = ['Wajib diisi.']; continue }
      if (typeof v !== 'number' || !Number.isFinite(v) || (f.kind === 'int' && !Number.isInteger(v))) fe[f.key] = [f.kind === 'int' ? 'Harus bilangan bulat.' : 'Harus berupa angka.']
      else if (v < f.min || v > f.max) fe[f.key] = [`Harus antara ${f.min} dan ${f.max}.`]
      else data[f.key] = v
    }
  }
  if (category === 'milestone-template') {
    const items = input.items
    if (!Array.isArray(items) || items.length === 0) fe.items = ['Minimal satu milestone.']
    else if (items.length > 50) fe.items = ['Maksimal 50 milestone.']
    else {
      const out: { id: string; label: string; offsetDays: number }[] = []
      items.forEach((item, i) => {
        const it = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        const label = typeof it.label === 'string' ? it.label.trim() : ''
        const offset = it.offsetDays
        if (!label || label.length > MAX.text) fe[`items.${i}.label`] = ['Nama milestone wajib diisi (maks 200 karakter).']
        if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < -365 || offset > 365) fe[`items.${i}.offsetDays`] = ['Offset hari harus bilangan bulat −365 s.d. 365.']
        out.push({ id: `${id}-${i + 1}`, label, offsetDays: offset as number })
      })
      data.items = out
    }
  }
  if (Object.keys(fe).length) throw errors.validation(fe)
  return data
}

const codeKey = (category: MasterCategory) => (category === 'currency' ? 'code' : category === 'airport' || category === 'airline' ? 'iataCode' : null)

async function assertCodeFree(tx: Queryable, category: MasterCategory, data: Record<string, unknown>, id: string) {
  const key = codeKey(category)
  if (!key) return
  const taken = await tx.query("select 1 from master_data_records where category = $1 and data->>$2 = $3 and id <> $4", [category, key, data[key], id])
  if (taken.length) throw rule(`Kode ${String(data[key])} sudah dipakai di ${CATEGORIES[category].label}.`)
}

const view = (r: Record<string, unknown>) => ({
  id: r.id as string,
  category: r.category as MasterCategory,
  isActive: r.is_active as boolean,
  data: r.data as Record<string, unknown>,
  updatedAt: iso(r.updated_at)
})

export async function listMasterData(db: Queryable, id?: string) {
  const rows = await db.query<Record<string, unknown>>(
    `select id, category, is_active, data, updated_at from master_data_records where ($1::text is null or id = $1)
      order by category, length(id), id`, [id ?? null])
  return rows.map(view)
}

async function lockRecord(tx: Queryable, category: MasterCategory, id: string) {
  const [r] = await tx.query<{ is_active: boolean; data: Record<string, unknown> }>(
    'select is_active, data from master_data_records where id = $1 and category = $2 for update', [id, category])
  if (!r) throw errors.notFound(CATEGORIES[category].label)
  return r
}

const auditBase = (actor: Actor, id: string, requestId: string) => ({ actorUserId: actor.userId, entityType: 'master_data', entityId: id, requestId })

export async function createMasterRecord(tx: Queryable, actor: Actor, category: MasterCategory, input: Record<string, unknown>, requestId: string) {
  const id = await nextId(tx, CATEGORIES[category].prefix)
  const data = validateRecord(category, input, id)
  await assertCodeFree(tx, category, data, id)
  await tx.query("insert into master_data_records (id, category, data, changed_by_api_at) values ($1, $2, $3::text::jsonb, now())", [id, category, JSON.stringify(data)])
  await recordAudit(tx, { action: 'master_data.created', ...auditBase(actor, id, requestId), details: { category }, after: data })
  return { id }
}

export async function updateMasterRecord(tx: Queryable, actor: Actor, category: MasterCategory, id: string, patch: Record<string, unknown>, requestId: string) {
  const current = await lockRecord(tx, category, id)
  if ('isActive' in patch) throw errors.validation({ isActive: ['Ubah status lewat Nonaktifkan / Aktifkan kembali.'] })
  const data = validateRecord(category, { ...current.data, ...patch }, id)
  await assertCodeFree(tx, category, data, id)
  if (category === 'currency' && current.is_active && data.code !== current.data.code) await assertNotProfileCurrency(tx, String(current.data.code))
  await tx.query("update master_data_records set data = $2::text::jsonb, changed_by_api_at = now(), updated_at = now() where id = $1", [id, JSON.stringify(data)])
  await recordAudit(tx, { action: 'master_data.updated', ...auditBase(actor, id, requestId), details: { category }, before: current.data, after: data })
}

async function assertNotProfileCurrency(tx: Queryable, code: string) {
  const used = await tx.query('select 1 from organization_profile where default_currency_code = $1', [code])
  if (used.length) throw rule(`Currency ${code} dipakai sebagai currency default Profil Organisasi. Ganti dulu di Profil Organisasi.`)
}

export async function setMasterRecordActive(tx: Queryable, actor: Actor, category: MasterCategory, id: string, active: boolean, requestId: string) {
  const current = await lockRecord(tx, category, id)
  if (current.is_active === active) throw rule(active ? 'Data ini sudah aktif.' : 'Data ini sudah nonaktif.')
  if (!active && category === 'currency') await assertNotProfileCurrency(tx, String(current.data.code))
  await tx.query('update master_data_records set is_active = $2, changed_by_api_at = now(), updated_at = now() where id = $1', [id, active])
  await recordAudit(tx, { action: active ? 'master_data.reactivated' : 'master_data.deactivated', ...auditBase(actor, id, requestId), details: { category } })
}

/* ---------- Organization profile ---------- */

const PROFILE_TEXT = { legalName: true, displayName: true, address: true, businessHours: false, contactPhone: false } as const
const PROFILE_KEYS = new Set([...Object.keys(PROFILE_TEXT), 'defaultCurrencyCode', 'contactEmail'])
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function getOrganizationProfile(db: Queryable) {
  const [r] = await db.query<Record<string, unknown>>('select * from organization_profile where id = $1', ['ORG-001'])
  if (!r) return null
  return {
    id: r.id as string,
    legalName: r.legal_name as string,
    displayName: r.display_name as string,
    address: r.address as string,
    defaultCurrencyCode: r.default_currency_code as string,
    businessHours: r.business_hours as string,
    contactEmail: r.contact_email as string,
    contactPhone: r.contact_phone as string,
    updatedAt: iso(r.updated_at),
    updatedBy: (r.updated_by as string | null) ?? null
  }
}

export async function updateOrganizationProfile(tx: Queryable, actor: Actor, input: Record<string, unknown>, requestId: string) {
  const fe: FieldErrors = {}
  for (const k of Object.keys(input)) if (!PROFILE_KEYS.has(k)) fe[k] = ['Field ini tidak dikenal.']
  const v: Record<string, string> = {}
  for (const [k, required] of Object.entries(PROFILE_TEXT)) {
    const s = typeof input[k] === 'string' ? (input[k] as string).trim() : ''
    if (input[k] !== undefined && input[k] !== null && typeof input[k] !== 'string') fe[k] = ['Harus berupa teks.']
    else if (required && !s) fe[k] = ['Wajib diisi.']
    else if (s.length > (k === 'address' ? MAX.long : MAX.text)) fe[k] = ['Terlalu panjang.']
    v[k] = s
  }
  const email = typeof input.contactEmail === 'string' ? input.contactEmail.trim() : ''
  if (!EMAIL.test(email) || email.length > MAX.text) fe.contactEmail = ['Email kontak tidak valid.']
  const currency = typeof input.defaultCurrencyCode === 'string' ? input.defaultCurrencyCode.trim().toUpperCase() : ''
  if (!/^[A-Z]{3}$/.test(currency)) fe.defaultCurrencyCode = ['Kode currency 3 huruf.']
  if (Object.keys(fe).length) throw errors.validation(fe)

  const active = await tx.query("select 1 from master_data_records where category = 'currency' and is_active and data->>'code' = $1", [currency])
  if (!active.length) throw rule(`Currency ${currency} tidak ada atau nonaktif di Master Data.`)
  const before = await getOrganizationProfile(tx)
  await tx.query(
    `insert into organization_profile (id, legal_name, display_name, address, default_currency_code, business_hours, contact_email,
                                       contact_phone, updated_by, changed_by_api_at, updated_at)
     values ('ORG-001', $1, $2, $3, $4, $5, $6, $7, $8, now(), now())
     on conflict (id) do update set legal_name = excluded.legal_name, display_name = excluded.display_name, address = excluded.address,
       default_currency_code = excluded.default_currency_code, business_hours = excluded.business_hours,
       contact_email = excluded.contact_email, contact_phone = excluded.contact_phone, updated_by = excluded.updated_by,
       changed_by_api_at = now(), updated_at = now()`,
    [v.legalName, v.displayName, v.address, currency, v.businessHours, email, v.contactPhone, actor.userId])
  const { updatedAt: _a, updatedBy: _b, ...after } = (await getOrganizationProfile(tx))!
  await recordAudit(tx, { action: 'organization.updated', actorUserId: actor.userId, entityType: 'organization', entityId: 'ORG-001', requestId,
    before: before ? { ...before, updatedAt: undefined, updatedBy: undefined } : null, after })
}
