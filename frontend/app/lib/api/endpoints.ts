import type { ApiClient } from './client'
import { newIdempotencyKey } from './client'
import type {
  ItineraryItemDto,
  ItineraryItemInput,
  MilestoneDto,
  MilestoneInput,
  ProjectActivityDto,
  ProjectChangeInput,
  BookingCancellationDto,
  DocumentDto,
  DocumentInput,
  MessageDto,
  MessageInput,
  ChangeRequestDto,
  ChangeRequestInput,
  IncidentDto,
  IncidentInput,
  TaskDto,
  TaskInput,
  RoomAssignmentDto,
  TravelerDto,
  TravelerGroupDto,
  TravelerImportResultDto,
  TravelerInput,
  GroupTripQualifyDto,
  GroupTripQualifyInput,
  ProjectSeatsDto,
  SalesOrderCreateInput,
  SalesOrderDto,
  LeadActivityDto,
  LeadDto,
  LeadWonDto,
  LeadWriteInput,
  QuotationContentInput,
  SalesQuotationDto,
  AccountLedgerDto,
  AdvanceDto,
  ApiBookingType,
  ApiProjectStatus,
  BankAccountDto,
  BillingScheduleInput,
  BillingScheduleItemDto,
  BookingCreateInput,
  BookingDto,
  BookingFinanceSummaryDto,
  BookingPatchInput,
  ProjectServiceDto,
  QuotationCreateInput,
  ServiceOrderDto,
  VendorQuotationDto,
  ServiceCreateInput,
  ServicePatchInput,
  GroupTripDpInput,
  GroupTripDpResult,
  SalesOrderFinanceSummaryDto,
  BookingRefDto,
  IsoDate,
  MoneyMinor,
  CancellationInput,
  CancellationPolicyDto,
  CancellationPreviewDto,
  CashFlowDto,
  CashFlowQuery,
  CashPositionDto,
  FinanceOverviewDto,
  MonthlyReportDto,
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
  ActivityCreateInput,
  ContactCreateInput,
  ContractValueInput,
  CreditLimitInput,
  PartyActivityDto,
  PartyContactDto,
  PartyCreateInput,
  PartyPatchInput,
  ProjectCreateInput,
  ProjectDetailDto,
  ProjectPatchInput,
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
  ApiSubjectType,
  StatementList,
  StatementQuery,
  TransferDto,
  TransferFeeQuote,
  TransferFeeRuleDto,
  TransferFeeRuleInput,
  TransferInput,
  VendorContactDto,
  VendorCreateInput,
  VendorDocumentDto,
  VendorDto,
  VendorPatchInput,
  VendorProductDto,
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
      listTravelers: (query: { projectId?: string } = {}) => client.get<TravelerDto[]>('/travelers', { query: { ...query } }),
      getTraveler: (id: string) => client.get<TravelerDto>(`/travelers/${seg(id)}`),
      createTraveler: (projectId: string, input: TravelerInput & { name: string }, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<TravelerDto>(`/projects/${seg(projectId)}/travelers`, input, { idempotencyKey }),
      updateTraveler: (id: string, input: TravelerInput) => client.patch<TravelerDto>(`/travelers/${seg(id)}`, input),
      deleteTraveler: (id: string) => client.delete<{ id: string; deleted: true }>(`/travelers/${seg(id)}`),
      verifyTraveler: (id: string, verified: boolean) => client.post<TravelerDto>(`/travelers/${seg(id)}/verify`, { verified }),
      setTravelerVip: (id: string, isVip: boolean) => client.post<TravelerDto>(`/travelers/${seg(id)}/vip`, { isVip }),
      cancelTraveler: (id: string, reason: string) => client.post<TravelerDto>(`/travelers/${seg(id)}/cancel`, { reason }),
      replaceTraveler: (id: string, input: TravelerInput & { name: string }) => client.post<TravelerDto>(`/travelers/${seg(id)}/replace`, input),
      importTravelers: (projectId: string, rows: { name: string; passportNumber?: string; groupId?: string }[], idempotencyKey: string = newIdempotencyKey()) =>
        client.post<TravelerImportResultDto>(`/projects/${seg(projectId)}/travelers/import`, { rows }, { idempotencyKey }),
      listTravelerGroups: (query: { projectId?: string } = {}) => client.get<TravelerGroupDto[]>('/traveler-groups', { query: { ...query } }),
      createTravelerGroup: (projectId: string, input: { name: string; paxCount?: number; roomingNote?: string }, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<TravelerGroupDto>(`/projects/${seg(projectId)}/traveler-groups`, input, { idempotencyKey }),
      updateTravelerGroup: (id: string, input: { name?: string; paxCount?: number; roomingNote?: string | null }) =>
        client.patch<TravelerGroupDto>(`/traveler-groups/${seg(id)}`, input),
      listRoomAssignments: (query: { projectId?: string } = {}) => client.get<RoomAssignmentDto[]>('/room-assignments', { query: { ...query } }),
      createRoomAssignment: (projectId: string, input: { groupId: string; roomLabel: string; roomType: string; travelerIds?: string[] }, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<RoomAssignmentDto>(`/projects/${seg(projectId)}/room-assignments`, input, { idempotencyKey }),
      setRoomTravelers: (id: string, travelerIds: string[]) => client.put<RoomAssignmentDto>(`/room-assignments/${seg(id)}/travelers`, { travelerIds }),
      deleteRoomAssignment: (id: string) => client.delete<{ id: string; deleted: true }>(`/room-assignments/${seg(id)}`),
      listItineraryItems: (query: { projectId?: string } = {}) => client.get<ItineraryItemDto[]>('/itinerary-items', { query: { ...query } }),
      createItineraryItem: (projectId: string, input: ItineraryItemInput & { date: string; title: string }, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<ItineraryItemDto>(`/projects/${seg(projectId)}/itinerary-items`, input, { idempotencyKey }),
      updateItineraryItem: (id: string, input: ItineraryItemInput) => client.patch<ItineraryItemDto>(`/itinerary-items/${seg(id)}`, input),
      deleteItineraryItem: (id: string) => client.delete<{ id: string; deleted: true }>(`/itinerary-items/${seg(id)}`),
      listDocuments: (query: { projectId?: string } = {}) => client.get<DocumentDto[]>('/documents', { query: { ...query } }),
      createDocument: (input: DocumentInput, idempotencyKey: string = newIdempotencyKey()) => client.post<DocumentDto>('/documents', input, { idempotencyKey }),
      listMessages: (query: { projectId?: string } = {}) => client.get<MessageDto[]>('/messages', { query: { ...query } }),
      sendMessage: (input: MessageInput, idempotencyKey: string = newIdempotencyKey()) => client.post<MessageDto>('/messages', input, { idempotencyKey }),
      listChangeRequests: (query: { projectId?: string } = {}) => client.get<ChangeRequestDto[]>('/change-requests', { query: { ...query } }),
      createChangeRequest: (projectId: string, input: ChangeRequestInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<ChangeRequestDto>(`/projects/${seg(projectId)}/change-requests`, input, { idempotencyKey }),
      reviewChangeRequest: (id: string) => client.post<ChangeRequestDto>(`/change-requests/${seg(id)}/review`, {}),
      approveChangeRequest: (id: string) => client.post<ChangeRequestDto>(`/change-requests/${seg(id)}/approve`, {}),
      rejectChangeRequest: (id: string, reason: string) => client.post<ChangeRequestDto>(`/change-requests/${seg(id)}/reject`, { reason }),
      implementChangeRequest: (id: string) => client.post<ChangeRequestDto>(`/change-requests/${seg(id)}/implement`, {}),
      listIncidents: (query: { projectId?: string } = {}) => client.get<IncidentDto[]>('/incidents', { query: { ...query } }),
      createIncident: (projectId: string, input: IncidentInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<IncidentDto>(`/projects/${seg(projectId)}/incidents`, input, { idempotencyKey }),
      changeIncidentStatus: (id: string, to: string) => client.post<IncidentDto>(`/incidents/${seg(id)}/status`, { to }),
      escalateIncident: (id: string, to: string, note?: string) => client.post<IncidentDto>(`/incidents/${seg(id)}/escalate`, { to, ...(note ? { note } : {}) }),
      addIncidentCommunication: (id: string, message: string) => client.post<IncidentDto>(`/incidents/${seg(id)}/communications`, { message }),
      resolveIncident: (id: string, note: string) => client.post<IncidentDto>(`/incidents/${seg(id)}/resolve`, { note }),
      listBookingCancellations: (query: { projectId?: string } = {}) => client.get<BookingCancellationDto[]>('/booking-cancellations', { query: { ...query } }),
      listProjectActivities: (query: { projectId?: string } = {}) => client.get<ProjectActivityDto[]>('/project-activities', { query: { ...query } }),
      logProjectChange: (projectId: string, input: ProjectChangeInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<ProjectActivityDto>(`/projects/${seg(projectId)}/changes`, input, { idempotencyKey }),
      approveProjectChange: (id: string) => client.post<ProjectActivityDto>(`/project-activities/${seg(id)}/approve`, {}),
      rejectProjectChange: (id: string) => client.post<ProjectActivityDto>(`/project-activities/${seg(id)}/reject`, {}),
      reviewProjectActivity: (id: string) => client.post<ProjectActivityDto>(`/project-activities/${seg(id)}/review`, {}),
      listTasks: (query: { projectId?: string } = {}) => client.get<TaskDto[]>('/tasks', { query: { ...query } }),
      createTask: (input: TaskInput & { title: string }, idempotencyKey: string = newIdempotencyKey()) => client.post<TaskDto>('/tasks', input, { idempotencyKey }),
      updateTask: (id: string, input: TaskInput) => client.patch<TaskDto>(`/tasks/${seg(id)}`, input),
      blockTask: (id: string, reason: string) => client.post<TaskDto>(`/tasks/${seg(id)}/block`, { reason }),
      unblockTask: (id: string) => client.post<TaskDto>(`/tasks/${seg(id)}/unblock`, {}),
      listMilestones: (query: { projectId?: string } = {}) => client.get<MilestoneDto[]>('/milestones', { query: { ...query } }),
      createMilestone: (projectId: string, input: MilestoneInput & { name: string; plannedDate: string }, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<MilestoneDto>(`/projects/${seg(projectId)}/milestones`, input, { idempotencyKey }),
      updateMilestone: (id: string, input: MilestoneInput) => client.patch<MilestoneDto>(`/milestones/${seg(id)}`, input),
      completeMilestone: (id: string) => client.post<MilestoneDto>(`/milestones/${seg(id)}/complete`, {}),
      addMilestoneDeliverable: (id: string, label: string) => client.post<MilestoneDto>(`/milestones/${seg(id)}/deliverables`, { label }),
      setMilestoneDeliverableDone: (id: string, deliverableId: string, done: boolean) =>
        client.patch<MilestoneDto>(`/milestones/${seg(id)}/deliverables/${seg(deliverableId)}`, { done }),
      removeMilestoneDeliverable: (id: string, deliverableId: string) => client.delete<MilestoneDto>(`/milestones/${seg(id)}/deliverables/${seg(deliverableId)}`),
      replaceMilestones: (projectId: string, milestones: { name: string; plannedDate: string; stepKey?: string }[]) =>
        client.post<MilestoneDto[]>(`/projects/${seg(projectId)}/milestones/replace`, { milestones }),
      listProjects: (query: PageQuery & { status?: ApiProjectStatus; partyId?: string } = {}) =>
        client.getList<ProjectDto>('/projects', { query: { ...query } }),
      getProject: (id: string) => client.get<ProjectDetailDto>(`/projects/${seg(id)}`),
      createProject: (input: ProjectCreateInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<ProjectDetailDto>('/projects', input, { idempotencyKey }),
      updateProject: (id: string, input: ProjectPatchInput) => client.patch<ProjectDetailDto>(`/projects/${seg(id)}`, input),
      setContractValue: (id: string, input: ContractValueInput) => client.put<ProjectDetailDto>(`/projects/${seg(id)}/contract-value`, input),
      acceptHandover: (id: string) => client.post<ProjectDetailDto>(`/projects/${seg(id)}/handover/accept`, {}),
      returnHandover: (id: string, reason: string) => client.post<ProjectDetailDto>(`/projects/${seg(id)}/handover/return`, { reason }),
      transitionProject: (id: string, to: ApiProjectStatus, reason?: string) =>
        client.post<ProjectDetailDto>(`/projects/${seg(id)}/transition`, reason ? { to, reason } : { to }),
      markProjectReady: (id: string) => client.post<ProjectDetailDto>(`/projects/${seg(id)}/ready`, {}),
      closeProjectFinance: (id: string) => client.post<ProjectDetailDto>(`/projects/${seg(id)}/finance-close`, {}),
      closeProject: (id: string, input: { finalNote: string; clientFeedback?: string }) => client.post<ProjectDetailDto>(`/projects/${seg(id)}/close`, input),
      addProjectMember: (id: string, userId: string) => client.put<ProjectDetailDto>(`/projects/${seg(id)}/members/${seg(userId)}`, {}),
      removeProjectMember: (id: string, userId: string) => client.delete<ProjectDetailDto>(`/projects/${seg(id)}/members/${seg(userId)}`),
      listParties: (query: PageQuery = {}) => client.getList<PartyDto>('/parties', { query: { ...query } }),
      getParty: (id: string) => client.get<PartyDto>(`/parties/${seg(id)}`),
      createParty: (input: PartyCreateInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<PartyDto>('/parties', input, { idempotencyKey }),
      updateParty: (id: string, input: PartyPatchInput) => client.patch<PartyDto>(`/parties/${seg(id)}`, input),
      setCreditLimit: (id: string, input: CreditLimitInput) => client.put<PartyDto>(`/parties/${seg(id)}/credit-limit`, input),
      listContacts: (partyId: string) => client.get<PartyContactDto[]>(`/parties/${seg(partyId)}/contacts`),
      listAllContacts: () => client.get<PartyContactDto[]>('/party-contacts'),
      createContact: (partyId: string, input: ContactCreateInput) => client.post<PartyContactDto>(`/parties/${seg(partyId)}/contacts`, input),
      listActivities: (query: { partyId?: string; leadId?: string } = {}) => client.get<PartyActivityDto[]>('/party-activities', { query: { ...query } }),
      createActivity: (partyId: string, input: ActivityCreateInput) => client.post<PartyActivityDto>(`/parties/${seg(partyId)}/activities`, input),
      listVendors: (query: PageQuery = {}) => client.getList<VendorDto>('/vendors', { query: { ...query } }),
      getVendor: (id: string) => client.get<VendorDto>(`/vendors/${seg(id)}`),
      createVendor: (input: VendorCreateInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<VendorDto>('/vendors', input, { idempotencyKey }),
      updateVendor: (id: string, input: VendorPatchInput) => client.patch<VendorDto>(`/vendors/${seg(id)}`, input),
      createVendorContact: (id: string, input: { name: string; title: string; email?: string; phone?: string }) =>
        client.post<VendorContactDto>(`/vendors/${seg(id)}/contacts`, input),
      createVendorProduct: (id: string, input: { name: string; category: VendorDto['serviceType']; description?: string; priceMinor?: string }) =>
        client.post<VendorProductDto>(`/vendors/${seg(id)}/products`, input),
      createVendorDocument: (id: string, input: { name: string; type: string }) => client.post<VendorDocumentDto>(`/vendors/${seg(id)}/documents`, input),
      listVendorContacts: () => client.get<VendorContactDto[]>('/vendor-contacts'),
      listVendorProducts: () => client.get<VendorProductDto[]>('/vendor-products'),
      listVendorDocuments: () => client.get<VendorDocumentDto[]>('/vendor-documents'),
      getServiceOrder: (id: string) => client.get<ServiceOrderDto>(`/service-orders/${seg(id)}`),
      getBookingRef: (type: ApiBookingType, id: string) => client.get<BookingRefDto>(`/bookings/${seg(type)}/${seg(id)}`),
      listProjectServices: (query: { projectId?: string } = {}) => client.get<ProjectServiceDto[]>('/project-services', { query: { ...query } }),
      createProjectService: (projectId: string, input: ServiceCreateInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<ProjectServiceDto>(`/projects/${seg(projectId)}/services`, input, { idempotencyKey }),
      updateProjectService: (id: string, input: ServicePatchInput) => client.patch<ProjectServiceDto>(`/project-services/${seg(id)}`, input),
      listBookings: (query: { projectId?: string; type?: ApiBookingType } = {}) => client.get<BookingDto[]>('/bookings', { query: { ...query } }),
      createBooking: (type: ApiBookingType, input: BookingCreateInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<BookingDto>(`/bookings/${seg(type)}`, input, { idempotencyKey }),
      updateBooking: (type: ApiBookingType, id: string, input: BookingPatchInput) => client.patch<BookingDto>(`/bookings/${seg(type)}/${seg(id)}`, input),
      changeBookingStatus: (type: ApiBookingType, id: string, input: { to: string; reason?: string; penaltyMinor?: string; refundEligible?: boolean }) =>
        client.post<BookingDto>(`/bookings/${seg(type)}/${seg(id)}/status`, input),
      logBookingAttempt: (type: ApiBookingType, id: string, input: { outcome: string; note?: string }) =>
        client.post<BookingDto>(`/bookings/${seg(type)}/${seg(id)}/attempts`, input),
      listVendorQuotations: (query: { projectId?: string; serviceId?: string; vendorId?: string } = {}) =>
        client.get<VendorQuotationDto[]>('/vendor-quotations', { query: { ...query } }),
      createVendorQuotation: (input: QuotationCreateInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<VendorQuotationDto>('/vendor-quotations', input, { idempotencyKey }),
      acceptVendorQuotation: (id: string) => client.post<VendorQuotationDto>(`/vendor-quotations/${seg(id)}/accept`, {}),
      rejectVendorQuotation: (id: string, reason?: string) =>
        client.post<VendorQuotationDto>(`/vendor-quotations/${seg(id)}/reject`, reason ? { reason } : {}),
      listServiceOrders: (query: { projectId?: string; vendorId?: string; serviceId?: string } = {}) =>
        client.get<ServiceOrderDto[]>('/service-orders', { query: { ...query } }),
      changeServiceOrderStatus: (id: string, input: { to: string; reason?: string }) =>
        client.post<ServiceOrderDto>(`/service-orders/${seg(id)}/status`, input)
    },

    sales: {
      listSalesOrders: (query: { projectId?: string } = {}) => client.get<SalesOrderDto[]>('/sales-orders', { query: { ...query } }),
      getSalesOrder: (id: string) => client.get<SalesOrderDto>(`/sales-orders/${seg(id)}`),
      createSalesOrder: (input: SalesOrderCreateInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<SalesOrderDto>('/sales-orders', input, { idempotencyKey }),
      changeSalesOrderStatus: (id: string, input: { to: string; reason?: string }) => client.post<SalesOrderDto>(`/sales-orders/${seg(id)}/status`, input),
      projectSeats: (projectId: string) => client.get<ProjectSeatsDto>(`/projects/${seg(projectId)}/seats`),
      qualifyGroupTrip: (leadId: string, input: GroupTripQualifyInput) => client.post<GroupTripQualifyDto>(`/leads/${seg(leadId)}/group-trip`, input),
      listLeads: () => client.get<LeadDto[]>('/leads'),
      getLead: (id: string) => client.get<LeadDto>(`/leads/${seg(id)}`),
      createLead: (input: LeadWriteInput & { name: string; source: string }, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<LeadDto>('/leads', input, { idempotencyKey }),
      updateLead: (id: string, patch: LeadWriteInput) => client.patch<LeadDto>(`/leads/${seg(id)}`, patch),
      qualifyLead: (id: string, input: { customerKind: 'company' | 'individual'; partyId?: string; priceMinor?: string; travelerCount?: number }) => client.post<LeadDto>(`/leads/${seg(id)}/qualify`, input),
      unqualifyLead: (id: string, reason: string) => client.post<LeadDto>(`/leads/${seg(id)}/unqualify`, { reason }),
      archiveLead: (id: string, reason?: string) => client.post<LeadDto>(`/leads/${seg(id)}/archive`, reason ? { reason } : {}),
      reopenLead: (id: string) => client.post<LeadDto>(`/leads/${seg(id)}/reopen`, {}),
      mergeLead: (id: string, intoLeadId: string) => client.post<LeadDto>(`/leads/${seg(id)}/merge`, { intoLeadId }),
      addLeadActivity: (id: string, input: { type: LeadActivityDto['type']; message: string; dueOn?: string }) =>
        client.post<LeadDto>(`/leads/${seg(id)}/activities`, input),
      completeLeadActivity: (id: string, activityId: string) => client.post<LeadDto>(`/leads/${seg(id)}/activities/${seg(activityId)}/done`, {}),
      listQuotations: (query: { leadId?: string } = {}) => client.get<SalesQuotationDto[]>('/quotations', { query: { ...query } }),
      createQuotation: (leadId: string, input: QuotationContentInput & { amountMinor: string }, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<SalesQuotationDto>(`/leads/${seg(leadId)}/quotation`, input, { idempotencyKey }),
      updateQuotation: (id: string, input: QuotationContentInput) => client.patch<SalesQuotationDto>(`/quotations/${seg(id)}`, input),
      reviseQuotation: (id: string, input: QuotationContentInput = {}) => client.post<SalesQuotationDto>(`/quotations/${seg(id)}/revise`, input),
      submitQuotation: (id: string) => client.post<SalesQuotationDto>(`/quotations/${seg(id)}/submit`, {}),
      withdrawQuotation: (id: string) => client.post<SalesQuotationDto>(`/quotations/${seg(id)}/withdraw`, {}),
      approveQuotation: (id: string, note?: string) => client.post<SalesQuotationDto>(`/quotations/${seg(id)}/approve`, note ? { note } : {}),
      rejectQuotation: (id: string, note: string) => client.post<SalesQuotationDto>(`/quotations/${seg(id)}/reject`, { note }),
      sendQuotation: (id: string) => client.post<SalesQuotationDto>(`/quotations/${seg(id)}/send`, {}),
      markLeadWon: (leadId: string, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<LeadWonDto>(`/leads/${seg(leadId)}/won`, {}, { idempotencyKey })
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

      listFeeRules: (query: { accountId?: string } = {}) =>
        client.get<TransferFeeRuleDto[]>('/finance/transfer-fee-rules', { query: { ...query } }),
      /** The server picks the rule for this direction and date; an empty fee on the transfer applies it. */
      quoteTransferFee: (query: { fromAccountId: string; toAccountId: string; amountMinor: string; effectiveDate: string }) =>
        client.get<TransferFeeQuote>('/finance/transfer-fee-quote', { query: { ...query } }),
      createFeeRule: (input: TransferFeeRuleInput) => client.post<TransferFeeRuleDto>('/finance/transfer-fee-rules', input),
      /** Direction cannot change; end the rule (effectiveTo) and create a new one instead of rewriting it. */
      updateFeeRule: (id: string, input: Omit<TransferFeeRuleInput, 'fromAccountId' | 'toAccountId'>) =>
        client.patch<TransferFeeRuleDto>(`/finance/transfer-fee-rules/${seg(id)}`, input),
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
      /** Extra charge on an issued invoice: a DN-numbered invoice for the same customer and project. */
      issueDebitNote: (id: string, input: { amountMinor: MoneyMinor; reason: string; dueDate: IsoDate }) =>
        client.post<CustomerInvoiceDetailDto>(`/finance/customer-invoices/${seg(id)}/debit-notes`, input),
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
      /** App dashboard: every project's payment status (Admin) plus cash, forecast and AR/AP (Finance). */
      overview: () => client.get<FinanceOverviewDto>('/finance/overview'),
      /** Reports: accrual revenue/cost/net per month and vendor spend (Finance, Super Admin). */
      /** Either the last `months` (default 6) or every calendar month a `from`–`to` range touches (max 24). */
      monthlyReport: (query: { months?: string; from?: IsoDate; to?: IsoDate } = {}) => client.get<MonthlyReportDto>('/finance/reports/monthly', { query: { ...query } }),
      projectSummary: (projectId: string) => client.get<ProjectFinanceSummaryDto>(`/projects/${seg(projectId)}/finance-summary`),
      bookingSummary: (type: ApiBookingType, id: string) => client.get<BookingFinanceSummaryDto>(`/bookings/${seg(type)}/${seg(id)}/finance-summary`),
      /** Group Trip participant booking: figures for Finance, a label for Admin. */
      salesOrderSummary: (salesOrderId: string) => client.get<SalesOrderFinanceSummaryDto>(`/sales-orders/${seg(salesOrderId)}/finance-summary`),
      /** Issues the participant's DP invoice and records the DP received, in one idempotent request. */
      confirmGroupTripDp: (salesOrderId: string, input: GroupTripDpInput, idempotencyKey: string = newIdempotencyKey()) =>
        client.post<GroupTripDpResult>(`/finance/sales-orders/${seg(salesOrderId)}/confirm-dp`, input, { idempotencyKey }),
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
