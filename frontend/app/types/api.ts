/**
 * Wire types for the MANOVA API (`backend/`, prefix `/api/v1`). They mirror the backend DTOs exactly;
 * when a backend response shape changes, update this file in the same change (root CLAUDE.md rule).
 *
 * Conventions (docs/manova-finance-implementation/05-API-CONTRACTS.md):
 *  - money is `MoneyMinor`: an integer in minor units as a decimal string ("30000000" = Rp30.000.000)
 *  - calendar dates are `YYYY-MM-DD` (Asia/Jakarta business dates); instants are ISO-8601 UTC strings
 */

import type { ServiceStatus, ServiceTypeKey } from './project'
import type { DocumentEntityType, NotificationCategory, NotificationType } from './document-comms'
import type { MasterDataCategoryKey } from './master-data'
import type { AssetCategoryKey, AssetCondition, AssetStatus, CheckoutStatus, MaintenanceStatus, MaintenanceType } from './inventory'
import type { ContentDevelopmentStage, ContentPlatform, ContentScheduleStatus } from './marketing'
import type { AttendanceStatus, EmployeeStatus, EmploymentType, PayrollRunStatus } from './hr'

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

export type ApiProjectCharacteristic = 'normal' | 'high-change' | 'complex'
export type ApiServiceType = 'flight' | 'hotel' | 'transportation' | 'mice' | 'additional'

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
  characteristic: ApiProjectCharacteristic
  serviceScope: ApiServiceType[]
  travelerCount: number
  isGroupTrip: boolean
  leadId: string | null
  sourceQuotationId: string | null
  tourLeaderName: string | null
  tourLeaderPhone: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  meetingPoint: string | null
  /** Project Order workflow (S3b), dates as YYYY-MM-DD. */
  handoverAcceptedAt: IsoDate | null
  handoverAcceptedBy: string | null
  handoverReturnedAt: IsoDate | null
  handoverReturnReason: string | null
  readyAt: IsoDate | null
  financeSettledAt: IsoDate | null
  financeSettledBy: string | null
  closedAt: IsoDate | null
  closedBy: string | null
  finalNote: string | null
  clientFeedback: string | null
}

export type ProjectDto = ProjectPortalDto | ProjectInternalDto

export type ProjectDetailDto = ProjectDto & { bookings: { type: ApiBookingType; id: string }[] }

export interface ProjectCreateInput {
  name: string
  partyId?: string
  isGroupTrip?: boolean
  destination: string
  travelStartDate: IsoDate
  travelEndDate: IsoDate
  characteristic?: ApiProjectCharacteristic
  serviceScope: ApiServiceType[]
  travelerCount: number
  contractValueMinor: MoneyMinor
  leadId?: string
  sourceQuotationId?: string
}

export interface ProjectPatchInput {
  name?: string
  destination?: string
  travelStartDate?: IsoDate
  travelEndDate?: IsoDate
  characteristic?: ApiProjectCharacteristic
  serviceScope?: ApiServiceType[]
  travelerCount?: number
  tourLeaderName?: string | null
  tourLeaderPhone?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  meetingPoint?: string | null
}

export interface ContractValueInput {
  contractValueMinor: MoneyMinor
  reason: string
}

export type ApiCompanyType = 'private-company' | 'bumn' | 'government-agency' | 'university' | 'foundation' | 'event-organizer' | 'travel-agent' | 'other'

export interface PartyDto {
  id: string
  name: string
  lifecycleStatus: 'prospect' | 'client'
  partyType: 'company' | 'individual' | null
  preferredCurrency: string | null
  industry: string | null
  companyType: ApiCompanyType | null
  size: string | null
  address: string | null
  city: string | null
  province: string | null
  country: string | null
  postalCode: string | null
  phone: string | null
  email: string | null
  website: string | null
  accountOwnerUserId: string | null
  registrationNumber: string | null
  npwp: string | null
  billingName: string | null
  billingAddress: string | null
  paymentTerm: string | null
  poRequired: boolean
  travelPreferences: string | null
  /** Finance-owned (ADR-007). Null = no limit, or a role that may not see commercial figures. */
  creditLimitMinor: MoneyMinor | null
  createdAt: IsoDate
  provenance?: ApiProvenance
}

/** Profile fields an Admin may set; credit limit and lifecycle have their own commands. */
export type PartyProfileInput = Partial<Pick<PartyDto,
  'industry' | 'companyType' | 'size' | 'address' | 'city' | 'province' | 'country' | 'postalCode' | 'phone' | 'email' |
  'website' | 'accountOwnerUserId' | 'registrationNumber' | 'npwp' | 'billingName' | 'billingAddress' | 'paymentTerm' |
  'poRequired' | 'travelPreferences'>>

export interface PartyCreateInput extends PartyProfileInput {
  name: string
  partyType: 'company' | 'individual'
  lifecycleStatus?: 'prospect' | 'client'
}

export type PartyPatchInput = PartyProfileInput & { name?: string }

export interface CreditLimitInput {
  creditLimitMinor: MoneyMinor | null
  reason: string
}

export interface PartyContactDto {
  id: string
  partyId: string
  name: string
  title: string
  email: string | null
  phone: string | null
}

export interface ContactCreateInput {
  name: string
  title: string
  email?: string
  phone?: string
}

export type ApiActivityType = 'call' | 'meeting' | 'email' | 'note' | 'follow-up'

export interface PartyActivityDto {
  id: string
  partyId: string
  leadId: string | null
  type: ApiActivityType
  message: string
  ownerUserId: string
  activityDate: IsoDate
  dueAt: IsoDate | null
}

export interface ActivityCreateInput {
  type: ApiActivityType
  message: string
  leadId?: string
  dueAt?: IsoDate
}

export interface VendorDto {
  id: string
  name: string
  serviceType: 'flight' | 'hotel' | 'transportation' | 'mice' | 'additional'
  status: 'active' | 'inactive' | 'pending'
  contactName: string | null
  contactPhone: string | null
  category: string | null
  provenance?: ApiProvenance
}

export interface VendorCreateInput {
  name: string
  serviceType: VendorDto['serviceType']
  contactName: string
  contactPhone?: string
  category?: string
  status?: VendorDto['status']
}

export type VendorPatchInput = Partial<Pick<VendorDto, 'name' | 'status' | 'contactName' | 'contactPhone' | 'category'>>

export interface VendorContactDto {
  id: string
  vendorId: string
  name: string
  title: string
  email: string | null
  phone: string | null
}

export interface VendorProductDto {
  id: string
  vendorId: string
  name: string
  category: VendorDto['serviceType']
  description: string | null
  priceMinor: MoneyMinor | null
}

export interface VendorDocumentDto {
  id: string
  vendorId: string
  name: string
  type: string
  uploadedAt: IsoDate
}

export interface ServiceOrderRefDto {
  id: string
  vendorId: string
  vendorName: string
  projectId: string | null
  serviceId: string | null
}

/** Full service order (S4b): the reference fields above plus procurement state. */
export interface ServiceOrderDto extends ServiceOrderRefDto {
  serviceType: ServiceTypeKey | null
  status: 'draft' | 'sent' | 'acknowledged' | 'amended' | 'fulfilled' | 'cancelled'
  statusReason: string | null
  netCostMinor: MoneyMinor | null
  lineItems: { description: string; quantity: number; unit: string }[]
  sourceQuotationId: string | null
  acknowledgedAt: IsoDate | null
  fulfilledAt: IsoDate | null
  createdAt: IsoDate
  updatedAt: IsoDate
  /** S5: vendor invoices Finance linked to this order — read-only facts (review and payment stay in Finance). */
  vendorInvoices: { id: string; vendorInvoiceNumber: string; status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'void'; invoiceDate: IsoDate; totalMinor: MoneyMinor | null }[]
}

/** Vendor quotation (S4b). `amountMinor` is null for roles that may not see commercial figures. */
export interface VendorQuotationDto {
  id: string
  vendorId: string
  projectId: string
  serviceId: string | null
  serviceType: ServiceTypeKey
  amountMinor: MoneyMinor | null
  notes: string | null
  status: 'submitted' | 'accepted' | 'rejected'
  decisionReason: string | null
  submittedOn: IsoDate
  decidedAt: IsoDate | null
}
export interface QuotationCreateInput { vendorId: string; projectId: string; serviceId?: string; serviceType: ServiceTypeKey; amountMinor: MoneyMinor; notes?: string }

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

/** Project service line (S4a). `budgetMinor` is null for roles that may not see commercial figures. */
export interface ProjectServiceDto {
  id: string
  projectId: string
  type: ServiceTypeKey
  label: string
  status: ServiceStatus
  vendorId: string | null
  bookingReference: string | null
  budgetMinor: MoneyMinor | null
  /** Rows with a booking take their status from it. */
  hasBookings: boolean
  provenance: string
}
export interface ServiceCreateInput { type: ServiceTypeKey; label: string; vendorId?: string | null; budgetMinor?: MoneyMinor | null; bookingReference?: string | null }
export type ServicePatchInput = Partial<Pick<ProjectServiceDto, 'label' | 'status' | 'vendorId' | 'bookingReference' | 'budgetMinor'>>

export interface BookingAttemptDto { id: string; outcome: 'success' | 'failed' | 'manual-fallback'; note: string | null; at: string; actorUserId: string | null }
/** Full booking (S4a): core columns + `details`, the UI-owned shape of each booking type. */
export interface BookingDto {
  type: ApiBookingType
  id: string
  projectId: string
  serviceId: string | null
  serviceType: ServiceTypeKey | null
  vendorId: string | null
  status: string
  statusReason: string | null
  /** PNR (flight) or confirmation number (hotel). */
  reference: string | null
  sellAmountMinor: MoneyMinor | null
  netCostMinor: MoneyMinor | null
  departureDate: IsoDate | null
  details: Record<string, unknown>
  createdAt: IsoDate
  updatedAt: IsoDate
  /** S4b: computed from Finance (own invoices, else the project's); never set by hand. */
  paymentGate: { status: 'not-required' | 'pending' | 'cleared'; basis: 'booking' | 'project' | null }
  attempts: BookingAttemptDto[]
  flaggedDuplicate: boolean
  duplicateOf: { type: ApiBookingType; id: string }[]
  duplicateNote: string | null
}
export interface BookingCreateInput { projectId: string; serviceId?: string; label?: string; reference?: string | null; sellAmountMinor?: MoneyMinor | null; netCostMinor?: MoneyMinor | null; details: Record<string, unknown>; allowDuplicate?: boolean; duplicateNote?: string }
export interface BookingPatchInput { details?: Record<string, unknown>; reference?: string | null; sellAmountMinor?: MoneyMinor | null; netCostMinor?: MoneyMinor | null }

export function isInternalProject (project: ProjectDto): project is ProjectInternalDto {
  return 'partyId' in project
}

// ── Finance: accounts, cash book, statement, ledger (Phase 2) ────────────────────────────────────────

export type ApiOpeningStatus = 'unset' | 'pending' | 'verified'
export type ApiTransactionKind =
  | 'customer_receipt' | 'vendor_refund' | 'other_income' | 'transfer_in'
  | 'vendor_payment' | 'refund_settlement' | 'expense' | 'transfer_out' | 'transfer_fee'
export type ApiExpenseCategory =
  | 'payroll' | 'office' | 'marketing' | 'technology' | 'travel' | 'professional' | 'bank_fee' | 'tax'
  // Field costs of one project (Pengeluaran tab)
  | 'transportation' | 'meals' | 'supplies' | 'accommodation' | 'emergency'
  | 'other'

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
  /** Active accounts, plus inactive ones that still hold money (cash never silently disappears). */
  accounts: { id: string; code: string; bankName: string; currency: string; isActive: boolean; openingStatus: ApiOpeningStatus; currentMinor: MoneyMinor | null }[]
}

// ── Cash Flow (Phase 6) ─────────────────────────────────────────────────────────────────────────────────

export type CashFlowHorizon = '30d' | '3m' | '6m' | '12m'
export type CashFlowCertainty = 'confirmed' | 'expected' | 'overdue'
export type CashFlowSource = 'customer_invoice' | 'vendor_invoice' | 'refund'
export type CashFlowExcludedCode = 'draft_invoices' | 'planned_billing' | 'vendor_invoices_in_review' | 'refunds_awaiting_decision'
  | 'customer_advances' | 'vendor_deposits' | 'incoming_after_horizon' | 'outgoing_after_horizon'

export interface CashFlowScope { type: 'company' | 'account' | 'project'; id: string | null; name: string | null }

export interface CashFlowRow {
  startDate: IsoDate
  endDate: IsoDate
  kind: 'week' | 'rest_of_month' | 'month'
  openingMinor: MoneyMinor
  incomingMinor: MoneyMinor
  outgoingMinor: MoneyMinor
  closingMinor: MoneyMinor
  /** Lowest end-of-day balance inside the period, and when (a gap can open and close within a month). */
  lowestMinor: MoneyMinor
  lowestDate: IsoDate
  confirmedIncomingMinor: MoneyMinor
  expectedIncomingMinor: MoneyMinor
  overdueIncomingMinor: MoneyMinor
  confirmedOutgoingMinor: MoneyMinor
  expectedOutgoingMinor: MoneyMinor
  overdueOutgoingMinor: MoneyMinor
}

export interface CashFlowItem {
  source: CashFlowSource
  id: string
  /** Invoice number, vendor invoice number, or refund case id. */
  reference: string
  counterparty: string
  project: { id: string; name: string | null } | null
  booking: { type: ApiBookingType; id: string } | null
  direction: 'in' | 'out'
  /** What the projection counts: outstanding minus any customer advance applied to it. */
  amountMinor: MoneyMinor
  /** Still outstanding on the invoice / refund case today. */
  outstandingMinor: MoneyMinor
  /** Part covered by the same customer's unallocated advance (already in cash). */
  advanceAppliedMinor: MoneyMinor
  dueDate: IsoDate | null
  expectedDate: IsoDate | null
  /** Where the projection places it (never before the first period). */
  forecastDate: IsoDate
  certainty: CashFlowCertainty
  disputed: boolean
  /** Placed in the first period because its date has passed (or, for refunds, because it is owed now). */
  movedToFirstPeriod: boolean
  periodIndex: number
  /** False on an account view: obligations carry no bank account yet, so they are listed but not counted. */
  counted: boolean
}

export type CashFlowWarning =
  | { code: 'CASH_GAP'; date: IsoDate; balanceMinor: MoneyMinor; lowestDate: IsoDate; lowestMinor: MoneyMinor; contributors: string[] }
  | { code: 'LOW_CASH'; date: IsoDate; balanceMinor: MoneyMinor; floorMinor: MoneyMinor; contributors: string[] }
  | { code: 'OVERDUE_INCOMING'; count: number; amountMinor: MoneyMinor; inFirstPeriodCount: number }
  | { code: 'DISPUTED_INCOMING' | 'ADVANCES_NETTED'; count: number; amountMinor: MoneyMinor }

interface CashFlowBase {
  asOf: IsoDate
  timezone: string
  horizon: CashFlowHorizon
  periodStart: IsoDate
  periodEnd: IsoDate
  scope: CashFlowScope
}

export interface CashFlowUnavailable extends CashFlowBase {
  available: false
  reason: 'NO_ACCOUNTS' | 'OPENING_BALANCE_UNVERIFIED'
  missingAccounts: { id: string; code: string }[]
}

export interface CashFlowProjection extends CashFlowBase {
  available: true
  /** company_cash / account_cash = verified balance today; zero_net_flow = a project's net flow from zero. */
  openingBasis: 'company_cash' | 'account_cash' | 'zero_net_flow'
  openingCashMinor: MoneyMinor
  closingMinor: MoneyMinor
  totals: {
    incomingMinor: MoneyMinor
    outgoingMinor: MoneyMinor
    netMinor: MoneyMinor
    confirmedIncomingMinor: MoneyMinor
    expectedIncomingMinor: MoneyMinor
    overdueIncomingMinor: MoneyMinor
    confirmedOutgoingMinor: MoneyMinor
    expectedOutgoingMinor: MoneyMinor
    overdueOutgoingMinor: MoneyMinor
    disputedIncomingMinor: MoneyMinor
    refundOutgoingMinor: MoneyMinor
  }
  rows: CashFlowRow[]
  items: CashFlowItem[]
  unassigned: { count: number; incomingMinor: MoneyMinor; outgoingMinor: MoneyMinor } | null
  warnings: CashFlowWarning[]
  excluded: { code: CashFlowExcludedCode; direction: 'in' | 'out' | null; count: number; amountMinor: MoneyMinor; undeterminedCount?: number }[]
  assumptions: Record<string, string | boolean>
}

export type CashFlowDto = CashFlowUnavailable | CashFlowProjection

export interface CashFlowQuery {
  horizon?: CashFlowHorizon
  projectId?: string
  accountId?: string
  /** Optional low-cash floor (minor units). */
  minimumCashMinor?: string
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
      /** Reversals and reversed postings: listed, but excluded from the totals above. */
      reversedCount: number
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

/** One direction's fee: a fixed amount, or basis points of the amount (100 = 1%) with optional min/max. */
export interface TransferFeeRuleShape {
  feeType: 'fixed' | 'percent'
  fixedMinor: MoneyMinor | null
  percentBasisPoints: number | null
  minMinor: MoneyMinor | null
  maxMinor: MoneyMinor | null
}

export interface TransferFeeRuleDto extends TransferFeeRuleShape {
  id: string
  fromAccountId: string
  toAccountId: string
  effectiveFrom: IsoDate
  effectiveTo: IsoDate | null
  isActive: boolean
  note: string | null
  createdBy: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export type TransferFeeRuleInput = Partial<TransferFeeRuleShape> & {
  fromAccountId?: string
  toAccountId?: string
  effectiveFrom?: IsoDate
  effectiveTo?: IsoDate | null
  isActive?: boolean
  note?: string | null
}

export interface TransferFeeQuote {
  feeMinor: MoneyMinor
  rule: TransferFeeRuleDto | null
}

export interface TransferDto {
  id: string
  fromAccountId: string
  toAccountId: string
  amountMinor: MoneyMinor
  feeMinor: MoneyMinor
  /** 'rule' = the direction's fee rule applied · 'manual' = typed in · 'none' = no rule, no fee. */
  feeSource: 'none' | 'rule' | 'manual'
  feeRuleId: string | null
  /** Snapshot of the rule at posting time (plus the fee it quoted), never the rule's current values. */
  feeRule: (TransferFeeRuleShape & { ruleId: string; effectiveFrom: IsoDate; effectiveTo: IsoDate | null; quotedMinor: MoneyMinor }) | null
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

// ── Finance: receivables & payables (Phase 3) ────────────────────────────────────────────────────────

/** `debit_note` is issued from an invoice (extra charge), never created as a normal draft. */
export type ApiInvoiceType = 'dp' | 'progress' | 'final' | 'other' | 'debit_note'
/** Derived for issued/approved invoices: open, partially paid, paid, or credited (zeroed by credit notes, no money). */
export type ApiSettlement = 'open' | 'partial' | 'paid' | 'credited'

export interface CustomerInvoiceDto {
  id: string
  /** Assigned when issued (INV-YYYY-NNNNN); null for drafts. */
  number: string | null
  project: { id: string; name: string }
  party: { id: string; name: string }
  booking: { type: ApiBookingType; id: string } | null
  billingScheduleItemId: string | null
  /** Group Trip participant booking billed by this invoice (customer = the participant). */
  salesOrderId: string | null
  /** For a debit note: the issued invoice it adds a charge to. */
  adjustsInvoiceId: string | null
  invoiceType: ApiInvoiceType
  status: 'draft' | 'issued' | 'void'
  settlement: ApiSettlement | null
  overdue: boolean
  daysOverdue: number
  currency: string
  totalMinor: MoneyMinor
  paidMinor: MoneyMinor
  creditedMinor: MoneyMinor
  outstandingMinor: MoneyMinor
  issueDate: IsoDate | null
  dueDate: IsoDate | null
  expectedDate: IsoDate | null
  expectedReason: string | null
  isDisputed: boolean
  disputeReason: string | null
  notes: string | null
  voidReason: string | null
  createdAt: IsoDateTime
  issuedAt: IsoDateTime | null
}

export interface InvoicePaymentDto {
  transactionId: string
  amountMinor: MoneyMinor
  effectiveDate: IsoDate
  account: { id: string; code: string }
  reference: string | null
  /** The payment was reversed; it no longer counts toward the invoice. */
  reversed: boolean
}

export interface CustomerInvoiceDetailDto extends CustomerInvoiceDto {
  billingSnapshot: { partyName: string; projectName: string } | null
  lines: { position: number; description: string; amountMinor: MoneyMinor }[]
  payments: InvoicePaymentDto[]
  /** `refund_liability` notes (and write-offs with a `refundId`) belong to a cancellation case and cannot be voided on their own. */
  creditNotes: { id: string; effect: 'reduce_receivable' | 'refund_liability'; refundId: string | null; amountMinor: MoneyMinor; reason: string; status: 'issued' | 'void'; createdAt: IsoDateTime }[]
}

export interface VendorInvoiceDto {
  id: string
  vendor: { id: string; name: string }
  vendorInvoiceNumber: string
  serviceOrderId: string | null
  project: { id: string; name: string | null } | null
  booking: { type: ApiBookingType; id: string } | null
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'void'
  matchStatus: 'matched' | 'unmatched' | 'disputed' | null
  settlement: ApiSettlement | null
  overdue: boolean
  daysOverdue: number
  currency: string
  totalMinor: MoneyMinor
  paidMinor: MoneyMinor
  outstandingMinor: MoneyMinor
  invoiceDate: IsoDate
  dueDate: IsoDate
  expectedDate: IsoDate | null
  expectedReason: string | null
  notes: string | null
  reviewNote: string | null
  rejectedReason: string | null
  voidReason: string | null
  reviewedBy: string | null
  reviewedAt: IsoDateTime | null
  createdAt: IsoDateTime
}

export interface VendorInvoiceDetailDto extends VendorInvoiceDto {
  payments: InvoicePaymentDto[]
}

export interface BillingScheduleItemDto {
  id: string
  project: { id: string; name: string }
  booking: { type: ApiBookingType; id: string } | null
  label: string
  invoiceType: ApiInvoiceType
  amountMinor: MoneyMinor
  plannedDate: IsoDate
  status: 'planned' | 'invoiced' | 'cancelled'
  invoiceId: string | null
}

export interface ReceivablesList {
  data: CustomerInvoiceDto[]
  meta: ApiMeta & { pagination: ApiPagination; summary: { outstandingMinor: MoneyMinor; overdueMinor: MoneyMinor; count: number; asOf: IsoDate } }
}

export interface PayablesList {
  data: VendorInvoiceDto[]
  meta: ApiMeta & {
    pagination: ApiPagination
    summary: { outstandingMinor: MoneyMinor; overdueMinor: MoneyMinor; pendingReviewMinor: MoneyMinor; pendingReviewCount: number; count: number; asOf: IsoDate }
  }
}

export interface AdvanceDto {
  transactionId: string
  kind: 'customer_receipt' | 'vendor_payment'
  effectiveDate: IsoDate
  account: { id: string; code: string }
  party: { id: string; name: string } | null
  vendor: { id: string; name: string } | null
  projectId: string | null
  amountMinor: MoneyMinor
  unallocatedMinor: MoneyMinor
}

/** 'paid' = everything billed and settled; 'up_to_date' = issued invoices settled but more still to bill; 'cancelled' = a live cancellation case. */
export type ApiPaymentStatus = 'not_invoiced' | 'awaiting_payment' | 'dp_received' | 'partially_paid' | 'up_to_date' | 'paid' | 'overdue' | 'cancelled'

/** One project on the app dashboard (Phase 7). Admin gets only these fields. */
export interface OverviewProjectStatus {
  projectId: string
  paymentStatus: ApiPaymentStatus
  label: string
  hasOverdue: boolean
  cancelled: boolean
  dpInvoiced: boolean
  dpReceived: boolean
}

export interface FinanceOverviewStatus {
  view: 'status'
  asOf: IsoDate
  projects: OverviewProjectStatus[]
}

/** Finance / Super Admin: the same figures as the Finance menus, in one request. */
export interface FinanceOverviewFull {
  view: 'full'
  asOf: IsoDate
  projects: (OverviewProjectStatus & { costMinor: MoneyMinor; revenueMinor: MoneyMinor; receivedMinor: MoneyMinor; outstandingMinor: MoneyMinor })[]
  cash: { available: boolean; reason: 'NO_ACCOUNTS' | 'OPENING_BALANCE_UNVERIFIED' | null; totalMinor: MoneyMinor }
  forecast:
    | { available: true; periodEnd: IsoDate; closingMinor: MoneyMinor; gap: { date: IsoDate; balanceMinor: MoneyMinor } | null }
    | { available: false; reason: 'NO_ACCOUNTS' | 'OPENING_BALANCE_UNVERIFIED' }
  receivables: { outstandingMinor: MoneyMinor; openCount: number; overdueMinor: MoneyMinor; overdueCount: number }
  payables: { outstandingMinor: MoneyMinor; overdueMinor: MoneyMinor; overdueCount: number; pendingReviewCount: number }
  overdueInvoices: { id: string; number: string; party: { id: string; name: string }; project: { id: string; name: string }; dueDate: IsoDate; outstandingMinor: MoneyMinor }[]
}

export type FinanceOverviewDto = FinanceOverviewStatus | FinanceOverviewFull

/** Accrual figures per calendar month (Reports). revenue = invoiced − credited; cost = vendor + expense; net = revenue − cost. */
export interface MonthlyReportDto {
  asOf: IsoDate
  timezone: string
  basis: 'accrual'
  months: {
    month: string
    invoicedMinor: MoneyMinor
    creditedMinor: MoneyMinor
    revenueMinor: MoneyMinor
    vendorCostMinor: MoneyMinor
    expenseMinor: MoneyMinor
    costMinor: MoneyMinor
    netMinor: MoneyMinor
  }[]
  vendors: { vendor: { id: string; name: string }; approvedMinor: MoneyMinor; projectCount: number; invoiceCount: number }[]
}

/** What Admin receives (ADR-007 #3): status, never amounts. */
export interface PaymentStatusView {
  view: 'status'
  paymentStatus: ApiPaymentStatus
  label: string
  hasOverdue: boolean
  openInvoiceCount: number
  nextDueDate: IsoDate | null
  /** Workflow facts (no amounts): a DP invoice is issued / money was received on one. */
  dpInvoiced: boolean
  dpReceived: boolean
}

export interface ReceivableTotals {
  invoicedMinor: MoneyMinor
  creditedMinor: MoneyMinor
  receivedMinor: MoneyMinor
  outstandingMinor: MoneyMinor
  overdueMinor: MoneyMinor
  invoiceCount: number
  draftCount: number
}

export interface PayableTotals {
  approvedMinor: MoneyMinor
  paidMinor: MoneyMinor
  outstandingMinor: MoneyMinor
  overdueMinor: MoneyMinor
  pendingReviewMinor: MoneyMinor
  pendingReviewCount: number
  invoiceCount: number
}

/** What can be cancelled: a whole project or one booking. */
export type ApiSubjectType = 'project' | ApiBookingType
export type ApiRefundStatus = 'requested' | 'approved' | 'rejected'
/** Derived for approved cases: nothing to pay / not paid / partly / fully paid. */
export type ApiRefundSettlement = 'none' | 'unpaid' | 'partial' | 'settled' | null

type FullView<T> = Omit<PaymentStatusView, 'view'> & { view: 'full' } & T

/** Live cancellation of a project/booking (Phase 5). Admin gets the state; Finance also the figures. */
export interface CancellationStatus {
  refundId: string
  subjectType: ApiSubjectType
  status: ApiRefundStatus
  settlement: ApiRefundSettlement
  cancelDate: IsoDate
}
export interface CancellationFull extends CancellationStatus {
  refundableMinor: MoneyMinor
  settledMinor: MoneyMinor
  outstandingMinor: MoneyMinor
  retainedMinor: MoneyMinor
  writtenOffMinor: MoneyMinor
}

export type ProjectFinanceSummaryDto =
  | (PaymentStatusView & { projectId: string; cancellation: CancellationStatus | null })
  | FullView<{
      projectId: string
      currency: string
      contractValueMinor: MoneyMinor | null
      receivable: ReceivableTotals & { uninvoicedMinor: MoneyMinor | null; scheduledNotInvoicedMinor: MoneyMinor }
      payable: PayableTotals
      projectExpensesMinor: MoneyMinor
      cancellation: CancellationFull | null
      /** All refund cases of the project (whole project or per booking). */
      refunds: { openCount: number; outstandingMinor: MoneyMinor; refundCreditedMinor: MoneyMinor }
      /** Accrual: revenue = invoiced − credit notes − refunds granted; cost = approved vendor invoices + project expenses. */
      profitability: { revenueMinor: MoneyMinor; costMinor: MoneyMinor; grossProfitMinor: MoneyMinor; marginBasisPoints: number | null }
      invoices: CustomerInvoiceDto[]
      vendorInvoices: VendorInvoiceDto[]
    }>

/** Group Trip participant booking (sales order): figures for Finance/Super Admin, a label for Admin. */
export type SalesOrderPaymentStatus = 'not_invoiced' | 'invoiced' | 'dp_received' | 'paid'
export type SalesOrderFinanceSummaryDto =
  | { view: 'status'; salesOrderId: string; paymentStatus: SalesOrderPaymentStatus; label: string }
  | {
      view: 'full'
      salesOrderId: string
      paymentStatus: SalesOrderPaymentStatus
      label: string
      priceMinor: MoneyMinor
      invoicedMinor: MoneyMinor
      receivedMinor: MoneyMinor
      outstandingMinor: MoneyMinor
      invoiceId: string | null
    }

export interface GroupTripDpInput { bankAccountId: string; dpAmountMinor: MoneyMinor; effectiveDate: IsoDate; dueDate: IsoDate }
export interface GroupTripDpResult { invoiceId: string; invoiceNumber: string; transactionId: string; outstandingMinor: MoneyMinor; minimumDpMinor: MoneyMinor }

export type BookingFinanceSummaryDto =
  | (PaymentStatusView & { booking: { type: ApiBookingType; id: string }; projectId: string; cancellation: CancellationStatus | null })
  | FullView<{
      booking: { type: ApiBookingType; id: string }
      projectId: string
      sellAmountMinor: MoneyMinor | null
      departureDate: IsoDate | null
      cancellation: CancellationFull | null
      receivable: ReceivableTotals
      payable: PayableTotals
      invoices: CustomerInvoiceDto[]
      vendorInvoices: VendorInvoiceDto[]
    }>

export interface VendorPaymentStatusView {
  view: 'status'
  vendorId: string
  pendingReviewCount: number
  awaitingPaymentCount: number
  overdueCount: number
  nextDueDate: IsoDate | null
}

export type VendorFinanceSummaryDto =
  | VendorPaymentStatusView
  | (Omit<VendorPaymentStatusView, 'view'> & { view: 'full'; payable: PayableTotals; depositUnallocatedMinor: MoneyMinor; invoices: VendorInvoiceDto[] })

export type PartyFinanceSummaryDto =
  | (PaymentStatusView & { partyId: string })
  | FullView<{ partyId: string; receivable: ReceivableTotals; advanceUnallocatedMinor: MoneyMinor; invoices: CustomerInvoiceDto[] }>

export interface InvoiceLineInput { description: string; amountMinor: MoneyMinor }

export interface CustomerInvoiceDraftInput {
  projectId?: string
  booking?: { type: ApiBookingType; id: string }
  billingScheduleItemId?: string
  invoiceType?: ApiInvoiceType
  lines?: InvoiceLineInput[]
  dueDate?: IsoDate
  expectedDate?: IsoDate
  notes?: string
}

export interface BillingScheduleInput {
  projectId: string
  booking?: { type: ApiBookingType; id: string }
  label: string
  invoiceType: ApiInvoiceType
  amountMinor: MoneyMinor
  plannedDate: IsoDate
}

export interface ReceiptInput {
  bankAccountId: string
  amountMinor: MoneyMinor
  effectiveDate: IsoDate
  partyId: string
  projectId?: string
  booking?: { type: ApiBookingType; id: string }
  counterparty?: string
  reference?: string
  memo?: string
  allocations?: { invoiceId: string; amountMinor: MoneyMinor }[]
}

export interface VendorInvoiceInput {
  vendorId: string
  vendorInvoiceNumber: string
  serviceOrderId?: string
  projectId?: string
  booking?: { type: ApiBookingType; id: string }
  invoiceDate: IsoDate
  dueDate: IsoDate
  expectedDate?: IsoDate
  totalMinor: MoneyMinor
  notes?: string
}

export interface VendorPaymentInput {
  bankAccountId: string
  amountMinor: MoneyMinor
  effectiveDate: IsoDate
  vendorId: string
  projectId?: string
  counterparty?: string
  reference?: string
  memo?: string
  allocations?: { vendorInvoiceId: string; amountMinor: MoneyMinor }[]
}

export interface ReceiptResult {
  transactionId: string
  allocations: { invoiceId: string; amountMinor: MoneyMinor; outstandingMinor: MoneyMinor }[]
  /** Kept as the customer's advance (uang muka). */
  unallocatedMinor: MoneyMinor
}

export interface VendorPaymentResult {
  transactionId: string
  allocations: { vendorInvoiceId: string; amountMinor: MoneyMinor; outstandingMinor: MoneyMinor }[]
  /** Kept as a vendor deposit. */
  unallocatedMinor: MoneyMinor
}

// ── Finance: cancellation policies, cancellations, refunds (Phase 5) ─────────────────────────────────

/** Half-open interval of days before departure: minDays ≤ H < maxDays (null = unbounded). */
export interface PolicyTier { minDays: number | null; maxDays: number | null; refundBp: number; forfeitBp: number }
export type PolicyTierInput = Omit<PolicyTier, 'forfeitBp'>

export interface CancellationPolicyDto {
  id: string
  code: string
  version: number
  name: string
  description: string | null
  /** null = every booking type and whole-project cancellations. */
  bookingType: ApiBookingType | null
  basis: 'paid_customer_deposit'
  status: 'draft' | 'published' | 'inactive'
  effectiveFrom: IsoDate
  effectiveTo: IsoDate | null
  tiers: PolicyTier[]
  createdBy: string
  createdAt: IsoDateTime
  publishedBy: string | null
  publishedAt: IsoDateTime | null
  deactivatedAt: IsoDateTime | null
  deactivationReason: string | null
  usage: { assignments: number; cases: number } | null
}

export interface PolicyInput {
  code?: string
  name?: string
  description?: string | null
  bookingType?: ApiBookingType | null
  effectiveFrom?: IsoDate
  effectiveTo?: IsoDate | null
  tiers?: PolicyTierInput[]
}

export interface PolicySnapshotDto {
  policyId: string
  code: string
  name: string
  version: number
  basis: 'paid_customer_deposit'
  bookingType: ApiBookingType | null
  effectiveFrom: IsoDate
  effectiveTo: IsoDate | null
  tiers: PolicyTier[]
}

export interface PolicyAssignmentDto {
  policyId: string
  version: number
  snapshot: PolicySnapshotDto
  note: string | null
  assignedBy: string
  assignedAt: IsoDateTime
}

export interface CancellationSubjectDto {
  type: ApiSubjectType
  id: string
  projectId: string
  projectName: string
  partyId: string
  partyName: string
  departureDate: IsoDate | null
}

interface CancellationPreviewBase {
  subject: CancellationSubjectDto
  cancelDate: IsoDate
  /** H: calendar days from the cancel date to departure (Asia/Jakarta); negative after departure. */
  daysBefore: number | null
  policy: { id: string; code: string; name: string; version: number; basis: 'paid_customer_deposit'; tiers: PolicyTier[] } | null
  tier: PolicyTier | null
  /** False when the refund cannot be computed automatically (see blockers). */
  canCalculate: boolean
  /** ACTIVE_CASE / OVERLAPPING_CASE carry the live case (so the operational status can follow it). */
  blockers: { code: 'NO_POLICY' | 'NO_DEPARTURE_DATE' | 'ACTIVE_CASE' | 'OVERLAPPING_CASE'; message: string; caseId?: string }[]
  plannedBillingCount: number
  draftInvoiceCount: number
  writeOffInvoiceCount: number
}

export type CancellationPreviewDto =
  | (CancellationPreviewBase & { view: 'status' })
  | (CancellationPreviewBase & {
      view: 'full'
      /** DP actually received on the subject's invoices, minus earlier refunds. */
      basisMinor: MoneyMinor
      /** Paid on non-DP invoices — refundable only as an explained exception. */
      otherPaidMinor: MoneyMinor
      policyRefundMinor: MoneyMinor
      retainedMinor: MoneyMinor
      maxRefundableMinor: MoneyMinor
      sourcePayments: { transactionId: string; invoiceId: string; invoiceNumber: string | null; invoiceType: ApiInvoiceType; effectiveDate: IsoDate; amountMinor: MoneyMinor }[]
      writeOffs: { invoiceId: string; number: string | null; outstandingMinor: MoneyMinor }[]
      writeOffMinor: MoneyMinor
      unallocatedAdvanceMinor: MoneyMinor
      vendorOpenCount: number
      vendorOpenMinor: MoneyMinor
    })

export interface CancellationInput {
  subjectType: ApiSubjectType
  subjectId: string
  cancelDate?: IsoDate
  reason: string
  calculation?: 'policy' | 'manual'
  additionalRefundMinor?: MoneyMinor
  additionalReason?: string
  proposedRefundMinor?: MoneyMinor
}

interface RefundBase {
  id: string
  subject: { type: ApiSubjectType; id: string }
  project: { id: string; name: string }
  party: { id: string; name: string }
  cancelDate: IsoDate
  departureDate: IsoDate | null
  daysBefore: number | null
  calculation: 'policy' | 'manual'
  policy: { id: string; code: string; name: string; version: number } | null
  tier: PolicyTier | null
  status: ApiRefundStatus
  settlement: ApiRefundSettlement
  reason: string
  requestedBy: { id: string; name: string }
  requestedAt: IsoDateTime
  decidedBy: { id: string; name: string } | null
  decidedAt: IsoDateTime | null
  decisionNote: string | null
  rejectReason: string | null
}

export type RefundStatusDto = RefundBase & { view: 'status' }

export interface RefundDto extends RefundBase {
  view: 'full'
  basisMinor: MoneyMinor
  otherPaidMinor: MoneyMinor
  policyRefundMinor: MoneyMinor
  additionalRefundMinor: MoneyMinor
  additionalReason: string | null
  refundableMinor: MoneyMinor
  retainedMinor: MoneyMinor
  writtenOffMinor: MoneyMinor
  settledMinor: MoneyMinor
  outstandingMinor: MoneyMinor
  sourcePayments: { transactionId: string; invoiceId: string; invoiceNumber: string | null; invoiceType: ApiInvoiceType; effectiveDate: IsoDate; amountMinor: MoneyMinor }[]
}

export interface RefundDetailDto extends RefundDto {
  settlements: { transactionId: string; effectiveDate: IsoDate; amountMinor: MoneyMinor; reference: string | null; recipient: string | null; account: { id: string; code: string }; reversed: boolean }[]
  creditNotes: { id: string; effect: 'reduce_receivable' | 'refund_liability'; amountMinor: MoneyMinor; reason: string; status: 'issued' | 'void'; invoice: { id: string; number: string | null } }[]
}

export interface RefundList {
  data: RefundDto[]
  meta: ApiMeta & { pagination: ApiPagination; summary: { requestedCount: number; toPayCount: number; toPayMinor: MoneyMinor } }
}

/** The same list for roles without finance figures (Admin): cases without amounts. */
export interface RefundStatusList {
  data: RefundStatusDto[]
  meta: ApiMeta & { pagination: ApiPagination; summary: { requestedCount: number; toPayCount: number } }
}

export interface RefundSettlementInput {
  bankAccountId: string
  amountMinor: MoneyMinor
  effectiveDate: IsoDate
  recipient?: string
  reference?: string
  memo?: string
}

export interface RefundSettlementResult { transactionId: string; refundId: string; amountMinor: MoneyMinor; outstandingMinor: MoneyMinor }

/** Sales (S6a) — `GET /leads`, `GET /quotations`. Dates are `YYYY-MM-DD`; money is minor units as a string. */
export interface LeadActivityDto { id: string; leadId: string; type: 'call' | 'meeting' | 'email' | 'note' | 'follow-up'; message: string; ownerUserId: string; activityDate: string; dueOn: string | null; doneOn: string | null }
export interface LeadDto {
  id: string; name: string; companyName: string | null; title: string | null; source: string; stage: 'new' | 'contacted' | 'qualified' | 'unqualified'
  ownerUserId: string; handedOverTo: string | null; phone: string | null; email: string | null; qualificationNotes: string | null
  expectedCloseDate: string | null; createdOn: string; lastUpdatedOn: string; archived: boolean; archiveReason: string | null; partyId: string | null
  qualifiedOn: string | null; unqualifiedReason: string | null; mergedInto: string | null; serviceCategory: string | null; destination: string | null
  travelStartDate: string | null; travelEndDate: string | null; travelerEstimate: number | null; serviceScope: string[]; requirementSummary: string | null
  budgetRange: string | null; dateFlexible: boolean | null; decisionMaker: string | null; urgency: 'low' | 'medium' | 'high' | null
  specialRequestNote: string | null; b2c: Record<string, unknown>; wonProjectId: string | null; quotationId: string | null; activities: LeadActivityDto[]
}
export type LeadWriteInput = Partial<Pick<LeadDto, 'name' | 'companyName' | 'title' | 'source' | 'handedOverTo' | 'phone' | 'email' | 'qualificationNotes'
  | 'expectedCloseDate' | 'serviceCategory' | 'destination' | 'travelStartDate' | 'travelEndDate' | 'travelerEstimate' | 'serviceScope'
  | 'requirementSummary' | 'budgetRange' | 'dateFlexible' | 'decisionMaker' | 'urgency' | 'specialRequestNote' | 'b2c'>> & { stage?: 'new' | 'contacted' }
export interface SalesQuotationVersionDto {
  version: number; status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'superseded'; amountMinor: string; createdOn: string
  submittedBy: string | null; decidedBy: string | null; decidedAt: string | null; decisionNote: string | null
}
export interface QuotationServiceLineDto { service: string; description?: string; amountMinor: string }
export interface QuotationContentInput {
  amountMinor?: string; discountMinor?: string | null; taxMinor?: string | null; markupMinor?: string | null; estimatedCostMinor?: string | null
  estimatedMarginMinor?: string | null; currency?: string | null; paymentTerms?: string | null; validUntil?: string | null; termsAndConditions?: string | null
  inclusions?: string | null; exclusions?: string | null; cancellationPolicy?: string | null; proposedItineraryNote?: string | null; costSheetId?: string | null
  serviceBreakdown?: QuotationServiceLineDto[]
}
export interface SalesQuotationDto {
  id: string; leadId: string; currentVersion: number; status: SalesQuotationVersionDto['status']; sentToClientOn: string | null; createdOn: string
  amountMinor: string; discountMinor: string | null; taxMinor: string | null; markupMinor: string | null; estimatedCostMinor: string | null
  estimatedMarginMinor: string | null; currency: string; paymentTerms: string | null; validUntil: string | null; termsAndConditions: string | null
  inclusions: string | null; exclusions: string | null; cancellationPolicy: string | null; proposedItineraryNote: string | null; costSheetId: string | null
  serviceBreakdown: QuotationServiceLineDto[]
  submittedBy: string | null; submittedAt: string | null; decidedBy: string | null; decidedAt: string | null; decisionNote: string | null
  versions: SalesQuotationVersionDto[]
}
export interface LeadWonDto { project: ProjectDetailDto; lead: LeadDto }

/** Sales orders (S6b) — B2C standalone (projectId null) and Group Trip participant bookings. */
export interface SalesOrderDto {
  id: string; projectId: string | null; partyId: string; partyName: string; leadId: string | null; destination: string | null
  travelStartDate: string | null; travelEndDate: string | null; travelerCount: number; priceMinor: string
  status: 'draft' | 'paid' | 'ongoing' | 'done' | 'cancelled'; statusReason: string | null; note: string | null; paidOn: string | null
  createdOn: string; updatedAt: string
}
export interface ProjectSeatsDto { capacity: number; filled: number; held: number; available: number }
export interface SalesOrderCreateInput { partyId?: string; customerName?: string; destination: string; travelStartDate: string; travelEndDate: string; travelerCount: number; priceMinor: string; note?: string }
export interface GroupTripQualifyInput { projectId: string; adultCount: number; childCount: number; infantCount: number; priceMinor: string; priceAcceptance: string; bookingReadiness: string }
export interface GroupTripQualifyDto { outcome: 'qualified' | 'waitlist'; lead: LeadDto; salesOrder: SalesOrderDto | null }

/** Participants (S7a) — travelers, groups and rooming list. Dates `YYYY-MM-DD`. */
export interface TravelerDto {
  id: string; projectId: string; groupId: string | null; partyId: string | null; leadId: string | null; salesOrderId: string | null; name: string
  passportNumber: string | null; passportExpiryDate: string | null; idNumber: string | null; visaNumber: string | null; visaExpiryDate: string | null
  emergencyContactName: string | null; emergencyContactPhone: string | null; specialRequest: string | null; dietaryRestrictions: string | null
  accessibilityNeeds: string | null; companionOfTravelerId: string | null; documentsVerifiedOn: string | null; documentsVerifiedBy: string | null
  isVip: boolean; cancelled: boolean; cancelReason: string | null; replacedByTravelerId: string | null; replacesTravelerId: string | null
}
export type TravelerInput = Partial<Pick<TravelerDto, 'name' | 'groupId' | 'passportNumber' | 'passportExpiryDate' | 'idNumber' | 'visaNumber'
  | 'visaExpiryDate' | 'emergencyContactName' | 'emergencyContactPhone' | 'specialRequest' | 'dietaryRestrictions' | 'accessibilityNeeds' | 'companionOfTravelerId'>>
export interface TravelerGroupDto { id: string; projectId: string; name: string; paxCount: number; roomingNote: string | null }
export interface RoomAssignmentDto { id: string; projectId: string; groupId: string; roomLabel: string; roomType: 'single' | 'twin' | 'suite'; travelerIds: string[] }
/** A user as the server knows it (S10a); status and role change only through the Super Admin. */
export interface UserDto {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'suspended'
  suspendedReason: string | null
  suspendedAt: string | null
  clientPartyId: string | null
  vendorId: string | null
}
/**
 * Client portal (S12a-2): a quotation sent to the client — the offer only, never cost, margin, markup or the internal
 * approval. `accepted` = the lead became a project.
 */
export interface ClientQuotationDto {
  id: string
  version: number
  createdOn: string
  sentToClientOn: string
  accepted: boolean
  projectId: string | null
  currency: string
  amountMinor: string
  discountMinor: string | null
  taxMinor: string | null
  previousAmountMinor: string | null
  serviceBreakdown: { service: string; description: string | null; amountMinor: string }[]
  paymentTerms: string | null
  validUntil: string | null
  termsAndConditions: string | null
  inclusions: string | null
  exclusions: string | null
  cancellationPolicy: string | null
  proposedItineraryNote: string | null
  preparedByName: string | null
  lead: {
    id: string
    title: string | null
    companyName: string | null
    name: string
    destination: string | null
    travelStartDate: string | null
    travelEndDate: string | null
    travelerEstimate: number | null
    serviceScope: string[]
  }
}
/** Client portal (S12a-2): a reservation without any money, vendor or internal note; `details` is a per-type whitelist. */
export interface ClientReservationDto {
  type: 'flight' | 'hotel' | 'transport' | 'mice'
  id: string
  projectId: string
  projectName: string
  status: string
  clientStatus: 'Diproses' | 'Dikonfirmasi' | 'Selesai' | 'Dibatalkan'
  reference: string | null
  label: string
  startDate: string | null
  deadlineDate: string | null
  details: Record<string, unknown> & { travelerIds?: string[] }
}
/** Client portal (S12a-2): an invoice billed to the client party (issued or void). */
export interface ClientInvoiceDto {
  id: string
  number: string | null
  project: { id: string; name: string }
  invoiceType: string
  status: 'issued' | 'void'
  settlement: 'open' | 'partial' | 'paid' | 'credited' | null
  overdue: boolean
  daysOverdue: number
  currency: string
  totalMinor: string
  paidMinor: string
  creditedMinor: string
  outstandingMinor: string
  issueDate: string | null
  dueDate: string | null
  isDisputed: boolean
  disputeReason: string | null
  voidReason: string | null
  billingSnapshot: unknown
  lines: { position: number; description: string; amountMinor: string }[]
  payments: { amountMinor: string; effectiveDate: string | null; reference: string | null }[]
  creditNotes: { id: string; amountMinor: string; reason: string | null; status: string; issuedAt: string }[]
}
export interface ClientInvoicesDto {
  invoices: ClientInvoiceDto[]
  summary: { invoicedMinor: string; paidMinor: string; outstandingMinor: string; overdueCount: string; nextDueDate: string | null }
}
/**
 * An employee (S11c). `baseSalaryMinor` and `commissionRatePercent` are sent only to holders of `hr.manage-payroll`
 * (Finance, Super Admin); everyone else receives `null`.
 */
export interface EmployeeDto {
  id: string
  userId: string | null
  name: string
  position: string
  department: string
  employmentType: EmploymentType
  status: EmployeeStatus
  joinedOn: string
  phone: string | null
  email: string | null
  baseSalaryMinor: string | null
  commissionRatePercent: number | null
}
/** Profile keys need `hr.manage-employee` (Admin); pay keys need `hr.manage-payroll` (Finance). */
export interface EmployeeInput {
  userId?: string | null
  name?: string
  position?: string
  department?: string
  employmentType?: EmploymentType
  status?: EmployeeStatus
  joinedOn?: string
  phone?: string | null
  email?: string | null
  baseSalaryMinor?: string
  commissionRatePercent?: number | null
}
export interface AttendanceDto { id: string; employeeId: string; date: string; status: AttendanceStatus; checkInAt: string | null; checkOutAt: string | null; note: string | null }
export interface PerformanceReviewDto {
  id: string
  employeeId: string
  period: string
  reviewerId: string
  deliveryScore: number
  qualityScore: number
  collaborationScore: number
  initiativeScore: number
  overallScore: number
  strengths: string | null
  improvements: string | null
  reviewedOn: string
}
/** Payroll (S11c, `hr.manage-payroll` only); status only — paying salaries is booked by Finance separately. */
export interface PayrollRunDto { id: string; period: string; status: PayrollRunStatus; approvedBy: string | null; approvedOn: string | null; paidOn: string | null }
export interface PayrollLineDto {
  id: string
  payrollRunId: string
  employeeId: string
  baseSalaryMinor: string
  allowanceMinor: string
  deductionMinor: string
  note: string | null
}
export interface PayrollLineInput { baseSalaryMinor?: string; allowanceMinor?: string; deductionMinor?: string; note?: string | null }
/** A commission (derived from a project the employee owns) or a manual incentive (S11c, `hr.manage-payroll` only). */
export interface CommissionDto {
  id: string
  employeeId: string
  projectId: string
  period: string
  baseAmountMinor: string
  ratePercent: number
  amountMinor: string
  status: 'accrued' | 'approved' | 'paid'
  source: 'derived' | 'manual'
  note: string | null
}
export interface IncentiveInput { employeeId: string; projectId: string; period: string; amountMinor: string; note?: string }
/** A marketing content schedule entry (S11b); `campaignId` is a plain reference (campaigns are still a mock). */
export interface ContentScheduleDto {
  id: string
  publishDate: string
  platform: ContentPlatform
  title: string
  status: ContentScheduleStatus
  campaignId: string | null
  note: string | null
}
export interface ContentScheduleInput {
  publishDate?: string
  platform?: ContentPlatform
  title?: string
  status?: ContentScheduleStatus
  campaignId?: string | null
  note?: string | null
}
/** A content idea in the development pipeline (S11b); `updatedOn` is set by the server. */
export interface ContentIdeaDto {
  id: string
  title: string
  stage: ContentDevelopmentStage
  platform: ContentPlatform
  ownerId: string | null
  note: string | null
  updatedOn: string
}
export interface ContentIdeaInput {
  title?: string
  stage?: ContentDevelopmentStage
  platform?: ContentPlatform
  ownerId?: string | null
  note?: string | null
}
/** A MANOVA-owned asset (S11a); `in-use` is set only by a checkout. */
export interface AssetDto {
  id: string
  code: string
  name: string
  category: AssetCategoryKey
  brand: string | null
  serialNumber: string | null
  purchasedOn: string
  purchasePriceMinor: string | null
  condition: AssetCondition
  status: AssetStatus
  location: string
  quantity: number
  note: string | null
}
export interface AssetInput {
  name?: string
  category?: AssetCategoryKey
  brand?: string | null
  serialNumber?: string | null
  purchasedOn?: string
  purchasePriceMinor?: string | null
  condition?: AssetCondition
  status?: 'available' | 'maintenance' | 'retired'
  location?: string
  quantity?: number
  note?: string | null
}
/** Asset maintenance (S11a); `overdue` is derived by the server from today's date. */
export interface AssetMaintenanceDto {
  id: string
  assetId: string
  type: MaintenanceType
  scheduledOn: string
  completedOn: string | null
  status: MaintenanceStatus
  vendorName: string | null
  costMinor: string | null
  note: string | null
  intervalDays: number | null
}
export interface AssetMaintenanceInput {
  assetId: string
  type: MaintenanceType
  scheduledOn: string
  vendorName?: string
  costMinor?: string
  note?: string
  intervalDays?: number
}
/** An asset lent to a project or a person (S11a); `overdue` is derived by the server. */
export interface AssetCheckoutDto {
  id: string
  assetId: string
  projectId: string | null
  borrowedBy: string
  checkedOutOn: string
  dueOn: string
  returnedOn: string | null
  status: CheckoutStatus
  conditionOnReturn: AssetCondition | null
  note: string | null
}
export interface AssetCheckoutInput {
  assetId: string
  projectId?: string
  borrowedBy?: string
  dueOn: string
  note?: string
}
/** A master data record (S10b); the category's fields sit under `data`. */
export interface MasterDataRecordDto {
  id: string
  category: MasterDataCategoryKey
  isActive: boolean
  data: Record<string, unknown>
  updatedAt: string
}
/** The travel agency's own profile (S10b); `updatedAt`/`updatedBy` are set by the server. */
export interface OrganizationProfileDto {
  id: string
  legalName: string
  displayName: string
  address: string
  defaultCurrencyCode: string
  businessHours: string
  contactEmail: string
  contactPhone: string
  updatedAt: string
  updatedBy: string | null
}
export type OrganizationProfileInput = Omit<OrganizationProfileDto, 'id' | 'updatedAt' | 'updatedBy'>
/** An audit event shaped for the Activity Center (S10a). */
export interface SystemEventDto {
  id: string
  module: string
  type: string
  message: string
  entityId: string | null
  userId: string | null
  createdAt: string
}
/** A sign-in paired with its sign-out from the audit trail (S10a). */
export interface SessionLogDto {
  id: string
  userId: string
  loginAt: string
  logoutAt: string | null
  ipAddress: string
  device: string
  status: 'active' | 'ended'
}
/** In-app notification (S9b); every user reads only their own. */
export interface NotificationDto {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  entityType: DocumentEntityType | null
  entityId: string | null
  category: NotificationCategory | null
  read: boolean
  createdAt: string
}
/** Document metadata (S9); no file is stored. Dates are `YYYY-MM-DD`. */
export interface DocumentDto {
  id: string
  entityType: DocumentEntityType
  entityId: string
  projectId: string | null
  name: string
  category: string
  version: number
  accessLevel: 'internal' | 'client' | 'supplier'
  sourceType: 'uploaded' | 'generated'
  previewRoute: string | null
  uploadedBy: string | null
  uploadedAt: string | null
  generatedAt: string | null
  expiresAt: string | null
  supersedesId: string | null
  verified: boolean
  verifiedBy: string | null
  verifiedAt: string | null
}
export interface DocumentInput {
  entityType: DocumentDto['entityType']
  entityId: string
  projectId?: string | null
  name: string
  category: string
  accessLevel: DocumentDto['accessLevel']
  expiresOn?: string | null
}
/** Message (S9); the sender is the signed-in user, delivery is simulated. */
export interface MessageDto {
  id: string
  entityType: DocumentDto['entityType']
  entityId: string
  projectId: string | null
  channel: 'internal-note' | 'client-message' | 'supplier-message'
  senderId: string
  body: string
  mentions: string[]
  sentAt: string
  deliveryStatus: 'queued' | 'sent' | 'delivered' | 'failed'
  deliveryChannel: 'email' | 'whatsapp' | null
  attachmentName: string | null
  readBy: string[]
}
export interface MessageInput {
  entityType: MessageDto['entityType']
  entityId: string
  projectId?: string | null
  channel: MessageDto['channel']
  body: string
  mentions?: string[]
  deliveryChannel?: 'email' | 'whatsapp'
  attachmentName?: string | null
}
/** Change request (S8), internal flow; `commercialImpactMinor` is a whole-rupiah decimal string. */
export interface ChangeRequestDto {
  id: string
  projectId: string
  source: 'client' | 'internal' | 'supplier'
  requestedBy: string
  submittedAt: string
  affectedEntities: { entityType: 'flight' | 'hotel' | 'transport' | 'mice' | 'itinerary' | 'order' | 'project'; entityId: string }[]
  beforeSummary: string
  afterSummary: string
  operationalImpact: string | null
  commercialImpactMinor: string | null
  financialImpactNote: string | null
  timelineImpactNote: string | null
  status: 'submitted' | 'under-review' | 'approved' | 'rejected' | 'implemented'
  decidedBy: string | null
  decidedAt: string | null
  rejectionReason: string | null
  implementedAt: string | null
  activityId: string | null
}
export interface ChangeRequestInput {
  source: ChangeRequestDto['source']
  category?: string
  beforeSummary: string
  afterSummary: string
  operationalImpact?: string | null
  commercialImpactMinor?: string | null
  timelineImpactNote?: string | null
  affectedEntities?: ChangeRequestDto['affectedEntities']
}
/** Project incident (S8); a communication entry's `from` is a user id. */
export interface IncidentDto {
  id: string
  projectId: string
  bookingType: 'flight' | 'hotel' | 'transport' | 'mice' | null
  bookingId: string | null
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  ownerId: string
  status: 'open' | 'investigating' | 'escalated' | 'resolved' | 'closed'
  escalatedTo: string | null
  communicationLog: { id: string; at: string; from: string; message: string }[]
  resolutionNote: string | null
  resolvedAt: string | null
  createdAt: string
}
export interface IncidentInput {
  title: string
  description: string
  severity: IncidentDto['severity']
  ownerId: string
  bookingType?: IncidentDto['bookingType']
  bookingId?: string | null
}
/** A no-show / refunded booking (or a pre-Finance cancellation) with its penalty (S8). */
export interface BookingCancellationDto {
  id: string
  projectId: string
  bookingType: 'flight' | 'hotel' | 'transport' | 'mice'
  bookingId: string
  outcome: 'cancelled' | 'no-show' | 'refunded'
  reason: string
  penaltyMinor: string | null
  refundEligible: boolean
  cancelledBy: string
  cancelledOn: string
}
/** Project activity log entry (S7d): `ACT-` written by a server action, `CHG-` a change logged by hand. */
export interface ProjectActivityDto {
  id: string
  projectId: string
  message: string
  isChange: boolean
  reviewed: boolean
  createdAt: string
  category: 'traveler' | 'itinerary' | 'service' | 'vendor' | 'budget' | 'other' | null
  reason: string | null
  requestedBy: string | null
  beforeValue: string | null
  afterValue: string | null
  impactNote: string | null
  approvalStatus: 'pending' | 'approved' | 'rejected' | null
  approvedBy: string | null
  actorUserId: string | null
  sourceAction: string | null
}
export interface ProjectChangeInput {
  category: NonNullable<ProjectActivityDto['category']>
  reason: string
  beforeValue?: string | null
  afterValue?: string | null
  impactNote?: string | null
}
/** Project task (S7c); a task without a project is a general to-do from the global Tasks page. */
export interface TaskDto {
  id: string
  projectId: string | null
  title: string
  status: 'not-started' | 'in-progress' | 'pending-confirmation' | 'done' | 'overdue'
  dueAt: string | null
  isMilestone: boolean
  dependsOnTaskId: string | null
  assignedTo: string | null
  isBlocked: boolean
  blockedReason: string | null
}
export type TaskInput = Partial<Pick<TaskDto, 'title' | 'status' | 'dueAt' | 'isMilestone' | 'dependsOnTaskId' | 'assignedTo'>> & { projectId?: string | null }
/** Project milestone (S7c); `budgetMinor` is a whole-rupiah decimal string. */
export interface MilestoneDto {
  id: string
  projectId: string
  stepKey: 'drafting' | 'confirmed' | 'start' | 'departure' | 'on-progress' | 'done' | null
  name: string
  plannedDate: string
  actualDate: string | null
  ownerId: string | null
  status: 'not-started' | 'in-progress' | 'completed' | 'delayed' | 'cancelled'
  note: string | null
  budgetMinor: string | null
  deliverables: { id: string; label: string; done: boolean }[]
}
export type MilestoneInput = Partial<Pick<MilestoneDto, 'name' | 'plannedDate' | 'stepKey' | 'ownerId' | 'note' | 'budgetMinor'>>
/** Daily itinerary item (S7b); `vendorAmountMinor` is a whole-rupiah decimal string. */
export interface ItineraryItemDto {
  id: string
  projectId: string
  date: string
  time: string | null
  title: string
  description: string | null
  serviceType: ServiceTypeKey | null
  groupId: string | null
  timezone: string | null
  location: string | null
  visibleToClient: boolean
  vendorId: string | null
  vendorAmountMinor: string | null
}
export type ItineraryItemInput = Partial<Omit<ItineraryItemDto, 'id' | 'projectId'>>
export interface TravelerImportResultDto { created: TravelerDto[]; rejected: { index: number; errors: string[] }[] }
/** S12b-1: client portal writes (only role client; the party comes from the session). */
export interface ClientDocumentInput { entityType: 'project' | 'traveler' | 'party'; entityId: string; name: string; category: string; expiresOn?: string }
export interface ClientMessageInput { projectId: string; body: string; attachmentName?: string }
export interface ClientContactInput { name?: string; title?: string; email?: string | null; phone?: string | null }
