import type { ID } from './common'

/**
 * `SupportTicket` (Client Experience — Repair Phase Section 1). Kanal keluhan/permintaan bantuan
 * CLIENT-FACING — SENGAJA terpisah dari `Incident` (`app/types/change-incident.ts`, Section 19, LOCKED),
 * yang tetap murni audit trail operasional internal (severity/escalation/communication log terstruktur
 * untuk tim Operations). Keduanya TIDAK saling menggantikan — `SupportTicket` tidak menjadi "log kedua"
 * untuk hal yang sudah dicakup `Incident`; bila diperlukan lintas keduanya di masa depan, tautkan lewat
 * ID longgar (`incidentId`), jangan gabungkan skema. Foundation only (Section 1) — array seed kosong,
 * mutator dibangun oleh section "Finance & Collaboration".
 */
export type SupportTicketCategory = 'reservation' | 'participant' | 'document' | 'billing' | 'operational' | 'complaint' | 'emergency' | 'technical' | 'service-quality'

export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export type SupportTicketStatus = 'open' | 'assigned' | 'in-progress' | 'waiting-for-client' | 'resolved' | 'closed' | 'reopened'

export interface SupportTicketReply {
  id: ID
  ticketId: ID
  authorId: ID
  message: string
  createdAt: string
  /** Repair Phase Section 6, Master Prompt bagian 14 "Attachment" — metadata nama file saja (mock). */
  attachmentName?: string
  /** S12c-2: the author's name, whether the client wrote it, and (staff only) an internal note. */
  authorName?: string
  fromClient?: boolean
  internal?: boolean
}

export interface SupportTicket {
  id: ID
  clientPartyId: ID
  projectId?: ID
  category: SupportTicketCategory
  priority: SupportTicketPriority
  status: SupportTicketStatus
  subject: string
  description: string
  createdAt: string
  createdBy: ID
  assignedTo?: ID
  /** Loose reference — HANYA bila tiket ini benar-benar berasal dari satu `Incident` internal yang sudah ada, tidak pernah dibuat otomatis dari sini. */
  incidentId?: ID
  /** Repair Phase Section 6, Master Prompt bagian 14 "Attachment" — metadata nama file saja (mock), dilampirkan saat create. */
  attachmentName?: string
  resolutionNote?: string
  resolvedAt?: string
  /** Rating Client atas penyelesaian (1-5), diisi setelah `resolved`. */
  resolutionRating?: number
  /** S12c-2: from the server — the handler's name, the rating note, how often the client reopened it, when it closed. */
  assignedToName?: string
  ratingNote?: string
  reopenCount?: number
  closedAt?: string
  projectName?: string
}
