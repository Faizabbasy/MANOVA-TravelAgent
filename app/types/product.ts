import type { ID } from './common'
import type { ServiceTypeKey } from './project'

/**
 * Product Planning dan Costing. Dua entitas baru: `ProductTemplate` (paket/product template — reusable,
 * tidak terikat satu Lead) dan `CostSheet` (perhitungan biaya konkret, traveler-based, boleh berdiri
 * sendiri atau terhubung ke satu Lead/Product Template). Keduanya TERPISAH dari `Quotation`
 * (`app/types/quotation.ts`) — `Quotation` tetap dokumen komersial client-facing (setelah sanitasi),
 * `CostSheet` adalah kerja internal Product Planner yang tidak pernah ditampilkan ke Client (lihat
 * `applyCostSheetToQuotation`, `app/data/index.ts`, untuk mekanisme snapshot).
 */

export type ProductTemplateStatus = 'draft' | 'active' | 'archived'

/**
 * Service alternative (Wajib "Service alternatives") — embedded array pada `ProductTemplate`, pola sama
 * `QuotationServiceItem` (`app/types/quotation.ts`): opsi layanan yang dibandingkan Planner sebelum
 * dituangkan ke Cost Sheet, mis. "Hotel bintang 3" vs "Hotel bintang 5" untuk service yang sama.
 */
export interface ProductServiceAlternative {
  service: ServiceTypeKey
  label: string
  costPerPaxIdr: number
  isRecommended?: boolean
  notes?: string
}

export interface ProductTemplate {
  id: ID
  name: string
  destination: string
  serviceScope: ServiceTypeKey[]
  status: ProductTemplateStatus
  /** "Itinerary concept" (Wajib) — ringkasan konsep perjalanan, bukan daily itinerary detail (itu milik `ItineraryItem` Section 12, dibuat setelah Project ada). */
  itineraryConcept?: string
  serviceAlternatives: ProductServiceAlternative[]
  inclusions?: string
  exclusions?: string
  assumptions?: string
  validityStart?: string
  validityEnd?: string
  /** Basis traveler-based costing default saat Cost Sheet dibuat dari template ini. */
  basePaxCount: number
  createdBy: ID
  createdAt: string
  updatedAt?: string
}

export type CostSheetStatus = 'draft' | 'final'

/** Satu baris komponen biaya per-pax (Wajib "Cost sheet, traveler-based costing") — embedded array, pola sama `QuotationServiceItem`. */
export interface CostSheetLineItem {
  service: ServiceTypeKey
  description?: string
  costPerPaxIdr: number
}

export interface CostSheet {
  id: ID
  /** Nama/label skenario (Wajib "Scenario/version comparison") — mis. "Economy Scenario", "Premium Scenario". Beberapa Cost Sheet dengan `leadId` yang sama merepresentasikan skenario berbeda untuk dibandingkan. */
  name: string
  /** Opsional — Cost Sheet boleh dibuat lepas dari Product Template (custom, dari nol). */
  productId?: ID
  /** Opsional — Cost Sheet boleh dibuat sebagai referensi katalog murni, belum terikat Lead manapun. */
  leadId?: ID
  travelerCount: number
  /** Default `IDR`, mockup — bukan multi-currency nyata (konsisten `Quotation.currency`). */
  currency: string
  lineItems: CostSheetLineItem[]
  markupPercent: number
  taxPercent: number
  contingencyPercent: number
  status: CostSheetStatus
  /** Versi (Wajib "Scenario/version comparison") — pola sama `Quotation.version`, dinaikkan lewat "Duplicate as New Version". */
  version: number
  supersededTotalSellIdr?: number
  inclusions?: string
  exclusions?: string
  assumptions?: string
  validityStart?: string
  validityEnd?: string
  notes?: string
  createdBy: ID
  createdAt: string
  updatedAt?: string
  /**
   * Snapshot konsep (Wajib "Snapshot konsep ketika dipakai pada quotation/project") — begitu diisi, Cost
   * Sheet ini dianggap sudah "dipakai" (status otomatis `final`, tidak dapat diedit lagi — lihat
   * `updateCostSheet`/`applyCostSheetToQuotation`). Revisi lanjutan wajib lewat "Duplicate as New Version".
   */
  appliedToQuotationId?: ID
  appliedAt?: string
}
