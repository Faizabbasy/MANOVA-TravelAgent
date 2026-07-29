import type { Opportunity, Quotation } from '~/types/opportunity'

/** docs/mockup-data-scenarios.md bagian 1-4. */
export const OPPORTUNITIES: Opportunity[] = [
  {
    id: 'OPP-001', partyId: 'PTY-001', title: 'Manila Business Trip Q3 2026', stage: 'won',
    createdAt: '2026-06-10', decidedAt: '2026-06-25', wonApprovedBy: 'USR-003',
    serviceScope: ['flight'], quotationId: 'QUO-001', projectId: 'PRJ-101',
  },
  {
    id: 'OPP-002', partyId: 'PTY-002', title: 'Abu Dhabi Corporate Gathering', stage: 'won',
    createdAt: '2026-06-01', decidedAt: '2026-06-20', wonApprovedBy: 'USR-003',
    serviceScope: ['flight', 'hotel'], quotationId: 'QUO-002', projectId: 'PRJ-102',
  },
  {
    id: 'OPP-003', partyId: 'PTY-003', title: 'Palu MICE Conference 2026', stage: 'won',
    createdAt: '2026-05-15', decidedAt: '2026-06-05', wonApprovedBy: 'USR-003',
    serviceScope: ['flight', 'hotel', 'transportation', 'mice'], quotationId: 'QUO-003', projectId: 'PRJ-103',
  },
  {
    id: 'OPP-004', partyId: 'PTY-004', title: 'Jakarta Incentive Trip', stage: 'lost',
    createdAt: '2026-06-15', decidedAt: '2026-07-05', lostReason: 'Budget internal client dipotong',
    serviceScope: ['flight', 'hotel'], quotationId: 'QUO-004',
  },
]

export const QUOTATIONS: Quotation[] = [
  { id: 'QUO-001', opportunityId: 'OPP-001', amountIdr: 95_000_000, createdAt: '2026-06-25', accepted: true },
  { id: 'QUO-002', opportunityId: 'OPP-002', amountIdr: 345_000_000, createdAt: '2026-06-20', accepted: true },
  { id: 'QUO-003', opportunityId: 'OPP-003', amountIdr: 1_400_000_000, createdAt: '2026-06-05', accepted: true },
  { id: 'QUO-004', opportunityId: 'OPP-004', amountIdr: 45_000_000, createdAt: '2026-06-15', accepted: false },
]
