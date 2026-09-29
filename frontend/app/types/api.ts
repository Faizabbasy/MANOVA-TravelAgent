/**
 * Wire types for the MANOVA API (`backend/`, prefix `/api/v1`). They mirror the backend DTOs exactly;
 * when a backend response shape changes, update this file in the same change (root CLAUDE.md rule).
 *
 * Conventions (docs/manova-finance-implementation/05-API-CONTRACTS.md):
 *  - money is `MoneyMinor`: an integer in minor units as a decimal string ("30000000" = Rp30.000.000)
 *  - calendar dates are `YYYY-MM-DD` (Asia/Jakarta business dates); instants are ISO-8601 UTC strings
 */

export type MoneyMinor = string
export type IsoDate = string
export type IsoDateTime = string

export interface ApiMeta {
  requestId: string
}

export interface ApiPagination {
  limit: number
  nextCursor: string | null
}

export interface ApiSuccess<T> {
  data: T
  meta: ApiMeta
}

export interface ApiList<T> {
  data: T[]
  meta: ApiMeta & { pagination: ApiPagination }
}

export interface ApiErrorPayload {
  error: {
    code: string
    message: string
    fieldErrors?: Record<string, string[]>
    details?: Record<string, unknown>
  }
  meta: ApiMeta
}

export interface PageQuery {
  limit?: number
  cursor?: string | null
}

// ── Health ────────────────────────────────────────────────────────────────────────────────────────────

export interface HealthDto {
  status: 'ok' | 'degraded'
  service: string
  /** Omitted in production (the endpoint is unauthenticated). */
  version?: string
  environment?: 'development' | 'test' | 'production'
  time: IsoDateTime
  timezone: string
  database: {
    /** Omitted in production. */
    engine?: 'postgres' | 'pglite'
    reachable: boolean
    schemaVersion?: number
    latestVersion: number
    pendingMigrations?: number
    migrationProblems?: number
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────────────────────────────

/** Active roles: super-admin, admin, finance. client/vendor exist but cannot sign in while portals are off. */
export type ApiRoleId = 'super-admin' | 'admin' | 'finance' | 'client' | 'vendor'
export type ApiPermissionLevel = 'NONE' | 'VIEW' | 'MANAGE' | 'APPROVE' | 'ADMIN'

export interface MeDto {
  user: { id: string; name: string; email: string; role: ApiRoleId; roleLabel: string; kind: 'internal' | 'portal' }
  scope: { partyId: string | null; vendorId: string | null }
  /** Server-computed; the UI may hide/disable with it, but the API enforces it. */
  permissions: {
    modules: Record<string, ApiPermissionLevel>
    capabilities: string[]
    canViewFullFinancials: boolean
  }
  session: { expiresAt: IsoDateTime }
}

// ── Core references ───────────────────────────────────────────────────────────────────────────────────

export type ApiProjectStatus = 'draft' | 'planning' | 'confirmed' | 'in-progress' | 'ongoing-trip' | 'completed' | 'on-hold' | 'cancelled'
/** Booking-orchestration literals: note `transport`, not `transportation`. */
export type ApiBookingType = 'flight' | 'hotel' | 'transport' | 'mice'
export type ApiProvenance = 'manual' | 'demo-fixture' | 'migration'

/** What client and vendor portals receive. */
export interface ProjectPortalDto {
  id: string
  name: string
  destination: string | null
  travelStartDate: IsoDate | null
  travelEndDate: IsoDate | null
  status: ApiProjectStatus
}

/** What internal roles receive. */
export interface ProjectInternalDto extends ProjectPortalDto {
  partyId: string
  partyName: string
  ownerUserId: string | null
  teamUserIds: string[]
  provenance: ApiProvenance
  /** Owned by the Project module (ADR-007). Null when unset or when the role may not see commercial figures. */
  contractValueMinor: MoneyMinor | null
  contractCurrency: string
}

export type ProjectDto = ProjectPortalDto | ProjectInternalDto

export type ProjectDetailDto = ProjectDto & { bookings: { type: ApiBookingType; id: string }[] }

export interface PartyDto {
  id: string
  name: string
  lifecycleStatus: 'prospect' | 'client'
  partyType: 'company' | 'individual' | null
  preferredCurrency: string | null
  provenance?: ApiProvenance
}

export interface VendorDto {
  id: string
  name: string
  serviceType: 'flight' | 'hotel' | 'transportation' | 'mice' | 'additional'
  status: 'active' | 'inactive' | 'pending'
  provenance?: ApiProvenance
}

export interface ServiceOrderRefDto {
  id: string
  vendorId: string
  vendorName: string
  projectId: string | null
  serviceId: string | null
}

export interface BookingRefDto {
  type: ApiBookingType
  id: string
  projectId: string
  /** Internal roles only. */
  serviceId?: string | null
  serviceType?: string | null
  vendorId?: string | null
  /** Owned by the Booking module (ADR-007): first departure / check-in / pickup / session date. */
  departureDate?: IsoDate | null
  /** Owned by the Booking module; null when unpriced or when the role may not see commercial figures. */
  sellAmountMinor?: MoneyMinor | null
}

export function isInternalProject (project: ProjectDto): project is ProjectInternalDto {
  return 'partyId' in project
}
