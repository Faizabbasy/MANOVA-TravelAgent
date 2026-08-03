import type { ID } from './common'

/**
 * `Approval` (Client Experience — Repair Phase Section 1). Generalisasi approval Client lintas berbagai
 * entitas — SATU tipe generik menaut ke `entityType`+`entityId` (pola sama `Document`/`Message`,
 * `app/types/document-comms.ts`), BUKAN membuat approval flow terpisah per entitas. Quotation Accept/
 * Reject/Request Revision (`app/pages/client/opportunities/[id]/index.vue`, `recordClientConfirmation`)
 * TETAP jalur tersendiri yang sudah bekerja — TIDAK diganti/dimigrasikan oleh entitas ini, `Approval` di
 * sini melengkapi jenis approval LAIN yang belum ada mekanismenya (final itinerary, participant list,
 * rooming list, change request, additional charge, cancellation charge, project completion, final
 * report, berita acara — lihat Master Prompt bagian G.5). Foundation only (Section 1) — array seed
 * kosong, mutator dibangun oleh section "Request & Commercial".
 */
export type ApprovalEntityType =
  | 'itinerary-version'
  | 'participant-list'
  | 'rooming-list'
  | 'change-request'
  | 'additional-charge'
  | 'cancellation-charge'
  | 'project-completion'
  | 'final-report'
  | 'berita-acara'

export type ApprovalDecision = 'approve' | 'reject' | 'request-revision'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revision-requested'

export interface Approval {
  id: ID
  projectId: ID
  clientPartyId: ID
  entityType: ApprovalEntityType
  entityId: ID
  status: ApprovalStatus
  requestedAt: string
  requestedBy: ID
  decision?: ApprovalDecision
  decidedBy?: ID
  decidedAt?: string
  /** Nominal yang disetujui — hanya relevan untuk `additional-charge`/`cancellation-charge`. */
  approvedAmountIdr?: number
  comment?: string
  /** Alasan wajib untuk `reject`/`request-revision` (pola sama section lain — mandatory-reason-on-destructive-transition). */
  reason?: string
  /** "Expired" (Repair Phase Section 3, Master Prompt bagian G.5) — derivasi lewat `isApprovalExpired` (pola sama `isDocumentExpired`), BUKAN nilai `ApprovalStatus` tersimpan (tetap `pending` sampai diputuskan/kedaluwarsa). Opsional — mayoritas jenis approval belum punya deadline baku. */
  expiresAt?: string
}
