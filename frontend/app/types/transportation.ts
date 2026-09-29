import type { ID } from './common'

/**
 * Transportation (Section 15 — roadmap Section 00–24 baru). Entitas baru `TransportBooking`, TERPISAH dari
 * `ProjectService` (Foundation/Section 12 lama) — pola arsitektur IDENTIK D-070/D-071 (Section 13/Ticketing,
 * Section 14/Accommodation): `ProjectService` (tipe `transportation`) tetap ringkasan baris generik di tab
 * "Itinerary & Services" (label/status/vendor/bookingReference), sedangkan `TransportBooking` adalah model
 * lifecycle detail KHUSUS transportasi darat (options/legs/dispatch/standby-overtime-toll/assignment/driver
 * sheet) yang tidak bisa dipaksakan ke model generik itu. `serviceId` (opsional) menautkan balik ke
 * `ProjectService` bila baris generiknya sudah ada — TIDAK wajib.
 *
 * "Manifest/group allocation" (Wajib) SENGAJA TIDAK diduplikasi — direuse dari `TravelerGroup` (Section 11,
 * `app/types/project.ts`) lewat `groupId` opsional, konsisten prinsip "jangan membuat dataset paralel"
 * (pola sama `HotelBooking.groupId`, D-071). "Supplier" (Wajib) direuse dari `Vendor`/`ProjectService.vendorId`
 * existing (Section 13 lama) — tidak ada entitas Supplier paralel.
 */

export type VehicleType = 'sedan' | 'suv' | 'van' | 'minibus' | 'bus'

export type TransportRateUnit = 'per-trip' | 'per-day' | 'per-hour'

/** "Transfer/service request" (Wajib) — kategori permintaan, ditampilkan di ringkasan dan dokumen. */
export type TransferType = 'airport-pickup' | 'airport-dropoff' | 'point-to-point' | 'full-day-charter' | 'multi-day-charter'

/** "Vehicle type, capacity, luggage, accessibility" (Wajib) — embedded array, pola sama `HotelOption`/`FlightOption`. */
export interface TransportOption {
  vehicleType: VehicleType
  capacity: number
  luggageCapacity?: string
  accessibilityFeatures?: string
  rateUnit: TransportRateUnit
  ratePerUnitIdr: number
  isSelected?: boolean
}

/** "Pickup/drop-off, route, schedule" + "Multi-leg dispatch" (Wajib) — satu leg = satu segmen perjalanan (bisa lebih dari satu untuk rombongan multi-titik). */
export interface TransportLeg {
  pickupLocation: string
  dropoffLocation: string
  scheduledAt: string
  label?: string
}

/**
 * "Quote, assignment, confirmation, service order, driver sheet" (Wajib) — lifecycle literal 7 nilai,
 * mengikuti urutan tahap literal (Quote → Assignment → Confirmation). `requested` = permintaan baru masuk
 * (nilai awal seluruh booking baru), sebelum quote diajukan.
 */
export type TransportBookingStatus = 'requested' | 'quoted' | 'assigned' | 'confirmed' | 'completed' | 'cancelled' | 'no-show'

export interface TransportBooking {
  id: ID
  projectId: ID
  /** Opsional — referensi balik ke `ProjectService` (tipe `transportation`) bila baris generiknya sudah ada. */
  serviceId?: ID
  /** Opsional — referensi ke `TravelerGroup` (Section 11) untuk reuse "Manifest/group allocation" (Wajib). Kosong = booking individual. */
  groupId?: ID
  /** "Transfer/service request" (Wajib). */
  transferType?: TransferType
  status: TransportBookingStatus
  options: TransportOption[]
  legs: TransportLeg[]
  /** "Manifest/group allocation" (Wajib) — juga berfungsi sebagai indikator individual vs group (1 entri = individual, banyak = group), pola sama `HotelBooking.travelerIds`/`FlightBooking.travelerIds`. */
  travelerIds: ID[]
  /** "Supplier, vehicle, driver, contact" (Wajib) — nomor polisi/nama+telepon driver, terisi begitu status mencapai `assigned` ke atas (mock, bukan integrasi fleet management nyata, D-006). Supplier sendiri direuse dari `ProjectService.vendorId`/`Vendor` existing. */
  assignedVehiclePlateNumber?: string
  driverName?: string
  driverPhone?: string
  /** "Standby/overtime/toll" (Wajib) — biaya tambahan eksplisit, terpisah dari rate dasar opsi kendaraan. */
  standbyHours?: number
  overtimeHours?: number
  tollFeeIdr?: number
  /** "Change" (Wajib) — perubahan rute/jadwal pasca-assignment, pola sama `FlightBooking.hasScheduleChange`. */
  hasChange?: boolean
  changeNote?: string
  /** "Incident" (Wajib) — insiden operasional (mis. kendaraan mogok, kecelakaan ringan), terpisah dari "Change" karena bersifat tidak terduga/di luar rencana. */
  hasIncident?: boolean
  incidentNote?: string
  /** Alasan wajib untuk transisi `cancelled`/`no-show` (pola sama `updateHotelBookingStatus`/`updateFlightBookingStatus`, D-070/D-071) — dicatat di sini (nilai terakhir) DAN sebagai `ActivityEntry` di project terkait. */
  statusReason?: string
  /** Internal cost isolation (hard rule protokol — "Jangan menampilkan internal cost/margin kepada Client") — `netCostIdr` TIDAK BOLEH terlihat Client (pola sama `FlightBooking`/`HotelBooking`, D-070/D-071). Keduanya opsional — belum terisi selama status `requested`/`quoted` (harga belum final). */
  netCostIdr?: number
  sellPriceIdr?: number
  createdAt: string
  updatedAt?: string
}
