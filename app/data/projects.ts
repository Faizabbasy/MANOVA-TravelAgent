import { reactive } from 'vue'
import { resolveDestinationGeo } from './geo'
import type { Project, ProjectService, TravelerGroup, Traveler, RoomAssignment, ItineraryItem } from '~/types/project'

/**
 * `reactive()` (Section 09) — melanjutkan pola Section 07/08. Approve Won harus mendorong Project baru
 * ke array ini dan langsung terlihat di `/projects`, Dashboard, dan Party Detail tanpa reload.
 */

/** docs/mockup-data-scenarios.md bagian 1-3 — 3 skenario demo wajib (Normal/High-Change/Complex). */
export const PROJECTS: Project[] = reactive([
  {
    id: 'PRJ-101',
    name: 'Manila Business Trip',
    partyId: 'PTY-001',
    leadId: 'LED-009',
    destination: 'Manila, Filipina',
    travelStartDate: '2026-08-20',
    travelEndDate: '2026-08-23',
    characteristic: 'normal',
    serviceScope: ['flight'],
    travelerCount: 6,
    ownerId: 'USR-002',
    teamUserIds: ['USR-002'],
    status: 'confirmed',
    quotationAmountIdr: 95_000_000,
    budgetIdr: 85_000_000,
    actualCostIdr: 82_500_000,
    handoverAcceptedAt: '2026-06-26',
    handoverAcceptedBy: 'USR-002'
  },
  {
    id: 'PRJ-102',
    name: 'Abu Dhabi Corporate Gathering',
    partyId: 'PTY-002',
    leadId: 'LED-013',
    destination: 'Abu Dhabi, Uni Emirat Arab',
    travelStartDate: '2026-09-22',
    travelEndDate: '2026-09-26',
    characteristic: 'high-change',
    serviceScope: ['flight', 'hotel'],
    travelerCount: 18,
    ownerId: 'USR-002',
    teamUserIds: ['USR-002', 'USR-002'],
    status: 'planning',
    quotationAmountIdr: 345_000_000,
    budgetIdr: 310_000_000,
    actualCostIdr: 335_000_000,
    handoverAcceptedAt: '2026-06-21',
    handoverAcceptedBy: 'USR-002'
  },
  {
    id: 'PRJ-103',
    name: 'Palu MICE Conference 2026',
    partyId: 'PTY-003',
    leadId: 'LED-014',
    destination: 'Palu, Indonesia',
    travelStartDate: '2026-08-10',
    travelEndDate: '2026-08-14',
    characteristic: 'complex',
    serviceScope: ['flight', 'hotel', 'transportation', 'mice'],
    travelerCount: 60,
    ownerId: 'USR-002',
    teamUserIds: ['USR-002', 'USR-002', 'USR-002', 'USR-002', 'USR-002'],
    status: 'in-progress',
    quotationAmountIdr: 1_400_000_000,
    budgetIdr: 1_250_000_000,
    actualCostIdr: 1_180_000_000,
    handoverAcceptedAt: '2026-06-06',
    handoverAcceptedBy: 'USR-002'
  },
  /**
   * PRJ-104 — Project Order kedua untuk repeat client PTY-001 (sumber: LED-018/QUO-008,
   * `app/data/quotations.ts`), memenuhi skenario "Active Client dengan beberapa Project Orders". Sengaja
   * `draft`/actualCost 0 — project baru saja terbentuk dari Won, belum ada service/vendor/invoice yang
   * diisi Operations (kondisi realistis, bukan gap tersembunyi). `handoverAcceptedAt` SENGAJA dibiarkan
   * kosong (berbeda dari PRJ-101/102/103 yang di-backfill "sudah accepted") agar skenario "Handover
   * Pending" + tombol Accept/Return Handover benar-benar demonstrable pada data yang realistis (project
   * yang memang baru saja Won).
   */
  {
    id: 'PRJ-104',
    name: 'Manila Follow-up Training Q1 2027',
    partyId: 'PTY-001',
    leadId: 'LED-018',
    sourceQuotationId: 'QUO-008',
    destination: 'Manila, Filipina',
    travelStartDate: '2027-02-16',
    travelEndDate: '2027-02-18',
    characteristic: 'normal',
    serviceScope: ['flight'],
    travelerCount: 8,
    ownerId: 'USR-002',
    teamUserIds: [],
    status: 'draft',
    quotationAmountIdr: 60_000_000,
    budgetIdr: 60_000_000,
    actualCostIdr: 0
  },
  /**
   * PRJ-201–204 (Client Experience — Repair Phase Section 1) — 4 dari 5 skenario demo wajib
   * `docs/client-mock-data-scenarios.md` (skenario "Bali MICE Event" belum menjadi Project, masih tahap
   * Lead — lihat `app/data/leads.ts` LED-012). Seluruhnya milik PTY-005 ("engagement langsung", tanpa
   * `leadId`, konsisten pola Service Order tanpa RFQ) — company baru, TIDAK memakai/mengubah
   * PRJ-101-104 yang sudah dipakai fixture/test section lain.
   */
  {
    id: 'PRJ-201',
    name: 'Korea Incentive Trip 2026',
    partyId: 'PTY-005',
    destination: 'Seoul, Korea Selatan',
    travelStartDate: '2026-10-12',
    travelEndDate: '2026-10-16',
    characteristic: 'high-change',
    serviceScope: ['flight', 'hotel'],
    travelerCount: 45,
    ownerId: 'USR-002',
    teamUserIds: ['USR-002', 'USR-002'],
    status: 'planning',
    quotationAmountIdr: 980_000_000,
    budgetIdr: 900_000_000,
    actualCostIdr: 410_000_000,
    handoverAcceptedAt: '2026-07-20',
    handoverAcceptedBy: 'USR-002',
    tourLeaderName: 'Sandi Wirawan',
    tourLeaderPhone: '0812-7001-1001',
    emergencyContactName: 'Manova 24/7 Operations',
    emergencyContactPhone: '+62 21 5000 1188',
    meetingPoint: 'Terminal 3 Bandara Soekarno-Hatta, konter check-in grup'
  },
  {
    id: 'PRJ-202',
    name: 'Abu Dhabi Business Delegation',
    partyId: 'PTY-005',
    destination: 'Abu Dhabi, Uni Emirat Arab',
    travelStartDate: '2026-07-25',
    travelEndDate: '2026-08-02',
    characteristic: 'normal',
    serviceScope: ['flight', 'hotel'],
    travelerCount: 24,
    ownerId: 'USR-002',
    teamUserIds: ['USR-002'],
    status: 'ongoing-trip',
    quotationAmountIdr: 460_000_000,
    budgetIdr: 420_000_000,
    actualCostIdr: 415_000_000,
    handoverAcceptedAt: '2026-07-10',
    handoverAcceptedBy: 'USR-002',
    tourLeaderName: 'Reza Pratama',
    tourLeaderPhone: '0812-7002-1002',
    emergencyContactName: 'Manova 24/7 Operations',
    emergencyContactPhone: '+62 21 5000 1188',
    meetingPoint: 'Lobi Hotel Emirates Palace, Abu Dhabi'
  },
  {
    id: 'PRJ-203',
    name: 'Manila Corporate Meeting 2026',
    partyId: 'PTY-005',
    destination: 'Manila, Filipina',
    travelStartDate: '2026-06-10',
    travelEndDate: '2026-06-13',
    characteristic: 'normal',
    serviceScope: ['flight'],
    travelerCount: 12,
    ownerId: 'USR-002',
    teamUserIds: [],
    status: 'completed',
    quotationAmountIdr: 165_000_000,
    budgetIdr: 150_000_000,
    actualCostIdr: 148_000_000,
    handoverAcceptedAt: '2026-05-15',
    handoverAcceptedBy: 'USR-002',
    tourLeaderName: 'Nadia Kusuma',
    tourLeaderPhone: '0812-7003-1003',
    emergencyContactName: 'Manova 24/7 Operations',
    emergencyContactPhone: '+62 21 5000 1188',
    meetingPoint: 'Lobi Manila Corporate Center'
  },
  {
    id: 'PRJ-204',
    name: 'Singapore Conference 2026',
    partyId: 'PTY-005',
    destination: 'Singapura',
    travelStartDate: '2026-11-05',
    travelEndDate: '2026-11-08',
    characteristic: 'high-change',
    serviceScope: ['flight', 'hotel'],
    travelerCount: 15,
    ownerId: 'USR-002',
    teamUserIds: ['USR-002'],
    status: 'confirmed',
    quotationAmountIdr: 320_000_000,
    budgetIdr: 300_000_000,
    actualCostIdr: 90_000_000,
    handoverAcceptedAt: '2026-07-18',
    handoverAcceptedBy: 'USR-002',
    tourLeaderName: 'Bagas Aditya',
    tourLeaderPhone: '0812-7004-1004',
    emergencyContactName: 'Manova 24/7 Operations',
    emergencyContactPhone: '+62 21 5000 1188',
    meetingPoint: 'Terminal 3 Bandara Soekarno-Hatta, konter check-in grup'
  },
  /**
   * PRJ-205 — contoh dummy Project B2C ("Group Trip"), pola sama `createProject({ isGroupTrip: true })`
   * (`app/data/index.ts`). `partyId` menunjuk Party placeholder sistem (PTY-009, `app/data/parties.ts`),
   * BUKAN customer sungguhan — peserta asli tercatat lewat `SALES_ORDERS`/`TRAVELERS` di bawah (`projectId:
   * 'PRJ-205'`). `travelerCount: 20` adalah kapasitas (seat), bukan jumlah peserta yang sudah gabung.
   */
  {
    id: 'PRJ-205',
    name: 'Open Trip Bromo Ijen 4D3N',
    partyId: 'PTY-009',
    isGroupTrip: true,
    destination: 'Bromo & Ijen, Indonesia',
    travelStartDate: '2026-09-18',
    travelEndDate: '2026-09-21',
    characteristic: 'normal',
    serviceScope: ['transportation', 'hotel'],
    travelerCount: 20,
    ownerId: 'USR-002',
    teamUserIds: ['USR-002'],
    status: 'planning',
    quotationAmountIdr: 3_500_000 * 20,
    budgetIdr: 3_000_000 * 20,
    actualCostIdr: 0,
    tourLeaderName: 'Arif Setiawan',
    tourLeaderPhone: '0812-7005-1005',
    emergencyContactName: 'Manova 24/7 Operations',
    emergencyContactPhone: '+62 21 5000 1188',
    meetingPoint: 'Stasiun Probolinggo, titik kumpul peserta'
  }
])

/** Backfill `destinationGeo` seed — data historis di atas dibuat langsung sebagai literal (bukan lewat `approveOpportunityWon`), jadi diresolusi sekali di sini agar peta destinasi langsung terisi. */
for (const project of PROJECTS) { project.destinationGeo = resolveDestinationGeo(project.destination) }

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

  /** PRJ-201-204 (Client Experience — Repair Phase Section 1) — merefleksikan narasi skenario Korea (hotel confirmed, flight belum), Abu Dhabi (seluruh confirmed, trip berjalan), Manila (seluruh completed), Singapore (masih pending menunggu revised quotation dari Change Request CR-005). */
  { id: 'SVC-2011', projectId: 'PRJ-201', type: 'flight', label: 'Flight Jakarta–Seoul', status: 'pending-confirmation', vendorId: 'VND-001' },
  { id: 'SVC-2012', projectId: 'PRJ-201', type: 'hotel', label: 'Hotel Seoul (45 pax)', status: 'confirmed', vendorId: 'VND-002', bookingReference: 'HTL-SEL-4501' },

  { id: 'SVC-2021', projectId: 'PRJ-202', type: 'flight', label: 'Flight Jakarta–Abu Dhabi', status: 'confirmed', vendorId: 'VND-001', bookingReference: 'PNR-AUH5502' },
  { id: 'SVC-2022', projectId: 'PRJ-202', type: 'hotel', label: 'Hotel Abu Dhabi (24 pax)', status: 'confirmed', vendorId: 'VND-002', bookingReference: 'HTL-AUH-2202' },

  { id: 'SVC-2031', projectId: 'PRJ-203', type: 'flight', label: 'Flight Jakarta–Manila', status: 'completed', vendorId: 'VND-001', bookingReference: 'PNR-MNL7701' },

  { id: 'SVC-2041', projectId: 'PRJ-204', type: 'flight', label: 'Flight Jakarta–Singapura', status: 'confirmed', vendorId: 'VND-001', bookingReference: 'PNR-SIN9901' },
  { id: 'SVC-2042', projectId: 'PRJ-204', type: 'hotel', label: 'Hotel Singapura (15 pax)', status: 'changed', vendorId: 'VND-002' }
])

/** Daily itinerary (Section 12) — jadwal harian per project, `groupId` merujuk `TravelerGroup` (Section 11) yang sudah ada. */
/**
 * `timezone`/`visibleToClient` (Section 12 baru, roadmap Section 00–24) — backfill aditif. Satu item
 * internal-only per project (`ITIN-1015`/`ITIN-1026`/`ITIN-1037`) ditambahkan sebagai catatan operasional
 * yang TIDAK boleh terlihat Client (briefing internal, bukan bagian itinerary yang disepakati client) —
 * mendemokan "Internal vs client-shared itinerary" secara nyata, bukan hanya field kosong tanpa contoh.
 */
export const ITINERARY_ITEMS: ItineraryItem[] = reactive([
  // PRJ-101 — Manila, 20-23 Agustus 2026, flight only.
  { id: 'ITIN-1011', projectId: 'PRJ-101', date: '2026-08-20', time: '08:00', title: 'Keberangkatan Jakarta → Manila', description: 'Seluruh 6 traveler berangkat bersama', serviceType: 'flight', timezone: 'Asia/Jakarta' },
  { id: 'ITIN-1012', projectId: 'PRJ-101', date: '2026-08-21', time: '09:00', title: 'Agenda Bisnis Hari 1', description: 'Pertemuan dengan client di kantor cabang Manila', timezone: 'Asia/Manila' },
  { id: 'ITIN-1013', projectId: 'PRJ-101', date: '2026-08-22', time: '09:00', title: 'Agenda Bisnis Hari 2', description: 'Kunjungan lokasi mitra', timezone: 'Asia/Manila' },
  { id: 'ITIN-1014', projectId: 'PRJ-101', date: '2026-08-23', time: '15:00', title: 'Kepulangan Manila → Jakarta', serviceType: 'flight', timezone: 'Asia/Manila' },
  { id: 'ITIN-1015', projectId: 'PRJ-101', date: '2026-08-20', time: '06:00', title: 'Briefing Internal Tim Sebelum Keberangkatan', description: 'Pengecekan dokumen dan manifest oleh Ticketing — tidak ditampilkan ke client', timezone: 'Asia/Jakarta', visibleToClient: false },

  // PRJ-102 — Abu Dhabi, 22-26 September 2026 (revised), flight + hotel.
  { id: 'ITIN-1021', projectId: 'PRJ-102', date: '2026-09-22', time: '10:00', title: 'Keberangkatan Jakarta → Abu Dhabi', serviceType: 'flight', timezone: 'Asia/Jakarta' },
  { id: 'ITIN-1022', projectId: 'PRJ-102', date: '2026-09-22', time: '20:00', title: 'Check-in Hotel (Room Block A)', description: 'Check-in setelah upgrade tipe kamar ke Suite', serviceType: 'hotel', timezone: 'Asia/Dubai' },
  { id: 'ITIN-1023', projectId: 'PRJ-102', date: '2026-09-23', time: '09:00', title: 'Corporate Gathering — Hari 1', timezone: 'Asia/Dubai' },
  { id: 'ITIN-1024', projectId: 'PRJ-102', date: '2026-09-25', time: '09:00', title: 'Corporate Gathering — Hari 2', timezone: 'Asia/Dubai' },
  { id: 'ITIN-1025', projectId: 'PRJ-102', date: '2026-09-26', time: '14:00', title: 'Kepulangan Abu Dhabi → Jakarta', serviceType: 'flight', timezone: 'Asia/Dubai' },
  { id: 'ITIN-1026', projectId: 'PRJ-102', date: '2026-09-22', time: '18:00', title: 'Serah Terima Room Block ke Tim Accommodation', description: 'Koordinasi internal upgrade Suite — tidak ditampilkan ke client', timezone: 'Asia/Dubai', visibleToClient: false },

  // PRJ-103 — Palu, 10-14 Agustus 2026, flight+hotel+transportation+MICE, 3 traveler group.
  { id: 'ITIN-1031', projectId: 'PRJ-103', date: '2026-08-10', time: '07:00', title: 'Kedatangan Group Management', description: 'Batch 1 tiba di Palu', serviceType: 'flight', groupId: 'GRP-001', timezone: 'Asia/Makassar' },
  { id: 'ITIN-1032', projectId: 'PRJ-103', date: '2026-08-10', time: '15:00', title: 'Kedatangan Group Partner / VIP', description: 'Batch 2 (VIP) menyusul', serviceType: 'flight', groupId: 'GRP-003', timezone: 'Asia/Makassar' },
  { id: 'ITIN-1033', projectId: 'PRJ-103', date: '2026-08-11', time: '08:00', title: 'MICE Conference — Hari 1', serviceType: 'mice', timezone: 'Asia/Makassar' },
  { id: 'ITIN-1034', projectId: 'PRJ-103', date: '2026-08-12', time: '08:00', title: 'MICE Conference — Hari 2', serviceType: 'mice', timezone: 'Asia/Makassar' },
  { id: 'ITIN-1035', projectId: 'PRJ-103', date: '2026-08-13', time: '10:00', title: 'City Tour & Free Program', serviceType: 'transportation', timezone: 'Asia/Makassar' },
  { id: 'ITIN-1036', projectId: 'PRJ-103', date: '2026-08-14', time: '16:00', title: 'Kepulangan Seluruh Group', serviceType: 'flight', timezone: 'Asia/Makassar' },
  { id: 'ITIN-1037', projectId: 'PRJ-103', date: '2026-08-11', time: '07:00', title: 'Briefing Tim Operations Sebelum Hari MICE', description: 'Cek kesiapan venue dan AV, alokasi shift staf — tidak ditampilkan ke client', timezone: 'Asia/Makassar', visibleToClient: false },

  // PRJ-201 — Korea Incentive Trip, itinerary masih "Waiting Approval" (Client Experience skenario A).
  { id: 'ITIN-2011', projectId: 'PRJ-201', date: '2026-10-12', time: '09:00', title: 'Keberangkatan Jakarta → Seoul', serviceType: 'flight', timezone: 'Asia/Jakarta' },
  { id: 'ITIN-2012', projectId: 'PRJ-201', date: '2026-10-16', time: '18:00', title: 'Kepulangan Seoul → Jakarta', serviceType: 'flight', timezone: 'Asia/Seoul' },

  // PRJ-202 — Abu Dhabi Business Delegation, trip sedang berjalan (skenario B).
  { id: 'ITIN-2021', projectId: 'PRJ-202', date: '2026-07-26', time: '09:00', title: 'Delegasi Bisnis — Hari 1', timezone: 'Asia/Dubai', location: 'Ballroom A, Hotel Emirates Palace' },
  { id: 'ITIN-2022', projectId: 'PRJ-202', date: '2026-08-02', time: '14:00', title: 'Kepulangan Abu Dhabi → Jakarta', serviceType: 'flight', timezone: 'Asia/Dubai', location: 'Abu Dhabi International Airport, Terminal 1' },

  // PRJ-203 — Manila Corporate Meeting, trip sudah selesai (skenario C).
  { id: 'ITIN-2031', projectId: 'PRJ-203', date: '2026-06-11', time: '09:00', title: 'Corporate Meeting', timezone: 'Asia/Manila' },

  // PRJ-204 — Singapore Conference, menunggu revised quotation dari Change Request (skenario E).
  { id: 'ITIN-2041', projectId: 'PRJ-204', date: '2026-11-06', time: '09:00', title: 'Conference — Hari 1', timezone: 'Asia/Singapore' }
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
  { id: 'GRP-003', projectId: 'PRJ-103', name: 'Partner / VIP', paxCount: 25, roomingNote: '2 suite VIP (termasuk kebutuhan aksesibilitas)' }
])

/**
 * Field Section 11 baru (roadmap Section 00–24) di-backfill selektif — bukan seluruh 17 traveler, agar
 * setiap kondisi (visa lengkap/tidak lengkap, companion, verified/belum, dietary/accessibility) punya
 * contoh nyata tanpa mengubah makna profil existing. `idNumber` KTP fiktif format 16 digit standar.
 */
export const TRAVELERS: Traveler[] = reactive([
  // PRJ-101 — Normal Project, travelerCount 6, seluruhnya profil lengkap (skenario "berjalan mulus").
  { id: 'TRV-1011', projectId: 'PRJ-101', name: 'Hendra Wijaya', passportNumber: 'B1234561', passportExpiryDate: '2029-04-10', emergencyContactName: 'Rina Wijaya', emergencyContactPhone: '0812-1000-1001', idNumber: '3171012501850001', documentsVerifiedAt: '2026-07-15', documentsVerifiedBy: 'USR-002' },
  { id: 'TRV-1012', projectId: 'PRJ-101', name: 'Siti Rahmawati', passportNumber: 'B1234562', passportExpiryDate: '2029-06-15', emergencyContactName: 'Budi Rahman', emergencyContactPhone: '0812-1000-1002' },
  { id: 'TRV-1013', projectId: 'PRJ-101', name: 'Agus Setiawan', passportNumber: 'B1234563', passportExpiryDate: '2028-11-02', emergencyContactName: 'Wati Setiawan', emergencyContactPhone: '0812-1000-1003' },
  { id: 'TRV-1014', projectId: 'PRJ-101', name: 'Dewi Lestari', passportNumber: 'B1234564', passportExpiryDate: '2029-01-20', emergencyContactName: 'Hadi Lestari', emergencyContactPhone: '0812-1000-1004' },
  { id: 'TRV-1015', projectId: 'PRJ-101', name: 'Rian Firmansyah', passportNumber: 'B1234565', passportExpiryDate: '2028-09-30' },
  { id: 'TRV-1016', projectId: 'PRJ-101', name: 'Nadia Puspita', passportNumber: 'B1234566', passportExpiryDate: '2029-03-05', emergencyContactName: 'Sari Puspita', emergencyContactPhone: '0812-1000-1006', dietaryRestrictions: 'Vegetarian', companionOfTravelerId: 'TRV-1011' },

  // PRJ-102 — High-Change Project, travelerCount 18 (sampel). Salah satu paspor akan kedaluwarsa < 6 bulan
  // dari tanggal keberangkatan (docs/mockup-data-scenarios.md bagian 2.4), satu lagi sengaja belum lengkap
  // sama sekali — mendemonstrasikan dua varian missing-document indicator. UAE mewajibkan visa untuk WNI —
  // destinasi ini dipakai sebagai contoh field visa (Section 11 baru): TRV-1021 visa lengkap (tetap
  // "Dokumen Lengkap"), TRV-1025 visa TANPA tanggal kedaluwarsa (sebelumnya lengkap, kini sengaja berubah
  // "Dokumen Belum Lengkap" oleh aturan visa baru — didokumentasikan, bukan regresi tersembunyi).
  { id: 'TRV-1021', projectId: 'PRJ-102', name: 'Sarah Amelia', passportNumber: 'C2234561', passportExpiryDate: '2028-12-01', emergencyContactName: 'Fajar Amelia', emergencyContactPhone: '0813-2000-2001', visaNumber: 'UAE-VS-88213', visaExpiryDate: '2027-06-30', documentsVerifiedAt: '2026-07-20', documentsVerifiedBy: 'USR-002' },
  { id: 'TRV-1022', projectId: 'PRJ-102', name: 'Yusuf Maulana', passportNumber: 'C2234562', passportExpiryDate: '2027-01-15', emergencyContactName: 'Lia Maulana', emergencyContactPhone: '0813-2000-2002', specialRequest: 'Permintaan menu makanan halal khusus' },
  { id: 'TRV-1023', projectId: 'PRJ-102', name: 'Indah Permatasari', emergencyContactName: 'Doni Permata', emergencyContactPhone: '0813-2000-2003' },
  { id: 'TRV-1024', projectId: 'PRJ-102', name: 'Bayu Aditya', passportNumber: 'C2234564', passportExpiryDate: '2028-08-18', dietaryRestrictions: 'Tanpa seafood', accessibilityNeeds: 'Kursi roda saat transit bandara' },
  { id: 'TRV-1025', projectId: 'PRJ-102', name: 'Citra Ananda', passportNumber: 'C2234565', passportExpiryDate: '2029-02-22', emergencyContactName: 'Wahyu Ananda', emergencyContactPhone: '0813-2000-2005', visaNumber: 'UAE-VS-88220' },
  { id: 'TRV-1026', projectId: 'PRJ-102', name: 'Fikri Ramadhan', passportNumber: 'C2234566', passportExpiryDate: '2028-10-11', emergencyContactName: 'Mega Ramadhan', emergencyContactPhone: '0813-2000-2006' },

  // PRJ-103 — Complex Project, travelerCount 60 (sampel per group, rooming list lihat ROOM_ASSIGNMENTS).
  // Destinasi domestik (Palu) — tidak diberi field visa (realistis, tidak seluruh destinasi butuh visa).
  { id: 'TRV-1031', projectId: 'PRJ-103', groupId: 'GRP-003', name: 'Dedi Kurniawan', passportNumber: 'D3334561', passportExpiryDate: '2028-05-14', emergencyContactName: 'Ani Kurniawan', emergencyContactPhone: '0814-3000-3001', accessibilityNeeds: 'Membutuhkan akses kursi roda', idNumber: '7371014503880002', documentsVerifiedAt: '2026-07-22', documentsVerifiedBy: 'USR-002' },
  { id: 'TRV-1032', projectId: 'PRJ-103', groupId: 'GRP-001', name: 'Michael Tanuwijaya', passportNumber: 'D3334562', passportExpiryDate: '2029-07-09', emergencyContactName: 'Grace Tanuwijaya', emergencyContactPhone: '0814-3000-3002', documentsVerifiedAt: '2026-07-22', documentsVerifiedBy: 'USR-002' },
  { id: 'TRV-1033', projectId: 'PRJ-103', groupId: 'GRP-001', name: 'Putri Anggraeni', passportNumber: 'D3334563', passportExpiryDate: '2028-12-25', emergencyContactName: 'Rudi Anggraeni', emergencyContactPhone: '0814-3000-3003' },
  { id: 'TRV-1034', projectId: 'PRJ-103', groupId: 'GRP-002', name: 'Taufik Hidayat', emergencyContactName: 'Sinta Hidayat', emergencyContactPhone: '0814-3000-3004' },
  { id: 'TRV-1035', projectId: 'PRJ-103', groupId: 'GRP-002', name: 'Ayu Wulandari', passportNumber: 'D3334565', passportExpiryDate: '2029-05-30' },
  { id: 'TRV-1036', projectId: 'PRJ-103', groupId: 'GRP-003', name: 'Reza Firmansyah', passportNumber: 'D3334566', passportExpiryDate: '2028-08-08', emergencyContactName: 'Nia Firmansyah', emergencyContactPhone: '0814-3000-3006', companionOfTravelerId: 'TRV-1031' },

  /**
   * PRJ-201-204 (Client Experience — Repair Phase Section 1) — sampel representatif (bukan 1:1 headcount
   * `project.travelerCount`, pola sama fixture Foundation/Section 11), 1 traveler dokumen lengkap + 1
   * belum lengkap per project agar completeness indicator (Section 11) tetap punya kondisi campuran nyata
   * saat section "Core Project" membangun halaman Participants Client.
   */
  { id: 'TRV-2011', projectId: 'PRJ-201', name: 'Bram Setiadi', passportNumber: 'E5551001', passportExpiryDate: '2029-02-01', emergencyContactName: 'Rani Setiadi', emergencyContactPhone: '0815-5001-0001', documentsVerifiedAt: '2026-07-25', documentsVerifiedBy: 'USR-002' },
  { id: 'TRV-2012', projectId: 'PRJ-201', name: 'Melisa Tanto', emergencyContactName: 'Vino Tanto', emergencyContactPhone: '0815-5001-0002' },

  { id: 'TRV-2021', projectId: 'PRJ-202', name: 'Farhan Nugroho', passportNumber: 'E5552001', passportExpiryDate: '2028-11-11', emergencyContactName: 'Dina Nugroho', emergencyContactPhone: '0815-5002-0001', documentsVerifiedAt: '2026-07-15', documentsVerifiedBy: 'USR-002' },
  { id: 'TRV-2022', projectId: 'PRJ-202', name: 'Clara Wibisono', passportNumber: 'E5552002', passportExpiryDate: '2029-01-09', documentsVerifiedAt: '2026-07-15', documentsVerifiedBy: 'USR-002' },

  { id: 'TRV-2031', projectId: 'PRJ-203', name: 'Reno Adiputra', passportNumber: 'E5553001', passportExpiryDate: '2028-05-20', documentsVerifiedAt: '2026-06-01', documentsVerifiedBy: 'USR-002' },

  { id: 'TRV-2041', projectId: 'PRJ-204', name: 'Kirana Salsabila', passportNumber: 'E5554001', passportExpiryDate: '2029-03-15', documentsVerifiedAt: '2026-07-19', documentsVerifiedBy: 'USR-002' },
  { id: 'TRV-2042', projectId: 'PRJ-204', name: 'Yoga Pranata', emergencyContactName: 'Sinta Pranata', emergencyContactPhone: '0815-5004-0002' },

  // PRJ-205 — Open Trip Bromo Ijen (dummy Project B2C), peserta lahir dari SalesOrder `paid` SLO-006
  // (`app/data/sales-orders.ts`) — pola sama `qualifyGroupTripLead`/DP confirm, `partyId`/`salesOrderId` diisi.
  { id: 'TRV-2051', projectId: 'PRJ-205', partyId: 'PTY-010', salesOrderId: 'SLO-006', name: 'Yulia Kartika', emergencyContactName: 'Rendra Kartika', emergencyContactPhone: '0815-6001-1001' },
  { id: 'TRV-2052', projectId: 'PRJ-205', partyId: 'PTY-010', salesOrderId: 'SLO-006', name: 'Rendra Kartika', emergencyContactName: 'Yulia Kartika', emergencyContactPhone: '0815-6001-1001' }
])

/** Rooming list eksplisit (Section 11) — hanya untuk traveler bernama yang datanya sudah tercatat di atas. */
export const ROOM_ASSIGNMENTS: RoomAssignment[] = reactive([
  { id: 'ROOM-001', projectId: 'PRJ-103', groupId: 'GRP-001', roomLabel: 'Twin 101', roomType: 'twin', travelerIds: ['TRV-1032', 'TRV-1033'] },
  { id: 'ROOM-002', projectId: 'PRJ-103', groupId: 'GRP-002', roomLabel: 'Twin 205', roomType: 'twin', travelerIds: ['TRV-1034', 'TRV-1035'] },
  { id: 'ROOM-003', projectId: 'PRJ-103', groupId: 'GRP-003', roomLabel: 'Suite VIP 1', roomType: 'suite', travelerIds: ['TRV-1031', 'TRV-1036'] }
])
