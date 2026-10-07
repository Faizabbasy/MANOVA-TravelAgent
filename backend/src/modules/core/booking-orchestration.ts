import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { todayBusinessDate } from '../finance/common'
import { derivePaymentStatus, INVOICES_WITH_BALANCE, type InvoiceBalanceRow } from '../finance/summaries'
import { serviceStatusFor } from './booking-rules'
import type { BookingType, BookingView } from './repository'

/**
 * Booking orchestration (S4b): the payment gate is computed from Finance (never stored), attempts are a log.
 * Gate: a booking that is not confirmed yet (or cancelled/no-show) needs nothing; a confirmed one is "cleared" once
 * its own invoices — or, without own invoices, the project's — are paid as far as billed (DP received or more).
 */

export type PaymentGate = { status: 'not-required' | 'pending' | 'cleared'; basis: 'booking' | 'project' | null }
const CLEARED = new Set(['dp_received', 'up_to_date', 'paid'])
const CONFIRMED = new Set(['confirmed', 'changed', 'completed'])
const OUTCOMES = ['success', 'failed', 'manual-fallback'] as const

type FullBooking = BookingView & { status: string; projectId: string }
const isFull = (b: BookingView): b is FullBooking => 'serviceId' in b

/** Adds `paymentGate` and `attempts` to full booking views (portal views pass through unchanged). */
export async function withOrchestration(q: Queryable, bookings: BookingView[]) {
  const full = bookings.filter(isFull)
  const projectIds = [...new Set(full.map(b => b.projectId))]
  const invoices = projectIds.length
    ? await q.query<InvoiceBalanceRow>(
      `${INVOICES_WITH_BALANCE} where i.status <> 'void' and i.project_id in (select jsonb_array_elements_text($1::text::jsonb))`,
      [JSON.stringify(projectIds)])
    : []
  const attempts = full.length
    ? await q.query<{ id: string; booking_type: string; booking_id: string; outcome: string; note: string | null; actor_user_id: string | null; at: string }>(
      `select a.id, a.booking_type, a.booking_id, a.outcome, a.note, a.actor_user_id,
              to_char(a.attempted_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI') as at
         from booking_attempts a
         join jsonb_to_recordset($1::text::jsonb) as k(type text, id text) on k.type = a.booking_type and k.id = a.booking_id
        order by a.attempted_at desc, a.id desc`,
      [JSON.stringify(full.map(b => ({ type: b.type, id: b.id })))])
    : []
  const today = todayBusinessDate()
  return bookings.map((b) => {
    if (!isFull(b)) return b
    let paymentGate: PaymentGate = { status: 'not-required', basis: null }
    if (CONFIRMED.has(serviceStatusFor(b.type as BookingType, b.status))) {
      const own = invoices.filter(i => i.booking_type === b.type && i.booking_id === b.id)
      const list = own.length ? own : invoices.filter(i => i.project_id === b.projectId)
      paymentGate = { status: CLEARED.has(derivePaymentStatus(list, today, true)) ? 'cleared' : 'pending', basis: own.length ? 'booking' : 'project' }
    }
    return {
      ...b,
      paymentGate,
      attempts: attempts
        .filter(a => a.booking_type === b.type && a.booking_id === b.id)
        .map(a => ({ id: a.id, outcome: a.outcome, note: a.note, at: a.at, actorUserId: a.actor_user_id }))
    }
  })
}

export async function logAttempt(tx: Queryable, actor: Actor, type: BookingType, id: string, input: Record<string, unknown>, requestId: string): Promise<void> {
  if (!(OUTCOMES as readonly unknown[]).includes(input.outcome)) throw errors.validation({ outcome: ['Hasil harus success, failed, atau manual-fallback.'] })
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 2000) : null
  const attemptId = await nextId(tx, 'BAT-')
  await tx.query(
    'insert into booking_attempts (id, booking_type, booking_id, outcome, note, actor_user_id) values ($1, $2, $3, $4, $5, $6)',
    [attemptId, type, id, input.outcome, note, actor.userId]
  )
  await recordAudit(tx, {
    action: 'booking.attempt_logged', actorUserId: actor.userId, entityType: 'booking', entityId: id, requestId,
    after: { type, attemptId, outcome: input.outcome }
  })
}
