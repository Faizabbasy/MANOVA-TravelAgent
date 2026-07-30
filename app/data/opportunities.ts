import { reactive } from 'vue'
import type { Opportunity, Quotation } from '~/types/opportunity'

/**
 * `reactive()` (Section 08) — melanjutkan pola Section 07 (`app/data/parties.ts`). Opportunity Detail
 * butuh transisi stage, submit Won, tandai Lost/On Hold, dan buat/revisi Quotation — seluruhnya mutasi
 * runtime yang harus ter-propagate ke Dashboard/Party Detail/CRM overview tanpa reload.
 */

/** docs/mockup-data-scenarios.md bagian 1-4. */
export const OPPORTUNITIES: Opportunity[] = reactive([
  {
    id: 'OPP-001', partyId: 'PTY-001', title: 'Manila Business Trip Q3 2026', stage: 'won',
    ownerId: 'USR-001', estimatedValueIdr: 95_000_000, destination: 'Manila, Filipina',
    travelStartDate: '2026-08-20', travelEndDate: '2026-08-23', travelerEstimate: 6,
    requirementNotes: 'Flight only, keberangkatan pagi, budget standard.',
    createdAt: '2026-06-10', decidedAt: '2026-06-25', wonApprovedBy: 'USR-003',
    serviceScope: ['flight'], quotationId: 'QUO-001', projectId: 'PRJ-101',
  },
  {
    id: 'OPP-002', partyId: 'PTY-002', title: 'Abu Dhabi Corporate Gathering', stage: 'won',
    ownerId: 'USR-001', estimatedValueIdr: 320_000_000, destination: 'Abu Dhabi, Uni Emirat Arab',
    travelStartDate: '2026-09-22', travelEndDate: '2026-09-26', travelerEstimate: 15,
    requirementNotes: 'Flight + hotel, room block untuk seluruh peserta, fleksibel tanggal.',
    createdAt: '2026-06-01', decidedAt: '2026-06-20', wonApprovedBy: 'USR-003',
    serviceScope: ['flight', 'hotel'], quotationId: 'QUO-002', projectId: 'PRJ-102',
  },
  {
    id: 'OPP-003', partyId: 'PTY-003', title: 'Palu MICE Conference 2026', stage: 'won',
    ownerId: 'USR-001', estimatedValueIdr: 1_400_000_000, destination: 'Palu, Indonesia',
    travelStartDate: '2026-08-10', travelEndDate: '2026-08-14', travelerEstimate: 60,
    requirementNotes: 'Full MICE: flight, hotel, transportation, dan venue acara untuk 60 peserta.',
    createdAt: '2026-05-15', decidedAt: '2026-06-05', wonApprovedBy: 'USR-003',
    serviceScope: ['flight', 'hotel', 'transportation', 'mice'], quotationId: 'QUO-003', projectId: 'PRJ-103',
  },
  {
    id: 'OPP-004', partyId: 'PTY-004', title: 'Jakarta Incentive Trip', stage: 'lost',
    ownerId: 'USR-001', estimatedValueIdr: 45_000_000, destination: 'Jakarta, Indonesia',
    travelStartDate: '2026-08-15', travelEndDate: '2026-08-18', travelerEstimate: 20,
    requirementNotes: 'Flight + hotel untuk 20 peserta incentive trip.',
    createdAt: '2026-06-15', decidedAt: '2026-07-05', lostReason: 'Budget internal client dipotong',
    serviceScope: ['flight', 'hotel'], quotationId: 'QUO-004',
  },
  /**
   * OPP-005–007 (Section 06/Dashboard): opportunity pipeline masih kosong bila hanya memakai OPP-001–004
   * (seluruhnya sudah Won/Lost), sehingga widget "Opportunity Pipeline" tidak punya data untuk ditampilkan.
   * Field destination/travel/traveler/requirement/owner/estimatedValue dilengkapi Section 08.
   * OPP-005 dimajukan ke stage `won-requested` di Section 09 — party (PTY-004) masih Prospect dan
   * datanya paling lengkap dari ketiga opportunity pipeline, kandidat paling siap untuk didemokan
   * Approve Won tanpa harus klik-klik dulu lewat seluruh stage sebelumnya.
   */
  {
    id: 'OPP-005', partyId: 'PTY-004', title: 'Bali Team Building 2026', stage: 'won-requested',
    ownerId: 'USR-001', estimatedValueIdr: 150_000_000, destination: 'Bali, Indonesia',
    travelStartDate: '2026-10-05', travelEndDate: '2026-10-08', travelerEstimate: 30,
    requirementNotes: 'Flight + hotel untuk 30 peserta, aktivitas team building 1 hari.',
    createdAt: '2026-07-05', serviceScope: ['flight', 'hotel'], quotationId: 'QUO-005',
  },
  {
    id: 'OPP-006', partyId: 'PTY-001', title: 'Manila Repeat Business Q4 2026', stage: 'proposal',
    ownerId: 'USR-001', estimatedValueIdr: 55_000_000, destination: 'Manila, Filipina',
    travelStartDate: '2026-11-10', travelEndDate: '2026-11-13', travelerEstimate: 8,
    requirementNotes: 'Flight only, repeat business dari client existing.',
    createdAt: '2026-07-15', serviceScope: ['flight'], quotationId: 'QUO-006',
  },
  {
    id: 'OPP-007', partyId: 'PTY-002', title: 'Abu Dhabi Follow-up Training', stage: 'qualification',
    ownerId: 'USR-001', estimatedValueIdr: 200_000_000, destination: 'Abu Dhabi, Uni Emirat Arab',
    // Tanggal, traveler estimate, dan requirement belum diisi — stage Qualification, belum digali (contoh empty state).
    createdAt: '2026-07-20', serviceScope: ['flight', 'hotel'],
  },
])

export const QUOTATIONS: Quotation[] = reactive([
  { id: 'QUO-001', opportunityId: 'OPP-001', amountIdr: 95_000_000, createdAt: '2026-06-25', accepted: true, version: 1 },
  { id: 'QUO-002', opportunityId: 'OPP-002', amountIdr: 345_000_000, createdAt: '2026-06-20', accepted: true, version: 1 },
  { id: 'QUO-003', opportunityId: 'OPP-003', amountIdr: 1_400_000_000, createdAt: '2026-06-05', accepted: true, version: 1 },
  { id: 'QUO-004', opportunityId: 'OPP-004', amountIdr: 45_000_000, createdAt: '2026-06-15', accepted: false, version: 1 },
  // QUO-005 sengaja versi 2 (Section 08) — mendemonstrasikan "quotation version mock": nilai direvisi naik
  // dari estimasi awal Rp 150jt (OPP-005.estimatedValueIdr) setelah negosiasi menambah cakupan hotel.
  { id: 'QUO-005', opportunityId: 'OPP-005', amountIdr: 180_000_000, createdAt: '2026-07-18', accepted: false, version: 2, supersededAmountIdr: 150_000_000 },
  { id: 'QUO-006', opportunityId: 'OPP-006', amountIdr: 60_000_000, createdAt: '2026-07-22', accepted: false, version: 1 },
])
