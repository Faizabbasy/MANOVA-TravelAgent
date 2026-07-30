import { reactive } from 'vue'
import type { Project, ProjectService, TravelerGroup, Traveler, RoomAssignment, ItineraryItem } from '~/types/project'

/**
 * `reactive()` (Section 09) — melanjutkan pola Section 07/08. Approve Won harus mendorong Project baru
 * ke array ini dan langsung terlihat di `/projects`, Dashboard, dan Party Detail tanpa reload.
 */

/** docs/mockup-data-scenarios.md bagian 1-3 — 3 skenario demo wajib (Normal/High-Change/Complex). */
export const PROJECTS: Project[] = reactive([
  {
    id: 'PRJ-101', name: 'Manila Business Trip', partyId: 'PTY-001', opportunityId: 'OPP-001',
    destination: 'Manila, Filipina', travelStartDate: '2026-08-20', travelEndDate: '2026-08-23',
    characteristic: 'normal', serviceScope: ['flight'], travelerCount: 6,
    ownerId: 'USR-002', teamUserIds: ['USR-004'], status: 'confirmed',
    quotationAmountIdr: 95_000_000, budgetIdr: 85_000_000, actualCostIdr: 82_500_000,
  },
  {
    id: 'PRJ-102', name: 'Abu Dhabi Corporate Gathering', partyId: 'PTY-002', opportunityId: 'OPP-002',
    destination: 'Abu Dhabi, Uni Emirat Arab', travelStartDate: '2026-09-22', travelEndDate: '2026-09-26',
    characteristic: 'high-change', serviceScope: ['flight', 'hotel'], travelerCount: 18,
    ownerId: 'USR-013', teamUserIds: ['USR-004', 'USR-005'], status: 'planning',
    quotationAmountIdr: 345_000_000, budgetIdr: 310_000_000, actualCostIdr: 335_000_000,
  },
  {
    id: 'PRJ-103', name: 'Palu MICE Conference 2026', partyId: 'PTY-003', opportunityId: 'OPP-003',
    destination: 'Palu, Indonesia', travelStartDate: '2026-08-10', travelEndDate: '2026-08-14',
    characteristic: 'complex', serviceScope: ['flight', 'hotel', 'transportation', 'mice'], travelerCount: 60,
    ownerId: 'USR-002', teamUserIds: ['USR-004', 'USR-005', 'USR-006', 'USR-007', 'USR-009'], status: 'in-progress',
    quotationAmountIdr: 1_400_000_000, budgetIdr: 1_250_000_000, actualCostIdr: 1_180_000_000,
  },
])

/**
 * `reactive()` (Section 12) — melanjutkan pola Section 07/08/09/10/11. Update status service (mis. saat
 * ditandai `changed`) harus langsung terlihat di tab "Itinerary & Services" dan tab "Overview" (Service
 * Summary, Section 10) tanpa reload, karena keduanya membaca array yang sama.
 *
 * `bookingReference` (Section 12) — mock nomor referensi/PNR/konfirmasi manual, BUKAN hasil panggilan API
 * airline/hotel/vendor sungguhan (larangan fabrikasi integrasi nyata, D-006). Sengaja tidak diisi untuk
 * service yang belum `confirmed`/`changed` — merefleksikan kondisi realistis (referensi baru ada setelah
 * booking terkonfirmasi).
 */
export const PROJECT_SERVICES: ProjectService[] = reactive([
  { id: 'SVC-1011', projectId: 'PRJ-101', type: 'flight', label: 'Flight Manila', status: 'confirmed', vendorId: 'VND-001', bookingReference: 'PNR-MNL8201' },

  { id: 'SVC-1021', projectId: 'PRJ-102', type: 'flight', label: 'Flight Abu Dhabi', status: 'confirmed', vendorId: 'VND-001', bookingReference: 'PNR-AUH9221' },
  { id: 'SVC-1022', projectId: 'PRJ-102', type: 'hotel', label: 'Room Block A (18 pax)', status: 'changed', vendorId: 'VND-002', bookingReference: 'HTL-AUH-A104' },
  { id: 'SVC-1023', projectId: 'PRJ-102', type: 'hotel', label: 'Room Block B (3 pax, digabung ke Block A)', status: 'cancelled', vendorId: 'VND-002' },

  { id: 'SVC-1031', projectId: 'PRJ-103', type: 'flight', label: 'Flight Batch 1', status: 'confirmed', vendorId: 'VND-001', bookingReference: 'PNR-PLW1031A' },
  { id: 'SVC-1032', projectId: 'PRJ-103', type: 'flight', label: 'Flight Batch 2 (Grup VIP)', status: 'pending-confirmation', vendorId: 'VND-001' },
  { id: 'SVC-1033', projectId: 'PRJ-103', type: 'hotel', label: 'Hotel Palu', status: 'confirmed', vendorId: 'VND-002', bookingReference: 'HTL-PLW-2200' },
  { id: 'SVC-1034', projectId: 'PRJ-103', type: 'transportation', label: 'Ground Transportation', status: 'pending-confirmation', vendorId: 'VND-003' },
  { id: 'SVC-1035', projectId: 'PRJ-103', type: 'mice', label: 'Venue & Rundown Acara', status: 'confirmed', vendorId: 'VND-004', bookingReference: 'MICE-PLW-VEN01' },
  { id: 'SVC-1036', projectId: 'PRJ-103', type: 'additional', label: 'Asuransi Perjalanan Grup', status: 'confirmed', bookingReference: 'INS-PLW-2026' },
])

/** Daily itinerary (Section 12) — jadwal harian per project, `groupId` merujuk `TravelerGroup` (Section 11) yang sudah ada. */
export const ITINERARY_ITEMS: ItineraryItem[] = reactive([
  // PRJ-101 — Manila, 20-23 Agustus 2026, flight only.
  { id: 'ITIN-1011', projectId: 'PRJ-101', date: '2026-08-20', time: '08:00', title: 'Keberangkatan Jakarta → Manila', description: 'Seluruh 6 traveler berangkat bersama', serviceType: 'flight' },
  { id: 'ITIN-1012', projectId: 'PRJ-101', date: '2026-08-21', time: '09:00', title: 'Agenda Bisnis Hari 1', description: 'Pertemuan dengan client di kantor cabang Manila' },
  { id: 'ITIN-1013', projectId: 'PRJ-101', date: '2026-08-22', time: '09:00', title: 'Agenda Bisnis Hari 2', description: 'Kunjungan lokasi mitra' },
  { id: 'ITIN-1014', projectId: 'PRJ-101', date: '2026-08-23', time: '15:00', title: 'Kepulangan Manila → Jakarta', serviceType: 'flight' },

  // PRJ-102 — Abu Dhabi, 22-26 September 2026 (revised), flight + hotel.
  { id: 'ITIN-1021', projectId: 'PRJ-102', date: '2026-09-22', time: '10:00', title: 'Keberangkatan Jakarta → Abu Dhabi', serviceType: 'flight' },
  { id: 'ITIN-1022', projectId: 'PRJ-102', date: '2026-09-22', time: '20:00', title: 'Check-in Hotel (Room Block A)', description: 'Check-in setelah upgrade tipe kamar ke Suite', serviceType: 'hotel' },
  { id: 'ITIN-1023', projectId: 'PRJ-102', date: '2026-09-23', time: '09:00', title: 'Corporate Gathering — Hari 1' },
  { id: 'ITIN-1024', projectId: 'PRJ-102', date: '2026-09-25', time: '09:00', title: 'Corporate Gathering — Hari 2' },
  { id: 'ITIN-1025', projectId: 'PRJ-102', date: '2026-09-26', time: '14:00', title: 'Kepulangan Abu Dhabi → Jakarta', serviceType: 'flight' },

  // PRJ-103 — Palu, 10-14 Agustus 2026, flight+hotel+transportation+MICE, 3 traveler group.
  { id: 'ITIN-1031', projectId: 'PRJ-103', date: '2026-08-10', time: '07:00', title: 'Kedatangan Group Management', description: 'Batch 1 tiba di Palu', serviceType: 'flight', groupId: 'GRP-001' },
  { id: 'ITIN-1032', projectId: 'PRJ-103', date: '2026-08-10', time: '15:00', title: 'Kedatangan Group Partner / VIP', description: 'Batch 2 (VIP) menyusul', serviceType: 'flight', groupId: 'GRP-003' },
  { id: 'ITIN-1033', projectId: 'PRJ-103', date: '2026-08-11', time: '08:00', title: 'MICE Conference — Hari 1', serviceType: 'mice' },
  { id: 'ITIN-1034', projectId: 'PRJ-103', date: '2026-08-12', time: '08:00', title: 'MICE Conference — Hari 2', serviceType: 'mice' },
  { id: 'ITIN-1035', projectId: 'PRJ-103', date: '2026-08-13', time: '10:00', title: 'City Tour & Free Program', serviceType: 'transportation' },
  { id: 'ITIN-1036', projectId: 'PRJ-103', date: '2026-08-14', time: '16:00', title: 'Kepulangan Seluruh Group', serviceType: 'flight' },
])

/**
 * `reactive()` (Section 11) — melanjutkan pola Section 07/08/09/10. Add/edit/remove/import mock traveler
 * harus langsung terlihat di tab "Travelers" tanpa reload.
 *
 * Catatan cakupan data (didokumentasikan, bukan gap tersembunyi): `project.travelerCount` (mis. 18 untuk
 * PRJ-102, 60 untuk PRJ-103) adalah angka headcount resmi dari `docs/mockup-data-scenarios.md`, sedangkan
 * profil `Traveler` bernama di bawah adalah **sampel representatif** (tidak 1:1 dengan headcount penuh) —
 * pola yang sama seperti fixture awal Foundation (`TRV-1031` sendirian mewakili 60 traveler PRJ-103).
 * Tab Travelers menampilkan catatan transparan soal ini, bukan berpura-pura lengkap.
 */
export const TRAVELER_GROUPS: TravelerGroup[] = reactive([
  { id: 'GRP-001', projectId: 'PRJ-103', name: 'Management', paxCount: 10, roomingNote: '5 kamar twin (10 pax)' },
  { id: 'GRP-002', projectId: 'PRJ-103', name: 'Sales Team', paxCount: 25, roomingNote: '12 kamar twin + 1 kamar single (25 pax)' },
  { id: 'GRP-003', projectId: 'PRJ-103', name: 'Partner / VIP', paxCount: 25, roomingNote: '2 suite VIP (termasuk kebutuhan aksesibilitas)' },
])

export const TRAVELERS: Traveler[] = reactive([
  // PRJ-101 — Normal Project, travelerCount 6, seluruhnya profil lengkap (skenario "berjalan mulus").
  { id: 'TRV-1011', projectId: 'PRJ-101', name: 'Hendra Wijaya', passportNumber: 'B1234561', passportExpiryDate: '2029-04-10', emergencyContactName: 'Rina Wijaya', emergencyContactPhone: '0812-1000-1001' },
  { id: 'TRV-1012', projectId: 'PRJ-101', name: 'Siti Rahmawati', passportNumber: 'B1234562', passportExpiryDate: '2029-06-15', emergencyContactName: 'Budi Rahman', emergencyContactPhone: '0812-1000-1002' },
  { id: 'TRV-1013', projectId: 'PRJ-101', name: 'Agus Setiawan', passportNumber: 'B1234563', passportExpiryDate: '2028-11-02', emergencyContactName: 'Wati Setiawan', emergencyContactPhone: '0812-1000-1003' },
  { id: 'TRV-1014', projectId: 'PRJ-101', name: 'Dewi Lestari', passportNumber: 'B1234564', passportExpiryDate: '2029-01-20', emergencyContactName: 'Hadi Lestari', emergencyContactPhone: '0812-1000-1004' },
  { id: 'TRV-1015', projectId: 'PRJ-101', name: 'Rian Firmansyah', passportNumber: 'B1234565', passportExpiryDate: '2028-09-30' },
  { id: 'TRV-1016', projectId: 'PRJ-101', name: 'Nadia Puspita', passportNumber: 'B1234566', passportExpiryDate: '2029-03-05', emergencyContactName: 'Sari Puspita', emergencyContactPhone: '0812-1000-1006' },

  // PRJ-102 — High-Change Project, travelerCount 18 (sampel). Salah satu paspor akan kedaluwarsa < 6 bulan
  // dari tanggal keberangkatan (docs/mockup-data-scenarios.md bagian 2.4), satu lagi sengaja belum lengkap
  // sama sekali — mendemonstrasikan dua varian missing-document indicator.
  { id: 'TRV-1021', projectId: 'PRJ-102', name: 'Sarah Amelia', passportNumber: 'C2234561', passportExpiryDate: '2028-12-01', emergencyContactName: 'Fajar Amelia', emergencyContactPhone: '0813-2000-2001' },
  { id: 'TRV-1022', projectId: 'PRJ-102', name: 'Yusuf Maulana', passportNumber: 'C2234562', passportExpiryDate: '2027-01-15', emergencyContactName: 'Lia Maulana', emergencyContactPhone: '0813-2000-2002', specialRequest: 'Permintaan menu makanan halal khusus' },
  { id: 'TRV-1023', projectId: 'PRJ-102', name: 'Indah Permatasari', emergencyContactName: 'Doni Permata', emergencyContactPhone: '0813-2000-2003' },
  { id: 'TRV-1024', projectId: 'PRJ-102', name: 'Bayu Aditya', passportNumber: 'C2234564', passportExpiryDate: '2028-08-18' },
  { id: 'TRV-1025', projectId: 'PRJ-102', name: 'Citra Ananda', passportNumber: 'C2234565', passportExpiryDate: '2029-02-22', emergencyContactName: 'Wahyu Ananda', emergencyContactPhone: '0813-2000-2005' },
  { id: 'TRV-1026', projectId: 'PRJ-102', name: 'Fikri Ramadhan', passportNumber: 'C2234566', passportExpiryDate: '2028-10-11', emergencyContactName: 'Mega Ramadhan', emergencyContactPhone: '0813-2000-2006' },

  // PRJ-103 — Complex Project, travelerCount 60 (sampel per group, rooming list lihat ROOM_ASSIGNMENTS).
  { id: 'TRV-1031', projectId: 'PRJ-103', groupId: 'GRP-003', name: 'Dedi Kurniawan', passportNumber: 'D3334561', passportExpiryDate: '2028-05-14', emergencyContactName: 'Ani Kurniawan', emergencyContactPhone: '0814-3000-3001', specialRequest: 'Membutuhkan akses kursi roda' },
  { id: 'TRV-1032', projectId: 'PRJ-103', groupId: 'GRP-001', name: 'Michael Tanuwijaya', passportNumber: 'D3334562', passportExpiryDate: '2029-07-09', emergencyContactName: 'Grace Tanuwijaya', emergencyContactPhone: '0814-3000-3002' },
  { id: 'TRV-1033', projectId: 'PRJ-103', groupId: 'GRP-001', name: 'Putri Anggraeni', passportNumber: 'D3334563', passportExpiryDate: '2028-12-25', emergencyContactName: 'Rudi Anggraeni', emergencyContactPhone: '0814-3000-3003' },
  { id: 'TRV-1034', projectId: 'PRJ-103', groupId: 'GRP-002', name: 'Taufik Hidayat', emergencyContactName: 'Sinta Hidayat', emergencyContactPhone: '0814-3000-3004' },
  { id: 'TRV-1035', projectId: 'PRJ-103', groupId: 'GRP-002', name: 'Ayu Wulandari', passportNumber: 'D3334565', passportExpiryDate: '2029-05-30' },
  { id: 'TRV-1036', projectId: 'PRJ-103', groupId: 'GRP-003', name: 'Reza Firmansyah', passportNumber: 'D3334566', passportExpiryDate: '2028-08-08', emergencyContactName: 'Nia Firmansyah', emergencyContactPhone: '0814-3000-3006' },
])

/** Rooming list eksplisit (Section 11) — hanya untuk traveler bernama yang datanya sudah tercatat di atas. */
export const ROOM_ASSIGNMENTS: RoomAssignment[] = reactive([
  { id: 'ROOM-001', projectId: 'PRJ-103', groupId: 'GRP-001', roomLabel: 'Twin 101', roomType: 'twin', travelerIds: ['TRV-1032', 'TRV-1033'] },
  { id: 'ROOM-002', projectId: 'PRJ-103', groupId: 'GRP-002', roomLabel: 'Twin 205', roomType: 'twin', travelerIds: ['TRV-1034', 'TRV-1035'] },
  { id: 'ROOM-003', projectId: 'PRJ-103', groupId: 'GRP-003', roomLabel: 'Suite VIP 1', roomType: 'suite', travelerIds: ['TRV-1031', 'TRV-1036'] },
])
