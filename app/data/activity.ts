import type { ActivityEntry, ProjectDocument, ProjectTask } from '~/types/activity'

/** docs/mockup-data-scenarios.md bagian 1-3. */
export const ACTIVITIES: ActivityEntry[] = [
  { id: 'ACT-1011', projectId: 'PRJ-101', message: 'E-ticket diterbitkan untuk seluruh traveler', isChange: false, reviewed: true, createdAt: '2026-06-26' },

  { id: 'CHG-1021', projectId: 'PRJ-102', message: 'Tanggal perjalanan berubah dari 15–19 Sep menjadi 22–26 Sep 2026', isChange: true, reviewed: true, createdAt: '2026-07-08' },
  { id: 'CHG-1022', projectId: 'PRJ-102', message: 'Jumlah traveler bertambah dari 15 menjadi 18 pax', isChange: true, reviewed: true, createdAt: '2026-07-08' },
  { id: 'CHG-1023', projectId: 'PRJ-102', message: 'Tipe kamar hotel di-upgrade dari Deluxe ke Suite (berdampak biaya)', isChange: true, reviewed: false, createdAt: '2026-07-12' },

  { id: 'CHG-1031', projectId: 'PRJ-103', message: 'Jumlah peserta Group B bertambah dari 20 menjadi 25 pax', isChange: true, reviewed: true, createdAt: '2026-07-10' },
]

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

  { id: 'TSK-1031', projectId: 'PRJ-103', title: 'Finalisasi rooming list Group C', status: 'in-progress' },
  { id: 'TSK-1032', projectId: 'PRJ-103', title: 'Konfirmasi venue MICE hari ke-2', status: 'pending-confirmation' },
  { id: 'TSK-1033', projectId: 'PRJ-103', title: 'Kirim rundown acara ke client', status: 'not-started' },
  { id: 'TSK-1034', projectId: 'PRJ-103', title: 'Rekonsiliasi actual cost transportation', status: 'overdue', dueAt: '2026-07-25' },
]
