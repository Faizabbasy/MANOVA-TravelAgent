import { reactive } from 'vue'
import type { ProjectMilestone, ProjectNote } from '~/types/project-order'

/**
 * Milestone & catatan Project Order (Revisi 9-Modul) — menopang panel "Timeline Tracking" dan
 * "Attachments & Notes" pada workspace `/project-orders/[id]`.
 *
 * `delay` SENGAJA tidak disimpan sebagai field. Ia diturunkan dari `plannedDate` vs `actualDate`
 * (`getMilestoneDelayDays`, `app/data/project-order-workflow.ts`) — konsisten dengan `isInvoiceOverdue`
 * dan seluruh derivasi lain di codebase ini, sehingga tidak mungkin basi.
 *
 * Attachment tidak punya entitas sendiri: workspace memakai `Document` existing (`entityType: 'project'`,
 * `getDocumentsForProject`) supaya dokumen yang sama muncul konsisten di Document Center.
 *
 * Seed sengaja memuat beberapa milestone TERLAMBAT (PRJ-102) dan beberapa selesai lebih cepat (PRJ-101),
 * agar kolom Delay, state merah, dan bar Gantt langsung terlihat hidup tanpa perlu memanipulasi data dulu.
 * Tanggal acuan demo: 2026-07-29 (`DEMO_REFERENCE_DATE`).
 */
export const PROJECT_MILESTONES: ProjectMilestone[] = reactive([
  // PRJ-101 — Manila Business Trip (confirmed, sebagian besar on-track)
  { id: 'PMS-101-1', projectId: 'PRJ-101', stepKey: 'drafting', name: 'SPK / Handover Diterima', plannedDate: '2026-06-10', actualDate: '2026-06-10', ownerId: 'USR-002', status: 'completed' },
  { id: 'PMS-101-2', projectId: 'PRJ-101', stepKey: 'drafting', name: 'Finalisasi Itinerary', plannedDate: '2026-06-18', actualDate: '2026-06-16', ownerId: 'USR-009', status: 'completed', note: 'Selesai 2 hari lebih cepat.' },
  { id: 'PMS-101-3', projectId: 'PRJ-101', stepKey: 'confirmed', name: 'Invoice DP Terbit', plannedDate: '2026-06-20', actualDate: '2026-06-21', ownerId: 'USR-008', status: 'completed' },
  { id: 'PMS-101-4', projectId: 'PRJ-101', stepKey: 'confirmed', name: 'Konfirmasi Vendor & Booking', plannedDate: '2026-07-05', actualDate: '2026-07-08', ownerId: 'USR-018', status: 'completed', note: 'Menunggu konfirmasi ulang hotel.' },
  { id: 'PMS-101-5', projectId: 'PRJ-101', stepKey: 'start', name: 'Dokumen Traveler Lengkap', plannedDate: '2026-07-25', ownerId: 'USR-002', status: 'in-progress' },
  { id: 'PMS-101-6', projectId: 'PRJ-101', stepKey: 'departure', name: 'Keberangkatan', plannedDate: '2026-08-12', ownerId: 'USR-009', status: 'not-started' },
  { id: 'PMS-101-7', projectId: 'PRJ-101', stepKey: 'on-progress', name: 'Trip Selesai', plannedDate: '2026-08-16', ownerId: 'USR-009', status: 'not-started' },
  { id: 'PMS-101-8', projectId: 'PRJ-101', stepKey: 'done', name: 'Laporan Akhir & Review Klien', plannedDate: '2026-08-25', ownerId: 'USR-002', status: 'not-started' },

  // PRJ-102 — Abu Dhabi Corporate Gathering (planning, high-change — sengaja ada keterlambatan)
  { id: 'PMS-102-1', projectId: 'PRJ-102', stepKey: 'drafting', name: 'SPK / Handover Diterima', plannedDate: '2026-06-25', actualDate: '2026-07-02', ownerId: 'USR-013', status: 'completed', note: 'Tertunda karena revisi scope dari klien.' },
  { id: 'PMS-102-2', projectId: 'PRJ-102', stepKey: 'drafting', name: 'Survey & Assessment Venue', plannedDate: '2026-07-05', actualDate: '2026-07-14', ownerId: 'USR-007', status: 'completed', note: 'Venue pertama tidak tersedia, harus survey ulang.' },
  { id: 'PMS-102-3', projectId: 'PRJ-102', stepKey: 'drafting', name: 'Finalisasi Itinerary', plannedDate: '2026-07-20', ownerId: 'USR-013', status: 'delayed', note: 'Menunggu keputusan klien atas opsi venue kedua.' },
  { id: 'PMS-102-4', projectId: 'PRJ-102', stepKey: 'confirmed', name: 'Invoice DP Terbit', plannedDate: '2026-07-24', ownerId: 'USR-008', status: 'delayed' },
  { id: 'PMS-102-5', projectId: 'PRJ-102', stepKey: 'confirmed', name: 'Konfirmasi Vendor & Booking', plannedDate: '2026-08-05', ownerId: 'USR-018', status: 'not-started' },
  { id: 'PMS-102-6', projectId: 'PRJ-102', stepKey: 'start', name: 'Dokumen Traveler Lengkap', plannedDate: '2026-08-20', ownerId: 'USR-013', status: 'not-started' },
  { id: 'PMS-102-7', projectId: 'PRJ-102', stepKey: 'departure', name: 'Keberangkatan', plannedDate: '2026-09-08', ownerId: 'USR-006', status: 'not-started' },
  { id: 'PMS-102-8', projectId: 'PRJ-102', stepKey: 'done', name: 'Laporan Akhir & Review Klien', plannedDate: '2026-09-22', ownerId: 'USR-013', status: 'not-started' },

  // PRJ-103 — Palu MICE Conference 2026 (complex)
  { id: 'PMS-103-1', projectId: 'PRJ-103', stepKey: 'drafting', name: 'SPK / Handover Diterima', plannedDate: '2026-05-15', actualDate: '2026-05-15', ownerId: 'USR-002', status: 'completed' },
  { id: 'PMS-103-2', projectId: 'PRJ-103', stepKey: 'drafting', name: 'Procurement Assessment', plannedDate: '2026-06-01', actualDate: '2026-06-04', ownerId: 'USR-018', status: 'completed' },
  { id: 'PMS-103-3', projectId: 'PRJ-103', stepKey: 'confirmed', name: 'Invoice DP Terbit', plannedDate: '2026-06-10', actualDate: '2026-06-10', ownerId: 'USR-008', status: 'completed' },
  { id: 'PMS-103-4', projectId: 'PRJ-103', stepKey: 'confirmed', name: 'Konfirmasi Vendor & Booking', plannedDate: '2026-07-01', actualDate: '2026-07-06', ownerId: 'USR-018', status: 'completed' },
  { id: 'PMS-103-5', projectId: 'PRJ-103', stepKey: 'start', name: 'Rundown & Staffing Final', plannedDate: '2026-07-22', actualDate: '2026-07-27', ownerId: 'USR-007', status: 'completed' },
  { id: 'PMS-103-6', projectId: 'PRJ-103', stepKey: 'departure', name: 'Mobilisasi Tim ke Lokasi', plannedDate: '2026-08-02', ownerId: 'USR-007', status: 'in-progress' },
  { id: 'PMS-103-7', projectId: 'PRJ-103', stepKey: 'on-progress', name: 'Event Berlangsung', plannedDate: '2026-08-05', ownerId: 'USR-007', status: 'not-started' },
  { id: 'PMS-103-8', projectId: 'PRJ-103', stepKey: 'done', name: 'Laporan Akhir & Review Klien', plannedDate: '2026-08-20', ownerId: 'USR-002', status: 'not-started' }
])

export const PROJECT_NOTES: ProjectNote[] = reactive([
  { id: 'PNT-001', projectId: 'PRJ-101', authorId: 'USR-002', body: 'Klien minta konfirmasi ulang jam kedatangan di Manila — sudah diteruskan ke Ticketing.', createdAt: '2026-07-20', pinned: true },
  { id: 'PNT-002', projectId: 'PRJ-101', authorId: 'USR-008', body: 'DP sudah masuk 21 Juni. Termin kedua jatuh tempo 5 Agustus.', createdAt: '2026-07-22' },
  { id: 'PNT-003', projectId: 'PRJ-102', authorId: 'USR-013', body: 'Venue opsi kedua (Yas Island) menunggu keputusan klien. Ini penghambat utama finalisasi itinerary.', createdAt: '2026-07-26', pinned: true },
  { id: 'PNT-004', projectId: 'PRJ-103', authorId: 'USR-007', body: 'Rundown final sudah disetujui klien. Staffing lengkap kecuali 1 slot LO cadangan.', createdAt: '2026-07-28' }
])
