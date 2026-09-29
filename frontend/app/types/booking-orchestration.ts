import type { ID } from './common'

/**
 * Booking dan Service Orders (Section 18 — roadmap Section 00–24 baru). Consolidation/orchestration LAYER
 * di atas 4 domain booking yang sudah COMPLETED (`FlightBooking`/`HotelBooking`/`TransportBooking`/
 * `MiceEvent`, Section 13-16, D-070/D-071/D-072/D-073) — BUKAN entitas komersial baru. Fully additive: TIDAK
 * ADA field yang ditambahkan ke keempat entitas booking existing.
 *
 * PENTING — disambiguasi eksplisit (lihat `docs/frontend-known-issues.md` bagian 13): `ServiceOrder`
 * (`app/types/procurement.ts`, Section 17) adalah dokumen formal Procurement→vendor (dari RFQ atau
 * engagement langsung). Section 18 ini TIDAK menambah entitas bernama serupa — istilah yang dipakai di sini
 * SENGAJA "Booking Orchestration"/"Booking Timeline", bukan "Service Order", untuk menghindari tabrakan nama
 * dengan Section 17. Nav label top-level: "Booking & Service Order Center" (istilah UI-only, bukan nama tipe).
 */

export type BookingDomain = 'flight' | 'hotel' | 'transport' | 'mice'

/** Mock gate finansial murni (D-006 — tidak ada payment gateway/processing nyata). */
export type BookingPaymentGateStatus = 'not-required' | 'pending' | 'cleared'

export type BookingAttemptOutcome = 'success' | 'failed' | 'manual-fallback'

/** "Failure/retry/manual fallback simulation" (Wajib) — narasi/log murni, bukan hasil integrasi nyata (D-006). Diseed dan/atau ditambahkan lewat `appendBookingAttempt` (`app/data/index.ts`). */
export interface BookingAttempt {
  id: ID
  at: string
  outcome: BookingAttemptOutcome
  note?: string
}

/** "Dependency antar-service" (Wajib) — satu booking dapat bergantung pada booking lain (lintas domain), mis. transfer bandara menunggu hotel check-in dikonfirmasi. */
export interface BookingOrchestrationDependency {
  bookingType: BookingDomain
  bookingId: ID
}

/**
 * Satu record per booking existing (Flight/Hotel/Transport/MICE) — dibuat dan ditautkan lewat ID, TIDAK
 * PERNAH memutasi entitas booking yang mendasarinya. Diseed 1:1 untuk seluruh fixture existing
 * (`app/data/booking-orchestration.ts`) dan dibuat otomatis (`getOrCreateBookingOrchestrationRecord`,
 * `app/data/index.ts`) untuk booking baru yang dibuat lewat UI setelah section ini — memastikan
 * `getBookingTimeline` tidak pernah "kehilangan" booking manapun tanpa perlu mengubah signature
 * `createFlightBooking`/`createHotelBooking`/`createTransportBooking`/`createMiceEvent` (Section 13-16,
 * LOCKED, lihat `docs/frontend-implementation-roadmap.md`).
 */
export interface BookingOrchestrationRecord {
  id: ID
  bookingType: BookingDomain
  bookingId: ID
  projectId: ID
  dependsOn?: BookingOrchestrationDependency[]
  paymentGateStatus: BookingPaymentGateStatus
  attemptLog: BookingAttempt[]
  /** "Duplicate booking prevention" (Wajib) — `true` bila booking ini SENGAJA dibuat sebagai duplicate (dikonfirmasi eksplisit oleh user lewat dialog konfirmasi), diset oleh `flagBookingOrchestrationDuplicate` (`app/data/index.ts`). */
  flaggedDuplicate?: boolean
}

/** Satu dependency, sudah di-resolve statusnya untuk ditampilkan sebagai badge (view-model, bukan disimpan). */
export interface BookingTimelineDependencyView {
  bookingType: BookingDomain
  bookingId: ID
  label: string
  isSatisfied: boolean
}

/**
 * DERIVED view-model (Wajib — "Semua Flight/Hotel/Transport/MICE service requirement dalam satu timeline"),
 * dihitung di `getBookingTimeline` (`app/data/index.ts`) — TIDAK disimpan sebagai state, pola sama
 * `ServiceReadinessRow`/`DepartureReadinessSummary`/`AttentionQueueItem` (Section 12 baru).
 *
 * "Internal/supplier/client-visible status mapping" (Wajib) — TIGA field status TERPISAH (bukan satu field
 * ambigu) agar sanitasi tidak pernah tercampur: `internalStatus` (label penuh dari vocabulary existing
 * masing-masing domain, mis. "Reissued"), `clientVisibleStatus`/`supplierVisibleStatus` (bucket 4-kategori
 * yang disederhanakan dari vocabulary yang SAMA — bukan enum baru, murni pemetaan label untuk audiens
 * berbeda, konsisten instruksi "reusing each domain's existing status vocabulary").
 *
 * `netCostIdr`/`sellPriceIdr` TETAP terpisah (bukan satu field gabungan) — halaman `/bookings` HARUS
 * menggerbangi `netCostIdr` dengan `canManage<Domain> || canViewFinancials` sebelum merender, sama seperti
 * pola D-070/D-071/D-072/D-073 pada masing-masing domain asal.
 */
export interface BookingTimelineEntry {
  orchestrationId: ID
  bookingType: BookingDomain
  bookingId: ID
  projectId: ID
  projectName: string
  serviceId?: ID
  label: string
  reference?: string
  travelerCount: number
  startDate?: string
  deadlineDate?: string
  internalStatus: string
  internalStatusTone: string
  supplierVisibleStatus: string
  clientVisibleStatus: string
  detailHref: string
  voucherHref?: string
  netCostIdr?: number
  sellPriceIdr?: number
  dependencies: BookingTimelineDependencyView[]
  paymentGateStatus: BookingPaymentGateStatus
  attemptLog: BookingAttempt[]
  /** Agregasi hasChange/hasScheduleChange/hasIncident/hasChangeOrder domain asal + blocked-dependency + failed-attempt + duplicate-flag (Wajib "Exception list"). */
  exceptions: string[]
}
