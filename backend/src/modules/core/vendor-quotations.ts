import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { AppError, errors, type FieldErrors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { SERVICE_TYPES } from './booking-rules'
import { ensureServiceOrder } from './service-orders'
import { money, updateService } from './service-writes'

/**
 * Vendor quotations (S4b): recorded by Operations when a vendor quotes for a service. Accepting one is a single
 * transaction — the service gets the vendor (S4a vendor rule applies) and `confirmed` when it has no booking yet,
 * the service order carries the quoted amount, and the competing quotations are rejected.
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)

export async function submitQuotation(tx: Queryable, actor: Actor, projectId: string, input: Record<string, unknown>, today: string, requestId: string): Promise<{ id: string }> {
  const problems: FieldErrors = {}
  const serviceType = (SERVICE_TYPES as readonly unknown[]).includes(input.serviceType) ? input.serviceType as string : undefined
  if (!serviceType) problems.serviceType = ['Jenis layanan tidak dikenal.']
  const vendorOk = typeof input.vendorId === 'string' && ID_PATTERN.test(input.vendorId) &&
    (await tx.query("select 1 from vendors where id = $1 and status in ('active', 'pending')", [input.vendorId])).length > 0
  if (!vendorOk) problems.vendorId = ['Vendor tidak ditemukan atau tidak aktif.']
  const amount = money(input.amountMinor, 'amountMinor', problems)
  if (!problems.amountMinor && (amount === undefined || amount === null || BigInt(amount) === 0n)) problems.amountMinor = ['Nilai quotation harus lebih dari 0.']
  let serviceId: string | null = null
  if (input.serviceId !== undefined && input.serviceId !== null) {
    const [s] = typeof input.serviceId === 'string' && ID_PATTERN.test(input.serviceId)
      ? await tx.query<{ id: string }>('select id from project_services where id = $1 and project_id = $2 and service_type = $3', [input.serviceId, projectId, serviceType ?? ''])
      : []
    if (!s) problems.serviceId = ['Layanan tidak ditemukan di project ini untuk jenis ini.']
    else serviceId = s.id
  }
  const notes = typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim().slice(0, 1000) : null
  if (Object.keys(problems).length) throw errors.validation(problems)

  const id = await nextId(tx, 'VQ-')
  await tx.query(
    'insert into vendor_quotations (id, vendor_id, project_id, service_id, service_type, amount_minor, notes, submitted_on) values ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, input.vendorId, projectId, serviceId, serviceType, amount, notes, today]
  )
  await recordAudit(tx, {
    action: 'quotation.submitted', actorUserId: actor.userId, entityType: 'vendor_quotation', entityId: id, requestId,
    after: { vendorId: input.vendorId, projectId, serviceId, serviceType, amountMinor: amount }
  })
  return { id }
}

async function lockSubmitted(tx: Queryable, id: string) {
  const [q] = await tx.query<{ status: string; vendor_id: string; service_id: string | null; amount_minor: string }>(
    'select status, vendor_id, service_id, amount_minor from vendor_quotations where id = $1 for update', [id])
  if (!q) throw errors.notFound('Quotation')
  if (q.status !== 'submitted') throw rule(`Quotation ini sudah ${q.status === 'accepted' ? 'diterima' : 'ditolak'}.`)
  return q
}

export async function acceptQuotation(tx: Queryable, actor: Actor, id: string, requestId: string): Promise<void> {
  const q = await lockSubmitted(tx, id)
  if (!q.service_id) throw rule('Quotation ini belum terhubung ke layanan project — tidak bisa diterima.')
  const [svc] = await tx.query<{ has_bookings: boolean }>('select exists (select 1 from booking_refs b where b.service_id = $1) as has_bookings', [q.service_id])
  // The S4a vendor rule (422 when Finance holds another vendor's invoice) runs first; the whole accept rolls back if it refuses.
  await updateService(tx, actor, q.service_id, svc!.has_bookings ? { vendorId: q.vendor_id } : { vendorId: q.vendor_id, status: 'confirmed' }, requestId)
  await ensureServiceOrder(tx, actor, q.service_id, q.vendor_id, { netCostMinor: q.amount_minor, sourceQuotationId: id }, requestId)
  await tx.query("update vendor_quotations set status = 'accepted', decided_at = now(), decided_by = $2 where id = $1", [id, actor.userId])
  const losers = await tx.query<{ id: string }>(
    `update vendor_quotations set status = 'rejected', decision_reason = 'Quotation lain diterima.', decided_at = now(), decided_by = $3
      where service_id = $1 and id <> $2 and status = 'submitted' returning id`,
    [q.service_id, id, actor.userId]
  )
  await recordAudit(tx, {
    action: 'quotation.accepted', actorUserId: actor.userId, entityType: 'vendor_quotation', entityId: id, requestId,
    after: { serviceId: q.service_id, vendorId: q.vendor_id, rejected: losers.map(l => l.id) }
  })
}

export async function rejectQuotation(tx: Queryable, actor: Actor, id: string, reasonInput: unknown, requestId: string): Promise<void> {
  await lockSubmitted(tx, id)
  const reason = typeof reasonInput === 'string' && reasonInput.trim() ? reasonInput.trim().slice(0, 1000) : null
  await tx.query("update vendor_quotations set status = 'rejected', decision_reason = $2, decided_at = now(), decided_by = $3 where id = $1", [id, reason, actor.userId])
  await recordAudit(tx, { action: 'quotation.rejected', actorUserId: actor.userId, entityType: 'vendor_quotation', entityId: id, requestId, reason })
}
