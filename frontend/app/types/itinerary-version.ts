import type { ID } from './common'
import type { ItineraryItem } from './project'

/**
 * `ItineraryVersion` (Client Experience — Repair Phase Section 1). `ItineraryItem` (`app/types/project.ts`,
 * LOCKED) TIDAK diubah shape-nya — versioning ditambahkan sebagai lapisan ADITIF di atasnya: setiap
 * revisi itinerary menghasilkan satu `ItineraryVersion` baru berisi SNAPSHOT `items` pada saat itu
 * (bukan referensi hidup), "jangan menimpa versi lama" (Master Prompt bagian G.8) terpenuhi karena versi
 * lama tetap sebagai row terpisah, tidak pernah di-mutate setelah dibuat. Foundation only (Section 1) —
 * array seed kosong, mutator (publish/request-revision/approve) dibangun oleh section "Core Project".
 */
export type ItineraryVersionStatus = 'draft' | 'under-review' | 'revision-requested' | 'waiting-approval' | 'approved' | 'final' | 'superseded'

export interface ItineraryVersion {
  id: ID
  projectId: ID
  versionNumber: number
  status: ItineraryVersionStatus
  /** Snapshot item itinerary pada versi ini — salinan, bukan referensi ke `ITINERARY_ITEMS` hidup. */
  items: ItineraryItem[]
  createdAt: string
  createdBy: ID
  /** Terisi bila versi ini lahir dari revisi Client atas versi sebelumnya. */
  supersedesVersionId?: ID
  comment?: string
}

/**
 * Comment thread Itinerary (Repair Phase Section 4 — Core Project, Wajib "Comment"). Entitas kecil berdiri
 * sendiri, pola sama `QuotationComment` (Section 3, `app/types/quotation.ts`) — BUKAN `Message`/`Document`
 * (Section 21) karena modul `documents` tetap `NONE` untuk client (di luar scope section ini). Diskop per
 * `projectId` (bukan per-version) — komentar berlaku untuk seluruh percakapan itinerary project tsb.
 */
export interface ItineraryComment {
  id: ID
  projectId: ID
  authorId: ID
  body: string
  createdAt: string
}
