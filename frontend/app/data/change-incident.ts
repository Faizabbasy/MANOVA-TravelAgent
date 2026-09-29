import { reactive } from 'vue'
import type { ChangeRequest, CancellationRecord, RefundRequest, Incident, ChangeRequestDraft, ChangeRequestComment, ChangeRequestAttachment } from '~/types/change-incident'

/**
 * `reactive()` (Section 19 — roadmap Section 00–24 baru) — melanjutkan pola Section 07 dst.
 *
 * Narasi diseed SENGAJA menautkan ke booking/project/change entry existing (bukan skenario lepas konteks),
 * pola sama `app/data/booking-orchestration.ts` (Section 18):
 * - `CR-001`/`CR-003` menautkan `activityEntryId` ke `CHG-1021`/`CHG-1031` (Section 14 lama, `app/data/activity.ts`)
 *   yang narasinya identik — mendemokan `ChangeRequest` sebagai lapisan struktur TAMBAHAN, bukan pengganti,
 *   `ActivityEntry` yang sudah ada. `CR-002` menautkan `CHG-1023` (approvalStatus existing `pending` selaras
 *   `ChangeRequest.status` 'under-review'). `CR-004`/`CR-005`/`CR-006` menautkan 3 `ActivityEntry` BARU
 *   (`CHG-1032`/`1033`/`1034`, ditambahkan aditif di `app/data/activity.ts` — TIDAK mengubah entri existing).
 * - `CancellationRecord` menautkan booking yang statusnya SUDAH `cancelled`/`refunded` (`FLT-1023`/`HTL-1023`/
 *   `TRN-1037`) — lapisan penalty-tracking seragam TAMBAHAN, TIDAK memutasi booking itu sendiri.
 * - `RefundRequest` menautkan `CancellationRecord` di atas + `Invoice` existing (`app/data/finance.ts`,
 *   read-only reference, TIDAK PERNAH memutasi `Invoice.status`) — `REF-001` mendemokan `creditStatus: 'issued'`.
 * - `Incident` mendemokan seluruh 4 severity, satu `escalated` (ke Operations `USR-002`) dengan
 *   `communicationLog` multi-entri (`INC-001`, tertaut `TRN-1034`), satu project-level tanpa `bookingId`
 *   (`INC-003`, severity `critical` — peringatan cuaca ekstrem Palu).
 */

export const CHANGE_REQUESTS: ChangeRequest[] = reactive([
  {
    id: 'CR-001',
    projectId: 'PRJ-102',
    source: 'internal',
    requestedBy: 'USR-002',
    submittedAt: '2026-07-08',
    affectedEntities: [{ entityType: 'itinerary', entityId: 'ITIN-1021' }, { entityType: 'flight', entityId: 'FLT-1021' }],
    beforeSummary: 'Tanggal perjalanan 15–19 Sep 2026',
    afterSummary: 'Tanggal perjalanan 22–26 Sep 2026',
    operationalImpact: 'Itinerary harian serta booking flight dan hotel perlu disesuaikan ulang.',
    timelineImpactNote: 'Keberangkatan mundur 7 hari dari rencana awal.',
    status: 'approved',
    approvedBy: 'USR-003',
    approvedAt: '2026-07-08',
    activityEntryId: 'CHG-1021'
  },
  {
    id: 'CR-002',
    projectId: 'PRJ-102',
    source: 'client',
    requestedBy: 'USR-021',
    submittedAt: '2026-07-12',
    affectedEntities: [{ entityType: 'hotel', entityId: 'HTL-1022' }],
    beforeSummary: 'Tipe kamar Deluxe untuk 18 pax (Room Block A)',
    afterSummary: 'Upgrade ke tipe kamar Suite untuk 18 pax',
    operationalImpact: 'Rooming list Room Block A disusun ulang oleh tim Accommodation.',
    commercialImpactIdr: 25_000_000,
    financialImpactNote: 'Menambah invoice termin tambahan INV-1022.',
    status: 'under-review',
    activityEntryId: 'CHG-1023'
  },
  {
    id: 'CR-003',
    projectId: 'PRJ-103',
    source: 'internal',
    requestedBy: 'USR-002',
    submittedAt: '2026-07-10',
    affectedEntities: [{ entityType: 'project', entityId: 'PRJ-103' }],
    beforeSummary: '20 pax Group Sales Team',
    afterSummary: '25 pax Group Sales Team',
    operationalImpact: 'Rooming list Group Sales Team (GRP-002) disesuaikan menjadi 12 twin + 1 single.',
    status: 'approved',
    approvedBy: 'USR-003',
    approvedAt: '2026-07-10',
    activityEntryId: 'CHG-1031'
  },
  {
    id: 'CR-004',
    projectId: 'PRJ-103',
    source: 'supplier',
    requestedBy: 'USR-015',
    submittedAt: '2026-07-18',
    affectedEntities: [{ entityType: 'transport', entityId: 'TRN-1034' }],
    beforeSummary: '2 unit Minibus (16 seat)',
    afterSummary: '1 unit Bus (40 seat)',
    operationalImpact: 'Perlu update assigned vehicle dan capacity check manifest Group Sales Team.',
    commercialImpactIdr: 3_000_000,
    status: 'submitted',
    activityEntryId: 'CHG-1032'
  },
  {
    id: 'CR-005',
    projectId: 'PRJ-101',
    source: 'client',
    requestedBy: 'USR-021',
    submittedAt: '2026-07-19',
    affectedEntities: [{ entityType: 'flight', entityId: 'FLT-1011' }],
    beforeSummary: 'Keberangkatan 20 Agu 2026 pagi (e-ticket sudah terbit)',
    afterSummary: 'Permintaan reschedule ke 21 Agu 2026',
    operationalImpact: 'Perlu pengecekan ulang ketersediaan kursi untuk e-ticket yang sudah issued.',
    status: 'rejected',
    rejectionReason: 'E-ticket sudah issued dan di luar fare rules reschedule H-1 — biaya reissue tidak proporsional dengan durasi trip.',
    approvedBy: 'USR-003',
    approvedAt: '2026-07-20',
    activityEntryId: 'CHG-1033'
  },
  {
    id: 'CR-006',
    projectId: 'PRJ-103',
    source: 'internal',
    requestedBy: 'USR-002',
    submittedAt: '2026-07-21',
    affectedEntities: [{ entityType: 'mice', entityId: 'MICE-1035' }],
    beforeSummary: 'Rundown venue: Ballroom A, sesi tunggal',
    afterSummary: 'Rundown venue: Ballroom A + Breakout Room B, dua sesi paralel',
    operationalImpact: 'BOQ dan staffing perlu ditambah untuk breakout room kedua.',
    commercialImpactIdr: 18_000_000,
    timelineImpactNote: 'Tidak mengubah tanggal event.',
    status: 'implemented',
    approvedBy: 'USR-003',
    approvedAt: '2026-07-22',
    activityEntryId: 'CHG-1034'
  },
  /**
   * CR-007 (Client Experience — Repair Phase Section 1) — skenario demo "Singapore Conference"
   * (`docs/client-mock-data-scenarios.md`): perubahan besar dengan cancellation fee, revised quotation
   * tersedia (`linkedQuotationId` sengaja kosong — belum ada Quotation nyata dibuat untuk PRJ-204,
   * diisi section "Request & Commercial" saat quotation revisi sungguhan dibuat), approval masih pending.
   * `activityEntryId` sengaja kosong (opsional) — tidak membuat `ActivityEntry` palsu hanya untuk seed ini.
   */
  {
    id: 'CR-007',
    projectId: 'PRJ-204',
    source: 'client',
    requestedBy: 'USR-021',
    submittedAt: '2026-07-24',
    affectedEntities: [{ entityType: 'hotel', entityId: 'SVC-2042' }, { entityType: 'project', entityId: 'PRJ-204' }],
    beforeSummary: 'Konferensi 3 hari, 15 peserta, 1 hotel venue tunggal',
    afterSummary: 'Konferensi diperpanjang 1 hari, venue hotel diganti ke properti lain',
    operationalImpact: 'Perlu re-booking hotel dan penyesuaian seluruh jadwal harian.',
    commercialImpactIdr: 42_000_000,
    financialImpactNote: 'Termasuk cancellation fee hotel venue lama, menunggu revised quotation.',
    timelineImpactNote: 'Tanggal kepulangan mundur 1 hari.',
    status: 'under-review'
  }
])

export const CANCELLATION_RECORDS: CancellationRecord[] = reactive([
  {
    id: 'CNX-001',
    projectId: 'PRJ-102',
    bookingType: 'flight',
    bookingId: 'FLT-1023',
    reason: 'Traveler membatalkan perjalanan karena kondisi mendesak keluarga.',
    penaltyIdr: 5_000_000,
    cancelledAt: '2026-07-15',
    cancelledBy: 'USR-002',
    refundEligible: true
  },
  {
    id: 'CNX-002',
    projectId: 'PRJ-102',
    bookingType: 'hotel',
    bookingId: 'HTL-1023',
    reason: 'Room Block B digabung ke Room Block A — kelebihan booking dibatalkan.',
    penaltyIdr: 3_750_000,
    cancelledAt: '2026-07-09',
    cancelledBy: 'USR-002',
    refundEligible: true
  },
  {
    id: 'CNX-003',
    projectId: 'PRJ-103',
    bookingType: 'transport',
    bookingId: 'TRN-1037',
    reason: 'Airport pickup dibatalkan — traveler menggunakan kendaraan pribadi.',
    cancelledAt: '2026-07-19',
    cancelledBy: 'USR-002',
    refundEligible: false
  }
])

export const REFUND_REQUESTS: RefundRequest[] = reactive([
  {
    id: 'REF-001',
    projectId: 'PRJ-102',
    cancellationId: 'CNX-001',
    invoiceId: 'INV-1021',
    type: 'partial',
    amountIdr: 45_000_000,
    status: 'processed',
    requestedAt: '2026-07-15',
    requestedBy: 'USR-002',
    approvedBy: 'USR-003',
    approvedAt: '2026-07-17',
    creditStatus: 'issued'
  },
  {
    id: 'REF-002',
    projectId: 'PRJ-102',
    cancellationId: 'CNX-002',
    invoiceId: 'INV-1022',
    type: 'full',
    amountIdr: 21_250_000,
    status: 'approved',
    requestedAt: '2026-07-09',
    requestedBy: 'USR-002',
    approvedBy: 'USR-003',
    approvedAt: '2026-07-11',
    creditStatus: 'pending'
  },
  {
    id: 'REF-003',
    projectId: 'PRJ-103',
    cancellationId: 'CNX-003',
    type: 'full',
    amountIdr: 2_000_000,
    status: 'under-review',
    requestedAt: '2026-07-19',
    requestedBy: 'USR-002',
    creditStatus: 'pending'
  },
  {
    id: 'REF-004',
    projectId: 'PRJ-101',
    invoiceId: 'INV-1011',
    type: 'partial',
    amountIdr: 5_000_000,
    status: 'requested',
    requestedAt: '2026-07-24',
    requestedBy: 'USR-002',
    creditStatus: 'pending'
  },
  {
    id: 'REF-005',
    projectId: 'PRJ-103',
    invoiceId: 'INV-1032',
    type: 'partial',
    amountIdr: 10_000_000,
    status: 'rejected',
    requestedAt: '2026-07-16',
    requestedBy: 'USR-002',
    approvedBy: 'USR-003',
    approvedAt: '2026-07-18',
    rejectionReason: 'Pengajuan melewati batas waktu kebijakan pembatalan/refund proyek.',
    creditStatus: 'not-applicable'
  }
])

/** Draft Change Request Client (Repair Phase Section 5) — kosong, dibuat/diisi lewat `saveChangeRequestDraft`. */
export const CHANGE_REQUEST_DRAFTS: ChangeRequestDraft[] = reactive([])

/** Comment/Attachment mock Change Request (Repair Phase Section 5) — kosong, pola sama `QUOTATION_COMMENTS`/`QUOTATION_ATTACHMENTS`. */
export const CHANGE_REQUEST_COMMENTS: ChangeRequestComment[] = reactive([])
export const CHANGE_REQUEST_ATTACHMENTS: ChangeRequestAttachment[] = reactive([])

export const INCIDENTS: Incident[] = reactive([
  {
    id: 'INC-001',
    projectId: 'PRJ-103',
    bookingType: 'transport',
    bookingId: 'TRN-1034',
    title: 'Kendaraan mogok saat penjemputan Group Sales Team',
    description: 'Salah satu unit armada mogok di tengah rute penjemputan dari bandara menuju hotel.',
    severity: 'high',
    ownerId: 'USR-002',
    status: 'escalated',
    escalatedTo: 'USR-002',
    communicationLog: [
      { id: 'INC-001-COM-1', at: '2026-07-19T08:15', from: 'USR-002', message: 'Unit armada B mogok di km 12, traveler dipindahkan ke unit cadangan.' },
      { id: 'INC-001-COM-2', at: '2026-07-19T08:40', from: 'USR-002', message: 'Dieskalasi ke Operations untuk koordinasi unit pengganti dan evaluasi vendor.' }
    ]
  },
  {
    id: 'INC-002',
    projectId: 'PRJ-102',
    bookingType: 'flight',
    bookingId: 'FLT-1021',
    title: 'Perubahan jadwal penerbangan berdampak pada koneksi',
    description: 'Jadwal penerbangan berubah dari maskapai, berpotensi mengganggu rencana kedatangan.',
    severity: 'medium',
    ownerId: 'USR-002',
    status: 'resolved',
    communicationLog: [
      { id: 'INC-002-COM-1', at: '2026-07-05T11:00', from: 'USR-002', message: 'Tiket berhasil di-reissue manual ke jadwal baru 22–26 Sep 2026.' }
    ],
    resolutionNote: 'Reissue selesai, traveler sudah dikonfirmasi ulang jadwal barunya.',
    resolvedAt: '2026-07-05'
  },
  {
    id: 'INC-003',
    projectId: 'PRJ-103',
    title: 'Peringatan cuaca ekstrem di lokasi venue',
    description: 'BMKG mengeluarkan peringatan cuaca ekstrem untuk area Palu pada rentang tanggal event.',
    severity: 'critical',
    ownerId: 'USR-002',
    status: 'open',
    communicationLog: []
  },
  {
    id: 'INC-004',
    projectId: 'PRJ-101',
    title: 'Keterlambatan pengumpulan dokumen traveler',
    description: 'Beberapa traveler terlambat mengumpulkan salinan paspor sebelum keberangkatan.',
    severity: 'low',
    ownerId: 'USR-002',
    status: 'closed',
    communicationLog: [
      { id: 'INC-004-COM-1', at: '2026-06-24T10:00', from: 'USR-002', message: 'Seluruh dokumen sudah lengkap H-2 sebelum keberangkatan.' }
    ],
    resolutionNote: 'Seluruh traveler melengkapi dokumen tepat waktu, tidak ada dampak ke keberangkatan.',
    resolvedAt: '2026-06-25'
  }
])
