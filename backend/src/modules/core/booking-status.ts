import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { recordAudit } from '../../shared/audit'
import { actorName, recordProjectActivity } from './activities'
import { serviceStatusFor } from './booking-rules'
import type { BookingType } from './repository'

export const BOOKING_LABEL: Record<BookingType, string> = { flight: 'Flight', hotel: 'Hotel', transport: 'Transport', mice: 'MICE' }

/**
 * Booking status writes shared by the booking API and the Finance cancellation hook (S4a). Kept free of
 * finance imports so `finance/refunds` can use it without an import cycle.
 */

export async function setBookingStatus(tx: Queryable, actor: Actor, type: BookingType, id: string, from: string, to: string, reason: string | null, requestId: string) {
  const [b] = await tx.query<{ service_id: string | null; project_id: string; reference: string | null }>(
    `update booking_refs set status = $3, status_reason = coalesce($4, status_reason), updated_at = now()
      where booking_type = $1 and booking_id = $2 returning service_id, project_id, reference`,
    [type, id, to, reason]
  )
  if (b?.service_id) await tx.query('update project_services set status = $2, updated_at = now() where id = $1', [b.service_id, serviceStatusFor(type, to)])
  // S7d: the project's activity log shows every booking status change (Operations or a Finance cancellation).
  if (b) {
    await recordProjectActivity(tx, {
      projectId: b.project_id, actorUserId: actor.userId, sourceAction: 'booking.status_changed', sourceEntityId: id,
      message: `${BOOKING_LABEL[type]} Booking ${id}${b.reference ? ` (${b.reference})` : ''} status diubah dari "${from}" menjadi "${to}" oleh ${await actorName(tx, actor.userId)}.${reason ? ` Alasan: ${reason}` : ''}`
    })
  }
  await recordAudit(tx, {
    action: 'booking.status_changed', actorUserId: actor.userId, entityType: 'booking', entityId: id, requestId, reason,
    before: { type, status: from }, after: { type, status: to }
  })
}

/** Any Finance record on the booking: such a booking is cancelled through Finance, not by Operations. */
export async function bookingHasFinance(tx: Queryable, type: string, id: string): Promise<boolean> {
  const [r] = await tx.query<{ blocked: boolean }>(
    `select exists (select 1 from customer_invoices where booking_type = $1 and booking_id = $2 and status <> 'void')
         or exists (select 1 from vendor_invoices where booking_type = $1 and booking_id = $2 and status not in ('rejected', 'void'))
         or exists (select 1 from financial_transactions where booking_type = $1 and booking_id = $2)
         or exists (select 1 from billing_schedule_items where booking_type = $1 and booking_id = $2 and status = 'planned')
         or exists (select 1 from refunds where subject_type = $1 and subject_id = $2 and status <> 'rejected') as blocked`,
    [type, id]
  )
  return r!.blocked
}
