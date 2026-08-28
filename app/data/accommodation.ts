import { reactive } from 'vue'
import type { HotelBooking } from '~/types/accommodation'

/**
 * `reactive()` (Section 14 — roadmap Section 00–24 baru) — melanjutkan pola Section 07 dst.
 *
 * Fixture di bawah SENGAJA ditautkan ke `ProjectService`/`TravelerGroup`/`RoomAssignment`/`ItineraryItem`
 * existing yang relevan (bukan dataset paralel terpisah): `HTL-1022`/`1023`/`1033` menautkan `serviceId` ke
 * `SVC-1022`/`1023`/`1033` (`app/data/projects.ts`) — `confirmationNumber` mengikuti persis `bookingReference`
 * existing baris tsb (mis. `SVC-1022.bookingReference` = `'HTL-AUH-A104'` → `HTL-1022.confirmationNumber` =
 * `'AUH-A104'`). `HTL-1033`/`1034`/`1035` menautkan `groupId` ke `TravelerGroup` (`GRP-001`/`002`/`003`,
 * Section 11) sehingga rooming list-nya (`getHotelRoomingList`) membaca `ROOM_ASSIGNMENTS` existing
 * (`ROOM-001`/`002`/`003`) — TIDAK ADA baris rooming baru dibuat. `ratePerNightIdr` opsi mengikuti
 * `costPerPaxIdr` Cost Sheet Section 10 (`CS-002`/`CS-003`/`CS-004`, `app/data/products.ts`) dibagi 4 malam
 * untuk destinasi yang sama — konsistensi lintas-modul, bukan angka acak baru. `HTL-1022` (Abu Dhabi,
 * `amended`) menautkan narasi upgrade Suite yang sama seperti `ITIN-1022`/`ITIN-1026` (`app/data/projects.ts`).
 * Mencakup 5 dari 7 status lifecycle (`requested`/`quoted`/`confirmed`/`amended`/`cancelled`) — `completed`/
 * `no-show` sengaja tidak di-seed (tetap reachable lewat transisi UI, diverifikasi lewat code review,
 * konsisten pola Section 13 yang tidak mem-pre-seed seluruh state).
 */
export const HOTEL_BOOKINGS: HotelBooking[] = reactive([
  // PRJ-102 — Abu Dhabi, Room Block A: upgrade ke Suite pasca komplain AC (lihat ITIN-1022/1026).
  {
    id: 'HTL-1022',
    projectId: 'PRJ-102',
    serviceId: 'SVC-1022',
    status: 'amended',
    options: [
      { propertyName: 'Hotel Prima Mitra — Deluxe Wing', roomType: 'Twin Deluxe', ratePlan: 'Standard Corporate Rate', mealPlan: 'breakfast', ratePerNightIdr: 1_125_000, policies: 'Free cancellation H-3, kamar non-smoking.', isSelected: false },
      { propertyName: 'Hotel Prima Mitra — Corniche Suite Wing', roomType: 'Suite', ratePlan: 'Corporate Suite Upgrade', mealPlan: 'breakfast', ratePerNightIdr: 1_800_000, policies: 'Non-refundable, upgrade fasilitas ballroom.', isSelected: true }
    ],
    travelerIds: ['TRV-1021', 'TRV-1022', 'TRV-1023', 'TRV-1024', 'TRV-1025', 'TRV-1026'],
    roomsBlocked: 9,
    checkInDate: '2026-09-22',
    checkOutDate: '2026-09-26',
    confirmationNumber: 'AUH-A104',
    voucherIssuedAt: '2026-06-25',
    cancellationDeadline: '2026-09-10',
    amendmentNote: 'Upgrade tipe kamar dari Twin Deluxe ke Suite untuk seluruh Room Block A pasca komplain unit AC bermasalah (lihat ITIN-1026, tab Itinerary & Services).',
    netCostIdr: 129_600_000,
    sellPriceIdr: 152_900_000,
    createdAt: '2026-06-15',
    updatedAt: '2026-09-05'
  },
  // PRJ-102 — Room Block B (3 pax) digabung ke Block A, dibatalkan setelah deadline — mendemokan penalty.
  {
    id: 'HTL-1023',
    projectId: 'PRJ-102',
    serviceId: 'SVC-1023',
    status: 'cancelled',
    options: [
      { propertyName: 'Hotel Prima Mitra — Deluxe Wing', roomType: 'Twin Deluxe', ratePlan: 'Standard Corporate Rate', mealPlan: 'breakfast', ratePerNightIdr: 1_125_000, isSelected: true }
    ],
    travelerIds: ['TRV-1025', 'TRV-1026'],
    roomsBlocked: 2,
    checkInDate: '2026-09-22',
    checkOutDate: '2026-09-26',
    cancellationDeadline: '2026-09-10',
    cancellationPenaltyIdr: 2_025_000,
    statusReason: 'Room Block B digabungkan ke Room Block A (HTL-1022) karena okupansi 3 pax terpisah tidak efisien — pembatalan dilakukan setelah deadline sehingga dikenakan penalti 15% dari estimasi biaya.',
    createdAt: '2026-06-15',
    updatedAt: '2026-09-12'
  },
  // PRJ-103 — Palu, Group Management (GRP-001, 10 pax), rooming list reuse ROOM-001.
  {
    id: 'HTL-1033',
    projectId: 'PRJ-103',
    serviceId: 'SVC-1033',
    groupId: 'GRP-001',
    status: 'confirmed',
    options: [
      { propertyName: 'Hotel Prima Mitra — Convention Center Wing', roomType: 'Twin Standard', ratePlan: 'Group Convention Rate', mealPlan: 'full-board', ratePerNightIdr: 1_350_000, policies: 'Deposit 50% saat konfirmasi, pelunasan H-7 sebelum check-in.', isSelected: true }
    ],
    travelerIds: ['TRV-1032', 'TRV-1033'],
    roomsBlocked: 5,
    checkInDate: '2026-08-10',
    checkOutDate: '2026-08-14',
    earlyCheckInRequested: true,
    confirmationNumber: 'PLW-2200',
    voucherIssuedAt: '2026-06-20',
    cancellationDeadline: '2026-07-25',
    netCostIdr: 54_000_000,
    sellPriceIdr: 63_000_000,
    createdAt: '2026-06-10',
    updatedAt: '2026-06-20'
  },
  // PRJ-103 — Sales Team (GRP-002, 25 pax) — masih quoted, 2 opsi property dibandingkan.
  {
    id: 'HTL-1034',
    projectId: 'PRJ-103',
    groupId: 'GRP-002',
    status: 'quoted',
    options: [
      { propertyName: 'Hotel Prima Mitra — Standard Wing', roomType: 'Twin Standard', ratePlan: 'Group Rate Bintang 3', mealPlan: 'breakfast', ratePerNightIdr: 900_000, policies: 'Free cancellation H-5.', isSelected: false },
      { propertyName: 'Hotel Prima Mitra — Convention Center Wing', roomType: 'Twin Deluxe', ratePlan: 'Group Rate Bintang 4', mealPlan: 'full-board', ratePerNightIdr: 1_350_000, policies: 'Dekat venue acara, hemat waktu transportasi.', isSelected: true }
    ],
    travelerIds: ['TRV-1034', 'TRV-1035'],
    roomsBlocked: 13,
    checkInDate: '2026-08-10',
    checkOutDate: '2026-08-14',
    cancellationDeadline: '2026-07-20',
    createdAt: '2026-06-18'
  },
  // PRJ-103 — Partner/VIP (GRP-003) — booking individual/VIP dengan kebutuhan aksesibilitas (TRV-1031).
  {
    id: 'HTL-1035',
    projectId: 'PRJ-103',
    groupId: 'GRP-003',
    status: 'confirmed',
    options: [
      { propertyName: 'Hotel Prima Mitra — VIP Suite Wing', roomType: 'Suite VIP (Aksesibilitas)', ratePlan: 'VIP Group Rate', mealPlan: 'full-board', ratePerNightIdr: 2_200_000, policies: 'Kamar lantai dasar dengan akses kursi roda, sesuai kebutuhan traveler.', isSelected: true }
    ],
    travelerIds: ['TRV-1031', 'TRV-1036'],
    roomsBlocked: 2,
    checkInDate: '2026-08-10',
    checkOutDate: '2026-08-14',
    lateCheckOutRequested: true,
    confirmationNumber: 'PLW-2200-VIP',
    voucherIssuedAt: '2026-06-22',
    cancellationDeadline: '2026-07-25',
    netCostIdr: 35_200_000,
    sellPriceIdr: 41_000_000,
    createdAt: '2026-06-12',
    updatedAt: '2026-06-22'
  },
  // PRJ-102 — permintaan overflow kamar untuk traveler yang menyusul belakangan, masih sourcing.
  {
    id: 'HTL-1036',
    projectId: 'PRJ-102',
    status: 'requested',
    options: [],
    travelerIds: [],
    checkInDate: '2026-09-22',
    checkOutDate: '2026-09-26',
    createdAt: '2026-08-28'
  },
  // PRJ-205 — Open Trip Bromo Ijen (dummy Project B2C), menautkan `serviceId: 'SVC-2052'`
  // (`app/data/projects.ts`) — netCostIdr/sellPriceIdr mengikuti VQ-012 (`app/data/vendors.ts`).
  {
    id: 'HTL-2052',
    projectId: 'PRJ-205',
    serviceId: 'SVC-2052',
    status: 'confirmed',
    options: [
      { propertyName: 'Homestay Bromo View', roomType: 'Twin/Triple Basic', ratePlan: 'Group Rate', mealPlan: 'breakfast', ratePerNightIdr: 600_000, policies: 'Non-refundable, khusus rombongan.', isSelected: true }
    ],
    travelerIds: ['TRV-2051', 'TRV-2052', 'TRV-2053', 'TRV-2054', 'TRV-2055'],
    roomsBlocked: 2,
    checkInDate: '2026-09-18',
    checkOutDate: '2026-09-19',
    confirmationNumber: 'HTL-BRM-2026',
    voucherIssuedAt: '2026-08-18',
    cancellationDeadline: '2026-09-10',
    netCostIdr: 12_000_000,
    sellPriceIdr: 14_000_000,
    createdAt: '2026-08-18',
    updatedAt: '2026-08-18'
  }
])
