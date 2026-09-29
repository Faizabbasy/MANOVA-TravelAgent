import type { ID } from './common'

/**
 * `TripAnnouncement` (Repair Phase Section 5 — Execution & Changes, Master Prompt bagian 10 "Announcements"/
 * "Confirm announcement"). Entitas baru berdiri sendiri — TIDAK ada padanan existing (`Message`/`Notification`,
 * Section 21, adalah percakapan/inbox per-user, bukan broadcast satu arah per-project yang bisa
 * dikonfirmasi banyak traveler/PIC company). Mock murni, tidak ada integrasi push/email nyata (D-006).
 */
export interface TripAnnouncement {
  id: ID
  projectId: ID
  title: string
  message: string
  publishedAt: string
  publishedBy: ID
  requiresConfirmation: boolean
  /** userId yang sudah menekan "Confirm announcement" — kosong bila `requiresConfirmation` false. */
  confirmedByUserIds: ID[]
}
