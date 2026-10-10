import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { actorName, recordProjectActivity } from './activities'
import { parseAmountMinor } from '../../shared/money'
import { SERVICE_STATUSES, SERVICE_TYPES, type ServiceStatus, type ServiceType } from './booking-rules'
import { ensureServiceOrder } from './service-orders'

/**
 * Project services (S4a): one row per service line of a project. Rows that carry a booking take their status
 * from the booking (booking-writes); the rest are set by hand. A vendor change is refused once Finance holds a
 * vendor invoice for the service, because payables checks invoice vendor = service vendor.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
const MAX = 1_000_000_000_000_000n

function text(value: unknown, field: string, label: string, problems: FieldErrors, required: boolean, max = 200): string | null | undefined {
  if (value === undefined) { if (required) problems[field] = [`${label} wajib diisi.`]; return undefined }
  if (value === null && !required) return null
  const s = typeof value === 'string' ? value.trim() : ''
  if (!s) {
    if (required) { problems[field] = [`${label} wajib diisi.`]; return undefined }
    return null
  }
  if (s.length > max) { problems[field] = [`Maksimal ${max} karakter.`]; return undefined }
  return s
}

/** Optional rupiah amount as a minor-unit string; `null`/'' clears it. */
export function money(value: unknown, field: string, problems: FieldErrors): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  try {
    const v = parseAmountMinor(value, field, { allowZero: true })
    if (v > MAX) { problems[field] = ['Nilai terlalu besar.']; return undefined }
    return v.toString()
  } catch {
    problems[field] = ['Harus angka rupiah ≥ 0.']
    return undefined
  }
}

async function vendorOk(tx: Queryable, vendorId: unknown, problems: FieldErrors): Promise<string | null | undefined> {
  if (vendorId === undefined) return undefined
  if (vendorId === null) return null
  if (typeof vendorId !== 'string' || !ID_PATTERN.test(vendorId) ||
    !(await tx.query("select 1 from vendors where id = $1 and status in ('active', 'pending')", [vendorId])).length) {
    problems.vendorId = ['Vendor tidak ditemukan atau tidak aktif.']
    return undefined
  }
  return vendorId
}

export async function insertService(tx: Queryable, s: { projectId: string; type: ServiceType; label: string; vendorId?: string | null; budgetMinor?: string | null; bookingReference?: string | null; status?: ServiceStatus }): Promise<string> {
  const id = await nextId(tx, 'SVC-')
  await tx.query(
    'insert into project_services (id, project_id, service_type, label, status, vendor_id, budget_minor, booking_reference) values ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, s.projectId, s.type, s.label, s.status ?? 'not-started', s.vendorId ?? null, s.budgetMinor ?? null, s.bookingReference ?? null]
  )
  return id
}

export async function createService(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const type = (SERVICE_TYPES as readonly unknown[]).includes(input.type) ? input.type as ServiceType : undefined
  if (!type) problems.type = ['Jenis layanan tidak dikenal.']
  const label = text(input.label, 'label', 'Nama layanan', problems, true)
  const budgetMinor = money(input.budgetMinor, 'budgetMinor', problems)
  const bookingReference = text(input.bookingReference, 'bookingReference', 'Referensi', problems, false, 100)
  const vendorId = await vendorOk(tx, input.vendorId, problems)
  if (Object.keys(problems).length) throw errors.validation(problems)
  const id = await insertService(tx, { projectId, type: type!, label: label as string, vendorId, budgetMinor, bookingReference })
  if (vendorId) await ensureServiceOrder(tx, actor, id, vendorId, {}, requestId)
  await recordAudit(tx, {
    action: 'service.created', actorUserId: actor.userId, entityType: 'project_service', entityId: id, requestId,
    after: { projectId, type, label, vendorId: vendorId ?? null, budgetMinor: budgetMinor ?? null }
  })
  return { id }
}

const FORBIDDEN = ['id', 'projectId', 'type', 'serviceType', 'provenance']
const COLUMNS: Record<string, string> = { label: 'label', status: 'status', budgetMinor: 'budget_minor', bookingReference: 'booking_reference', vendorId: 'vendor_id' }

export async function updateService(tx: Queryable, actor: Actor, id: string, input: Record<string, unknown>, requestId: string): Promise<void> {
  const blocked = Object.keys(input).filter(k => FORBIDDEN.includes(k))
  if (blocked.length) throw errors.validation(Object.fromEntries(blocked.map(k => [k, ['Tidak bisa diubah lewat edit layanan.']])))
  const [cur] = await tx.query<Record<string, unknown>>(
    `select label, status, budget_minor, booking_reference, vendor_id, exists (select 1 from booking_refs b where b.service_id = ps.id) as has_bookings
       from project_services ps where id = $1 for update`, [id])
  if (!cur) throw errors.notFound('Layanan')
  const problems: FieldErrors = {}
  const next: Record<string, unknown> = {}
  if (input.label !== undefined) next.label = text(input.label, 'label', 'Nama layanan', problems, true)
  if (input.status !== undefined) {
    if (!(SERVICE_STATUSES as readonly unknown[]).includes(input.status)) problems.status = ['Status layanan tidak dikenal.']
    else next.status = input.status
  }
  const budget = money(input.budgetMinor, 'budgetMinor', problems)
  if (budget !== undefined) next.budgetMinor = budget
  const ref = text(input.bookingReference, 'bookingReference', 'Referensi', problems, false, 100)
  if (ref !== undefined) next.bookingReference = ref
  const vendor = await vendorOk(tx, input.vendorId, problems)
  if (vendor !== undefined) next.vendorId = vendor
  if (Object.keys(problems).length) throw errors.validation(problems)
  // Drop values that change nothing (no empty audit rows).
  for (const k of Object.keys(next)) if (String(next[k] ?? '') === String(cur[COLUMNS[k]!] ?? '')) delete next[k]
  const keys = Object.keys(next)
  if (!keys.length) return
  if (next.status !== undefined && cur.has_bookings) throw rule('Status layanan ini mengikuti booking-nya — ubah status di halaman booking.')
  if ('vendorId' in next) {
    const [used] = await tx.query(
      `select 1 from vendor_invoices v
        where v.status not in ('rejected', 'void')
          and ((v.booking_type, v.booking_id) in (select booking_type, booking_id from booking_refs where service_id = $1)
               or v.service_order_id in (select id from service_orders where service_id = $1))
        limit 1`, [id])
    if (used) throw rule('Vendor layanan ini tidak bisa diganti: sudah ada invoice vendor untuk layanan ini di Finance.')
  }
  await tx.query(`update project_services set ${keys.map((k, i) => `${COLUMNS[k]} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`, [id, ...keys.map(k => next[k])])
  // S4b: the service orders follow the vendor (new vendor → draft order, old vendor's unbilled order cancelled).
  if ('vendorId' in next) await ensureServiceOrder(tx, actor, id, (next.vendorId as string | null) ?? null, {}, requestId)
  // S7d: a service marked "changed" by hand is a change the team has to review.
  if (next.status === 'changed') {
    const [svc] = await tx.query<{ project_id: string; label: string }>('select project_id, label from project_services where id = $1', [id])
    await recordProjectActivity(tx, {
      projectId: svc!.project_id, actorUserId: actor.userId, sourceAction: 'service.changed', sourceEntityId: id, isChange: true,
      message: `Layanan "${svc!.label}" ditandai berubah oleh ${await actorName(tx, actor.userId)} — perlu ditinjau.`
    })
  }
  await recordAudit(tx, {
    action: 'service.updated', actorUserId: actor.userId, entityType: 'project_service', entityId: id, requestId,
    before: Object.fromEntries(keys.map(k => [k, cur[COLUMNS[k]!] ?? null])), after: next
  })
}
