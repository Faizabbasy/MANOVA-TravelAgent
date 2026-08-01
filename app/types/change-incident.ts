import type { ID } from './common'
import type { BookingDomain } from './booking-orchestration'

/**
 * Changes, Cancellation, Refund dan Incident (Section 19 — roadmap Section 00–24 baru). Fully additive —
 * ZERO perubahan ke `FlightBooking`/`HotelBooking`/`TransportBooking`/`MiceEvent` (Section 13-16),
 * `Invoice`/`Payment` (Foundation/`app/types/finance.ts`), maupun `ActivityEntry` (Section 14 lama). Pola
 * arsitektur mengikuti preseden D-075 (Section 18, Booking Orchestration): entitas baru yang menautkan ke
 * entitas existing lewat ID, tidak pernah memutasi apa yang ditautnya.
 *
 * `ChangeRequest` SENGAJA tidak menggantikan `ActivityEntry`/`ChangeCategory`/`ChangeApprovalStatus`
 * (Section 14 lama, `app/types/activity.ts`) — entitas itu tetap SATU-SATUNYA audit trail project (LOCKED,
 * `docs/mockup-information-architecture.md` bagian 4). `ChangeRequest` adalah lapisan STRUKTUR TAMBAHAN di
 * atasnya (before/after summary terstruktur, affected entities, dampak operasional/komersial/finansial/
 * timeline, status lifecycle 5-nilai, link ke additional quotation/change order) — setiap `ChangeRequest`
 * WAJIB menautkan tepat satu `ActivityEntry` (`activityEntryId`) lewat `createChangeEntry`/`approveChangeEntry`/
 * `rejectChangeEntry` existing (`app/data/index.ts`), memastikan audit trail tetap satu sumber kebenaran.
 * "Versioned itinerary/order history" (Wajib) dipenuhi lewat sifat append-only `ChangeRequest` (tidak pernah
 * diedit/dihapus setelah dibuat, hanya berpindah status) — BUKAN entitas versioning baru.
 */

export type ChangeRequestSource = 'client' | 'internal' | 'supplier'

export type ChangeRequestStatus = 'submitted' | 'under-review' | 'approved' | 'rejected' | 'implemented'

/** Entitas yang terdampak satu Change Request — referensi ID lintas-domain, tidak pernah memutasi entitas yang ditunjuk. */
export interface AffectedEntityRef {
  entityType: 'flight' | 'hotel' | 'transport' | 'mice' | 'itinerary' | 'order' | 'project'
  entityId: ID
}

export interface ChangeRequest {
  id: ID
  projectId: ID
  source: ChangeRequestSource
  requestedBy: ID
  submittedAt: string
  affectedEntities: AffectedEntityRef[]
  beforeSummary: string
  afterSummary: string
  /** Dampak operasional (Wajib) — teks bebas, mis. "Rooming list dan manifest transport perlu disusun ulang." */
  operationalImpact?: string
  /** Dampak komersial (Wajib) — nominal, internal-only (TIDAK boleh terlihat Client kecuali ini request milik Client sendiri, dan bahkan begitu tetap disanitasi di Client Portal — lihat `app/pages/client/project-orders/[id]/index.vue`). */
  commercialImpactIdr?: number
  /** Dampak finansial (Wajib) — narasi tambahan di luar angka commercial impact, mis. dampak ke termin invoice. */
  financialImpactNote?: string
  /** Dampak timeline (Wajib) — mis. pergeseran tanggal keberangkatan/deadline. */
  timelineImpactNote?: string
  status: ChangeRequestStatus
  approvedBy?: ID
  approvedAt?: string
  /** Alasan wajib untuk `rejected` (pola sama `updateFlightBookingStatus`/section lain, D-070/D-071/D-072). */
  rejectionReason?: string
  /** "Additional quotation/change order" (Wajib) — link opsional ke `Quotation` existing (`app/types/opportunity.ts`) bila perubahan ini memicu quotation tambahan. */
  linkedQuotationId?: ID
  /** Menautkan ke `ActivityEntry` (Section 14 lama, `CHG-*`) yang dibuat otomatis oleh `createChangeRequest` — audit trail tetap satu sumber kebenaran (`app/types/activity.ts`). */
  activityEntryId?: ID
}

/**
 * `CancellationRecord` — lapisan penalty-tracking SERAGAM lintas 4 tipe booking (hari ini hanya `HotelBooking`
 * yang punya field penalty sendiri, D-071). TIDAK memutasi `FlightBooking`/`HotelBooking`/`TransportBooking`/
 * `MiceEvent` — dibuat SEBAGAI TAMBAHAN saat booking ditransisikan ke status cancel-equivalent
 * (`cancelled`/`refunded`/`no-show`) lewat hook UI-level di halaman detail masing-masing domain (lihat
 * `app/pages/ticketing/[id]/index.vue` dkk.) — TIDAK mengubah guard/transition-map/reason-wajib existing
 * (`update*BookingStatus`, `app/data/index.ts`, LOCKED).
 */
export interface CancellationRecord {
  id: ID
  projectId: ID
  bookingType: BookingDomain
  bookingId: ID
  reason: string
  penaltyIdr?: number
  cancelledAt: string
  cancelledBy: ID
  refundEligible: boolean
}

export type RefundRequestStatus = 'requested' | 'under-review' | 'approved' | 'rejected' | 'processed'

/**
 * `RefundRequest` — SENGAJA self-contained, TIDAK menyentuh `Invoice`/`Payment` (`app/types/finance.ts`,
 * LOCKED, Section 20 baru masih PARTIAL — lihat `docs/frontend-known-issues.md` bagian 15). `invoiceId`
 * hanyalah referensi ID longgar/read-only (murni untuk ditampilkan sebagai konteks, TIDAK PERNAH memutasi
 * `Invoice.status`). `creditStatus` adalah field mock SENDIRI — BUKAN integrasi `CreditNote` nyata ke Finance;
 * forward dependency eksplisit untuk Section 20 (lihat `docs/frontend-known-issues.md` bagian 15, KNOWN_GAP).
 */
export interface RefundRequest {
  id: ID
  projectId: ID
  cancellationId?: ID
  invoiceId?: ID
  type: 'partial' | 'full'
  amountIdr: number
  status: RefundRequestStatus
  requestedAt: string
  requestedBy: ID
  approvedBy?: ID
  approvedAt?: string
  /** Alasan wajib untuk `rejected` (pola sama `ChangeRequest`/section lain). */
  rejectionReason?: string
  creditStatus: 'pending' | 'issued' | 'not-applicable'
}

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'

export type IncidentStatus = 'open' | 'investigating' | 'escalated' | 'resolved' | 'closed'

/** "Communication" (Wajib) — log narasi murni (mock, D-006), TIDAK ada integrasi channel komunikasi nyata (email/WhatsApp/dsb). */
export interface IncidentCommunicationEntry {
  id: ID
  at: string
  from: ID
  message: string
}

export interface Incident {
  id: ID
  projectId: ID
  /** Opsional — insiden dapat berupa project-level (mis. bencana alam di destinasi) atau tertaut ke satu booking spesifik. */
  bookingType?: BookingDomain
  bookingId?: ID
  title: string
  description: string
  severity: IncidentSeverity
  ownerId: ID
  status: IncidentStatus
  /** "Escalation" (Wajib) — terisi begitu `status` mencapai `escalated`. */
  escalatedTo?: ID
  communicationLog: IncidentCommunicationEntry[]
  /** "Resolution" (Wajib) — wajib diisi saat `status` menjadi `resolved`. */
  resolutionNote?: string
  resolvedAt?: string
}
