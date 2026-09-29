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

// ── Finance: accounts, cash book, statement, ledger (Phase 2) ────────────────────────────────────────

export type ApiOpeningStatus = 'unset' | 'pending' | 'verified'
export type ApiTransactionKind =
  | 'customer_receipt' | 'vendor_refund' | 'other_income' | 'transfer_in'
  | 'vendor_payment' | 'refund_settlement' | 'expense' | 'transfer_out' | 'transfer_fee'
export type ApiExpenseCategory = 'payroll' | 'office' | 'marketing' | 'technology' | 'travel' | 'professional' | 'bank_fee' | 'tax' | 'other'

export interface BankAccountDto {
  id: string
  code: string
  bankName: string
  holderName: string
  /** Masked ("•••• 6789") unless the caller may manage bank accounts. */
  accountNumber: string
  currency: string
  isActive: boolean
  opening: {
    status: ApiOpeningStatus
    balanceMinor: MoneyMinor | null
    date: IsoDate | null
    note: string | null
    submittedBy: string | null
    submittedAt: IsoDateTime | null
    verifiedBy: string | null
    verifiedAt: IsoDateTime | null
  }
  /** `available: false` until the opening balance is verified — show "Belum tersedia", never Rp0. */
  balance: { available: boolean; currentMinor: MoneyMinor | null; asOf: IsoDate }
  provenance: ApiProvenance
}

export interface CashPositionDto {
  asOf: IsoDate
  available: boolean
  reason: 'NO_ACCOUNTS' | 'OPENING_BALANCE_UNVERIFIED' | null
  totalMinor: MoneyMinor
  unverifiedAccountIds: string[]
  accounts: { id: string; code: string; bankName: string; currency: string; openingStatus: ApiOpeningStatus; currentMinor: MoneyMinor | null }[]
}

export interface MovementDto {
  id: string
  account: { id: string; code: string; bankName: string }
  direction: 'in' | 'out'
  amountMinor: MoneyMinor
  currency: string
  kind: ApiTransactionKind
  effectiveDate: IsoDate
  postedAt: IsoDateTime
  project: { id: string; name: string | null } | null
  booking: { type: ApiBookingType; id: string } | null
  party: { id: string; name: string | null } | null
  vendor: { id: string; name: string | null } | null
  counterparty: string | null
  reference: string | null
  memo: string | null
  category: ApiExpenseCategory | null
  transferId: string | null
  /** Transfer legs between own accounts; excluded from operational in/out totals. */
  isInternalTransfer: boolean
  reversalOfId: string | null
  reversalReason: string | null
  reversedById: string | null
  createdBy: { id: string; name: string }
}

export interface StatementList {
  data: MovementDto[]
  meta: ApiMeta & {
    pagination: ApiPagination
    period: { from: IsoDate; to: IsoDate }
    summary: {
      inMinor: MoneyMinor
      outMinor: MoneyMinor
      netMinor: MoneyMinor
      internalTransferInMinor: MoneyMinor
      internalTransferOutMinor: MoneyMinor
      count: number
    }
  }
}

export type AccountLedgerDto =
  | { available: false; reason: 'OPENING_BALANCE_UNVERIFIED'; account: { id: string; code: string; bankName: string; currency: string }; period: { from: IsoDate; to: IsoDate } }
  | {
      available: true
      account: { id: string; code: string; bankName: string; currency: string }
      period: { from: IsoDate; to: IsoDate; requestedFrom: IsoDate }
      openingDate: IsoDate
      openingMinor: MoneyMinor
      inMinor: MoneyMinor
      outMinor: MoneyMinor
      closingMinor: MoneyMinor
      items: (MovementDto & { balanceAfterMinor: MoneyMinor })[]
    }

export interface TransferDto {
  id: string
  fromAccountId: string
  toAccountId: string
  amountMinor: MoneyMinor
  feeMinor: MoneyMinor
  effectiveDate: IsoDate
  memo: string | null
  reversed: boolean
  createdBy: string
  createdAt: IsoDateTime
  legs: MovementDto[]
}

export interface ManualTransactionInput {
  bankAccountId: string
  kind: 'other_income' | 'expense'
  amountMinor: MoneyMinor
  effectiveDate: IsoDate
  category?: ApiExpenseCategory
  projectId?: string
  booking?: { type: ApiBookingType; id: string }
  partyId?: string
  vendorId?: string
  counterparty?: string
  reference?: string
  memo?: string
}

export interface TransferInput {
  fromAccountId: string
  toAccountId: string
  amountMinor: MoneyMinor
  feeMinor?: MoneyMinor
  effectiveDate: IsoDate
  memo?: string
}

export interface StatementQuery extends PageQuery {
  from?: IsoDate
  to?: IsoDate
  accountId?: string
  projectId?: string
  direction?: 'in' | 'out'
  kind?: ApiTransactionKind
  includeTransfers?: boolean
}
