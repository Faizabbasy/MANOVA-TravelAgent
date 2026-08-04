import { reactive } from 'vue'
import { resolveDestinationGeo } from './geo'
import type { Opportunity, Quotation } from '~/types/opportunity'

/**
 * `reactive()` (Section 08) — melanjutkan pola Section 07 (`app/data/parties.ts`). Opportunity Detail
 * butuh transisi stage, submit Won, tandai Lost/On Hold, dan buat/revisi Quotation — seluruhnya mutasi
 * runtime yang harus ter-propagate ke Dashboard/Party Detail/CRM overview tanpa reload.
 */

/**
 * docs/mockup-data-scenarios.md bagian 1-4. `ownerId` seluruh Opportunity di bawah di-reassign dari
 * `USR-001` (Sales) ke `USR-014` (Account Executive) di Prompt 19 (Change Request) — di bawah model role
 * baru, Sales berhenti menangani Opportunity/Quotation (kini scoped ke Lead, lihat `app/data/leads.ts`),
 * AE yang menjadi Account Owner. Perubahan field murni (bukan struktur/hapus), didokumentasikan di
 * `docs/mockup-change-impact-log.md`.
 */
export const OPPORTUNITIES: Opportunity[] = reactive([
  {
    id: 'OPP-001',
    partyId: 'PTY-001',
    title: 'Manila Business Trip Q3 2026',
    stage: 'won',
    ownerId: 'USR-014',
    estimatedValueIdr: 95_000_000,
    destination: 'Manila, Filipina',
    travelStartDate: '2026-08-20',
    travelEndDate: '2026-08-23',
    travelerEstimate: 6,
    requirementNotes: 'Flight only, keberangkatan pagi, budget standard.',
    createdAt: '2026-06-10',
    decidedAt: '2026-06-25',
    wonApprovedBy: 'USR-003',
    serviceScope: ['flight'],
    quotationId: 'QUO-001',
    projectId: 'PRJ-101',
    // Related Lead (Prompt 20) — LED-009 sudah menaut ke OPP-001 sejak Prompt 19, kini ditautkan balik.
    contactName: 'Hendra Wijaya',
    leadId: 'LED-009'
  },
  {
    id: 'OPP-002',
    partyId: 'PTY-002',
    title: 'Abu Dhabi Corporate Gathering',
    stage: 'won',
    ownerId: 'USR-014',
    estimatedValueIdr: 320_000_000,
    destination: 'Abu Dhabi, Uni Emirat Arab',
    travelStartDate: '2026-09-22',
    travelEndDate: '2026-09-26',
    travelerEstimate: 15,
    requirementNotes: 'Flight + hotel, room block untuk seluruh peserta, fleksibel tanggal.',
    createdAt: '2026-06-01',
    decidedAt: '2026-06-20',
    wonApprovedBy: 'USR-003',
    serviceScope: ['flight', 'hotel'],
    quotationId: 'QUO-002',
    projectId: 'PRJ-102'
  },
  {
    id: 'OPP-003',
    partyId: 'PTY-003',
    title: 'Palu MICE Conference 2026',
    stage: 'won',
    ownerId: 'USR-014',
    estimatedValueIdr: 1_400_000_000,
    destination: 'Palu, Indonesia',
    travelStartDate: '2026-08-10',
    travelEndDate: '2026-08-14',
    travelerEstimate: 60,
    requirementNotes: 'Full MICE: flight, hotel, transportation, dan venue acara untuk 60 peserta.',
    createdAt: '2026-05-15',
    decidedAt: '2026-06-05',
    wonApprovedBy: 'USR-003',
    serviceScope: ['flight', 'hotel', 'transportation', 'mice'],
    quotationId: 'QUO-003',
    projectId: 'PRJ-103'
  },
  {
    id: 'OPP-004',
    partyId: 'PTY-004',
    title: 'Jakarta Incentive Trip',
    stage: 'lost',
    ownerId: 'USR-014',
    estimatedValueIdr: 45_000_000,
    destination: 'Jakarta, Indonesia',
    travelStartDate: '2026-08-15',
    travelEndDate: '2026-08-18',
    travelerEstimate: 20,
    requirementNotes: 'Flight + hotel untuk 20 peserta incentive trip.',
    createdAt: '2026-06-15',
    decidedAt: '2026-07-05',
    lostReason: 'Budget internal client dipotong',
    serviceScope: ['flight', 'hotel'],
    quotationId: 'QUO-004'
  },
  /**
   * OPP-005–007 (Section 06/Dashboard): opportunity pipeline masih kosong bila hanya memakai OPP-001–004
   * (seluruhnya sudah Won/Lost), sehingga widget "Opportunity Pipeline" tidak punya data untuk ditampilkan.
   * Field destination/travel/traveler/requirement/owner/estimatedValue dilengkapi Section 08.
   *
   * Prompt 19 (Change Request) — OPP-005 DIKEMBALIKAN dari `won-requested` (Section 09 CI-012) ke
   * `negotiation`: di bawah workflow Commercial Approval baru, "Ajukan sebagai Won" mensyaratkan
   * `Quotation.approvalStatus === 'approved'` lebih dulu — QUO-005 di bawah sengaja `submitted`
   * (menunggu approval Management), skenario "satu quotation menunggu approval" yang diminta literal
   * Prompt 19-9. Live-demo Approve Won (Section 09) kini didemokan lewat OPP-006 (quotation-nya sudah
   * `approved`) alih-alih OPP-005 — perubahan re-staging ini dicatat di `docs/mockup-change-impact-log.md`.
   */
  {
    id: 'OPP-005',
    partyId: 'PTY-004',
    title: 'Bali Team Building 2026',
    stage: 'negotiation',
    ownerId: 'USR-014',
    estimatedValueIdr: 150_000_000,
    destination: 'Bali, Indonesia',
    travelStartDate: '2026-10-05',
    travelEndDate: '2026-10-08',
    travelerEstimate: 30,
    requirementNotes: 'Flight + hotel untuk 30 peserta, aktivitas team building 1 hari.',
    createdAt: '2026-07-05',
    serviceScope: ['flight', 'hotel'],
    quotationId: 'QUO-005',
    contactName: 'Nadia Ramadhani',
    leadId: 'LED-005',
    // Requirement Detail (Prompt 20) — mendemokan field AE terisi sebagian pada Opportunity yang masih
    // "Pending Management Approval" (QUO-005 submitted).
    requirementDetail: {
      departureCity: 'Jakarta',
      destinationDetail: 'Nusa Dua, Bali — hotel bintang 4 dekat pantai',
      travelerComposition: '30 pax karyawan, 1 rombongan',
      roomRequirement: '15 kamar twin',
      specialRequest: 'Aktivitas team building outdoor 1 hari penuh',
      decisionMaker: 'Nadia Ramadhani (Procurement Officer)',
      paymentTerms: 'DP 50% setelah quotation disetujui, pelunasan H-7 keberangkatan'
    }
  },
  /** OPP-006 — Quotation sudah `approved` (Prompt 19/20), siap didemokan AE "Mark as Won" langsung. */
  {
    id: 'OPP-006',
    partyId: 'PTY-001',
    title: 'Manila Repeat Business Q4 2026',
    stage: 'negotiation',
    ownerId: 'USR-014',
    estimatedValueIdr: 55_000_000,
    destination: 'Manila, Filipina',
    travelStartDate: '2026-11-10',
    travelEndDate: '2026-11-13',
    travelerEstimate: 8,
    requirementNotes: 'Flight only, repeat business dari client existing.',
    createdAt: '2026-07-15',
    serviceScope: ['flight'],
    quotationId: 'QUO-006',
    contactName: 'Hendra Wijaya',
    requirementDetail: {
      departureCity: 'Jakarta',
      destinationDetail: 'Manila, Filipina — hotel dekat kawasan bisnis',
      travelerComposition: '8 pax repeat business traveler',
      flightPreference: 'Penerbangan pagi, maskapai full-service',
      decisionMaker: 'Hendra Wijaya (Operations Manager)',
      paymentTerms: 'Net 30 setelah trip selesai',
      commercialNotes: 'Repeat client, harga mengikuti rate korporat existing.'
    }
  },
  {
    id: 'OPP-007',
    partyId: 'PTY-002',
    title: 'Abu Dhabi Follow-up Training',
    stage: 'qualification',
    ownerId: 'USR-014',
    estimatedValueIdr: 200_000_000,
    destination: 'Abu Dhabi, Uni Emirat Arab',
    // Tanggal, traveler estimate, dan requirement belum diisi — stage Qualification, belum digali (contoh empty state).
    createdAt: '2026-07-20',
    serviceScope: ['flight', 'hotel']
  },
  /**
   * OPP-008 (Prompt 19) — repeat client PTY-001 (sudah Won lewat OPP-001/PRJ-101) dengan Project Order
   * kedua (PRJ-104, lihat `app/data/projects.ts`), memenuhi literal Prompt 19-9 "satu Active Client dengan
   * beberapa Project Orders" tanpa aksi interaktif tambahan — di-seed langsung sebagai Won, mengikuti pola
   * OPP-001/002/003 (bukan dataset paralel, satu sumber `OPPORTUNITIES`/`QUOTATIONS` yang sama).
   */
  {
    id: 'OPP-008',
    partyId: 'PTY-001',
    title: 'Manila Follow-up Training Q1 2027',
    stage: 'won',
    ownerId: 'USR-014',
    estimatedValueIdr: 60_000_000,
    destination: 'Manila, Filipina',
    travelStartDate: '2027-02-16',
    travelEndDate: '2027-02-18',
    travelerEstimate: 8,
    requirementNotes: 'Flight only, lanjutan repeat business dari PT Cipta Distribusi Nusantara.',
    createdAt: '2026-07-15',
    decidedAt: '2026-07-24',
    wonApprovedBy: 'USR-003',
    serviceScope: ['flight'],
    quotationId: 'QUO-008',
    projectId: 'PRJ-104',
    contactName: 'Hendra Wijaya'
  },
  /**
   * OPP-009/010 (Prompt 20 — Change Request) — melengkapi skenario Requirement Gate/Quotation literal
   * Prompt 20-15: "Opportunity Ready for Quotation" dan "Opportunity dengan Draft Quotation" belum ada
   * contohnya di fixture Prompt 19 (seluruh opportunity aktif sudah punya quotation submitted/approved).
   * Reuse party client existing (PTY-002/003, bukan dataset paralel) — repeat opportunity pada client yang
   * sama sudah jadi pola mapan sejak OPP-006/008.
   */
  {
    id: 'OPP-009',
    partyId: 'PTY-003',
    title: 'Palu MICE Conference 2027',
    stage: 'requirement-gathering',
    ownerId: 'USR-014',
    estimatedValueIdr: 180_000_000,
    destination: 'Palu, Indonesia',
    travelStartDate: '2027-03-10',
    travelEndDate: '2027-03-13',
    travelerEstimate: 25,
    requirementNotes: 'Full MICE lanjutan: flight, hotel, dan venue acara untuk 25 peserta.',
    createdAt: '2026-07-26',
    serviceScope: ['flight', 'hotel', 'mice'],
    contactName: 'Michael Tanuwijaya'
    // Requirement lengkap (destination/tanggal/traveler/service scope/requirement summary/contact person/
    // estimated value seluruhnya terisi), BELUM ada Quotation — workflow status "Ready for Quotation".
  },
  {
    id: 'OPP-010',
    partyId: 'PTY-002',
    title: 'Surabaya Regional Sales Meeting 2027',
    stage: 'proposal',
    ownerId: 'USR-014',
    estimatedValueIdr: 75_000_000,
    destination: 'Surabaya, Indonesia',
    travelStartDate: '2027-01-20',
    travelEndDate: '2027-01-22',
    travelerEstimate: 18,
    requirementNotes: 'Flight + hotel untuk 18 peserta regional sales meeting.',
    createdAt: '2026-07-27',
    serviceScope: ['flight', 'hotel'],
    quotationId: 'QUO-010',
    contactName: 'Sarah Amelia'
    // Quotation sudah dibuat (QUO-010) tapi masih draft (`approvalStatus` belum diisi) — workflow status
    // "Quotation Draft", mendemokan field discount/estimated cost/estimated margin/payment terms/service
    // breakdown hasil "Edit Quotation".
  }
])

/** Backfill `destinationGeo` seed — data historis di atas dibuat langsung sebagai literal (bukan lewat `qualifyLeadAndCreateOpportunity`), jadi diresolusi sekali di sini agar peta destinasi langsung terisi. */
for (const opportunity of OPPORTUNITIES) { opportunity.destinationGeo = resolveDestinationGeo(opportunity.destination) }

/**
 * `approvalStatus` (Prompt 19) — commercial approval quotation, aditif. QUO-001/002/003 di-backfill
 * `approved` (Opportunity-nya sudah Won, secara historis nilai komersialnya jelas sudah disetujui).
 * QUO-004 (Lost) dibiarkan tanpa `approvalStatus` (`draft`, default) — deal batal karena alasan klien
 * (budget internal dipotong), bukan penolakan komersial internal Management, jadi tidak tepat ditandai
 * `rejected`.
 */
export const QUOTATIONS: Quotation[] = reactive([
  { id: 'QUO-001', opportunityId: 'OPP-001', amountIdr: 95_000_000, createdAt: '2026-06-25', accepted: true, version: 1, approvalStatus: 'approved', approvedBy: 'USR-003' },
  { id: 'QUO-002', opportunityId: 'OPP-002', amountIdr: 345_000_000, createdAt: '2026-06-20', accepted: true, version: 1, approvalStatus: 'approved', approvedBy: 'USR-003' },
  { id: 'QUO-003', opportunityId: 'OPP-003', amountIdr: 1_400_000_000, createdAt: '2026-06-05', accepted: true, version: 1, approvalStatus: 'approved', approvedBy: 'USR-003' },
  { id: 'QUO-004', opportunityId: 'OPP-004', amountIdr: 45_000_000, createdAt: '2026-06-15', accepted: false, version: 1 },
  // QUO-005 sengaja versi 2 (Section 08) — mendemonstrasikan "quotation version mock": nilai direvisi naik
  // dari estimasi awal Rp 150jt (OPP-005.estimatedValueIdr) setelah negosiasi menambah cakupan hotel.
  // approvalStatus 'submitted' (Prompt 19) — skenario "satu quotation menunggu approval" (literal 9-9).
  { id: 'QUO-005', opportunityId: 'OPP-005', amountIdr: 180_000_000, createdAt: '2026-07-18', accepted: false, version: 2, supersededAmountIdr: 150_000_000, approvalStatus: 'submitted' },
  // approvalStatus 'approved' (Prompt 19) — skenario "satu quotation approved" (literal 9-9), siap "Ajukan sebagai Won".
  // sentToClientAt (Section 05) — sudah dikirim ke client tapi BELUM ada Client Confirmation (Opportunity.clientConfirmedAt
  // sengaja tidak diisi), mendemokan gerbang baru "AE belum dapat Mark as Won sebelum approved + client confirmation".
  { id: 'QUO-006', opportunityId: 'OPP-006', amountIdr: 60_000_000, createdAt: '2026-07-22', accepted: false, version: 1, approvalStatus: 'approved', approvedBy: 'USR-003', sentToClientAt: '2026-07-23' },
  { id: 'QUO-008', opportunityId: 'OPP-008', amountIdr: 60_000_000, createdAt: '2026-07-15', accepted: true, version: 1, approvalStatus: 'approved', approvedBy: 'USR-003' },
  // QUO-010 (Prompt 20) — draft lengkap dengan discount/estimated cost/estimated margin/payment terms/
  // service breakdown, `approvalStatus` sengaja tidak diisi (default "draft") — belum pernah di-submit.
  // Section 05 — dilengkapi field komersial tambahan (tax/markup/currency/validity/terms/inclusions/
  // exclusions) sebagai demo lengkap "Edit Quotation" dan "PDF/Print Preview".
  {
    id: 'QUO-010',
    opportunityId: 'OPP-010',
    amountIdr: 75_000_000,
    createdAt: '2026-07-27',
    accepted: false,
    version: 1,
    discountIdr: 3_000_000,
    estimatedCostIdr: 58_000_000,
    estimatedMarginIdr: 14_000_000,
    paymentTerms: 'DP 30% di muka, pelunasan H-14 keberangkatan',
    serviceBreakdown: [
      { service: 'flight', description: '18 pax PP Jakarta–Surabaya', amountIdr: 27_000_000 },
      { service: 'hotel', description: '9 kamar twin, 2 malam', amountIdr: 48_000_000 }
    ],
    taxIdr: 3_500_000,
    markupIdr: 2_500_000,
    currency: 'IDR',
    validUntil: '2026-08-27',
    inclusions: 'Tiket pesawat PP Jakarta-Surabaya, hotel bintang 4 (2 malam), transportasi bandara-hotel PP.',
    exclusions: 'Pengeluaran pribadi, asuransi perjalanan, aktivitas di luar itinerary.',
    termsAndConditions: 'Harga berlaku sampai tanggal validity. DP 30% tidak dapat dikembalikan setelah konfirmasi booking.'
  }
])
