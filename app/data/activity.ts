import { reactive } from 'vue'
import type { ActivityEntry, ProjectDocument, ProjectTask } from '~/types/activity'

/** `reactive()` (Section 09) — approve Won harus mencatat entri Activity baru untuk project yang baru dibuat. */

/**
 * `reactive()` (Section 09) — approve Won harus mencatat entri Activity baru untuk project yang baru dibuat.
 * Field Section 14 (`category`/`reason`/`requestedBy`/`beforeValue`/`afterValue`/`impactNote`/`approvalStatus`/
 * `approvedBy`) ditambahkan aditif pada baris `CHG-*` existing — bukan entitas Change paralel, tetap satu
 * sumber log yang sama dengan `isChange` (docs/mockup-information-architecture.md bagian 4, LOCKED).
 * `CHG-1023` sengaja dibiarkan `approvalStatus: 'pending'` (selaras `reviewed: false` yang sudah ada sejak
 * Foundation) — skenario approval hidup yang siap didemokan, bukan data baru yang dipaksakan.
 */
export const ACTIVITIES: ActivityEntry[] = reactive([
  { id: 'ACT-1011', projectId: 'PRJ-101', message: 'E-ticket diterbitkan untuk seluruh traveler', isChange: false, reviewed: true, createdAt: '2026-06-26' },

  {
    id: 'CHG-1021', projectId: 'PRJ-102', message: 'Tanggal perjalanan berubah dari 15–19 Sep menjadi 22–26 Sep 2026',
    isChange: true, reviewed: true, createdAt: '2026-07-08',
    category: 'itinerary', reason: 'Perubahan jadwal keberangkatan dari sisi klien', requestedBy: 'USR-013',
    beforeValue: '15–19 Sep 2026', afterValue: '22–26 Sep 2026', approvalStatus: 'approved', approvedBy: 'USR-003',
    impactNote: 'Itinerary harian serta booking flight dan hotel perlu disesuaikan ulang.',
  },
  {
    id: 'CHG-1022', projectId: 'PRJ-102', message: 'Jumlah traveler bertambah dari 15 menjadi 18 pax',
    isChange: true, reviewed: true, createdAt: '2026-07-08',
    category: 'traveler', reason: 'Penambahan peserta dari sisi klien', requestedBy: 'USR-013',
    beforeValue: '15 pax', afterValue: '18 pax', approvalStatus: 'approved', approvedBy: 'USR-003',
    impactNote: 'Kapasitas rooming list dan alokasi kursi penerbangan perlu ditambah.',
  },
  {
    id: 'CHG-1023', projectId: 'PRJ-102', message: 'Tipe kamar hotel di-upgrade dari Deluxe ke Suite (berdampak biaya)',
    isChange: true, reviewed: false, createdAt: '2026-07-12',
    category: 'service', reason: 'Permintaan upgrade kamar dari klien', requestedBy: 'USR-005',
    beforeValue: 'Deluxe', afterValue: 'Suite', approvalStatus: 'pending',
    impactNote: 'Actual cost meningkat sekitar Rp25.000.000 dibanding budget awal Room Block A.',
  },

  {
    id: 'CHG-1031', projectId: 'PRJ-103', message: 'Jumlah peserta Group Sales Team bertambah dari 20 menjadi 25 pax',
    isChange: true, reviewed: true, createdAt: '2026-07-10',
    category: 'traveler', reason: 'Penambahan peserta Group Sales Team', requestedBy: 'USR-002',
    beforeValue: '20 pax', afterValue: '25 pax', approvalStatus: 'approved', approvedBy: 'USR-003',
    impactNote: 'Rooming list Group Sales Team (GRP-002) disesuaikan menjadi 12 twin + 1 single.',
  },
])

export const DOCUMENTS: ProjectDocument[] = [
  { id: 'DOC-1011', projectId: 'PRJ-101', name: 'E-ticket_Manila_Group.pdf', uploadedAt: '2026-06-26' },

  { id: 'DOC-1021', projectId: 'PRJ-102', name: 'Revised_Itinerary_AbuDhabi.pdf', uploadedAt: '2026-07-09' },
  { id: 'DOC-1022', projectId: 'PRJ-102', name: 'Hotel_Upgrade_Approval.pdf', uploadedAt: '2026-07-12' },

  { id: 'DOC-1031', projectId: 'PRJ-103', name: 'Rundown_Acara_MICE_Palu.pdf', uploadedAt: '2026-07-01' },
  { id: 'DOC-1032', projectId: 'PRJ-103', name: 'Rooming_List_Draft_GroupC.xlsx', uploadedAt: '2026-07-15' },
  { id: 'DOC-1033', projectId: 'PRJ-103', name: 'Kontrak_Vendor_MICE.pdf', uploadedAt: '2026-06-10' },
]

export const TASKS: ProjectTask[] = [
  { id: 'TSK-1011', projectId: 'PRJ-101', title: 'Konfirmasi manifest penumpang', status: 'done' },

  { id: 'TSK-1021', projectId: 'PRJ-102', title: 'Reschedule hotel booking', status: 'in-progress' },
  { id: 'TSK-1022', projectId: 'PRJ-102', title: 'Update traveler manifest', status: 'overdue', dueAt: '2026-07-22' },
  // TSK-1023 (Section 06/Dashboard): melengkapi task dengan dueAt di masa depan agar widget
  // "Milestone/task mendatang" (Project Manager) punya data selain yang overdue.
  { id: 'TSK-1023', projectId: 'PRJ-102', title: 'Follow-up pembayaran termin tambahan ke client', status: 'not-started', dueAt: '2026-08-01' },

  { id: 'TSK-1031', projectId: 'PRJ-103', title: 'Finalisasi rooming list Group C', status: 'in-progress' },
  { id: 'TSK-1032', projectId: 'PRJ-103', title: 'Konfirmasi venue MICE hari ke-2', status: 'pending-confirmation' },
  { id: 'TSK-1033', projectId: 'PRJ-103', title: 'Kirim rundown acara ke client', status: 'not-started' },
  { id: 'TSK-1034', projectId: 'PRJ-103', title: 'Rekonsiliasi actual cost transportation', status: 'overdue', dueAt: '2026-07-25' },
  { id: 'TSK-1035', projectId: 'PRJ-103', title: 'Verifikasi ulang manifest VIP sebelum keberangkatan', status: 'in-progress', dueAt: '2026-08-05' },
]
