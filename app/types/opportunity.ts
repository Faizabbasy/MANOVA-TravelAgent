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
}
