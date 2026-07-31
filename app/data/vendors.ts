import { reactive } from 'vue'
import type { Vendor, VendorContact, VendorQuotation, VendorActivity, VendorProduct, VendorDocument } from '~/types/vendor'

/**
 * `reactive()` (Section 13) — melanjutkan pola Section 07/08/09/10/11/12. Tambah vendor/contact/quotation
 * baru harus langsung terlihat di `/vendors`, Vendor Detail, dan tab "Vendors" Project Detail tanpa reload.
 */

/**
 * docs/mockup-data-scenarios.md bagian 0.2 — nama fiktif, bukan brand nyata (D-006). VND-006/VND-007
 * (Prompt 19 — Change Request) adalah 2 contoh supplier company External Partners: masing-masing punya
 * supplier user sendiri (`app/data/users.ts` USR-015/016, terisolasi via `User.vendorId`) dan katalog
 * produk/layanan berbeda (`VENDOR_PRODUCTS` di bawah) — bukan sekadar vendor tambahan biasa.
 */
/** `category`/`status` (Section 17) — field aditif, seluruh vendor existing di-backfill `status: 'active'` (regression-safe, tidak ada vendor lama yang berubah perilaku tampilan list/detail). */
export const VENDORS: Vendor[] = reactive([
  { id: 'VND-001', name: 'CV Tiket Mitra Nusantara', serviceType: 'flight', contactName: 'Yusuf Maulana', category: 'Flight Consolidator', status: 'active' },
  { id: 'VND-002', name: 'Hotel Prima Mitra', serviceType: 'hotel', contactName: 'Rina Kartika', category: 'Hotel Full-Service', status: 'active' },
  { id: 'VND-003', name: 'Trans Wahana Logistik', serviceType: 'transportation', contactName: 'Bimo Saputro', category: 'Ground Transportation', status: 'active' },
  { id: 'VND-004', name: 'Cendana MICE Organizer', serviceType: 'mice', contactName: 'Wulan Permatasari', category: 'MICE Full-Service', status: 'active' },
  { id: 'VND-005', name: 'CV Wisata Kargo Ekspres', serviceType: 'transportation', contactName: 'Agus Salim', category: 'Ground Transportation', status: 'pending' },
  { id: 'VND-006', name: 'PT ABC', serviceType: 'hotel', contactName: 'Hasan Alfarizi', category: 'Hotel Budget', status: 'active' },
  { id: 'VND-007', name: 'PT EFG', serviceType: 'mice', contactName: 'Ika Puspitasari', category: 'MICE Vendor Package', status: 'active' },
])

/** Dokumen vendor (Section 17) — preview mock (bukan file upload nyata, D-006), dipakai tab "Documents" Vendor Detail. */
export const VENDOR_DOCUMENTS: VendorDocument[] = reactive([
  { id: 'VDOC-001', vendorId: 'VND-002', name: 'Kontrak Kerjasama Hotel Prima Mitra 2026.pdf', type: 'Kontrak', uploadedAt: '2026-05-02' },
  { id: 'VDOC-002', vendorId: 'VND-003', name: 'NPWP Trans Wahana Logistik.pdf', type: 'NPWP', uploadedAt: '2026-04-18' },
  { id: 'VDOC-003', vendorId: 'VND-006', name: 'Kontrak Kerjasama PT ABC 2026.pdf', type: 'Kontrak', uploadedAt: '2026-06-01' },
  { id: 'VDOC-004', vendorId: 'VND-006', name: 'Sertifikat Standar Layanan PT ABC.pdf', type: 'Sertifikasi', uploadedAt: '2026-06-01' },
  { id: 'VDOC-005', vendorId: 'VND-007', name: 'Kontrak Kerjasama PT EFG 2026.pdf', type: 'Kontrak', uploadedAt: '2026-06-05' },
])

/** Backfill 1 contact per vendor dari `Vendor.contactName` existing (Foundation) — bukan data baru, hanya diberi wadah tab "Contacts". */
export const VENDOR_CONTACTS: VendorContact[] = reactive([
  { id: 'VCT-001', vendorId: 'VND-001', name: 'Yusuf Maulana', title: 'Account Manager', phone: '0821-1000-0001' },
  { id: 'VCT-002', vendorId: 'VND-002', name: 'Rina Kartika', title: 'Sales Manager', phone: '0821-1000-0002' },
  { id: 'VCT-003', vendorId: 'VND-003', name: 'Bimo Saputro', title: 'Operations Manager', phone: '0821-1000-0003' },
  { id: 'VCT-004', vendorId: 'VND-004', name: 'Wulan Permatasari', title: 'Event Coordinator', phone: '0821-1000-0004' },
  { id: 'VCT-005', vendorId: 'VND-005', name: 'Agus Salim', title: 'Account Manager', phone: '0821-1000-0005' },
  { id: 'VCT-006', vendorId: 'VND-006', name: 'Hasan Alfarizi', title: 'Partnership Manager', phone: '0821-1000-0006' },
  { id: 'VCT-007', vendorId: 'VND-007', name: 'Ika Puspitasari', title: 'Partnership Manager', phone: '0821-1000-0007' },
])

/**
 * Product/service catalog (Prompt 19) — PT ABC menjual paket akomodasi, PT EFG menjual paket MICE/event,
 * kategori produk berbeda sesuai instruksi literal ("masing-masing supplier harus... memiliki produk atau
 * layanan yang berbeda"). Dipakai tab "Products" Vendor Detail dan `/supplier/products` (self-service,
 * discope `vendorId` via `usePermissions().vendorScopeId`).
 */
export const VENDOR_PRODUCTS: VendorProduct[] = reactive([
  { id: 'VPR-001', vendorId: 'VND-006', name: 'Paket Kamar Deluxe (per malam)', category: 'hotel', description: 'Kamar deluxe kapasitas 2 pax, termasuk sarapan.', priceIdr: 1_200_000 },
  { id: 'VPR-002', vendorId: 'VND-006', name: 'Paket Meeting Room Half-Day', category: 'hotel', description: 'Ruang meeting kapasitas 20 pax, coffee break 1x.', priceIdr: 3_500_000 },
  { id: 'VPR-003', vendorId: 'VND-007', name: 'Paket Venue Konferensi (per hari)', category: 'mice', description: 'Venue kapasitas 100 pax lengkap sound system.', priceIdr: 25_000_000 },
  { id: 'VPR-004', vendorId: 'VND-007', name: 'Paket Event Organizer Full-Service', category: 'mice', description: 'Koordinasi acara end-to-end, termasuk rundown dan dokumentasi.', priceIdr: 45_000_000 },
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
