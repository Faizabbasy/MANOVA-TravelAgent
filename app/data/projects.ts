import type { Project, ProjectService, TravelerGroup, Traveler } from '~/types/project'

/** docs/mockup-data-scenarios.md bagian 1-3 — 3 skenario demo wajib (Normal/High-Change/Complex). */
export const PROJECTS: Project[] = [
  {
    id: 'PRJ-101', name: 'Manila Business Trip', partyId: 'PTY-001', opportunityId: 'OPP-001',
    destination: 'Manila, Filipina', travelStartDate: '2026-08-20', travelEndDate: '2026-08-23',
    characteristic: 'normal', serviceScope: ['flight'], travelerCount: 6,
    ownerId: 'USR-002', teamUserIds: ['USR-004'], status: 'confirmed',
    quotationAmountIdr: 95_000_000, budgetIdr: 85_000_000, actualCostIdr: 82_500_000,
  },
  {
    id: 'PRJ-102', name: 'Abu Dhabi Corporate Gathering', partyId: 'PTY-002', opportunityId: 'OPP-002',
    destination: 'Abu Dhabi, Uni Emirat Arab', travelStartDate: '2026-09-22', travelEndDate: '2026-09-26',
    characteristic: 'high-change', serviceScope: ['flight', 'hotel'], travelerCount: 18,
    ownerId: 'USR-013', teamUserIds: ['USR-004', 'USR-005'], status: 'planning',
    quotationAmountIdr: 345_000_000, budgetIdr: 310_000_000, actualCostIdr: 335_000_000,
  },
  {
    id: 'PRJ-103', name: 'Palu MICE Conference 2026', partyId: 'PTY-003', opportunityId: 'OPP-003',
    destination: 'Palu, Indonesia', travelStartDate: '2026-08-10', travelEndDate: '2026-08-14',
    characteristic: 'complex', serviceScope: ['flight', 'hotel', 'transportation', 'mice'], travelerCount: 60,
    ownerId: 'USR-002', teamUserIds: ['USR-004', 'USR-005', 'USR-006', 'USR-007', 'USR-009'], status: 'in-progress',
    quotationAmountIdr: 1_400_000_000, budgetIdr: 1_250_000_000, actualCostIdr: 1_180_000_000,
  },
]

export const PROJECT_SERVICES: ProjectService[] = [
  { id: 'SVC-1011', projectId: 'PRJ-101', type: 'flight', label: 'Flight Manila', status: 'confirmed', vendorId: 'VND-001' },

  { id: 'SVC-1021', projectId: 'PRJ-102', type: 'flight', label: 'Flight Abu Dhabi', status: 'confirmed', vendorId: 'VND-001' },
  { id: 'SVC-1022', projectId: 'PRJ-102', type: 'hotel', label: 'Room Block A (18 pax)', status: 'changed', vendorId: 'VND-002' },
  { id: 'SVC-1023', projectId: 'PRJ-102', type: 'hotel', label: 'Room Block B (3 pax, digabung ke Block A)', status: 'cancelled', vendorId: 'VND-002' },

  { id: 'SVC-1031', projectId: 'PRJ-103', type: 'flight', label: 'Flight Batch 1', status: 'confirmed', vendorId: 'VND-001' },
  { id: 'SVC-1032', projectId: 'PRJ-103', type: 'flight', label: 'Flight Batch 2 (Grup VIP)', status: 'pending-confirmation', vendorId: 'VND-001' },
  { id: 'SVC-1033', projectId: 'PRJ-103', type: 'hotel', label: 'Hotel Palu', status: 'confirmed', vendorId: 'VND-002' },
  { id: 'SVC-1034', projectId: 'PRJ-103', type: 'transportation', label: 'Ground Transportation', status: 'pending-confirmation', vendorId: 'VND-003' },
  { id: 'SVC-1035', projectId: 'PRJ-103', type: 'mice', label: 'Venue & Rundown Acara', status: 'confirmed', vendorId: 'VND-004' },
]

export const TRAVELER_GROUPS: TravelerGroup[] = [
  { id: 'GRP-001', projectId: 'PRJ-103', name: 'Management', paxCount: 10 },
  { id: 'GRP-002', projectId: 'PRJ-103', name: 'Sales Team', paxCount: 25 },
  { id: 'GRP-003', projectId: 'PRJ-103', name: 'Partner / VIP', paxCount: 25 },
]

export const TRAVELERS: Traveler[] = [
  { id: 'TRV-1031', projectId: 'PRJ-103', groupId: 'GRP-003', name: 'Dedi Kurniawan', specialRequest: 'Membutuhkan akses kursi roda' },
]
