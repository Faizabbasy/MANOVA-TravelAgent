import { reactive } from 'vue'
import type { RFQ, RFQInvitation, RFQResponse, RFQClarificationMessage, ServiceOrder, ServiceOrderAmendment, SupplierInvoice } from '~/types/procurement'

/**
 * `reactive()` (Section 17 — Supplier dan Procurement, roadmap Section 00–24 baru) — melanjutkan pola
 * Section 07 dst. Seluruh `vendorId` mereuse `VENDORS` (`app/data/vendors.ts`) — TIDAK ada entitas Supplier
 * paralel. `VND-006` (PT ABC, kategori Hotel Budget) dan `VND-007` (PT EFG, kategori MICE Vendor Package)
 * dipakai luas di sini sesuai literal Wajib Section 17 ("PT ABC dan PT EFG memiliki produk berbeda") —
 * keduanya sudah punya katalog `VendorProduct` berbeda sejak Prompt 19 (`VENDOR_PRODUCTS`), fixture di sini
 * MELANJUTKAN skenario itu (bukan mengulang), lihat `docs/mockup-data-scenarios.md` bagian 4t.
 *
 * 4 RFQ merentang seluruh status literal: RFQ-001 (`draft`, belum dikirim), RFQ-002 (`responses-in`, 2 vendor
 * sudah merespons), RFQ-003 (`clarification`, thread klarifikasi aktif dengan PT ABC), RFQ-004 (`closed`,
 * vendor terpilih dan Service Order sudah dibuat). RFQ-004 SENGAJA TIDAK menautkan `serviceId` ke `SVC-1034`
 * (Ground Transportation PRJ-103) — baris itu tetap milik skenario comparison VQ-009/VQ-010 (Section 13 lama,
 * masih `pending-confirmation`, live demo Accept/Reject di tab Vendors) — RFQ-004 adalah kebutuhan transport
 * VIP tambahan yang TERPISAH, menghindari dua mekanisme keputusan vendor yang saling bertentangan untuk baris
 * service yang sama.
 */
export const RFQS: RFQ[] = reactive([
  {
    id: 'RFQ-001',
    projectId: 'PRJ-102',
    title: 'RFQ Akomodasi Tambahan — Rooming Group B',
    serviceType: 'hotel',
    status: 'draft',
    lineItems: [{ description: 'Kamar Twin tambahan (rooming ulang Group B)', quantity: 3, unit: 'kamar/4 malam' }],
    notes: 'Menyusul konsolidasi Room Block B ke Block A (SVC-1023) — dibutuhkan opsi cadangan bila ada penambahan peserta.',
    createdBy: 'USR-002',
    createdAt: '2026-07-25'
  },
  {
    id: 'RFQ-002',
    projectId: 'PRJ-103',
    title: 'RFQ Vendor Package Tambahan — Dokumentasi & Booth Sponsor',
    serviceType: 'mice',
    status: 'responses-in',
    lineItems: [
      { description: 'Dokumentasi foto dan video profesional (2 hari)', quantity: 2, unit: 'hari' },
      { description: 'Booth sponsor tambahan', quantity: 2, unit: 'unit' }
    ],
    dueAt: '2026-07-30',
    notes: 'Melengkapi BOQ MICE-1035 — dibandingkan sebelum memutuskan vendor dokumentasi final.',
    createdBy: 'USR-002',
    createdAt: '2026-07-18',
    updatedAt: '2026-07-24'
  },
  {
    id: 'RFQ-003',
    projectId: 'PRJ-103',
    title: 'RFQ Akomodasi VIP Suite Tambahan',
    serviceType: 'hotel',
    status: 'clarification',
    lineItems: [{ description: 'VIP Suite kapasitas 2 pax, aksesibilitas', quantity: 2, unit: 'kamar/4 malam' }],
    dueAt: '2026-08-02',
    notes: 'Untuk 2 tamu VIP tambahan di luar Room Block existing (SVC-1033).',
    createdBy: 'USR-002',
    createdAt: '2026-07-20',
    updatedAt: '2026-07-27'
  },
  {
    id: 'RFQ-004',
    projectId: 'PRJ-103',
    title: 'RFQ Transportasi Bandara — Grup VIP Tambahan',
    serviceType: 'transportation',
    status: 'closed',
    lineItems: [{ description: 'Airport transfer VIP (sedan eksekutif)', quantity: 4, unit: 'trip' }],
    dueAt: '2026-07-10',
    selectedVendorId: 'VND-003',
    notes: 'Kebutuhan transfer VIP terpisah dari Ground Transportation rombongan utama (SVC-1034).',
    createdBy: 'USR-002',
    createdAt: '2026-06-28',
    updatedAt: '2026-07-12',
    closedAt: '2026-07-12'
  }
])

export const RFQ_INVITATIONS: RFQInvitation[] = reactive([
  { id: 'RFQINV-001', rfqId: 'RFQ-002', vendorId: 'VND-004', status: 'responded', invitedAt: '2026-07-18' },
  { id: 'RFQINV-002', rfqId: 'RFQ-002', vendorId: 'VND-007', status: 'responded', invitedAt: '2026-07-18' },
  { id: 'RFQINV-003', rfqId: 'RFQ-003', vendorId: 'VND-002', status: 'responded', invitedAt: '2026-07-20' },
  { id: 'RFQINV-004', rfqId: 'RFQ-003', vendorId: 'VND-006', status: 'responded', invitedAt: '2026-07-20' },
  { id: 'RFQINV-005', rfqId: 'RFQ-004', vendorId: 'VND-003', status: 'responded', invitedAt: '2026-06-28' },
  { id: 'RFQINV-006', rfqId: 'RFQ-004', vendorId: 'VND-005', status: 'responded', invitedAt: '2026-06-28' }
])

export const RFQ_RESPONSES: RFQResponse[] = reactive([
  {
    id: 'RFQRESP-001',
    rfqId: 'RFQ-002',
    vendorId: 'VND-004',
    lineItems: [
      { description: 'Dokumentasi foto dan video profesional (2 hari)', unitPriceIdr: 6_500_000, quantity: 2 },
      { description: 'Booth sponsor tambahan', unitPriceIdr: 4_000_000, quantity: 2 }
    ],
    totalAmountIdr: 21_000_000,
    notes: 'Termasuk editing dan highlight reel.',
    status: 'submitted',
    submittedAt: '2026-07-22'
  },
  {
    id: 'RFQRESP-002',
    rfqId: 'RFQ-002',
    vendorId: 'VND-007',
    lineItems: [
      { description: 'Dokumentasi foto dan video profesional (2 hari)', unitPriceIdr: 5_800_000, quantity: 2 },
      { description: 'Booth sponsor tambahan', unitPriceIdr: 4_500_000, quantity: 2 }
    ],
    totalAmountIdr: 20_600_000,
    notes: 'Paket termasuk operator drone untuk shot udara.',
    status: 'submitted',
    submittedAt: '2026-07-24'
  },
  {
    id: 'RFQRESP-003',
    rfqId: 'RFQ-003',
    vendorId: 'VND-002',
    lineItems: [{ description: 'VIP Suite kapasitas 2 pax, aksesibilitas', unitPriceIdr: 3_200_000, quantity: 8 }],
    totalAmountIdr: 25_600_000,
    notes: 'Free upgrade late check-out.',
    status: 'submitted',
    submittedAt: '2026-07-23'
  },
  {
    id: 'RFQRESP-004',
    rfqId: 'RFQ-003',
    vendorId: 'VND-006',
    lineItems: [{ description: 'VIP Suite kapasitas 2 pax, aksesibilitas', unitPriceIdr: 2_900_000, quantity: 8 }],
    totalAmountIdr: 23_200_000,
    notes: 'Harga khusus partner — menunggu konfirmasi kebijakan pembatalan.',
    status: 'submitted',
    submittedAt: '2026-07-26'
  },
  {
    id: 'RFQRESP-005',
    rfqId: 'RFQ-004',
    vendorId: 'VND-003',
    lineItems: [{ description: 'Airport transfer VIP (sedan eksekutif)', unitPriceIdr: 850_000, quantity: 4 }],
    totalAmountIdr: 3_400_000,
    status: 'selected',
    submittedAt: '2026-07-02'
  },
  {
    id: 'RFQRESP-006',
    rfqId: 'RFQ-004',
    vendorId: 'VND-005',
    lineItems: [{ description: 'Airport transfer VIP (sedan eksekutif)', unitPriceIdr: 950_000, quantity: 4 }],
    totalAmountIdr: 3_800_000,
    status: 'rejected',
    submittedAt: '2026-07-03'
  }
])

/** Thread klarifikasi RFQ-003 dengan PT ABC (VND-006) — dua arah, menjaga status RFQ tetap `clarification` sampai terjawab. */
export const RFQ_CLARIFICATIONS: RFQClarificationMessage[] = reactive([
  { id: 'RFQCLR-001', rfqId: 'RFQ-003', vendorId: 'VND-006', from: 'procurement', message: 'Mohon konfirmasi kebijakan pembatalan/no-show untuk harga khusus partner yang diajukan.', createdAt: '2026-07-27' },
  { id: 'RFQCLR-002', rfqId: 'RFQ-003', vendorId: 'VND-006', from: 'supplier', message: 'Pembatalan H-3 dikenakan penalti 20%, di bawah H-3 dikenakan 50%. Akan kami kirimkan dokumen kebijakan resmi.', createdAt: '2026-07-28' }
])

/**
 * Service Order. `SO-001` hasil formal dari RFQ-004 (selected → Service Order, `fulfilled`) — internal cost
 * isolation sama seperti section 13-16 (`netCostIdr` tidak pernah tampil di Supplier Portal). `SO-002` adalah
 * engagement langsung (tanpa RFQ) dengan PT ABC untuk PRJ-102, sudah `amended` (upgrade tipe kamar) — bersama
 * `SO-001` mendemokan "one plain, one amended" sesuai kebutuhan literal.
 */
export const SERVICE_ORDERS: ServiceOrder[] = reactive([
  {
    id: 'SO-001',
    rfqId: 'RFQ-004',
    vendorId: 'VND-003',
    projectId: 'PRJ-103',
    lineItems: [{ description: 'Airport transfer VIP (sedan eksekutif)', quantity: 4, unit: 'trip' }],
    status: 'fulfilled',
    netCostIdr: 3_400_000,
    sellPriceIdr: 4_200_000,
    acknowledgedAt: '2026-07-13',
    fulfilledAt: '2026-08-11',
    createdAt: '2026-07-12',
    updatedAt: '2026-08-11'
  },
  {
    id: 'SO-002',
    vendorId: 'VND-006',
    projectId: 'PRJ-102',
    lineItems: [{ description: 'Kamar Deluxe upgrade ke Suite (rooming tambahan)', quantity: 2, unit: 'kamar/4 malam' }],
    status: 'amended',
    netCostIdr: 9_600_000,
    sellPriceIdr: 12_000_000,
    acknowledgedAt: '2026-07-05',
    createdAt: '2026-07-01',
    updatedAt: '2026-07-19'
  },
  /**
   * SO-101F/SO-205T/SO-205H — MENAUTKAN `serviceId` ke `ProjectService` (`app/data/projects.ts`), berbeda dari
   * SO-001/SO-002 di atas yang sengaja tidak menaut (lihat komentar `RFQS`). Dibuat khusus supaya "Pengeluaran
   * per Layanan" (tab Finance Project Order, `getServiceTypeSpendBreakdown`) punya data nyata untuk didemokan
   * — traceability SupplierInvoice→tipe layanan lewat `ServiceOrder.serviceId` sebelumnya nol data sama sekali.
   */
  {
    id: 'SO-101F',
    vendorId: 'VND-001',
    projectId: 'PRJ-101',
    serviceId: 'SVC-1011',
    lineItems: [{ description: 'Tiket pesawat rombongan Jakarta–Manila (6 pax)', quantity: 6, unit: 'tiket' }],
    status: 'fulfilled',
    netCostIdr: 90_000_000,
    sellPriceIdr: 92_000_000,
    acknowledgedAt: '2026-06-18',
    fulfilledAt: '2026-06-20',
    createdAt: '2026-06-16',
    updatedAt: '2026-06-20'
  },
  {
    id: 'SO-205T',
    vendorId: 'VND-003',
    projectId: 'PRJ-205',
    serviceId: 'SVC-2051',
    lineItems: [{ description: 'Bus pariwisata 4D3N (rombongan)', quantity: 1, unit: 'unit/4 hari' }],
    status: 'acknowledged',
    netCostIdr: 8_000_000,
    sellPriceIdr: 9_600_000,
    acknowledgedAt: '2026-08-15',
    createdAt: '2026-08-14',
    updatedAt: '2026-08-15'
  },
  {
    id: 'SO-205H',
    vendorId: 'VND-002',
    projectId: 'PRJ-205',
    serviceId: 'SVC-2052',
    lineItems: [{ description: 'Homestay Bromo View — 2 kamar/1 malam', quantity: 2, unit: 'kamar/1 malam' }],
    status: 'acknowledged',
    netCostIdr: 12_000_000,
    sellPriceIdr: 14_000_000,
    acknowledgedAt: '2026-08-19',
    createdAt: '2026-08-18',
    updatedAt: '2026-08-19'
  }
])

export const SERVICE_ORDER_AMENDMENTS: ServiceOrderAmendment[] = reactive([
  { id: 'SOA-001', serviceOrderId: 'SO-002', reason: 'Upgrade tipe kamar dari Deluxe ke Suite atas permintaan klien — penyesuaian harga net cost dan sell price.', changedAt: '2026-07-19', changedBy: 'USR-002' }
])

/**
 * Supplier Invoice — preview/mock murni (larangan protokol: tidak ada payment gateway/processing nyata).
 * Merentang seluruh status literal: `SINV-001` (approved, pembayaran final SO-001), `SINV-002` (under-review,
 * biaya tol tambahan SO-001), `SINV-003` (rejected, submission pertama SO-002 — jumlah tidak sesuai amendment),
 * `SINV-004` (submitted, submission ulang SO-002 setelah koreksi) — resolusi Q12 (`docs/mockup-open-questions.md`).
 *
 * `paymentScheduleDate`/`matchStatus` (Section 20 — Project Finance, roadmap Section 00–24 baru, aditif):
 * `SINV-001` (`approved`) → `matched` + `paymentScheduleDate` terjadwal (AP siap dibayar). `SINV-002`
 * (`under-review`) → `unmatched` (mendemokan reconciliation workspace `/finance/reconciliation`). `SINV-003`
 * (`rejected`) → TIDAK diisi (moot, tidak relevan direkonsiliasi). `SINV-004` (`submitted`) → `disputed`
 * (mendemokan state ketiga reconciliation — jumlah sesuai submission tapi menunggu konfirmasi pajak
 * terpisah dari vendor).
 */
export const SUPPLIER_INVOICES: SupplierInvoice[] = reactive([
  { id: 'SINV-001', serviceOrderId: 'SO-001', vendorId: 'VND-003', amountIdr: 4_200_000, submittedAt: '2026-08-11', status: 'approved', note: 'Invoice final airport transfer VIP.', reviewedAt: '2026-08-12', reviewedBy: 'USR-002', matchStatus: 'matched', paymentScheduleDate: '2026-08-20' },
  { id: 'SINV-002', serviceOrderId: 'SO-001', vendorId: 'VND-003', amountIdr: 450_000, submittedAt: '2026-08-12', status: 'under-review', note: 'Biaya tol tambahan rute bandara alternatif.', matchStatus: 'unmatched' },
  { id: 'SINV-003', serviceOrderId: 'SO-002', vendorId: 'VND-006', amountIdr: 11_000_000, submittedAt: '2026-07-08', status: 'rejected', note: 'Invoice awal sebelum amendment.', reviewedAt: '2026-07-19', reviewedBy: 'USR-002', reviewNote: 'Jumlah belum sesuai amendment upgrade Suite (SOA-001) — mohon submit ulang dengan nominal terbaru.' },
  { id: 'SINV-004', serviceOrderId: 'SO-002', vendorId: 'VND-006', amountIdr: 12_000_000, submittedAt: '2026-07-20', status: 'submitted', note: 'Submission ulang mengikuti amendment SOA-001.', matchStatus: 'disputed' },
  /** SINV-101F/SINV-205T/SINV-205H — pasangan SO-101F/SO-205T/SO-205H di atas, `approved` supaya ikut terhitung `getProjectActualCostIdr`/`getServiceTypeSpendBreakdown`. */
  { id: 'SINV-101F', serviceOrderId: 'SO-101F', vendorId: 'VND-001', amountIdr: 90_000_000, submittedAt: '2026-06-20', status: 'approved', note: 'Invoice final tiket pesawat rombongan Jakarta–Manila.', reviewedAt: '2026-06-21', reviewedBy: 'USR-002', matchStatus: 'matched', paymentScheduleDate: '2026-07-01' },
  { id: 'SINV-205T', serviceOrderId: 'SO-205T', vendorId: 'VND-003', amountIdr: 8_000_000, submittedAt: '2026-08-15', status: 'approved', note: 'Invoice bus pariwisata 4D3N.', reviewedAt: '2026-08-16', reviewedBy: 'USR-002', matchStatus: 'matched', paymentScheduleDate: '2026-09-04' },
  { id: 'SINV-205H', serviceOrderId: 'SO-205H', vendorId: 'VND-002', amountIdr: 12_000_000, submittedAt: '2026-08-19', status: 'approved', note: 'Invoice homestay Bromo View.', reviewedAt: '2026-08-20', reviewedBy: 'USR-002', matchStatus: 'matched', paymentScheduleDate: '2026-09-04' }
])
