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

/**
 * 5 nilai awal (Section 19) TETAP dipakai apa adanya oleh flow internal (`/changes`, LOCKED — lihat
 * `CHANGE_REQUEST_TRANSITIONS`, `app/data/index.ts`). 6 nilai baru (Repair Phase Section 5 — Execution &
 * Changes, Master Prompt bagian B "Status flow") HANYA dipakai oleh alur `source: 'client'` yang melewati
 * mock impact review (`runChangeRequestMockReview`) — additive murni, tidak ada nilai lama yang
 * dihapus/diganti makna sehingga seluruh halaman internal existing tetap berperilaku identik.
 */
export type ChangeRequestStatus =
  | 'submitted' | 'under-review' | 'approved' | 'rejected' | 'implemented'
  | 'availability-check' | 'costing' | 'waiting-client-approval' | 'in-execution' | 'cancelled' | 'not-feasible'

/** "Jenis" Change Request (Master Prompt bagian 11 lama / Repair Phase Section 5 bagian B) — dipakai form create Client, opsional (request internal/supplier lama tidak mengisi field ini). */
export type ChangeRequestType =
  | 'add-participant' | 'remove-participant' | 'replace-participant'
  | 'change-date' | 'change-flight' | 'change-hotel' | 'add-transportation'
  | 'add-activity' | 'upgrade-service' | 'remove-service' | 'change-itinerary'
  | 'cancel-service' | 'cancel-project'

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
  /** Repair Phase Section 5 — jenis perubahan client-facing, opsional (lihat `ChangeRequestType`). */
  changeType?: ChangeRequestType
  /** Dampak operasional (Wajib) — teks bebas, mis. "Rooming list dan manifest transport perlu disusun ulang." */
  operationalImpact?: string
  /** Dampak komersial (Wajib) — nominal, internal-only (TIDAK boleh terlihat Client kecuali ini request milik Client sendiri, dan bahkan begitu tetap disanitasi di Client Portal — lihat `app/pages/client/project-orders/[id]/index.vue`). */
  commercialImpactIdr?: number
  /** Dampak finansial (Wajib) — narasi tambahan di luar angka commercial impact, mis. dampak ke termin invoice. */
  financialImpactNote?: string
  /** Dampak timeline (Wajib) — mis. pergeseran tanggal keberangkatan/deadline. */
  timelineImpactNote?: string
  /** Repair Phase Section 5 (Master Prompt bagian B "Cancellation fee") — nominal terpisah dari `commercialImpactIdr` (yang mencakup total dampak biaya lain), khusus penalti pembatalan/reissue. */
  cancellationFeeIdr?: number
  status: ChangeRequestStatus
  approvedBy?: ID
  approvedAt?: string
  /** Alasan wajib untuk `rejected`/`not-feasible` (pola sama `updateFlightBookingStatus`/section lain, D-070/D-071/D-072). */
  rejectionReason?: string
  /** Alasan wajib untuk `cancelled` oleh pengaju sendiri (Repair Phase Section 5) — field terpisah dari `rejectionReason` (keputusan pihak lain) agar audit trail jelas siapa yang membatalkan. */
  cancelReason?: string
  /** "Additional quotation/change order" (Wajib) — link opsional ke `Quotation` existing (`app/types/opportunity.ts`) bila perubahan ini memicu quotation tambahan. */
  linkedQuotationId?: ID
  /** Menautkan ke `ActivityEntry` (Section 14 lama, `CHG-*`) yang dibuat otomatis oleh `createChangeRequest` — audit trail tetap satu sumber kebenaran (`app/types/activity.ts`). */
  activityEntryId?: ID
}

/**
 * Draft Change Request (Repair Phase Section 5, Master Prompt bagian B "Save draft") — SENGAJA entitas
 * terpisah dari `ChangeRequest` (bukan `ChangeRequest.status: 'draft'`) agar draft yang belum disubmit
 * TIDAK PERNAH muncul di `/changes` (dashboard internal, LOCKED) yang query langsung `CHANGE_REQUESTS`
 * tanpa filter status — pola sama pemisahan `TravelRequest` dari `Lead` (Repair Phase Section 3). `submitChangeRequestDraft`
 * (`app/data/index.ts`) memindahkan isi draft ini menjadi `ChangeRequest` nyata via `createChangeRequest`,
 * lalu menghapus baris draft.
 */
export interface ChangeRequestDraft {
  id: ID
  projectId: ID
  createdBy: ID
  changeType?: ChangeRequestType
  beforeSummary: string
  afterSummary: string
  updatedAt: string
}

/** Comment thread Change Request (Repair Phase Section 5, Wajib "Comment") — pola sama `ItineraryComment`/`QuotationComment`. */
export interface ChangeRequestComment {
  id: ID
  changeRequestId: ID
  authorId: ID
  body: string
  createdAt: string
}

/** Attachment mock (Repair Phase Section 5, Wajib "Attachment mock") — metadata saja, pola sama `TravelRequestAttachment`/`QuotationAttachment`. */
export interface ChangeRequestAttachment {
  id: ID
  changeRequestId: ID
  fileName: string
  uploadedBy: ID
  uploadedAt: string
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
