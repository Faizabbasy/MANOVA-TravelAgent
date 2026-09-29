import { reactive } from 'vue'
import type { FlightBooking } from '~/types/ticketing'

/**
 * `reactive()` (Section 13 — roadmap Section 00–24 baru) — melanjutkan pola Section 07 dst.
 *
 * Fixture di bawah SENGAJA ditautkan ke `ProjectService`/`ItineraryItem`/`ActivityEntry` existing yang
 * relevan (bukan dataset paralel terpisah): `FLT-1011`/`1021`/`1031`/`1032` menautkan `serviceId` ke
 * `SVC-1011`/`1021`/`1031`/`1032` (`app/data/projects.ts`) — `pnr` mengikuti persis `bookingReference`
 * existing baris tsb (mis. `SVC-1011.bookingReference` = `'PNR-MNL8201'` → `FLT-1011.pnr` = `'MNL8201'`),
 * segmen mengikuti tanggal/jam `ItineraryItem` terkait, dan biaya opsi `fareIdr` mengikuti `costPerPaxIdr`
 * `CostSheet` Section 10 untuk destinasi yang sama (`CS-001`/`CS-002`/`CS-003`) — konsistensi lintas-modul,
 * bukan angka acak baru. `FLT-1021` (Abu Dhabi, `reissued`) menautkan narasi `CHG-1021` (perubahan
 * tanggal, Section 14 lama) sebagai alasan reissue. Mencakup 5 dari 7 status lifecycle (`requested`/
 * `hold`/`issued`/`reissued`/`refunded`) — `confirmed`/`cancelled` sengaja tidak di-seed (tetap reachable
 * lewat transisi UI, diverifikasi lewat code review, konsisten pola Section 09/12 yang tidak mem-pre-seed
 * seluruh state).
 */
export const FLIGHT_BOOKINGS: FlightBooking[] = reactive([
  {
    id: 'FLT-1011',
    projectId: 'PRJ-101',
    serviceId: 'SVC-1011',
    pnr: 'MNL8201',
    status: 'issued',
    options: [
      { airline: 'Budget Wings Air', cabinClass: 'economy', fareIdr: 10_500_000, baggageAllowance: '10kg', isSelected: false },
      { airline: 'Garuda Nusantara', cabinClass: 'economy', fareIdr: 12_500_000, baggageAllowance: '20kg', ancillaries: 'Pemilihan kursi, bagasi tambahan 10kg', isSelected: true }
    ],
    segments: [
      { origin: 'CGK Jakarta', destination: 'MNL Manila', flightNumber: 'GN-812', departureAt: '2026-08-20T08:00' },
      { origin: 'MNL Manila', destination: 'CGK Jakarta', flightNumber: 'GN-815', departureAt: '2026-08-23T15:00' }
    ],
    travelerIds: ['TRV-1011', 'TRV-1012', 'TRV-1013', 'TRV-1014', 'TRV-1015', 'TRV-1016'],
    ticketingDeadline: '2026-08-05',
    fareRules: 'Non-refundable setelah issued. Reschedule dikenakan biaya admin Rp500.000/pax.',
    netCostIdr: 75_000_000,
    sellPriceIdr: 95_000_000,
    createdAt: '2026-06-15',
    updatedAt: '2026-06-25'
  },
  {
    id: 'FLT-1021',
    projectId: 'PRJ-102',
    serviceId: 'SVC-1021',
    pnr: 'AUH9221',
    status: 'reissued',
    options: [
      { airline: 'Gulf Horizon', cabinClass: 'economy', fareIdr: 9_500_000, baggageAllowance: '20kg', isSelected: false },
      { airline: 'Emirates Skyline', cabinClass: 'economy', fareIdr: 9_800_000, baggageAllowance: '25kg', ancillaries: 'Direct flight, meal included', isSelected: true }
    ],
    segments: [
      { origin: 'CGK Jakarta', destination: 'AUH Abu Dhabi', flightNumber: 'ES-241', departureAt: '2026-09-22T10:00' },
      { origin: 'AUH Abu Dhabi', destination: 'CGK Jakarta', flightNumber: 'ES-248', departureAt: '2026-09-26T14:00' }
    ],
    travelerIds: ['TRV-1021', 'TRV-1022', 'TRV-1023', 'TRV-1024', 'TRV-1025', 'TRV-1026'],
    ticketingDeadline: '2026-09-10',
    fareRules: 'Reissue gratis 1x untuk perubahan tanggal dari klien; reissue berikutnya dikenakan selisih fare.',
    netCostIdr: 58_800_000,
    sellPriceIdr: 72_000_000,
    hasScheduleChange: true,
    scheduleChangeNote: 'Tanggal keberangkatan berubah dari 15–19 Sep menjadi 22–26 Sep 2026 (lihat CHG-1021, tab Activity & Changes) — tiket lama di-reissue menyesuaikan jadwal baru.',
    createdAt: '2026-06-20',
    updatedAt: '2026-07-08'
  },
  {
    id: 'FLT-1031',
    projectId: 'PRJ-103',
    serviceId: 'SVC-1031',
    pnr: 'PLW1031A',
    status: 'issued',
    options: [
      { airline: 'Nusantara Air', cabinClass: 'economy', fareIdr: 3_200_000, baggageAllowance: '15kg', isSelected: false },
      { airline: 'Garuda Nusantara', cabinClass: 'economy', fareIdr: 3_400_000, baggageAllowance: '20kg', isSelected: true }
    ],
    segments: [
      { origin: 'CGK Jakarta', destination: 'PLW Palu', flightNumber: 'GN-511', departureAt: '2026-08-10T07:00' }
    ],
    travelerIds: ['TRV-1032', 'TRV-1033'],
    ticketingDeadline: '2026-07-25',
    fareRules: 'Group rate — perubahan nama peserta dikenakan biaya admin per pax.',
    netCostIdr: 6_800_000,
    sellPriceIdr: 8_800_000,
    createdAt: '2026-06-10',
    updatedAt: '2026-06-18'
  },
  {
    id: 'FLT-1032',
    projectId: 'PRJ-103',
    serviceId: 'SVC-1032',
    status: 'hold',
    options: [
      { airline: 'Garuda Nusantara', cabinClass: 'economy', fareIdr: 3_400_000, baggageAllowance: '20kg', isSelected: false },
      { airline: 'Garuda Nusantara', cabinClass: 'premium-economy', fareIdr: 4_200_000, baggageAllowance: '25kg', ancillaries: 'Extra legroom, prioritas boarding', isSelected: false }
    ],
    segments: [
      { origin: 'CGK Jakarta', destination: 'PLW Palu', flightNumber: 'GN-513', departureAt: '2026-08-10T15:00' }
    ],
    travelerIds: ['TRV-1031', 'TRV-1036'],
    ticketingDeadline: '2026-08-01',
    createdAt: '2026-07-20',
    updatedAt: '2026-07-27'
  },
  {
    id: 'FLT-1023',
    projectId: 'PRJ-102',
    pnr: 'AUH9245',
    status: 'refunded',
    options: [
      { airline: 'Emirates Skyline', cabinClass: 'economy', fareIdr: 9_800_000, baggageAllowance: '25kg', isSelected: true }
    ],
    segments: [
      { origin: 'CGK Jakarta', destination: 'AUH Abu Dhabi', flightNumber: 'ES-241', departureAt: '2026-09-22T10:00' }
    ],
    travelerIds: ['TRV-1024'],
    ticketingDeadline: '2026-09-10',
    fareRules: 'Refundable dengan potongan biaya admin 15%.',
    netCostIdr: 9_800_000,
    sellPriceIdr: 12_000_000,
    statusReason: 'Traveler mengundurkan diri karena keperluan mendesak — tiket dibatalkan dan diproses refund.',
    createdAt: '2026-06-25',
    updatedAt: '2026-07-15'
  },
  {
    id: 'FLT-1033',
    projectId: 'PRJ-103',
    status: 'requested',
    options: [
      { airline: 'Nusantara Air', cabinClass: 'economy', fareIdr: 3_100_000, baggageAllowance: '15kg', isSelected: false },
      { airline: 'Garuda Nusantara', cabinClass: 'economy', fareIdr: 3_600_000, baggageAllowance: '20kg', ancillaries: 'Jadwal fleksibel, dapat direschedule 1x gratis', isSelected: false }
    ],
    segments: [
      { origin: 'PLW Palu', destination: 'CGK Jakarta', departureAt: '2026-08-14T16:00' }
    ],
    travelerIds: [],
    ticketingDeadline: '2026-08-05',
    createdAt: '2026-07-28'
  }
])
