import type { ID } from './common'
import type { ServiceTypeKey } from './project'

/**
 * Procurement (Section 17 — Supplier dan Procurement, roadmap Section 00–24 baru). Modul top-level BARU
 * `/procurement`, MENDAMPINGI (bukan menggantikan) `/vendors` (Vendor Directory master data, Section 13
 * lama) dan `/supplier` (Supplier Portal self-service, Prompt 19) — pola arsitektur mengikuti preseden
 * D-070/D-071/D-072/D-073 (modul top-level baru untuk lifecycle detail lintas-project, MENDAMPINGI
 * struktur existing, D-020 tetap LOCKED). Entitas di sini (`RFQ`/`ServiceOrder`/`SupplierInvoice`) MEREUSE
 * `Vendor`/`VendorProduct`/`VendorContact` (Section 13 lama) lewat `vendorId` — TIDAK menduplikasi master
 * data vendor. Lihat D-074 (`docs/mockup-design-decisions.md`) untuk rasional lengkap.
 */

/** Lifecycle RFQ formal — dari draft sampai vendor terpilih dan RFQ ditutup. */
export type RFQStatus = 'draft' | 'sent' | 'responses-in' | 'comparison' | 'clarification' | 'selected' | 'closed'

/** Line item kebutuhan RFQ — dikirim ke seluruh vendor yang diundang, dipakai sebagai basis perbandingan harga. */
export interface RFQLineItem {
  description: string
  quantity: number
  unit: string
}

export interface RFQ {
  id: ID
  /** Opsional — RFQ dapat dibuat sebelum project terbentuk (sourcing awal) atau menautkan project existing. */
  projectId?: ID
  title: string
  serviceType: ServiceTypeKey
  status: RFQStatus
  lineItems: RFQLineItem[]
  dueAt?: string
  notes?: string
  /** Diisi begitu status mencapai `selected` — vendor pemenang, reuse `Vendor.id` existing. */
  selectedVendorId?: ID
  /** Reuse `User.id` (role `procurement`). */
  createdBy: ID
  createdAt: string
  updatedAt?: string
  closedAt?: string
}

export type RFQInvitationStatus = 'invited' | 'responded' | 'declined'

/** Vendor yang diundang untuk satu RFQ — reuse `Vendor.id`, bukan entitas Supplier paralel. */
export interface RFQInvitation {
  id: ID
  rfqId: ID
  vendorId: ID
  status: RFQInvitationStatus
  invitedAt: string
}

export interface RFQResponseLineItem {
  description: string
  unitPriceIdr: number
  quantity: number
}

export type RFQResponseStatus = 'submitted' | 'shortlisted' | 'selected' | 'rejected'

/** Respons harga per-vendor terhadap satu RFQ — basis tabel perbandingan side-by-side. */
export interface RFQResponse {
  id: ID
  rfqId: ID
  vendorId: ID
  lineItems: RFQResponseLineItem[]
  totalAmountIdr: number
  notes?: string
  status: RFQResponseStatus
  submittedAt: string
}

/** Thread klarifikasi per-vendor pada satu RFQ — dua arah (`procurement` internal vs `supplier` self-service). */
export interface RFQClarificationMessage {
  id: ID
  rfqId: ID
  vendorId: ID
  from: 'procurement' | 'supplier'
  message: string
  createdAt: string
}

/** Lifecycle Service Order — dari draft sampai fulfilled/cancelled. */
export type ServiceOrderStatus = 'draft' | 'sent' | 'acknowledged' | 'amended' | 'fulfilled' | 'cancelled'

export interface ServiceOrderLineItem {
  description: string
  quantity: number
  unit: string
}

/**
 * Service Order — dokumen formal ke vendor terpilih (dari RFQ atau engagement langsung). Internal cost
 * isolation (hard rule protokol) — `netCostIdr` TIDAK BOLEH tampil di dokumen client-facing atau Supplier
 * Portal manapun; sanitasi identik pola D-070/D-071/D-072/D-073.
 */
export interface ServiceOrder {
  id: ID
  /** Opsional — menautkan balik ke RFQ asal bila Service Order ini adalah hasil seleksi RFQ formal. */
  rfqId?: ID
  vendorId: ID
  projectId?: ID
  /** Opsional — menautkan balik ke `ProjectService` existing (Section 05/12) bila baris generiknya sudah ada. */
  serviceId?: ID
  lineItems: ServiceOrderLineItem[]
  status: ServiceOrderStatus
  netCostIdr?: number
  sellPriceIdr?: number
  acknowledgedAt?: string
  fulfilledAt?: string
  /** Alasan wajib untuk transisi `cancelled` (pola sama section 13-16). */
  statusReason?: string
  createdAt: string
  updatedAt?: string
}

/** Riwayat amendment Service Order — append-only, satu baris per perubahan. */
export interface ServiceOrderAmendment {
  id: ID
  serviceOrderId: ID
  reason: string
  changedAt: string
  /** Reuse `User.id`. */
  changedBy: ID
}

/** Preview/mock murni — TIDAK ADA payment gateway/processing nyata (larangan protokol eksplisit). */
export type SupplierInvoiceStatus = 'submitted' | 'under-review' | 'approved' | 'rejected'

export interface SupplierInvoice {
  id: ID
  serviceOrderId: ID
  vendorId: ID
  amountIdr: number
  submittedAt: string
  status: SupplierInvoiceStatus
  note?: string
  reviewedAt?: string
  /** Reuse `User.id` (role `procurement`/`finance`). */
  reviewedBy?: ID
  reviewNote?: string
}
