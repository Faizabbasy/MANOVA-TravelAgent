import { reactive } from 'vue'
import type { Vendor, VendorContact, VendorQuotation, VendorActivity } from '~/types/vendor'

/**
 * `reactive()` (Section 13) — melanjutkan pola Section 07/08/09/10/11/12. Tambah vendor/contact/quotation
 * baru harus langsung terlihat di `/vendors`, Vendor Detail, dan tab "Vendors" Project Detail tanpa reload.
 */

/** docs/mockup-data-scenarios.md bagian 0.2 — nama fiktif, bukan brand nyata (D-006). */
export const VENDORS: Vendor[] = reactive([
  { id: 'VND-001', name: 'CV Tiket Mitra Nusantara', serviceType: 'flight', contactName: 'Yusuf Maulana' },
  { id: 'VND-002', name: 'Hotel Prima Mitra', serviceType: 'hotel', contactName: 'Rina Kartika' },
  { id: 'VND-003', name: 'Trans Wahana Logistik', serviceType: 'transportation', contactName: 'Bimo Saputro' },
  { id: 'VND-004', name: 'Cendana MICE Organizer', serviceType: 'mice', contactName: 'Wulan Permatasari' },
  { id: 'VND-005', name: 'CV Wisata Kargo Ekspres', serviceType: 'transportation', contactName: 'Agus Salim' },
])

/** Backfill 1 contact per vendor dari `Vendor.contactName` existing (Foundation) — bukan data baru, hanya diberi wadah tab "Contacts". */
export const VENDOR_CONTACTS: VendorContact[] = reactive([
  { id: 'VCT-001', vendorId: 'VND-001', name: 'Yusuf Maulana', title: 'Account Manager', phone: '0821-1000-0001' },
  { id: 'VCT-002', vendorId: 'VND-002', name: 'Rina Kartika', title: 'Sales Manager', phone: '0821-1000-0002' },
  { id: 'VCT-003', vendorId: 'VND-003', name: 'Bimo Saputro', title: 'Operations Manager', phone: '0821-1000-0003' },
  { id: 'VCT-004', vendorId: 'VND-004', name: 'Wulan Permatasari', title: 'Event Coordinator', phone: '0821-1000-0004' },
  { id: 'VCT-005', vendorId: 'VND-005', name: 'Agus Salim', title: 'Account Manager', phone: '0821-1000-0005' },
])

/**
 * Vendor Quotation (Section 13) — `serviceId` merujuk `ProjectService` existing (Section 05/12), BUKAN
 * fixture service paralel (hard rule "jangan menggandakan service fixture"). Mayoritas sudah `accepted`
 * (merefleksikan service yang sudah `confirmed`/`changed` di fixture), kecuali VQ-009/VQ-010 — dua quotation
 * bersaing untuk `SVC-1034` (Ground Transportation, PRJ-103, masih `pending-confirmation`) dari VND-003
 * (vendor yang sudah ditugaskan) vs VND-005 (kompetitor, sama-sama tipe `transportation`) — skenario
 * comparison konkret yang belum diputuskan, siap didemokan lewat aksi Accept di tab Vendors Project Detail.
 */
export const VENDOR_QUOTATIONS: VendorQuotation[] = reactive([
  { id: 'VQ-001', vendorId: 'VND-001', projectId: 'PRJ-101', serviceId: 'SVC-1011', serviceType: 'flight', amountIdr: 90_000_000, status: 'accepted', submittedAt: '2026-06-15' },
  { id: 'VQ-002', vendorId: 'VND-001', projectId: 'PRJ-102', serviceId: 'SVC-1021', serviceType: 'flight', amountIdr: 205_000_000, status: 'accepted', submittedAt: '2026-06-10' },
  { id: 'VQ-003', vendorId: 'VND-002', projectId: 'PRJ-102', serviceId: 'SVC-1022', serviceType: 'hotel', amountIdr: 140_000_000, status: 'accepted', submittedAt: '2026-06-12', notes: 'Direvisi setelah upgrade tipe kamar ke Suite' },
  { id: 'VQ-004', vendorId: 'VND-001', projectId: 'PRJ-103', serviceId: 'SVC-1031', serviceType: 'flight', amountIdr: 250_000_000, status: 'accepted', submittedAt: '2026-06-08' },
  { id: 'VQ-005', vendorId: 'VND-002', projectId: 'PRJ-103', serviceId: 'SVC-1033', serviceType: 'hotel', amountIdr: 400_000_000, status: 'accepted', submittedAt: '2026-06-08' },
  { id: 'VQ-006', vendorId: 'VND-004', projectId: 'PRJ-103', serviceId: 'SVC-1035', serviceType: 'mice', amountIdr: 280_000_000, status: 'accepted', submittedAt: '2026-06-08' },
  { id: 'VQ-007', vendorId: 'VND-001', projectId: 'PRJ-103', serviceId: 'SVC-1032', serviceType: 'flight', amountIdr: 150_000_000, status: 'submitted', submittedAt: '2026-07-20', notes: 'Flight Batch 2 (Grup VIP), menunggu konfirmasi vendor' },
  { id: 'VQ-008', vendorId: 'VND-002', projectId: 'PRJ-102', serviceId: 'SVC-1023', serviceType: 'hotel', amountIdr: 25_000_000, status: 'rejected', submittedAt: '2026-06-05', notes: 'Room Block B — dibatalkan setelah konsolidasi ke Block A' },
  { id: 'VQ-009', vendorId: 'VND-003', projectId: 'PRJ-103', serviceId: 'SVC-1034', serviceType: 'transportation', amountIdr: 45_000_000, status: 'submitted', submittedAt: '2026-07-15', notes: '10 unit bus pariwisata, sudah termasuk sopir' },
  { id: 'VQ-010', vendorId: 'VND-005', projectId: 'PRJ-103', serviceId: 'SVC-1034', serviceType: 'transportation', amountIdr: 52_000_000, status: 'submitted', submittedAt: '2026-07-16', notes: 'Termasuk asuransi perjalanan tambahan untuk seluruh peserta' },
])

/** Activity/history vendor (Section 13) — seed awal mengikuti riwayat quotation `accepted`/`rejected`; entri baru ditambahkan otomatis saat Accept/Reject dijalankan dari tab Vendors Project Detail. */
export const VENDOR_ACTIVITIES: VendorActivity[] = reactive([
  { id: 'VACT-001', vendorId: 'VND-001', message: 'Quotation Flight untuk PRJ-101 diterima.', createdAt: '2026-06-16' },
  { id: 'VACT-002', vendorId: 'VND-002', message: 'Quotation Hotel untuk PRJ-102 direvisi setelah upgrade tipe kamar.', createdAt: '2026-06-13' },
  { id: 'VACT-003', vendorId: 'VND-002', message: 'Quotation Room Block B (PRJ-102) ditolak — dikonsolidasi ke Block A.', createdAt: '2026-06-06' },
  { id: 'VACT-004', vendorId: 'VND-003', message: 'Mengajukan quotation Ground Transportation untuk PRJ-103.', createdAt: '2026-07-15' },
  { id: 'VACT-005', vendorId: 'VND-005', message: 'Mengajukan quotation kompetitor untuk Ground Transportation PRJ-103.', createdAt: '2026-07-16' },
])
