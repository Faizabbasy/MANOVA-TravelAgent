import type { ID } from './common'

/**
 * Ticketing (Section 13 — roadmap Section 00–24 baru). Entitas baru `FlightBooking`, TERPISAH dari
 * `ProjectService` (Foundation/Section 12 lama) — `ProjectService` (tipe `flight`) tetap ringkasan baris
 * generik di tab "Itinerary & Services" (label/status/vendor/bookingReference, dipakai lintas seluruh tipe
 * layanan termasuk hotel/transportation/mice), sedangkan `FlightBooking` adalah model lifecycle detail
 * KHUSUS flight (options/segments/PNR/deadline/fare rules/net cost) yang tidak bisa dipaksakan ke model
 * generik itu tanpa mencampur konsep lintas-domain. `serviceId` (opsional) menautkan balik ke
 * `ProjectService` bila baris generiknya sudah ada — TIDAK wajib (booking bisa berdiri sendiri, mis. saat
 * masih tahap "requested" sebelum ada baris service formal, pola sama `CostSheet.leadId` opsional).
 */

export type CabinClass = 'economy' | 'premium-economy' | 'business' | 'first'

/** "Flight request/options" + "Fare/cabin/baggage/ancillary display" (Wajib) — embedded array, pola sama `QuotationServiceItem`/`ProductServiceAlternative`. */
export interface FlightOption {
  airline: string
  cabinClass: CabinClass
  fareIdr: number
  baggageAllowance?: string
  ancillaries?: string
  isSelected?: boolean
}

/** "Segments" (Wajib) — satu leg penerbangan (bisa lebih dari satu untuk PP/multi-city). */
export interface FlightSegment {
  origin: string
  destination: string
  departureAt: string
  arrivalAt?: string
  flightNumber?: string
}

/**
 * "Hold, Confirm, Issue, Reissue, Cancel, Refund state simulation" (Wajib) — lifecycle literal 7 nilai.
 * `requested` = belum masuk salah satu dari 6 status aksi eksplisit (nilai awal seluruh booking baru).
 */
export type FlightBookingStatus = 'requested' | 'hold' | 'confirmed' | 'issued' | 'reissued' | 'cancelled' | 'refunded'

export interface FlightBooking {
  id: ID
  projectId: ID
  /** Opsional — referensi balik ke `ProjectService` (tipe `flight`) bila baris generiknya sudah ada. */
  serviceId?: ID
  /** "PNR/order reference mock" (Wajib) — terisi begitu status mencapai `confirmed` ke atas (mock, bukan integrasi GDS/airline nyata, D-006). */
  pnr?: string
  status: FlightBookingStatus
  options: FlightOption[]
  segments: FlightSegment[]
  /** "Segments dan traveler assignment" (Wajib) — juga berfungsi sebagai "Group booking/name list" saat lebih dari satu traveler. */
  travelerIds: ID[]
  /** "Ticketing deadline" (Wajib) — tenggat waktu tiket harus di-issue sebelum harga/kursi hangus (mock). */
  ticketingDeadline?: string
  /** "Fare rules and financial impact" (Wajib) — teks bebas (mis. syarat refund/reschedule). */
  fareRules?: string
  /** "Internal net cost vs client sell price" (Wajib) — `netCostIdr` TIDAK BOLEH terlihat Client (pola sama `CostSheet`/`Quotation.estimatedCostIdr`, D-067/D-065). Keduanya opsional — belum terisi selama status `requested`/`hold` (harga belum final). */
  netCostIdr?: number
  sellPriceIdr?: number
  /** "Schedule change/disruption" (Wajib). */
  hasScheduleChange?: boolean
  scheduleChangeNote?: string
  /** Alasan wajib untuk transisi `cancelled`/`refunded` (pola sama `updateProjectStatus`, D-066) — dicatat di sini (nilai terakhir) DAN sebagai `ActivityEntry` di project terkait untuk jejak historis. */
  statusReason?: string
  createdAt: string
  updatedAt?: string
}
