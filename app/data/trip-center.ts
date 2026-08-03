import { reactive } from 'vue'
import type { TripAnnouncement } from '~/types/trip-center'

/**
 * `TRIP_ANNOUNCEMENTS` (Repair Phase Section 5 — Execution & Changes). 2 skenario: PRJ-202 (Abu Dhabi,
 * trip aktif) — pengumuman perubahan titik kumpul yang WAJIB dikonfirmasi Client (`USR-021` belum
 * mengonfirmasi, mendemokan aksi "Confirm announcement"); PRJ-201 (Korea, pra-keberangkatan) — reminder
 * dokumen, informasional saja (`requiresConfirmation: false`).
 */
export const TRIP_ANNOUNCEMENTS: TripAnnouncement[] = reactive([
  {
    id: 'ANN-001',
    projectId: 'PRJ-202',
    title: 'Perubahan Titik Kumpul Hari Ini',
    message: 'Titik kumpul untuk sesi delegasi bisnis hari ini dipindahkan ke Ballroom A, Hotel Emirates Palace (semula Ballroom B). Mohon konfirmasi bahwa Anda sudah menerima informasi ini.',
    publishedAt: '2026-07-29',
    publishedBy: 'USR-002',
    requiresConfirmation: true,
    confirmedByUserIds: []
  },
  {
    id: 'ANN-002',
    projectId: 'PRJ-201',
    title: 'Reminder Kelengkapan Dokumen',
    message: 'Mohon pastikan seluruh peserta melengkapi nomor paspor sebelum H-30 keberangkatan (12 Sep 2026) agar proses tiket tidak tertunda.',
    publishedAt: '2026-07-20',
    publishedBy: 'USR-002',
    requiresConfirmation: false,
    confirmedByUserIds: []
  }
])
