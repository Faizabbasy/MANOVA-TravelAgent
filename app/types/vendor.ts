import type { ID } from './common'
import type { ServiceTypeKey } from './project'

/**
 * `category`/`status`/`documents` (Section 17 — Supplier dan Procurement, roadmap Section 00–24 baru) —
 * field ADITIF pada `Vendor` existing (Section 13 lama), TIDAK menggantikan `serviceType` (tetap dipakai
 * luas sejak Foundation untuk kategori layanan generik). `category` adalah label bebas yang lebih granular
 * (mis. "hotel-budget", "mice-full-service") untuk kebutuhan RFQ/sourcing Procurement — opsional, boleh
 * kosong untuk vendor lama. `status` merepresentasikan lifecycle vendor sebagai partner (aktif/nonaktif/
 * pending approval) — TERPISAH dari `VendorQuotationStatus` (per-quotation) dan `ServiceStatus` (per-service).
 */
export type VendorStatus = 'active' | 'inactive' | 'pending'

/** Dokumen vendor (Section 17) — kontrak, sertifikasi, NPWP, dsb., preview mock (bukan file upload nyata, D-006). */
export interface VendorDocument {
  id: ID
  vendorId: ID
  name: string
  type: string
  uploadedAt: string
}

export interface Vendor {
  id: ID
  name: string
  serviceType: ServiceTypeKey
  contactName: string
  contactPhone?: string
  /** Kategori sourcing granular (Section 17, opsional aditif) — mis. "Hotel Budget", "MICE Full-Service". */
  category?: string
  /** Lifecycle vendor sebagai partner (Section 17, opsional aditif — default diperlakukan sebagai `active` bila kosong, regression-safe untuk vendor existing). */
  status?: VendorStatus
  documents?: VendorDocument[]
}

/** Vendor Detail (Section 13) — tab "Contacts", multiple contact per vendor (Vendor.contactName tetap dipertahankan sebagai ringkasan cepat di list). */
export interface VendorContact {
  id: ID
  vendorId: ID
  name: string
  title: string
  email?: string
  phone?: string
}

export type VendorQuotationStatus = 'submitted' | 'accepted' | 'rejected'

/**
 * Vendor Quotation (Section 13) — terhubung ke Project/Service (hard rule), `serviceId` merujuk
 * `ProjectService` existing (Section 05/12) bila sudah ada baris service konkret, bukan data paralel.
 */
export interface VendorQuotation {
  id: ID
  vendorId: ID
  projectId: ID
  serviceId?: ID
  serviceType: ServiceTypeKey
  amountIdr: number
  status: VendorQuotationStatus
  submittedAt: string
  notes?: string
}

/** Activity/history vendor (Section 13) — mengikuti pola `PartyActivity` (Section 07), entitas terpisah scoped ke Vendor. */
export interface VendorActivity {
  id: ID
  vendorId: ID
  message: string
  createdAt: string
}

/** Tab identifiers Vendor Detail — 4 tab LOCKED (docs/mockup-information-architecture.md bagian 3.6) + `products` (Prompt 19, Change Request — katalog produk/layanan supplier) + `documents` (Section 17 — dokumen vendor, preview mock). */
export type VendorDetailTab = 'overview' | 'services' | 'quotations' | 'contacts' | 'products' | 'documents'

/**
 * Product/service catalog (Prompt 19 — Change Request, area Supplier/External Partners). Satu vendor
 * company dapat menjual beberapa produk/layanan berbeda — dipakai tab "Products" Vendor Detail dan
 * halaman `/supplier/products` (portal supplier, discope ke `vendorId` milik sendiri via `usePermissions`).
 */
export interface VendorProduct {
  id: ID
  vendorId: ID
  name: string
  category: ServiceTypeKey
  description?: string
  priceIdr?: number
}
