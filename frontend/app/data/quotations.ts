import { reactive } from 'vue'
import type { Quotation } from '~/types/quotation'

/**
 * `reactive()` — halaman detail Lead butuh submit Won, buat/revisi Quotation — seluruhnya mutasi runtime
 * yang harus ter-propagate ke Dashboard/Party Detail/CRM overview tanpa reload.
 *
 * `leadId` di bawah menaut ke `LEADS` (`app/data/leads.ts`) — setiap Quotation historis di sini punya Lead
 * pasangannya sendiri (deal record 1:1, bukan lagi Opportunity terpisah). Repeat business dari company yang
 * sama (mis. PTY-001/Hendra Wijaya muncul di LED-009/LED-016/LED-018) sengaja direpresentasikan sebagai Lead
 * BERBEDA per deal, bukan satu Lead dipakai ulang — konsisten dengan makna Lead sebagai satu deal record.
 *
 * `approvalStatus` — commercial approval quotation, aditif. QUO-001/002/003 di-backfill `approved`
 * (Lead-nya sudah Won, secara historis nilai komersialnya jelas sudah disetujui). QUO-004 (deal batal)
 * dibiarkan tanpa `approvalStatus` (`draft`, default) — deal batal karena alasan klien (budget internal
 * dipotong), bukan penolakan komersial internal Management, jadi tidak tepat ditandai `rejected`.
 */
export const QUOTATIONS: Quotation[] = reactive([
  { id: 'QUO-001', leadId: 'LED-009', amountIdr: 95_000_000, createdAt: '2026-06-25', accepted: true, version: 1, approvalStatus: 'approved', approvedBy: 'USR-003' },
  { id: 'QUO-002', leadId: 'LED-013', amountIdr: 345_000_000, createdAt: '2026-06-20', accepted: true, version: 1, approvalStatus: 'approved', approvedBy: 'USR-003' },
  { id: 'QUO-003', leadId: 'LED-014', amountIdr: 1_400_000_000, createdAt: '2026-06-05', accepted: true, version: 1, approvalStatus: 'approved', approvedBy: 'USR-003' },
  { id: 'QUO-004', leadId: 'LED-015', amountIdr: 45_000_000, createdAt: '2026-06-15', accepted: false, version: 1 },
  // QUO-005 sengaja versi 2 — mendemonstrasikan "quotation version mock": nilai direvisi naik dari estimasi
  // awal Rp 150jt setelah negosiasi menambah cakupan hotel. approvalStatus 'submitted' — skenario "satu
  // quotation menunggu approval".
  { id: 'QUO-005', leadId: 'LED-005', amountIdr: 180_000_000, createdAt: '2026-07-18', accepted: false, version: 2, supersededAmountIdr: 150_000_000, approvalStatus: 'submitted' },
  // approvalStatus 'approved' — skenario "satu quotation approved", siap "Mark as Won" (satu langkah, tidak
  // ada gerbang client-confirmation terpisah lagi). sentToClientAt — sudah dikirim ke client (mock).
  { id: 'QUO-006', leadId: 'LED-016', amountIdr: 60_000_000, createdAt: '2026-07-22', accepted: false, version: 1, approvalStatus: 'approved', approvedBy: 'USR-003', sentToClientAt: '2026-07-23' },
  { id: 'QUO-008', leadId: 'LED-018', amountIdr: 60_000_000, createdAt: '2026-07-15', accepted: true, version: 1, approvalStatus: 'approved', approvedBy: 'USR-003' },
  // QUO-010 — draft lengkap dengan discount/estimated cost/estimated margin/payment terms/service
  // breakdown, `approvalStatus` sengaja tidak diisi (default "draft") — belum pernah di-submit. Dilengkapi
  // field komersial tambahan (tax/markup/currency/validity/terms/inclusions/exclusions) sebagai demo
  // lengkap "Edit Quotation" dan "PDF/Print Preview".
  {
    id: 'QUO-010',
    leadId: 'LED-020',
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
