import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { actorName, recordProjectActivity } from './activities'

/**
 * Service orders (S4b): one active order per service + vendor, created when a vendor is assigned (quick assignment
 * or an accepted quotation) and cancelled when the vendor changes — never deleted, because Finance vendor invoices
 * point at them. Amendments and RFQ orders stay in procurement (S5).
 */

const rule = (message: string) => new AppError(422, 'RULE_VIOLATION', message)
export const SERVICE_ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['acknowledged', 'cancelled'],
  acknowledged: ['fulfilled', 'cancelled'],
  amended: ['fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: []
}

const BILLED = "exists (select 1 from vendor_invoices v where v.service_order_id = so.id and v.status not in ('rejected', 'void'))"

/** S7d: a service order's status change is shown in its project's activity log. */
async function logOrderStatus(tx: Queryable, actor: Actor, id: string, from: string, to: string, reason: string | null) {
  const [so] = await tx.query<{ project_id: string | null; vendor: string }>(
    'select so.project_id, coalesce(v.name, so.vendor_id) as vendor from service_orders so left join vendors v on v.id = so.vendor_id where so.id = $1', [id])
  if (!so?.project_id) return
  await recordProjectActivity(tx, {
    projectId: so.project_id, actorUserId: actor.userId, sourceAction: 'service_order.status_changed', sourceEntityId: id,
    message: `Service Order ${id} (${so.vendor}) status diubah dari "${from}" menjadi "${to}" oleh ${await actorName(tx, actor.userId)}.${reason ? ` Alasan: ${reason}` : ''}`
  })
}

async function cancelOrder(tx: Queryable, actor: Actor, id: string, from: string, reason: string, requestId: string) {
  await tx.query("update service_orders set status = 'cancelled', status_reason = $2, updated_at = now() where id = $1", [id, reason])
  await logOrderStatus(tx, actor, id, from, 'cancelled', reason)
  await recordAudit(tx, {
    action: 'service_order.cancelled', actorUserId: actor.userId, entityType: 'service_order', entityId: id, requestId, reason,
    before: { status: from }, after: { status: 'cancelled' }
  })
}

/** Makes the service's active orders match its vendor; returns the active order of `vendorId` (null when none). */
export async function ensureServiceOrder(
  tx: Queryable, actor: Actor, serviceId: string, vendorId: string | null,
  opts: { netCostMinor?: string; sourceQuotationId?: string }, requestId: string
): Promise<string | null> {
  const active = await tx.query<{ id: string; vendor_id: string; status: string; billed: boolean; net_cost_minor: string | null; source_quotation_id: string | null }>(
    `select so.id, so.vendor_id, so.status, ${BILLED} as billed, so.net_cost_minor, so.source_quotation_id
       from service_orders so where so.service_id = $1 and so.status <> 'cancelled' order by so.id for update`,
    [serviceId]
  )
  // Another vendor's order that Finance has not been billed on goes; a billed one cannot exist here (S4a vendor rule).
  for (const so of active) {
    if (so.vendor_id !== vendorId && !so.billed) await cancelOrder(tx, actor, so.id, so.status, 'Vendor layanan diganti.', requestId)
  }
  if (!vendorId) return null
  const mine = active.find(so => so.vendor_id === vendorId)
  if (mine) {
    if ((opts.netCostMinor && !mine.net_cost_minor) || (opts.sourceQuotationId && !mine.source_quotation_id)) {
      await tx.query(
        'update service_orders set net_cost_minor = coalesce(net_cost_minor, $2), source_quotation_id = coalesce(source_quotation_id, $3), updated_at = now() where id = $1',
        [mine.id, opts.netCostMinor ?? null, opts.sourceQuotationId ?? null]
      )
    }
    return mine.id
  }
  const [svc] = await tx.query<{ project_id: string }>('select project_id from project_services where id = $1', [serviceId])
  const id = await nextId(tx, 'SO-')
  await tx.query(
    'insert into service_orders (id, vendor_id, project_id, service_id, status, net_cost_minor, source_quotation_id) values ($1, $2, $3, $4, $5, $6, $7)',
    [id, vendorId, svc!.project_id, serviceId, 'draft', opts.netCostMinor ?? null, opts.sourceQuotationId ?? null]
  )
  await recordAudit(tx, {
    action: 'service_order.created', actorUserId: actor.userId, entityType: 'service_order', entityId: id, requestId,
    after: { serviceId, vendorId, netCostMinor: opts.netCostMinor ?? null, sourceQuotationId: opts.sourceQuotationId ?? null }
  })
  return id
}

export async function changeServiceOrderStatus(tx: Queryable, actor: Actor, id: string, to: unknown, reasonInput: unknown, requestId: string): Promise<void> {
  if (typeof to !== 'string' || !['sent', 'acknowledged', 'fulfilled', 'cancelled'].includes(to)) {
    throw errors.validation({ to: ['Status harus sent, acknowledged, fulfilled, atau cancelled.'] })
  }
  const reason = typeof reasonInput === 'string' && reasonInput.trim() ? reasonInput.trim().slice(0, 1000) : null
  if (to === 'cancelled' && !reason) throw errors.validation({ reason: ['Alasan wajib diisi untuk membatalkan service order.'] })
  const [so] = await tx.query<{ status: string; billed: boolean }>(`select so.status, ${BILLED} as billed from service_orders so where so.id = $1 for update`, [id])
  if (!so) throw errors.notFound('Service order')
  if (!SERVICE_ORDER_TRANSITIONS[so.status]?.includes(to)) throw rule(`Status service order tidak bisa diubah dari ${so.status} ke ${to}.`)
  if (to === 'cancelled') {
    if (so.billed) throw rule('Service order ini sudah ditagih vendor di Finance — tidak bisa dibatalkan.')
    await cancelOrder(tx, actor, id, so.status, reason!, requestId)
    return
  }
  await tx.query(
    `update service_orders set status = $2, updated_at = now(),
       acknowledged_at = case when $2 = 'acknowledged' then now() else acknowledged_at end,
       fulfilled_at = case when $2 = 'fulfilled' then now() else fulfilled_at end
     where id = $1`,
    [id, to]
  )
  await logOrderStatus(tx, actor, id, so.status, to, reason)
  await recordAudit(tx, {
    action: 'service_order.status_changed', actorUserId: actor.userId, entityType: 'service_order', entityId: id, requestId, reason,
    before: { status: so.status }, after: { status: to }
  })
}
