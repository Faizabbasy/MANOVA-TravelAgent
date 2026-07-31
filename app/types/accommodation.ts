import type { ID } from './common'

/**
 * Accommodation (Section 14 — roadmap Section 00–24 baru). Entitas baru `HotelBooking`, TERPISAH dari
 * `ProjectService` (Foundation/Section 12 lama) — pola arsitektur IDENTIK D-070 (Section 13/Ticketing):
 * `ProjectService` (tipe `hotel`) tetap ringkasan baris generik di tab "Itinerary & Services"
 * (label/status/vendor/bookingReference), sedangkan `HotelBooking` adalah model lifecycle detail KHUSUS
 * hotel (options/room block/check-in-out/voucher/amendment/cancellation/no-show/penalty/net cost) yang
 * tidak bisa dipaksakan ke model generik itu tanpa mencampur konsep lintas-domain. `serviceId` (opsional)
 * menautkan balik ke `ProjectService` bila baris generiknya sudah ada — TIDAK wajib.
 *
 * "Room block, occupancy, rooming list" (Wajib) SENGAJA TIDAK diduplikasi di sini — direuse penuh dari
 * `TravelerGroup`/`RoomAssignment` (Section 11, `app/types/project.ts`) lewat `groupId` opsional (lihat
 * `getHotelRoomingList`, `app/data/index.ts`), konsisten prinsip "jangan membuat dataset paralel".
 * "Traveler special requests" (Wajib) juga direuse dari `Traveler.specialRequest`/`dietaryRestrictions`/
 * `accessibilityNeeds` (Section 11) lewat `travelerIds` — bukan field baru.
 */

export type MealPlan = 'room-only' | 'breakfast' | 'half-board' | 'full-board'

/** "Hotel sourcing/options" + "Property, room type, rate plan, meal, policies" (Wajib) — embedded array, pola sama `FlightOption`. */
export interface HotelOption {
  propertyName: string
  roomType: string
  ratePlan: string
  mealPlan: MealPlan
  ratePerNightIdr: number
  policies?: string
  isSelected?: boolean
}

/**
 * "Quote, booking, confirmation, voucher" + "Amendment, cancellation, no-show, deadline, penalty" (Wajib) —
 * lifecycle literal 7 nilai. `requested` = baru diajukan/sourcing (nilai awal seluruh booking baru).
 * `amended` = perubahan pasca-konfirmasi (mis. upgrade tipe kamar) — bukan status terminal, booking tetap
 * dapat lanjut ke `completed`/`cancelled`/`no-show` setelahnya.
 */
export type HotelBookingStatus = 'requested' | 'quoted' | 'confirmed' | 'amended' | 'completed' | 'cancelled' | 'no-show'

export interface HotelBooking {
  id: ID
  projectId: ID
  /** Opsional — referensi balik ke `ProjectService` (tipe `hotel`) bila baris generiknya sudah ada. */
  serviceId?: ID
  /** Opsional — referensi ke `TravelerGroup` (Section 11) untuk reuse room block/occupancy/rooming list (`getHotelRoomingList`). Kosong bila booking individual/lintas-group. */
  groupId?: ID
  status: HotelBookingStatus
  options: HotelOption[]
  /** "Individual maupun group" (acceptance) — 1 traveler = individual, banyak traveler = group; juga sumber tampilan "Traveler special requests" (reuse `Traveler.specialRequest`/dietary/accessibility). */
  travelerIds: ID[]
  /** "Room block" (Wajib) — jumlah kamar yang diblok/dipesan; dapat berbeda dari jumlah baris `RoomAssignment` aktual bila belum seluruhnya di-assign nama. */
  roomsBlocked?: number
  /** "Check-in/out" (Wajib). */
  checkInDate?: string
  checkOutDate?: string
  /** "Early/late request" (Wajib). */
  earlyCheckInRequested?: boolean
  lateCheckOutRequested?: boolean
  /** "Confirmation" (Wajib) — nomor konfirmasi mock, bukan integrasi PMS/OTA nyata (D-006), pola sama `FlightBooking.pnr`. */
  confirmationNumber?: string
  /** "Voucher" (Wajib) — timestamp voucher diterbitkan (mock milestone, bukan generator dokumen produksi). */
  voucherIssuedAt?: string
  /** "Deadline" (Wajib) — tenggat pembatalan tanpa penalti penuh. */
  cancellationDeadline?: string
  /** "Amendment" (Wajib) — catatan perubahan (mis. upgrade tipe kamar) saat status `amended`. */
  amendmentNote?: string
  /** "Penalty" (Wajib) — nominal penalti yang dikenakan untuk cancellation/no-show (opsional, 0 = tidak dikenakan). */
  cancellationPenaltyIdr?: number
  noShowPenaltyIdr?: number
  /** Alasan wajib untuk transisi `cancelled`/`no-show` (pola sama `updateFlightBookingStatus`, D-070) — dicatat di sini (nilai terakhir) DAN sebagai `ActivityEntry` di project terkait. */
  statusReason?: string
  /** "Internal cost isolation" (Wajib) — `netCostIdr` TIDAK BOLEH terlihat Client (pola sama `FlightBooking`/`CostSheet`/`Quotation.estimatedCostIdr`, D-065/D-067/D-070). Keduanya opsional — belum terisi selama status `requested`/`quoted` (harga belum final). */
  netCostIdr?: number
  sellPriceIdr?: number
  createdAt: string
  updatedAt?: string
}
