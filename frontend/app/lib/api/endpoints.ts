import type { ApiClient } from './client'
import { newIdempotencyKey } from './client'
import type {
  AccountLedgerDto,
  AdvanceDto,
  ApiBookingType,
  ApiProjectStatus,
  BankAccountDto,
  BillingScheduleInput,
  BillingScheduleItemDto,
  BookingFinanceSummaryDto,
  BookingRefDto,
  CancellationInput,
  CancellationPolicyDto,
  CancellationPreviewDto,
  CashFlowDto,
  CashFlowQuery,
  CashPositionDto,
  CustomerInvoiceDetailDto,
  CustomerInvoiceDraftInput,
  CustomerInvoiceDto,
  HealthDto,
  ManualTransactionInput,
  MeDto,
  MovementDto,
  PageQuery,
  PartyDto,
  PartyFinanceSummaryDto,
  PayablesList,
  PolicyAssignmentDto,
  PolicyInput,
  ProjectDetailDto,
  ProjectDto,
  ProjectFinanceSummaryDto,
  ReceiptInput,
  ReceiptResult,
  ReceivablesList,
  RefundDetailDto,
  RefundList,
  RefundStatusList,
  RefundSettlementInput,
  RefundSettlementResult,
  RefundStatusDto,
  ServiceOrderRefDto,
  ApiSubjectType,
  StatementList,
  StatementQuery,
  TransferDto,
  TransferInput,
  VendorDto,
  VendorFinanceSummaryDto,
  VendorInvoiceDetailDto,
  VendorInvoiceInput,
  VendorPaymentInput,
  VendorPaymentResult
} from '~/types/api'

/**
 * One typed function per backend endpoint. Finance endpoints are added here phase by phase as the
 * backend ships them; UI code calls these, never raw paths.
 *
 * Money-moving commands take an optional `idempotencyKey`. Generate ONE key per user intent (e.g. when a
 * form opens) and reuse it for retries of that same submission, so a retried request never posts twice.
 */
export function createManovaApi (client: ApiClient) {
  const seg = encodeURIComponent

  return {
    health: () => client.get<HealthDto>('/health'),

    auth: {
      login: (email: string, password: string) => client.post<MeDto>('/auth/login', { email, password }),
      /** One-click sign-in as a demo account (dev/demo only; 404 when the server has DEMO_LOGIN off). */
      demoLogin: (userId: string) => client.post<MeDto>('/auth/demo-login', { userId }),
      logout: () => client.post<{ signedOut: true }>('/auth/logout'),
      me: () => client.get<MeDto>('/auth/me')
    },

    core: {
      listProjects: (query: PageQuery & { status?: ApiProjectStatus; partyId?: string } = {}) =>
        client.getList<ProjectDto>('/projects', { query: { ...query } }),
      getProject: (id: string) => client.get<ProjectDetailDto>(`/projects/${seg(id)}`),
      listParties: (query: PageQuery = {}) => client.getList<PartyDto>('/parties', { query: { ...query } }),
      getParty: (id: string) => client.get<PartyDto>(`/parties/${seg(id)}`),
      listVendors: (query: PageQuery = {}) => client.getList<VendorDto>('/vendors', { query: { ...query } }),
      getVendor: (id: string) => client.get<VendorDto>(`/vendors/${seg(id)}`),
      getServiceOrder: (id: string) => client.get<ServiceOrderRefDto>(`/service-orders/${seg(id)}`),
      getBookingRef: (type: ApiBookingType, id: string) => client.get<BookingRefDto>(`/bookings/${seg(type)}/${seg(id)}`)
    },

    finance: {
      cashPosition: () => client.get<CashPositionDto>('/finance/cash-position'),
      /** Projection: current cash + outstanding AR − outstanding AP − approved unpaid refunds (Phase 6). */
      cashFlow: (query: CashFlowQuery = {}) => client.get<CashFlowDto>('/finance/cash-flow', { query: { ...query } }),

      listAccounts: () => client.get<BankAccountDto[]>('/finance/accounts'),
      getAccount: (id: string) => client.get<BankAccountDto>(`/finance/accounts/${seg(id)}`),
      createAccount: (input: { code: string; bankName: string; holderName: string; accountNumber: string }) =>
        client.post<BankAccountDto>('/finance/accounts', input),
      updateAccount: (id: string, input: { bankName?: string; holderName?: string; accountNumber?: string; isActive?: boolean }) =>
        client.patch<BankAccountDto>(`/finance/accounts/${seg(id)}`, input),
      /** Maker step (Finance). */
      submitOpening: (id: string, input: { amountMinor: string; openingDate: string; note?: string }) =>
        client.post<BankAccountDto>(`/finance/accounts/${seg(id)}/opening`, input),
      /**
       * Checker step (Super Admin); must be a different person than the maker. Send the exact figure shown to
       * the checker — the server answers 409 if the maker changed it in the meantime.
       */
      verifyOpening: (id: string, reviewed: { balanceMinor: string; openingDate: string }) =>
        client.post<BankAccountDto>(`/finance/accounts/${seg(id)}/opening/verify`, reviewed),
      accountLedger: (id: string, query: { from?: string; to?: string } = {}) =>
        client.get<AccountLedgerDto>(`/finance/accounts/${seg(id)}/ledger`, { query: { ...query } }),

      statement: (query: StatementQuery = {}) =>
        client.request<StatementList>('GET', '/finance/statement', { query: { ...query } }),
      getTransaction: (id: string) => client.get<MovementDto>(`/finance/transactions/${seg(id)}`),
      postTransaction: (input: ManualTransactionInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<{ transactionId: string }>('/finance/transactions', input, { idempotencyKey }),
      reverseTransaction: (id: string, reason: string, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<{ reversalId: string }>(`/finance/transactions/${seg(id)}/reverse`, { reason }, { idempotencyKey }),

      getTransfer: (id: string) => client.get<TransferDto>(`/finance/transfers/${seg(id)}`),
      postTransfer: (input: TransferInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<{ transferId: string; transactionIds: string[] }>('/finance/transfers', input, { idempotencyKey }),
      reverseTransfer: (id: string, reason: string, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<{ reversalIds: string[] }>(`/finance/transfers/${seg(id)}/reverse`, { reason }, { idempotencyKey }),

      // ── Receivables ──────────────────────────────────────────────────────────────────────────────
      listBillingSchedule: (query: { projectId?: string; status?: 'planned' | 'invoiced' | 'cancelled' } = {}) =>
        client.get<BillingScheduleItemDto[]>('/finance/billing-schedule', { query: { ...query } }),
      createScheduleItem: (input: BillingScheduleInput) => client.post<{ id: string }>('/finance/billing-schedule', input),
      updateScheduleItem: (id: string, input: Partial<Omit<BillingScheduleInput, 'projectId' | 'booking'>>) =>
        client.patch<{ id: string }>(`/finance/billing-schedule/${seg(id)}`, input),
      cancelScheduleItem: (id: string, reason: string) => client.post<{ id: string }>(`/finance/billing-schedule/${seg(id)}/cancel`, { reason }),

      receivables: (query: PageQuery & { settlement?: 'outstanding' | 'overdue' | 'paid' | 'all'; partyId?: string; projectId?: string; dueTo?: string } = {}) =>
        client.request<ReceivablesList>('GET', '/finance/receivables', { query: { ...query } }),
      listCustomerInvoices: (query: { status?: 'draft' | 'issued' | 'void'; projectId?: string; partyId?: string; limit?: number } = {}) =>
        client.get<CustomerInvoiceDto[]>('/finance/customer-invoices', { query: { ...query } }),
      getCustomerInvoice: (id: string) => client.get<CustomerInvoiceDetailDto>(`/finance/customer-invoices/${seg(id)}`),
      createInvoiceDraft: (input: CustomerInvoiceDraftInput) => client.post<CustomerInvoiceDetailDto>('/finance/customer-invoices', input),
      updateInvoiceDraft: (id: string, input: Omit<CustomerInvoiceDraftInput, 'projectId' | 'booking' | 'billingScheduleItemId'>) =>
        client.patch<CustomerInvoiceDetailDto>(`/finance/customer-invoices/${seg(id)}`, input),
      deleteInvoiceDraft: (id: string) => client.delete<{ id: string }>(`/finance/customer-invoices/${seg(id)}`),
      /** meta.warnings may carry advisories (e.g. EXCEEDS_CONTRACT_VALUE); issuing never moves money. */
      issueInvoice: (id: string, input: { issueDate?: string; dueDate?: string } = {}) =>
        client.request<{ data: CustomerInvoiceDetailDto; meta: { requestId: string; warnings: { code: string; message: string }[] } }>(
          'POST', `/finance/customer-invoices/${seg(id)}/issue`, { body: input }),
      voidInvoice: (id: string, reason: string) => client.post<CustomerInvoiceDetailDto>(`/finance/customer-invoices/${seg(id)}/void`, { reason }),
      setInvoiceExpectation: (id: string, expectedDate: string | null, reason: string) =>
        client.patch<CustomerInvoiceDetailDto>(`/finance/customer-invoices/${seg(id)}/expectation`, { expectedDate, reason }),
      setInvoiceDispute: (id: string, disputed: boolean, reason: string) =>
        client.post<CustomerInvoiceDetailDto>(`/finance/customer-invoices/${seg(id)}/dispute`, { disputed, reason }),
      issueCreditNote: (input: { invoiceId: string; amountMinor: string; reason: string }) =>
        client.post<{ id: string; outstandingMinor: string }>('/finance/credit-notes', input),
      voidCreditNote: (id: string, reason: string) => client.post<{ id: string }>(`/finance/credit-notes/${seg(id)}/void`, { reason }),
      postReceipt: (input: ReceiptInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<ReceiptResult>('/finance/receipts', input, { idempotencyKey }),
      allocateReceipt: (transactionId: string, allocations: { invoiceId: string; amountMinor: string }[], idempotencyKey: string = newIdempotencyKey()) =>
        client.post<ReceiptResult>(`/finance/receipts/${seg(transactionId)}/allocations`, { allocations }, { idempotencyKey }),
      advances: (query: { type?: 'customer' | 'vendor'; partyId?: string; vendorId?: string } = {}) =>
        client.get<AdvanceDto[]>('/finance/advances', { query: { ...query } }),

      // ── Payables ─────────────────────────────────────────────────────────────────────────────────
      payables: (query: PageQuery & { view?: 'outstanding' | 'overdue' | 'paid' | 'review' | 'all'; vendorId?: string; projectId?: string; dueTo?: string } = {}) =>
        client.request<PayablesList>('GET', '/finance/payables', { query: { ...query } }),
      getVendorInvoice: (id: string) => client.get<VendorInvoiceDetailDto>(`/finance/vendor-invoices/${seg(id)}`),
      createVendorInvoice: (input: VendorInvoiceInput) => client.post<VendorInvoiceDetailDto>('/finance/vendor-invoices', input),
      updateVendorInvoice: (id: string, input: Partial<Pick<VendorInvoiceInput, 'vendorInvoiceNumber' | 'invoiceDate' | 'dueDate' | 'totalMinor' | 'notes'>>) =>
        client.patch<VendorInvoiceDetailDto>(`/finance/vendor-invoices/${seg(id)}`, input),
      reviewVendorInvoice: (id: string, input: { action: 'start_review' | 'approve' | 'reject'; note?: string; reason?: string; matchStatus?: 'matched' | 'unmatched' | 'disputed' }) =>
        client.post<VendorInvoiceDetailDto>(`/finance/vendor-invoices/${seg(id)}/review`, input),
      voidVendorInvoice: (id: string, reason: string) => client.post<VendorInvoiceDetailDto>(`/finance/vendor-invoices/${seg(id)}/void`, { reason }),
      setVendorInvoiceExpectation: (id: string, expectedDate: string | null, reason: string) =>
        client.patch<VendorInvoiceDetailDto>(`/finance/vendor-invoices/${seg(id)}/expectation`, { expectedDate, reason }),
      postVendorPayment: (input: VendorPaymentInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<VendorPaymentResult>('/finance/vendor-payments', input, { idempotencyKey }),
      allocateVendorPayment: (transactionId: string, allocations: { vendorInvoiceId: string; amountMinor: string }[], idempotencyKey: string = newIdempotencyKey()) =>
        client.post<VendorPaymentResult>(`/finance/vendor-payments/${seg(transactionId)}/allocations`, { allocations }, { idempotencyKey }),

      // ── Finance context for other screens (full for Finance/Super Admin, status-only for Admin) ──
      projectSummary: (projectId: string) => client.get<ProjectFinanceSummaryDto>(`/projects/${seg(projectId)}/finance-summary`),
      bookingSummary: (type: ApiBookingType, id: string) => client.get<BookingFinanceSummaryDto>(`/bookings/${seg(type)}/${seg(id)}/finance-summary`),
      vendorSummary: (vendorId: string) => client.get<VendorFinanceSummaryDto>(`/vendors/${seg(vendorId)}/finance-summary`),
      partySummary: (partyId: string) => client.get<PartyFinanceSummaryDto>(`/parties/${seg(partyId)}/finance-summary`),

      // ── Cancellation policies (Phase 5) ────────────────────────────────────────────────────────────
      listPolicies: (query: { status?: 'draft' | 'published' | 'inactive' } = {}) => client.get<CancellationPolicyDto[]>('/finance/policies', { query: { ...query } }),
      getPolicy: (id: string) => client.get<CancellationPolicyDto>(`/finance/policies/${seg(id)}`),
      createPolicy: (input: PolicyInput) => client.post<CancellationPolicyDto>('/finance/policies', input),
      updatePolicy: (id: string, input: Omit<PolicyInput, 'code'>) => client.patch<CancellationPolicyDto>(`/finance/policies/${seg(id)}`, input),
      deletePolicy: (id: string) => client.delete<{ id: string }>(`/finance/policies/${seg(id)}`),
      publishPolicy: (id: string) => client.post<CancellationPolicyDto>(`/finance/policies/${seg(id)}/publish`),
      deactivatePolicy: (id: string, reason: string) => client.post<CancellationPolicyDto>(`/finance/policies/${seg(id)}/deactivate`, { reason }),
      newPolicyVersion: (id: string) => client.post<CancellationPolicyDto>(`/finance/policies/${seg(id)}/new-version`),
      /**
       * The policy that applies to a project/booking (a booking without its own inherits its project's, `inherited`),
       * plus the policies that may be assigned to it today.
       */
      subjectPolicy: (type: ApiSubjectType, id: string) =>
        client.get<{ assignment: PolicyAssignmentDto | null; inherited: boolean; assignable: CancellationPolicyDto[] }>(`/finance/cancellation-policy/${seg(type)}/${seg(id)}`),
      assignPolicy: (type: ApiSubjectType, id: string, input: { policyId: string; note?: string }) =>
        client.put<PolicyAssignmentDto>(`/finance/cancellation-policy/${seg(type)}/${seg(id)}`, input),

      // ── Cancellations & refunds (Phase 5) ──────────────────────────────────────────────────────────
      /** No side effects. Admin gets the status view (policy, H-x, tier — no amounts). */
      previewCancellation: (input: { subjectType: ApiSubjectType; subjectId: string; cancelDate?: string }) =>
        client.post<CancellationPreviewDto>('/finance/cancellations/preview', input),
      /** Records the cancellation once (write-offs + refund case). Money moves only at settlement. */
      createCancellation: (input: CancellationInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<RefundDetailDto | RefundStatusDto>('/finance/cancellations', input, { idempotencyKey }),
      refunds: (query: PageQuery & { view?: 'open' | 'requested' | 'to_pay' | 'settled' | 'rejected' | 'all'; projectId?: string; partyId?: string } = {}) =>
        client.request<RefundList>('GET', '/finance/refunds', { query: { ...query } }),
      /** Status-only view of the same cases (Admin, Changes screen). */
      refundStatuses: (query: PageQuery & { view?: 'open' | 'requested' | 'to_pay' | 'settled' | 'rejected' | 'all'; projectId?: string } = {}) =>
        client.request<RefundStatusList>('GET', '/finance/refunds', { query: { ...query } }),
      getRefund: (id: string) => client.get<RefundDetailDto | RefundStatusDto>(`/finance/refunds/${seg(id)}`),
      approveRefund: (id: string, input: { refundMinor?: string; note?: string } = {}) => client.post<RefundDetailDto>(`/finance/refunds/${seg(id)}/approve`, input),
      rejectRefund: (id: string, reason: string) => client.post<RefundDetailDto>(`/finance/refunds/${seg(id)}/reject`, { reason }),
      settleRefund: (id: string, input: RefundSettlementInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<RefundSettlementResult>(`/finance/refunds/${seg(id)}/settlements`, input, { idempotencyKey })
    }
  }
}

export type ManovaApi = ReturnType<typeof createManovaApi>
