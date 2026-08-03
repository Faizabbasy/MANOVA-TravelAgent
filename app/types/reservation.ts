import type { ID } from './common'
import type { BookingDomain } from './booking-orchestration'

/**
 * `Reservation` (Client Experience — Repair Phase Section 1). View-model client-safe untuk booking
 * tradisional (Flight/Hotel/Transport/MICE, Section 13-16 — internal-only hari ini) DAN kategori lain
 * yang belum punya entitas internal sendiri (Venue/Restaurant/Guide/Activity/Visa/Insurance/Event
 * equipment — dicatat sebagai kategori generik, bukan entitas Section 13-16 baru). Dirancang untuk
 * DIRIVASI dari `BookingOrchestrationRecord`/`getBookingTimeline` (Section 18, sudah lintas-domain) saat
 * section "Core Project" diimplementasikan — bukan dataset paralel yang bisa stale. Foundation only
 * (Section 1) — array seed kosong, TIDAK ADA mutator (Client hanya view + request change lewat Change
 * Request, tidak pernah mengedit booking vendor langsung, Master Prompt bagian G.9).
 */
export type ReservationCategory = 'flight' | 'hotel' | 'transportation' | 'venue' | 'restaurant' | 'guide' | 'activity' | 'visa' | 'insurance' | 'event-equipment'

export type ReservationStatus = 'requested' | 'checking-availability' | 'on-hold' | 'reserved' | 'confirmed' | 'issued' | 'changed' | 'cancelled' | 'completed'

export interface Reservation {
  id: ID
  projectId: ID
  category: ReservationCategory
  label: string
  status: ReservationStatus
  /** Referensi longgar ke entitas booking internal asal (Section 13-16/18) bila kategori punya padanannya — opsional, tidak semua kategori (mis. `guide`/`activity`) punya entitas internal dedicated hari ini. */
  bookingType?: BookingDomain
  bookingId?: ID
  referenceCode?: string
  deadline?: string
  /** Menaut ke `Document` (Section 21, `app/types/document-comms.ts`) untuk confirmation/ticket/voucher — bukan field file baru. */
  documentId?: ID
}
