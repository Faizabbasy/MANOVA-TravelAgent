import type { ID } from './common'
import type { ServiceTypeKey } from './project'

/**
 * Commercial Approval. Status approval quotation — quotation harus `approved` sebelum "Mark as Won" bisa
 * ditekan (`markLeadWon`, `app/data/index.ts`). `draft` = belum pernah diajukan (nilai awal seluruh
 * quotation baru).
 */
export type QuotationApprovalStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

/** Satu baris service breakdown Quotation, diisi AE lewat "Edit Quotation". */
export interface QuotationServiceItem {
  service: ServiceTypeKey
  description?: string
  amountIdr: number
}

export interface Quotation {
  id: ID
  /** Lead pemilik quotation ini — satu Lead punya paling banyak satu Quotation aktif (lihat `Lead.quotationId`). */
  leadId: ID
  amountIdr: number
  createdAt: string
  accepted: boolean
  /** Nomor versi — "quotation version mock" ringan, bukan histori penuh per versi. */
  version: number
  /** Nilai versi sebelumnya, terisi hanya bila quotation ini adalah hasil revisi. */
  supersededAmountIdr?: number
  /** Commercial approval workflow (AE submit → Management approve/reject). */
  approvalStatus?: QuotationApprovalStatus
  approvedBy?: ID
  approvalNote?: string

  /** Detail komersial, diisi AE lewat "Edit Quotation" (draft, sebelum submit). */
  discountIdr?: number
  estimatedCostIdr?: number
  estimatedMarginIdr?: number
  paymentTerms?: string
  serviceBreakdown?: QuotationServiceItem[]

  /** Field komersial tambahan (line items sudah ada di `serviceBreakdown`), "PDF/print preview" (`/crm/leads/[id]/quotation-preview`), dan "send mock ke client". */
  taxIdr?: number
  markupIdr?: number
  /** Default `IDR` bila kosong — mockup, bukan multi-currency nyata (tidak ada konversi kurs). */
  currency?: string
  validUntil?: string
  termsAndConditions?: string
  inclusions?: string
  exclusions?: string
  /** "Send mock ke client" — timestamp simulasi, TIDAK mengirim email/WA nyata. */
  sentToClientAt?: string

  /**
   * Dua field naratif aditif untuk halaman client "Quotations & Proposals". Free-text, pola sama
   * `termsAndConditions`/`inclusions`/`exclusions` — TIDAK menambah entitas itinerary baru (itinerary
   * sungguhan tetap `ItineraryItem`/`ItineraryVersion`, project-scoped, belum ada pra-Project; field ini
   * murni ringkasan naratif AE untuk tahap proposal).
   */
  cancellationPolicy?: string
  proposedItineraryNote?: string

  /**
   * Product Planning dan Costing. Referensi Cost Sheet yang dipakai membentuk quotation ini (lihat
   * `applyCostSheetToQuotation`, `app/data/index.ts`) — traceability collaboration Product Planner↔AE,
   * TIDAK menggantikan `estimatedCostIdr`/`estimatedMarginIdr` yang tetap disalin (snapshot) ke field di
   * atas agar Quotation tetap berdiri sendiri meski Cost Sheet sumber kelak direvisi.
   */
  costSheetId?: ID
}

/**
 * Quotation attachment/comment mock. Entitas kecil berdiri sendiri (BUKAN `Document`/`Message`,
 * `app/types/document-comms.ts`) karena modul `documents` sengaja masih `ROLE_MODULE_ACCESS.client.documents:
 * 'NONE'` sampai section "Collaboration" mengaudit ulang visibilitasnya. Pola sama `TravelRequestAttachment`.
 */
export interface QuotationAttachment {
  id: ID
  quotationId: ID
  fileName: string
  uploadedAt: string
  uploadedBy: ID
}

export interface QuotationComment {
  id: ID
  quotationId: ID
  authorId: ID
  body: string
  createdAt: string
}
