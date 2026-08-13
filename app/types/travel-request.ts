import type { ID } from './common'
import type { ServiceTypeKey } from './project'
import type { PartyActivityType } from './party'

/**
 * `TravelRequest` (Client Experience). Entitas BARU, terpisah dari `Lead` (`app/types/lead.ts`) — aksi
 * "Ajukan Travel Request" Client (`app/pages/client/index.vue`) membuat `TravelRequest` dengan
 * status/draft/edit/duplicate/cancel miliknya sendiri. `TravelRequest` TIDAK menggantikan `Lead` — begitu
 * `TravelRequest` disetujui secara internal, ia akan menaut ke satu `Lead` (lewat `leadId`, ID-linked, pola
 * sama section lain), bukan memutasinya.
 */
export type TravelRequestStatus =
  | 'draft'
  | 'submitted'
  | 'under-review'
  | 'need-clarification'
  | 'proposal-preparation'
  | 'converted-to-lead'
  | 'cancelled'
  | 'closed'

export interface TravelRequestFlightRequirement {
  preferredAirline?: string
  cabinClass?: string
  notes?: string
}

export interface TravelRequestHotelRequirement {
  starRating?: string
  roomType?: string
  notes?: string
}

export interface TravelRequestTransportationRequirement {
  vehicleType?: string
  notes?: string
}

export interface TravelRequestMiceRequirement {
  eventType?: string
  expectedAttendees?: number
  notes?: string
}

export interface TravelRequest {
  id: ID
  /** Company pemohon — `Party.id` (client-portal login yang membuat), pola sama `CommodityRequirement.clientPartyId`. */
  clientPartyId: ID
  requestName: string
  contactPersonId?: ID
  tripType?: string
  purpose?: string
  destination: string
  travelStartDate?: string
  travelEndDate?: string
  dateFlexible: boolean
  estimatedParticipants?: number
  estimatedBudgetIdr?: number
  currency?: string
  serviceScope: ServiceTypeKey[]
  flightRequirement?: TravelRequestFlightRequirement
  hotelRequirement?: TravelRequestHotelRequirement
  transportationRequirement?: TravelRequestTransportationRequirement
  miceRequirement?: TravelRequestMiceRequirement
  additionalServicesNote?: string
  status: TravelRequestStatus
  createdAt: string
  updatedAt?: string
  /** Terisi begitu status mencapai `converted-to-lead` — referensi, bukan duplikasi. */
  leadId?: ID
}

/** Attachment mock (bukan file upload sungguhan, D-006) — nama file + metadata saja. */
export interface TravelRequestAttachment {
  id: ID
  travelRequestId: ID
  fileName: string
  uploadedAt: string
  uploadedBy: ID
}

/**
 * Activity timeline. Pola IDENTIK `LeadActivity` (`app/types/lead.ts`) — reuse `PartyActivityType` yang
 * sama alih-alih membuat enum baru. `TravelRequest` belum punya project (pre-Lead-qualification), sehingga
 * tidak bisa memakai `ActivityEntry` (projectId-scoped) — entitas timeline sendiri diperlukan, mengikuti
 * preseden yang sama persis dengan Lead.
 */
export interface TravelRequestActivity {
  id: ID
  travelRequestId: ID
  type: PartyActivityType
  message: string
  ownerId: ID
  createdAt: string
}
