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

export type ApiInvoiceType = 'dp' | 'progress' | 'final' | 'other'
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
