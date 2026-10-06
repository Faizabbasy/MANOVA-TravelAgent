import type { ProjectInternalDto } from '~/types/api'

/** A server project as `GET /projects` returns it to internal roles (for tests only). */
export function serverProjectDto (over: Partial<ProjectInternalDto> = {}): ProjectInternalDto {
  return {
    id: 'PRJ-901',
    name: 'Project Uji',
    destination: 'Yogyakarta, Indonesia',
    travelStartDate: '2027-03-20',
    travelEndDate: '2027-03-23',
    status: 'draft',
    partyId: 'PTY-001',
    partyName: 'PT Cipta Distribusi Nusantara',
    ownerUserId: 'USR-002',
    teamUserIds: ['USR-002'],
    provenance: 'manual',
    contractValueMinor: '100000000',
    contractCurrency: 'IDR',
    characteristic: 'normal',
    serviceScope: ['flight'],
    travelerCount: 5,
    isGroupTrip: false,
    leadId: null,
    sourceQuotationId: null,
    tourLeaderName: null,
    tourLeaderPhone: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    meetingPoint: null,
    ...over
  }
}
