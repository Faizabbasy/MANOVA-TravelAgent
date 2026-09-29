import type { ID } from './common'
import type { ServiceTypeKey } from './project'

/**
 * Commodity Requirement (Phase 1 — Client–Vendor Commodity) — "Kebutuhan yang dibuat Client dalam
 * project" (Phase 0 Section 7). Entitas TERPISAH dari `CommodityProduct` (produk milik Vendor) — jangan
 * digabung/dicampur.
 */
export type RequirementStatus =
  | 'draft'
  | 'open'
  | 'matching'
  | 'selection-in-progress'
  | 'selection-submitted'
  | 'fulfilled'
  | 'closed'
  | 'cancelled'

/**
 * Category-specific fields (Phase 0 Section 5) — discriminated union per `ServiceTypeKey` reuse existing
 * (`app/constants/status.ts` → `SERVICE_TYPES`). Field per kategori adalah desain minimal Phase 1, boleh
 * diperluas Phase 3 saat form UI benar-benar dibangun.
 */
export type CommodityRequirementDetail =
  | { category: 'flight'; origin?: string; destination?: string; departureDate?: string }
  | { category: 'hotel'; checkInDate?: string; checkOutDate?: string; roomCount?: number }
  | { category: 'transportation'; vehicleType?: string; serviceDate?: string; route?: string }
  | { category: 'mice'; eventType?: string; participantCount?: number; eventDate?: string }
  | { category: 'additional' }

export interface CommodityRequirement {
  id: ID
  projectId: ID
  /** Isolasi ownership Client — pola sama `clientScopeId` (`usePermissions.ts`). */
  clientPartyId: ID
  category: ServiceTypeKey
  title: string
  quantity: number
  notes?: string
  detail?: CommodityRequirementDetail
  status: RequirementStatus
  createdAt: string
  updatedAt?: string
}
