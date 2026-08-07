import { reactive } from 'vue'
import type { SupportTicket, SupportTicketReply } from '~/types/support'

/**
 * Support Ticket (Client Experience — Repair Phase Section 1, Foundation; mutator+seed Repair Phase
 * Section 6 — Finance & Collaboration). 3 skenario demo untuk `PTY-005`/`USR-021`: `TCK-001` (in-progress,
 * mendemokan Reply + auto-`in-progress` dari `waiting-for-client`), `TCK-002` (resolved, mendemokan Confirm
 * Resolution/Reopen/Rating), `TCK-003` (open, belum ditriase, category `emergency` — mendemokan UI
 * emergency-ticket-menonjol dan kasus belum ada `assignedTo`).
 */
export const SUPPORT_TICKETS: SupportTicket[] = reactive([
  {
    id: 'TCK-001',
    clientPartyId: 'PTY-005',
    projectId: 'PRJ-202',
    category: 'operational',
    priority: 'high',
    status: 'in-progress',
    subject: 'Perubahan jadwal city tour hari ke-3',
    description: 'Delegasi kami perlu menggeser jadwal city tour hari ke-3 karena ada meeting tambahan yang mendadak. Mohon bantuan tim operasional untuk koordinasi ulang jadwal dengan guide/transportasi.',
    createdAt: '2026-07-27',
    createdBy: 'USR-021',
    assignedTo: 'USR-002'
  },
  {
    id: 'TCK-002',
    clientPartyId: 'PTY-005',
    projectId: 'PRJ-201',
    category: 'document',
    priority: 'medium',
    status: 'resolved',
    subject: 'Bantuan verifikasi visa peserta',
    description: 'Beberapa peserta kami masih ragu dokumen visa yang diunggah sudah sesuai format yang diminta kedutaan Korea. Mohon dicek ulang oleh tim.',
    createdAt: '2026-07-18',
    createdBy: 'USR-021',
    assignedTo: 'USR-002',
    resolutionNote: 'Seluruh dokumen visa yang diunggah sudah sesuai format, tidak ada yang perlu direvisi. Tim kami sudah mengonfirmasi ke masing-masing peserta.',
    resolvedAt: '2026-07-21'
  },
  /** Belum ditriase (`assignedTo` kosong) — status `open` murni fixture historis, TIDAK dibuat lewat `createSupportTicket` (yang selalu auto-assign instan) agar ada 1 skenario "belum ditugaskan" untuk diverifikasi UI. */
  {
    id: 'TCK-003',
    clientPartyId: 'PTY-005',
    projectId: 'PRJ-204',
    category: 'emergency',
    priority: 'urgent',
    status: 'open',
    subject: 'Info darurat cuaca ekstrem mendekati tanggal konferensi',
    description: 'Kami menerima info cuaca ekstrem di Singapura mendekati tanggal konferensi kami. Mohon informasi kontingensi dari tim Manova secepatnya.',
    createdAt: '2026-07-28',
    createdBy: 'USR-021'
  }
])

export const SUPPORT_TICKET_REPLIES: SupportTicketReply[] = reactive([
  { id: 'TCKR-001', ticketId: 'TCK-001', authorId: 'USR-002', message: 'Sudah kami koordinasikan dengan guide dan transportasi — jadwal city tour digeser ke sore hari. Konfirmasi tertulis menyusul dalam 1x24 jam.', createdAt: '2026-07-27' },
  { id: 'TCKR-002', ticketId: 'TCK-001', authorId: 'USR-021', message: 'Baik, ditunggu konfirmasinya. Terima kasih.', createdAt: '2026-07-28' },
  { id: 'TCKR-003', ticketId: 'TCK-002', authorId: 'USR-002', message: 'Sudah kami cek satu per satu, seluruh dokumen visa lengkap dan sesuai format.', createdAt: '2026-07-21' }
])
