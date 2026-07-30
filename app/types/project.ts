import type { ID } from './common'

export type ServiceTypeKey = 'flight' | 'hotel' | 'transportation' | 'mice'

export type ProjectStatus =
  | 'draft'
  | 'planning'
  | 'confirmed'
  | 'in-progress'
  | 'ongoing-trip'
  | 'completed'
  | 'on-hold'
  | 'cancelled'

export type ProjectCharacteristic = 'normal' | 'high-change' | 'complex'

export type ServiceStatus =
  | 'not-started'
  | 'sourcing'
  | 'quoted'
  | 'pending-confirmation'
  | 'confirmed'
  | 'changed'
  | 'completed'
  | 'cancelled'

/** Tab identifiers for the Project Detail workspace (docs/mockup-information-architecture.md bagian 4). */
export type ProjectDetailTab =
  | 'overview'
  | 'itinerary-services'
  | 'travelers'
  | 'vendors'
  | 'finance'
  | 'tasks'
  | 'documents'
  | 'activity-changes'

export interface Project {
  id: ID
  name: string
  partyId: ID
  opportunityId?: ID
  /** Quotation yang di-Won-kan, referensi (Section 09 — docs/route-and-role-matrix.md bagian 2.2 item 6). */
  sourceQuotationId?: ID
  destination: string
  travelStartDate: string
  travelEndDate: string
  characteristic: ProjectCharacteristic
  serviceScope: ServiceTypeKey[]
  travelerCount: number
  ownerId: ID
  teamUserIds: ID[]
  status: ProjectStatus
  quotationAmountIdr: number
  budgetIdr: number
  actualCostIdr: number
}

export interface ProjectService {
  id: ID
  projectId: ID
  type: ServiceTypeKey
  label: string
  status: ServiceStatus
  vendorId?: ID
}

export interface TravelerGroup {
  id: ID
  projectId: ID
  name: string
  paxCount: number
  /** Ringkasan rooming list per group (Section 11), mis. "5 kamar twin (10 pax)" — teks, bukan breakdown kamar granular. */
  roomingNote?: string
}

export interface Traveler {
  id: ID
  projectId: ID
  groupId?: ID
  name: string
  passportNumber?: string
  passportExpiryDate?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  specialRequest?: string
}

export type RoomType = 'single' | 'twin' | 'suite'

/** Rooming list (Section 11) — penugasan traveler bernama ke kamar spesifik dalam satu group. */
export interface RoomAssignment {
  id: ID
  projectId: ID
  groupId: ID
  roomLabel: string
  roomType: RoomType
  travelerIds: ID[]
}
