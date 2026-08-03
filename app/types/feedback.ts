import type { ID } from './common'

/**
 * `Feedback` (Client Experience — Repair Phase Section 1). Entitas baru — belum ada padanan di codebase.
 * "Feedback harus memperbarui project closing progress" (Master Prompt bagian G.17/H Flow 6) berarti
 * `Feedback` akan menaut ADITIF ke `ProjectClosureChecklist` (`app/types/project.ts`, shell sejak Section
 * 09/D-066, gate nyata sejak Section 24/LOCKED — `evaluateProjectClosureGate`) lewat field baru murni
 * penambahan, TIDAK PERNAH mengubah logic gate closure yang sudah final. Integrasi tsb dikerjakan oleh
 * section "Insights & Company" (bukan Section 1) — foundation ini hanya menyediakan tipe + array kosong.
 */
export type FeedbackStatus = 'not-started' | 'draft' | 'submitted' | 'acknowledged' | 'follow-up-required' | 'closed'

export interface Feedback {
  id: ID
  projectId: ID
  clientPartyId: ID
  submittedBy?: ID
  status: FeedbackStatus
  overallExperience?: number
  salesResponsiveness?: number
  proposalQuality?: number
  itineraryQuality?: number
  hotelRating?: number
  transportationRating?: number
  tourLeaderRating?: number
  operationSupportRating?: number
  reservationHandlingRating?: number
  communicationRating?: number
  issueResolutionRating?: number
  valueForMoneyRating?: number
  recommendationScore?: number
  comment?: string
  improvementSuggestion?: string
  testimonialConsent: boolean
  createdAt?: string
  submittedAt?: string
  acknowledgedAt?: string
  acknowledgedBy?: ID
}
