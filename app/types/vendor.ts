import type { ID } from './common'
import type { ServiceTypeKey } from './project'

export interface Vendor {
  id: ID
  name: string
  serviceType: ServiceTypeKey
  contactName: string
  contactPhone?: string
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

/** Tab identifiers Vendor Detail (docs/mockup-information-architecture.md bagian 3.6, LOCKED — 4 tab). */
export type VendorDetailTab = 'overview' | 'services' | 'quotations' | 'contacts'
