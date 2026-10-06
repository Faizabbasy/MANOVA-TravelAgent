import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { parseAmountMinor } from '../../shared/money'

/**
 * Vendor writes (S2): profile, contact persons, product catalog and document records. Documents are metadata
 * only (no file storage yet — ADR-005). Vendor quotations, activities and service orders stay in procurement.
 */

export const VENDOR_SERVICE_TYPES = ['flight', 'hotel', 'transportation', 'mice', 'additional'] as const
export const VENDOR_STATUSES = ['active', 'inactive', 'pending'] as const
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_PRICE = 1_000_000_000_000_000n

function requiredText(value: unknown, field: string, label: string, problems: FieldErrors, max = 200): string | undefined {
  const s = typeof value === 'string' ? value.trim() : ''
  if (!s) { problems[field] = [`${label} wajib diisi.`]; return undefined }
  if (s.length > max) { problems[field] = [`Maksimal ${max} karakter.`]; return undefined }
  return s
}

function optionalText(value: unknown, field: string, problems: FieldErrors, max = 200): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') { problems[field] = ['Harus teks.']; return undefined }
  const s = value.trim()
  if (s.length > max) { problems[field] = [`Maksimal ${max} karakter.`]; return undefined }
  return s || null
}

function oneOf<T extends string>(value: unknown, list: readonly T[], field: string, message: string, problems: FieldErrors): T | undefined {
  if ((list as readonly unknown[]).includes(value)) return value as T
  problems[field] = [message]
  return undefined
}

export async function createVendor(tx: Queryable, actor: Actor, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const name = requiredText(input.name, 'name', 'Nama vendor', problems)
  const serviceType = oneOf(input.serviceType, VENDOR_SERVICE_TYPES, 'serviceType', 'Jenis layanan tidak dikenal.', problems)
  const contactName = requiredText(input.contactName, 'contactName', 'Nama kontak', problems)
  const status = input.status === undefined ? 'active' : oneOf(input.status, VENDOR_STATUSES, 'status', 'Status harus active, inactive, atau pending.', problems)
  const contactPhone = optionalText(input.contactPhone, 'contactPhone', problems, 50)
  const category = optionalText(input.category, 'category', problems)
  if (Object.keys(problems).length) throw errors.validation(problems)

  const id = await nextId(tx, 'VND-')
  await tx.query(
    'insert into vendors (id, name, service_type, status, contact_name, contact_phone, category) values ($1, $2, $3, $4, $5, $6, $7)',
    [id, name, serviceType, status, contactName, contactPhone ?? null, category ?? null]
  )
  await recordAudit(tx, {
    action: 'vendor.created', actorUserId: actor.userId, entityType: 'vendor', entityId: id, requestId,
    after: { name, serviceType, status, contactName, contactPhone: contactPhone ?? null, category: category ?? null }
  })
  return { id }
}

const PATCH_COLUMNS: Record<string, string> = { name: 'name', status: 'status', contactName: 'contact_name', contactPhone: 'contact_phone', category: 'category' }
const FORBIDDEN_PATCH = ['id', 'serviceType', 'provenance']

export async function updateVendor(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string): Promise<void> {
  const blocked = Object.keys(input).filter(k => FORBIDDEN_PATCH.includes(k))
  if (blocked.length) throw errors.validation(Object.fromEntries(blocked.map(k => [k, ['Tidak bisa diubah lewat edit vendor.']])))
  const [current] = await tx.query<Record<string, unknown>>('select name, status, contact_name, contact_phone, category from vendors where id = $1 for update', [id])
  if (!current) throw errors.notFound('Vendor')
  const problems: FieldErrors = {}
  const next: Record<string, unknown> = {}
  if (input.name !== undefined) next.name = requiredText(input.name, 'name', 'Nama vendor', problems)
  if (input.contactName !== undefined) next.contactName = requiredText(input.contactName, 'contactName', 'Nama kontak', problems)
  if (input.status !== undefined) next.status = oneOf(input.status, VENDOR_STATUSES, 'status', 'Status harus active, inactive, atau pending.', problems)
  const phone = optionalText(input.contactPhone, 'contactPhone', problems, 50)
  if (phone !== undefined) next.contactPhone = phone
  const category = optionalText(input.category, 'category', problems)
  if (category !== undefined) next.category = category
  if (Object.keys(problems).length) throw errors.validation(problems)
  const keys = Object.keys(next)
  if (!keys.length) return
  await tx.query(`update vendors set ${keys.map((k, i) => `${PATCH_COLUMNS[k]} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`, [id, ...Object.values(next)])
  await recordAudit(tx, {
    action: 'vendor.updated', actorUserId: actor.userId, entityType: 'vendor', entityId: id, requestId,
    before: Object.fromEntries(keys.map(k => [k, current[PATCH_COLUMNS[k]!]])), after: next
  })
}

export async function createVendorContact(tx: Queryable, actor: Actor, vendorId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const name = requiredText(input.name, 'name', 'Nama kontak', problems)
  const title = requiredText(input.title, 'title', 'Jabatan', problems)
  const email = optionalText(input.email, 'email', problems)
  if (email && !EMAIL.test(email)) problems.email = ['Format email tidak valid.']
  const phone = optionalText(input.phone, 'phone', problems, 50)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'VCT-')
  await tx.query('insert into vendor_contacts (id, vendor_id, name, title, email, phone) values ($1, $2, $3, $4, $5, $6)', [id, vendorId, name, title, email ?? null, phone ?? null])
  await recordAudit(tx, { action: 'vendor.contact_created', actorUserId: actor.userId, entityType: 'vendor', entityId: vendorId, requestId, after: { contactId: id, name, title } })
  return { id }
}

export async function createVendorProduct(tx: Queryable, actor: Actor, vendorId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const name = requiredText(input.name, 'name', 'Nama produk', problems)
  const category = oneOf(input.category, VENDOR_SERVICE_TYPES, 'category', 'Kategori tidak dikenal.', problems)
  const description = optionalText(input.description, 'description', problems, 1000)
  let price: bigint | null = null
  if (input.priceMinor !== undefined && input.priceMinor !== null && input.priceMinor !== '') {
    try {
      price = parseAmountMinor(input.priceMinor, 'priceMinor', { allowZero: true })
      if (price > MAX_PRICE) problems.priceMinor = ['Harga terlalu besar.']
    } catch {
      problems.priceMinor = ['Harga harus angka rupiah ≥ 0.']
    }
  }
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'VPR-')
  await tx.query('insert into vendor_products (id, vendor_id, name, category, description, price_minor) values ($1, $2, $3, $4, $5, $6)',
    [id, vendorId, name, category, description ?? null, price?.toString() ?? null])
  await recordAudit(tx, { action: 'vendor.product_created', actorUserId: actor.userId, entityType: 'vendor', entityId: vendorId, requestId, after: { productId: id, name, category } })
  return { id }
}

export async function createVendorDocument(tx: Queryable, actor: Actor, vendorId: string, input: Record<string, unknown>, today: string, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const name = requiredText(input.name, 'name', 'Nama dokumen', problems)
  const type = requiredText(input.type, 'type', 'Jenis dokumen', problems, 100)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await nextId(tx, 'VDOC-')
  await tx.query('insert into vendor_documents (id, vendor_id, name, type, uploaded_on) values ($1, $2, $3, $4, $5)', [id, vendorId, name, type, today])
  await recordAudit(tx, { action: 'vendor.document_created', actorUserId: actor.userId, entityType: 'vendor', entityId: vendorId, requestId, after: { documentId: id, name, type } })
  return { id }
}
