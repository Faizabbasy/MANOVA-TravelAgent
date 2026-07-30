import type { ID } from './common'
import type { ServiceTypeKey } from './project'

export type OpportunityStage =
  | 'draft'
  | 'qualification'
  | 'requirement-gathering'
  | 'proposal'
  | 'negotiation'
  | 'won-requested'
  | 'won'
  | 'lost'
  | 'on-hold'

export interface Opportunity {
  id: ID
  partyId: ID
  title: string
  stage: OpportunityStage
  /** Sales pemilik opportunity (Section 08) — dipakai widget "milik sendiri" dan filter owner. */
  ownerId: ID
  /** Estimasi nilai deal awal (Section 08) — terpisah dari `Quotation.amountIdr` yang lebih presisi setelah quotation dibuat. */
  estimatedValueIdr: number
  destination: string
  /** Tanggal perkiraan — opsional karena belum tentu diketahui di stage awal (Draft/Qualification). */
  travelStartDate?: string
  travelEndDate?: string
  travelerEstimate?: number
  /** Catatan requirement — diisi mulai stage Requirement Gathering, kosong sebelum itu. */
  requirementNotes?: string
  createdAt: string
  decidedAt?: string
  wonApprovedBy?: ID
  lostReason?: string
  serviceScope: ServiceTypeKey[]
  quotationId?: ID
  projectId?: ID
}

export interface Quotation {
  id: ID
  opportunityId: ID
  amountIdr: number
  createdAt: string
  accepted: boolean
  /** Nomor versi (Section 08) — "quotation version mock" ringan, bukan histori penuh per versi. */
  version: number
  /** Nilai versi sebelumnya, terisi hanya bila quotation ini adalah hasil revisi. */
  supersededAmountIdr?: number
}
