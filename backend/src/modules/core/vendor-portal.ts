import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { errors } from '../../http/errors'
import { notifyInternal } from './client-writes'
import { changeServiceOrderStatus } from './service-orders'

/**
 * Vendor portal (S12d). A vendor confirms (`acknowledged`) or completes (`fulfilled`) its own service orders; sending,
 * re-sending and cancelling stay with MANOVA staff. The caller has checked the order belongs to the vendor.
 */
export const VENDOR_SO_TARGETS = ['acknowledged', 'fulfilled']

export async function vendorChangeServiceOrderStatus(tx: Queryable, actor: Actor, id: string, to: unknown, requestId: string) {
  if (typeof to !== 'string' || !VENDOR_SO_TARGETS.includes(to)) throw errors.forbidden('Vendor hanya bisa mengonfirmasi atau menandai selesai.')
  await changeServiceOrderStatus(tx, actor, id, to, null, requestId)
  const [so] = await tx.query<{ project_id: string | null; owner_user_id: string | null; project_name: string | null }>(
    'select so.project_id, p.owner_user_id, p.name as project_name from service_orders so left join projects p on p.id = so.project_id where so.id = $1', [id])
  if (!so?.project_id) return
  await notifyInternal(tx, actor, so.owner_user_id, {
    type: 'change', title: `Service Order ${id} ${to === 'acknowledged' ? 'dikonfirmasi' : 'ditandai selesai'} vendor`,
    body: `Vendor mengubah status ${id} (${so.project_name}) menjadi ${to}.`, entityType: 'project', entityId: so.project_id
  })
}
