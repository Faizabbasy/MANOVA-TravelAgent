import type { ApiClient } from './client'
import { newIdempotencyKey } from './client'
import type {
  AccountLedgerDto,
  ApiBookingType,
  ApiProjectStatus,
  BankAccountDto,
  BookingRefDto,
  CashPositionDto,
  HealthDto,
  ManualTransactionInput,
  MeDto,
  MovementDto,
  PageQuery,
  PartyDto,
  ProjectDetailDto,
  ProjectDto,
  ServiceOrderRefDto,
  StatementList,
  StatementQuery,
  TransferDto,
  TransferInput,
  VendorDto
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

      listAccounts: () => client.get<BankAccountDto[]>('/finance/accounts'),
      getAccount: (id: string) => client.get<BankAccountDto>(`/finance/accounts/${seg(id)}`),
      createAccount: (input: { code: string; bankName: string; holderName: string; accountNumber: string }) =>
        client.post<BankAccountDto>('/finance/accounts', input),
      updateAccount: (id: string, input: { bankName?: string; holderName?: string; accountNumber?: string; isActive?: boolean }) =>
        client.patch<BankAccountDto>(`/finance/accounts/${seg(id)}`, input),
      /** Maker step (Finance). */
      submitOpening: (id: string, input: { amountMinor: string; openingDate: string; note?: string }) =>
        client.post<BankAccountDto>(`/finance/accounts/${seg(id)}/opening`, input),
      /** Checker step (Super Admin); must be a different person than the maker. */
      verifyOpening: (id: string) => client.post<BankAccountDto>(`/finance/accounts/${seg(id)}/opening/verify`),
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
        client.post<{ reversalIds: string[] }>(`/finance/transfers/${seg(id)}/reverse`, { reason }, { idempotencyKey })
    }
  }
}

export type ManovaApi = ReturnType<typeof createManovaApi>
