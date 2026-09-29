import { reactive } from 'vue'
import type { MiceEvent } from '~/types/mice'

/**
 * `reactive()` (Section 16 — roadmap Section 00–24 baru) — melanjutkan pola Section 07 dst.
 *
 * Satu-satunya fixture, `MICE-1035`, ditautkan ke `SVC-1035` ("Venue & Rundown Acara", PRJ-103,
 * `confirmed`, `bookingReference: 'MICE-PLW-VEN01'`) dan `VQ-006` (`app/data/vendors.ts`, VND-004,
 * Rp280.000.000, `accepted`) — total BOQ (netCost ~Rp235,5 juta / sellPrice ~Rp282 juta) berada dalam
 * skala yang sama dengan `VQ-006` TANPA memaksakan kesamaan angka persis (granularitas berbeda: BOQ =
 * itemized internal, VendorQuotation = harga total yang sudah diterima). Narasi Hari 2 (venue tentatif,
 * kapasitas lebih kecil) menautkan langsung ke `TSK-1032` ("Konfirmasi venue MICE hari ke-2"),
 * `TSK-1033` ("Kirim rundown acara ke client"), dan `RSK-1031` ("Ketersediaan venue MICE hari ke-2 belum
 * terkonfirmasi final") di `app/data/activity.ts` — BUKAN detail baru yang tidak berhubungan. Staffing
 * menautkan ke `USR-002` (Lina Marlina, role `mice`, sudah ada di `PROJECTS[2].teamUserIds`) sebagai PIC
 * utama, konsisten `SFT-1032` (shift note existing) yang mencatat Lina menangani venue Hari 1.
 */
export const MICE_EVENTS: MiceEvent[] = reactive([
  {
    id: 'MICE-1035',
    projectId: 'PRJ-103',
    serviceId: 'SVC-1035',
    brief: 'MICE Conference tahunan seluruh cabang — sesi pleno, panel diskusi, dan penghargaan tahunan. Tujuan: konsolidasi strategi 2027 dan apresiasi tim regional.',
    venueName: 'Hotel Prima Mitra — Convention Center Wing',
    venueAddress: 'Jl. Trans Sulawesi, Palu, Sulawesi Tengah',
    status: 'in-progress',
    clientApprovalStatus: 'approved',
    sessions: [
      { roomName: 'Ballroom Utama', sessionTitle: 'MICE Conference — Hari 1: Opening & Keynote', startAt: '2026-08-11T08:00', endAt: '2026-08-11T17:00', capacity: 150, picUserId: 'USR-002', isConfirmed: true },
      { roomName: 'Ballroom Utama (opsi alternatif — venue belum final)', sessionTitle: 'MICE Conference — Hari 2: Panel & Closing', startAt: '2026-08-12T08:00', endAt: '2026-08-12T17:00', capacity: 100, picUserId: 'USR-002', isConfirmed: false }
    ],
    participantCategories: [
      { category: 'Delegate (Rombongan Traveling)', expectedCount: 60, actualCount: 60 },
      { category: 'VIP / Partner', expectedCount: 10, actualCount: 10 },
      { category: 'Local Guest / Undangan', expectedCount: 40, actualCount: 35 },
      { category: 'Staff / Crew', expectedCount: 15, actualCount: 15 }
    ],
    boqItems: [
      { category: 'staging', description: 'Panggung utama, backdrop, dan dekorasi', quantity: 1, unit: 'paket', vendorId: 'VND-004', netCostIdr: 45_000_000, sellPriceIdr: 55_000_000 },
      { category: 'av', description: 'Sound system, LED screen, lighting (2 hari)', quantity: 2, unit: 'hari', vendorId: 'VND-004', netCostIdr: 60_000_000, sellPriceIdr: 72_000_000 },
      { category: 'catering', description: 'Coffee break + lunch (125 pax x 2 hari)', quantity: 250, unit: 'paket pax', vendorId: 'VND-004', netCostIdr: 87_500_000, sellPriceIdr: 100_000_000 },
      { category: 'equipment', description: 'Sewa kursi, meja, dan AC portable tambahan', quantity: 1, unit: 'paket', vendorId: 'VND-004', netCostIdr: 15_000_000, sellPriceIdr: 18_000_000 },
      { category: 'booth', description: 'Booth sponsor dan registrasi (4 unit)', quantity: 4, unit: 'unit', vendorId: 'VND-004', netCostIdr: 20_000_000, sellPriceIdr: 25_000_000 },
      { category: 'other', description: 'Dokumentasi foto dan video profesional', quantity: 1, unit: 'paket', vendorId: 'VND-007', netCostIdr: 8_000_000, sellPriceIdr: 12_000_000 }
    ],
    staffAssignments: [
      { userId: 'USR-002', roleLabel: 'Event Coordinator / PIC Utama' },
      { userId: 'USR-002', roleLabel: 'Project Manager — Pengawasan Umum' },
      { userId: 'USR-002', roleLabel: 'Liaison Vendor dan Logistik' }
    ],
    checklist: [
      { task: 'permit', label: 'Izin keramaian dan venue dari pihak berwenang setempat', isDone: true },
      { task: 'setup', label: 'Setup panggung, AV, dan booth Hari 1', isDone: true },
      { task: 'rehearsal', label: 'Gladi bersih MC dan pembicara kunci', isDone: true },
      { task: 'setup', label: 'Setup ulang venue untuk Hari 2 (menunggu konfirmasi venue alternatif)', isDone: false },
      { task: 'teardown', label: 'Teardown panggung dan booth pasca-acara', isDone: false }
    ],
    deliverables: [
      { label: 'Dokumentasi foto dan video acara', isDelivered: false },
      { label: 'Laporan attendance dan feedback peserta', isDelivered: false },
      { label: 'E-certificate peserta', isDelivered: false }
    ],
    hasChangeOrder: true,
    changeOrderNote: 'Venue Hari 2 berpotensi pindah ke opsi alternatif berkapasitas lebih kecil (100 pax) menunggu konfirmasi final H-7 (lihat RSK-1031, tab Overview) — rundown terbaru belum dikirim ke client (TSK-1033, tab Tasks).',
    hasIncident: true,
    incidentNote: 'Keterlambatan pengiriman unit AV cadangan H-1, diatasi dengan unit sewaan darurat dari vendor lokal — tidak mengganggu jadwal Hari 1.',
    createdAt: '2026-06-08',
    updatedAt: '2026-08-11'
  }
])
