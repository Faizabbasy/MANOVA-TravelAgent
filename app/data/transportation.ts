import { reactive } from 'vue'
import type { TransportBooking } from '~/types/transportation'

/**
 * `reactive()` (Section 15 — roadmap Section 00–24 baru) — melanjutkan pola Section 07 dst.
 *
 * Fixture di bawah SENGAJA ditautkan ke `ProjectService`/`TravelerGroup`/`VendorQuotation` existing yang
 * relevan (bukan dataset paralel terpisah): `TRN-1034` menautkan `serviceId: 'SVC-1034'` (`app/data/projects.ts`,
 * "Ground Transportation" PRJ-103, masih `pending-confirmation` — VQ-009/VQ-010 di `app/data/vendors.ts` masih
 * `submitted`, BELUM diputuskan Procurement, TIDAK diubah/diasumsikan diterima oleh section ini) — rate
 * kendaraan per-hari pada `options` berada dalam skala yang sama dengan kedua quotation vendor tsb
 * (Rp45.000.000/Rp52.000.000 untuk seluruh armada 10 unit bus), TANPA memaksakan kesamaan angka persis
 * (granularitas berbeda: `VendorQuotation` = harga total per-vendor untuk seluruh layanan, `TransportBooking`
 * = booking operasional per-group/leg). `TRN-1034`/`1035`/`1036` menautkan `groupId` ke `TravelerGroup`
 * existing (`GRP-001`/`002`/`003`, Section 11) untuk "Manifest/group allocation" — TIDAK ADA baris manifest
 * baru dibuat. Mencakup 5 dari 7 status lifecycle (`quoted`/`assigned`/`confirmed`/`completed`/`cancelled`)
 * — `requested`/`no-show` sengaja tidak di-seed (tetap reachable lewat transisi UI, diverifikasi lewat code
 * review, konsisten pola Section 13/14).
 */
export const TRANSPORT_BOOKINGS: TransportBooking[] = reactive([
  // PRJ-103 — Management (GRP-001, 10 pax), multi-day charter, driver sudah ditugaskan.
  {
    id: 'TRN-1034',
    projectId: 'PRJ-103',
    serviceId: 'SVC-1034',
    groupId: 'GRP-001',
    transferType: 'multi-day-charter',
    status: 'assigned',
    options: [
      { vehicleType: 'van', capacity: 10, luggageCapacity: '10 koper sedang', rateUnit: 'per-day', ratePerUnitIdr: 950_000, isSelected: false },
      { vehicleType: 'minibus', capacity: 15, luggageCapacity: '15 koper besar', accessibilityFeatures: 'Pintu masuk rendah, dapat memuat 1 kursi roda lipat', rateUnit: 'per-day', ratePerUnitIdr: 1_350_000, isSelected: true }
    ],
    legs: [
      { pickupLocation: 'Bandara Mutiara SIS Al-Jufri, Palu', dropoffLocation: 'Hotel Prima Mitra Convention Center Wing', scheduledAt: '2026-08-10T08:00', label: 'Airport Transfer — Kedatangan' },
      { pickupLocation: 'Hotel Prima Mitra Convention Center Wing', dropoffLocation: 'Venue MICE Conference', scheduledAt: '2026-08-11T07:30', label: 'Hotel ke Venue — Hari 1' },
      { pickupLocation: 'Hotel Prima Mitra Convention Center Wing', dropoffLocation: 'Bandara Mutiara SIS Al-Jufri, Palu', scheduledAt: '2026-08-14T13:00', label: 'Airport Transfer — Kepulangan' }
    ],
    travelerIds: ['TRV-1032', 'TRV-1033'],
    assignedVehiclePlateNumber: 'DN 1234 AB',
    driverName: 'Herman Wijaya',
    driverPhone: '0852-6600-1001',
    standbyHours: 4,
    tollFeeIdr: 150_000,
    netCostIdr: 5_950_000,
    sellPriceIdr: 7_200_000,
    createdAt: '2026-06-12',
    updatedAt: '2026-07-20'
  },
  // PRJ-103 — Sales Team (GRP-002, 25 pax), confirmed, mendemokan "Change" (jadwal city tour dimajukan).
  {
    id: 'TRN-1035',
    projectId: 'PRJ-103',
    groupId: 'GRP-002',
    transferType: 'multi-day-charter',
    status: 'confirmed',
    options: [
      { vehicleType: 'bus', capacity: 40, luggageCapacity: '30 koper besar', rateUnit: 'per-day', ratePerUnitIdr: 1_800_000, isSelected: true }
    ],
    legs: [
      { pickupLocation: 'Bandara Mutiara SIS Al-Jufri, Palu', dropoffLocation: 'Hotel Prima Mitra Standard Wing', scheduledAt: '2026-08-10T15:00', label: 'Airport Transfer — Kedatangan' },
      { pickupLocation: 'Hotel Prima Mitra Standard Wing', dropoffLocation: 'Rute City Tour', scheduledAt: '2026-08-13T08:00', label: 'City Tour & Free Program' }
    ],
    travelerIds: ['TRV-1034', 'TRV-1035'],
    assignedVehiclePlateNumber: 'DN 5678 CD',
    driverName: 'Slamet Riyadi',
    driverPhone: '0852-6600-1002',
    tollFeeIdr: 100_000,
    hasChange: true,
    changeNote: 'Jadwal City Tour dimajukan dari 10:00 menjadi 08:00 mengikuti penyesuaian agenda MICE Conference Hari 1.',
    netCostIdr: 7_300_000,
    sellPriceIdr: 8_800_000,
    createdAt: '2026-06-15',
    updatedAt: '2026-08-05'
  },
  // PRJ-103 — Partner/VIP (GRP-003), point-to-point kepulangan, mendemokan aksesibilitas + "Incident".
  {
    id: 'TRN-1036',
    projectId: 'PRJ-103',
    groupId: 'GRP-003',
    transferType: 'point-to-point',
    status: 'completed',
    options: [
      { vehicleType: 'van', capacity: 6, luggageCapacity: '6 koper', accessibilityFeatures: 'Ramp kursi roda, sabuk pengaman khusus', rateUnit: 'per-trip', ratePerUnitIdr: 650_000, isSelected: true }
    ],
    legs: [
      { pickupLocation: 'Hotel Prima Mitra VIP Suite Wing', dropoffLocation: 'Bandara Mutiara SIS Al-Jufri, Palu', scheduledAt: '2026-08-14T13:30', label: 'Airport Transfer — Kepulangan VIP' }
    ],
    travelerIds: ['TRV-1031', 'TRV-1036'],
    assignedVehiclePlateNumber: 'DN 9012 EF',
    driverName: 'Yanto Pratama',
    driverPhone: '0852-6600-1003',
    hasIncident: true,
    incidentNote: 'Unit awal mengalami kendala AC saat pre-check — diganti unit cadangan (DN 9012 EF) 30 menit sebelum jadwal, tidak ada keterlambatan keberangkatan.',
    netCostIdr: 650_000,
    sellPriceIdr: 850_000,
    createdAt: '2026-06-20',
    updatedAt: '2026-08-14'
  },
  // PRJ-103 — individual, dibatalkan sebelum eksekusi (peserta memakai kendaraan pribadi).
  {
    id: 'TRN-1037',
    projectId: 'PRJ-103',
    transferType: 'airport-pickup',
    status: 'cancelled',
    options: [
      { vehicleType: 'sedan', capacity: 3, luggageCapacity: '2 koper', rateUnit: 'per-trip', ratePerUnitIdr: 350_000, isSelected: false }
    ],
    legs: [
      { pickupLocation: 'Bandara Mutiara SIS Al-Jufri, Palu', dropoffLocation: 'Hotel Prima Mitra Convention Center Wing', scheduledAt: '2026-08-10T09:00', label: 'Airport Transfer — Individual' }
    ],
    travelerIds: ['TRV-1035'],
    statusReason: 'Peserta memutuskan menggunakan kendaraan pribadi — transfer bandara dibatalkan sebelum eksekusi, tidak ada penggantian unit.',
    createdAt: '2026-06-25',
    updatedAt: '2026-07-30'
  },
  // PRJ-103 — permintaan tambahan (overflow day charter) untuk agenda MICE, masih tahap quote.
  {
    id: 'TRN-1038',
    projectId: 'PRJ-103',
    transferType: 'full-day-charter',
    status: 'quoted',
    options: [
      { vehicleType: 'minibus', capacity: 15, rateUnit: 'per-day', ratePerUnitIdr: 1_350_000, isSelected: false },
      { vehicleType: 'bus', capacity: 40, rateUnit: 'per-day', ratePerUnitIdr: 1_800_000, isSelected: false }
    ],
    legs: [
      { pickupLocation: 'Hotel Prima Mitra Convention Center Wing', dropoffLocation: 'Venue Alternatif MICE (opsional)', scheduledAt: '2026-08-12T09:00', label: 'Overflow Day Charter (tentatif)' }
    ],
    travelerIds: [],
    createdAt: '2026-07-28'
  }
])
