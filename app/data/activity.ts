import { reactive } from 'vue'
import type { ActivityEntry, ProjectDocument, ProjectTask, ProjectRisk, ShiftNote, SystemEvent } from '~/types/activity'

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
  /** PRJ-104 (Prompt 19) — mengikuti pola entri `approveOpportunityWon` (Section 09) untuk project yang di-seed langsung. */
  { id: 'ACT-1041', projectId: 'PRJ-104', message: 'Project PRJ-104 dibuat dari Opportunity OPP-008 (Won oleh Sari Wijaya/Management)', isChange: false, reviewed: true, createdAt: '2026-07-24' },
])

export const DOCUMENTS: ProjectDocument[] = [
  { id: 'DOC-1011', projectId: 'PRJ-101', name: 'E-ticket_Manila_Group.pdf', uploadedAt: '2026-06-26' },

  { id: 'DOC-1021', projectId: 'PRJ-102', name: 'Revised_Itinerary_AbuDhabi.pdf', uploadedAt: '2026-07-09' },
  { id: 'DOC-1022', projectId: 'PRJ-102', name: 'Hotel_Upgrade_Approval.pdf', uploadedAt: '2026-07-12' },

  { id: 'DOC-1031', projectId: 'PRJ-103', name: 'Rundown_Acara_MICE_Palu.pdf', uploadedAt: '2026-07-01' },
  { id: 'DOC-1032', projectId: 'PRJ-103', name: 'Rooming_List_Draft_GroupC.xlsx', uploadedAt: '2026-07-15' },
  { id: 'DOC-1033', projectId: 'PRJ-103', name: 'Kontrak_Vendor_MICE.pdf', uploadedAt: '2026-06-10' },
]

/**
 * `reactive()` (Section 09 — roadmap Section 00–24 baru) — Tasks tab sebelumnya read-only murni (tidak
 * ada create/edit sama sekali meski `dueAt` sudah ada di type sejak Foundation); `createProjectTask`/
 * `updateProjectTask` (`app/data/index.ts`) butuh array reaktif. `isMilestone`/`dependsOnTaskId`/
 * `assignedTo` (Wajib "Milestones, tasks, dependencies") dibackfill aditif pada beberapa baris existing
 * untuk mendemokan fitur tanpa mengubah task lama yang sudah berjalan.
 */
export const TASKS: ProjectTask[] = reactive([
  { id: 'TSK-1011', projectId: 'PRJ-101', title: 'Konfirmasi manifest penumpang', status: 'done', assignedTo: 'USR-004' },

  // isBlocked/blockedReason (Section 12 baru, Wajib "blocker") — dibackfill pada 1 task per skenario yang paling wajar diblokir oleh faktor eksternal (bukan seluruh task, agar tetap merepresentasikan kondisi realistis campuran blocked/tidak).
  { id: 'TSK-1021', projectId: 'PRJ-102', title: 'Reschedule hotel booking', status: 'in-progress', assignedTo: 'USR-005', isBlocked: true, blockedReason: 'Menunggu konfirmasi ketersediaan kamar Suite dari hotel' },
  { id: 'TSK-1022', projectId: 'PRJ-102', title: 'Update traveler manifest', status: 'overdue', dueAt: '2026-07-22', assignedTo: 'USR-004', dependsOnTaskId: 'TSK-1021' },
  // TSK-1023 (Section 06/Dashboard): melengkapi task dengan dueAt di masa depan agar widget
  // "Milestone/task mendatang" (Project Manager) punya data selain yang overdue.
  { id: 'TSK-1023', projectId: 'PRJ-102', title: 'Follow-up pembayaran termin tambahan ke client', status: 'not-started', dueAt: '2026-08-01' },

  { id: 'TSK-1031', projectId: 'PRJ-103', title: 'Finalisasi rooming list Group C', status: 'in-progress', isMilestone: true, assignedTo: 'USR-005' },
  { id: 'TSK-1032', projectId: 'PRJ-103', title: 'Konfirmasi venue MICE hari ke-2', status: 'pending-confirmation', isMilestone: true, assignedTo: 'USR-007' },
  { id: 'TSK-1033', projectId: 'PRJ-103', title: 'Kirim rundown acara ke client', status: 'not-started', dependsOnTaskId: 'TSK-1032' },
  { id: 'TSK-1034', projectId: 'PRJ-103', title: 'Rekonsiliasi actual cost transportation', status: 'overdue', dueAt: '2026-07-25', assignedTo: 'USR-006' },
  { id: 'TSK-1035', projectId: 'PRJ-103', title: 'Verifikasi ulang manifest VIP sebelum keberangkatan', status: 'in-progress', dueAt: '2026-08-05', isMilestone: true },
])

/**
 * Project Risk (Section 09 — roadmap Section 00–24 baru, Wajib "risks"). Diseed pada `PRJ-103` (project
 * `complex`, MICE 60 pax — skenario paling wajar untuk risk tracking nyata), tidak dipaksakan ke seluruh
 * project demo lain.
 */
export const PROJECT_RISKS: ProjectRisk[] = reactive([
  { id: 'RSK-1031', projectId: 'PRJ-103', title: 'Ketersediaan venue MICE hari ke-2 belum terkonfirmasi final', description: 'Venue alternatif perlu disiapkan bila konfirmasi tidak turun H-7.', severity: 'high', status: 'open', raisedBy: 'USR-002', createdAt: '2026-07-20' },
  { id: 'RSK-1032', projectId: 'PRJ-103', title: 'Cuaca ekstrem berpotensi mengganggu sesi outdoor', description: 'Rencana cadangan indoor perlu disiapkan tim Operations.', severity: 'medium', status: 'mitigated', raisedBy: 'USR-006', createdAt: '2026-07-18' },
])

/**
 * "On-trip updates dan shift notes mock" (Section 12 — roadmap Section 00–24 baru, Wajib). Diseed pada
 * `PRJ-103` (satu-satunya project berstatus `in-progress`/on-trip pada tanggal referensi demo, skenario
 * paling wajar untuk shift handover nyata), tidak dipaksakan ke project lain yang belum berjalan.
 */
export const SHIFT_NOTES: ShiftNote[] = reactive([
  { id: 'SFT-1031', projectId: 'PRJ-103', authorId: 'USR-006', shift: 'pagi', note: 'Seluruh group tiba tepat waktu, transportasi bandara-hotel lancar tanpa kendala.', createdAt: '2026-08-10' },
  { id: 'SFT-1032', projectId: 'PRJ-103', authorId: 'USR-007', shift: 'siang', note: 'Venue MICE hari ke-1 sudah siap, AV testing selesai. Serah terima ke shift malam untuk persiapan hari ke-2.', createdAt: '2026-08-11' },
])

/**
 * System Event (Prompt 19 — Change Request, Activity Center Super Admin). Log mock lintas-modul,
 * `entityId` merujuk ID entitas sumber yang sudah ada (`LEADS`/`OPPORTUNITIES`/`QUOTATIONS`/`PARTIES`/
 * `PROJECTS`/`VENDOR_QUOTATIONS`/`INVOICES`/`USERS`) — bukan log paralel yang memfabrikasi entitas baru.
 * Diurutkan kronologis (lama → baru) mengikuti tanggal transaksi entitas aslinya.
 */
export const SYSTEM_EVENTS: SystemEvent[] = reactive([
  { id: 'EVT-001', module: 'user', type: 'user-created', message: 'User Galih Ramadhan (Account Executive) ditambahkan ke sistem', entityId: 'USR-014', userId: 'USR-010', createdAt: '2026-06-01' },
  { id: 'EVT-002', module: 'opportunity', type: 'opportunity-created', message: 'Opportunity OPP-001 "Manila Business Trip Q3 2026" dibuat', entityId: 'OPP-001', userId: 'USR-014', createdAt: '2026-06-10' },
  { id: 'EVT-003', module: 'quotation', type: 'quotation-approved', message: 'Quotation QUO-001 (Rp 95.000.000) disetujui Management', entityId: 'QUO-001', userId: 'USR-003', createdAt: '2026-06-24' },
  { id: 'EVT-004', module: 'opportunity', type: 'opportunity-won', message: 'Opportunity OPP-001 ditandai Won', entityId: 'OPP-001', userId: 'USR-003', createdAt: '2026-06-25' },
  { id: 'EVT-005', module: 'client', type: 'client-activated', message: 'PT Cipta Distribusi Nusantara (PTY-001) berubah status menjadi Active Client', entityId: 'PTY-001', createdAt: '2026-06-25' },
  { id: 'EVT-006', module: 'project-order', type: 'project-order-created', message: 'Project Order PRJ-101 dibuat dari Opportunity OPP-001', entityId: 'PRJ-101', createdAt: '2026-06-25' },
  { id: 'EVT-007', module: 'finance', type: 'invoice-issued', message: 'Invoice INV-1011 (Rp 95.000.000) diterbitkan untuk PRJ-101', entityId: 'INV-1011', createdAt: '2026-06-26' },
  { id: 'EVT-008', module: 'finance', type: 'payment-received', message: 'Payment PAY-1011 (Rp 95.000.000) diterima, INV-1011 lunas', entityId: 'PAY-1011', createdAt: '2026-07-10' },
  { id: 'EVT-009', module: 'vendor', type: 'supplier-quotation-submitted', message: 'Vendor VND-003 mengajukan quotation VQ-009 untuk PRJ-103', entityId: 'VQ-009', createdAt: '2026-07-15' },
  { id: 'EVT-010', module: 'vendor', type: 'supplier-quotation-submitted', message: 'Vendor VND-005 mengajukan quotation kompetitor VQ-010 untuk PRJ-103', entityId: 'VQ-010', createdAt: '2026-07-16' },
  { id: 'EVT-011', module: 'lead', type: 'lead-created', message: 'Lead LED-010 "Toni Gunawan" (UD Gunawan Sejahtera) masuk dari sumber Other', entityId: 'LED-010', createdAt: '2026-06-15' },
  { id: 'EVT-012', module: 'lead', type: 'lead-assigned', message: 'Lead LED-006 "Wahyu Setiadi" ditugaskan ke Rani Kusuma (Sales)', entityId: 'LED-006', userId: 'USR-001', createdAt: '2026-07-12' },
  { id: 'EVT-013', module: 'lead', type: 'lead-created', message: 'Lead LED-004 "Doni Ferdian" masuk dari sumber WhatsApp', entityId: 'LED-004', createdAt: '2026-07-18' },
  { id: 'EVT-014', module: 'lead', type: 'lead-follow-up-added', message: 'Follow-up dijadwalkan untuk Lead LED-004', entityId: 'LED-004', userId: 'USR-001', createdAt: '2026-07-26' },
  { id: 'EVT-015', module: 'lead', type: 'lead-qualified', message: 'Lead LED-005 "Nadia Ramadhani" di-qualify dan diserahkan ke Account Executive', entityId: 'LED-005', userId: 'USR-014', createdAt: '2026-07-18' },
  { id: 'EVT-016', module: 'opportunity', type: 'opportunity-created', message: 'Opportunity OPP-005 "Bali Team Building 2026" dibuat dari Lead LED-005', entityId: 'OPP-005', userId: 'USR-014', createdAt: '2026-07-05' },
  { id: 'EVT-017', module: 'quotation', type: 'quotation-submitted', message: 'Quotation QUO-005 (Rp 180.000.000) diajukan untuk commercial approval', entityId: 'QUO-005', userId: 'USR-014', createdAt: '2026-07-22' },
  { id: 'EVT-018', module: 'quotation', type: 'quotation-approved', message: 'Quotation QUO-006 (Rp 60.000.000) disetujui Management', entityId: 'QUO-006', userId: 'USR-003', createdAt: '2026-07-23' },
  { id: 'EVT-019', module: 'opportunity', type: 'opportunity-won', message: 'Opportunity OPP-008 (repeat client PT Cipta Distribusi Nusantara) ditandai Won', entityId: 'OPP-008', userId: 'USR-003', createdAt: '2026-07-24' },
  { id: 'EVT-020', module: 'project-order', type: 'project-order-created', message: 'Project Order PRJ-104 dibuat dari Opportunity OPP-008 — Project Order kedua PT Cipta Distribusi Nusantara', entityId: 'PRJ-104', createdAt: '2026-07-24' },
  { id: 'EVT-021', module: 'user', type: 'user-created', message: 'Supplier user Hasan Alfarizi (PT ABC) ditambahkan, terisolasi ke VND-006', entityId: 'USR-015', userId: 'USR-010', createdAt: '2026-07-27' },
  { id: 'EVT-022', module: 'user', type: 'user-created', message: 'Supplier user Ika Puspitasari (PT EFG) ditambahkan, terisolasi ke VND-007', entityId: 'USR-016', userId: 'USR-010', createdAt: '2026-07-27' },
])
