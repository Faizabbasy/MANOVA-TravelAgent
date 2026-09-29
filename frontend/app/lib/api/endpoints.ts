import type { ApiClient } from './client'
import type {
  ApiBookingType,
  ApiProjectStatus,
  BookingRefDto,
  HealthDto,
  MeDto,
  PageQuery,
  PartyDto,
  ProjectDetailDto,
  ProjectDto,
  ServiceOrderRefDto,
  VendorDto
} from '~/types/api'

/**
 * One typed function per backend endpoint. Finance endpoints are added here phase by phase as the
 * backend ships them (Phase 2+); UI code calls these, never raw paths.
 */
export function createManovaApi (client: ApiClient) {
  const seg = encodeURIComponent

  return {
    health: () => client.get<HealthDto>('/health'),

    auth: {
      login: (email: string, password: string) => client.post<MeDto>('/auth/login', { email, password }),
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
    }
  }
}

export type ManovaApi = ReturnType<typeof createManovaApi>
