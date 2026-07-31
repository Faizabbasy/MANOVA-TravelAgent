import type { ID } from './common'
import type { ServiceTypeKey } from './project'

export type OpportunityStage =
  | 'draft'
  | 'qualification'
  | 'requirement-gathering'
  | 'proposal'
  | 'negotiation'
  | 'won-requested'
  | 'won'
  | 'lost'
  | 'on-hold'

/**
 * Requirement Detail (Prompt 20 — Change Request). Field yang dilengkapi Account Executive di Opportunity
 * Detail (bukan lagi di Lead) — melengkapi/menyempurnakan requirement awal dari Sales tanpa menghapus histori
 * qualification (field dasar `destination`/`travelStartDate`/dst. pada `Opportunity` tetap dipertahankan apa
 * adanya sebagai hasil carry-over qualification). Seluruh field opsional.
 */
export interface OpportunityRequirementDetail {
  itineraryConcept?: string
  departureCity?: string
  destinationDetail?: string
  travelerComposition?: string
  roomRequirement?: string
  flightPreference?: string
  transportRequirement?: string
  miceRequirement?: string
  specialRequest?: string
  decisionMaker?: string
  paymentTerms?: string
  commercialNotes?: string
  operationalNotes?: string
  riskNotes?: string
}

/**
 * Status workflow tampilan AE-facing (Prompt 20-10/14) — DIRIVASI (bukan field tersimpan) dari kombinasi
 * `Opportunity.stage` + `Quotation.approvalStatus` lewat `getOpportunityWorkflowStatus` (`app/data/index.ts`),
 * mengikuti pola D-049 (lapisan aditif/ortogonal, bukan merestrukturisasi `OpportunityStage`). Menggantikan
 * label lama yang membingungkan ("Won (Menunggu Approval)") sebagai indikator status utama di Opportunity
 * Detail, tanpa mengubah state machine `stage` yang dipakai luas oleh Section 08/09/14.
 */
export type OpportunityWorkflowStatus =
  | 'pending-requirement'
  | 'ready-for-quotation'
  | 'quotation-draft'
  | 'pending-management-approval'
  | 'approved'
  | 'won'
  | 'lost'

export interface Opportunity {
  id: ID
  partyId: ID
  title: string
  stage: OpportunityStage
  /** Sales pemilik opportunity (Section 08) — dipakai widget "milik sendiri" dan filter owner. */
  ownerId: ID
  /** Estimasi nilai deal awal (Section 08) — terpisah dari `Quotation.amountIdr` yang lebih presisi setelah quotation dibuat. */
  estimatedValueIdr: number
  destination: string
  /** Tanggal perkiraan — opsional karena belum tentu diketahui di stage awal (Draft/Qualification). */
  travelStartDate?: string
  travelEndDate?: string
  travelerEstimate?: number
  /** Catatan requirement — diisi mulai stage Requirement Gathering, kosong sebelum itu. */
  requirementNotes?: string
  createdAt: string
  decidedAt?: string
  wonApprovedBy?: ID
  lostReason?: string
  serviceScope: ServiceTypeKey[]
  quotationId?: ID
  projectId?: ID

  /** Prompt 20 — Change Request: field aditif hasil carry-over qualification Lead + AE Requirement Detail. */
  /** Nama kontak (dibawa dari `Lead.name` saat Qualify) — dipakai gate "Contact Person" pre-quotation. */
  contactName?: string
  /** Referensi Lead asal (Overview "Related Lead") — opsional karena Opportunity juga bisa ada tanpa Lead (data legacy pra-Prompt 19). */
  leadId?: ID
  expectedCloseDate?: string
  requirementDetail?: OpportunityRequirementDetail

  /**
   * Client Confirmation (Section 05 — roadmap Section 00–24 baru). Dicatat AE setelah quotation `approved`
   * dan client sudah mengonfirmasi (verbal/email/WA, seluruhnya mock — bukan integrasi nyata). Gerbang
   * TAMBAHAN sebelum "Mark as Won" (Prompt 20-13/D-053: sebelumnya hanya digerbangi `approvalStatus`),
   * literal Section 05/06 Wajib "AE belum dapat Mark as Won sebelum approved + client confirmation".
   */
  clientConfirmedAt?: string
  clientConfirmationNote?: string
}

/**
 * Commercial Approval (Prompt 19 — Change Request). Status approval quotation, TERPISAH dari
 * `Opportunity.stage` — quotation harus `approved` sebelum AE dapat mengajukan Opportunity ke stage
 * `won-requested` ("Mark as Won"). `draft` = belum pernah diajukan (nilai awal seluruh quotation lama).
 */
export type QuotationApprovalStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

/** Satu baris service breakdown Quotation (Prompt 20 — Change Request), diisi AE lewat "Edit Quotation". */
export interface QuotationServiceItem {
  service: ServiceTypeKey
  description?: string
  amountIdr: number
}

export interface Quotation {
  id: ID
  opportunityId: ID
  amountIdr: number
  createdAt: string
  accepted: boolean
  /** Nomor versi (Section 08) — "quotation version mock" ringan, bukan histori penuh per versi. */
  version: number
  /** Nilai versi sebelumnya, terisi hanya bila quotation ini adalah hasil revisi. */
  supersededAmountIdr?: number
  /** Field Prompt 19 di bawah ini opsional — commercial approval workflow (AE submit → Management approve/reject). */
  approvalStatus?: QuotationApprovalStatus
  approvedBy?: ID
  approvalNote?: string

  /** Prompt 20 — Change Request: detail komersial, diisi AE lewat "Edit Quotation" (draft, sebelum submit). */
  discountIdr?: number
  estimatedCostIdr?: number
  estimatedMarginIdr?: number
  paymentTerms?: string
  serviceBreakdown?: QuotationServiceItem[]

  /**
   * Section 05 — Change Request: field komersial tambahan (line items sudah ada di `serviceBreakdown`),
   * "PDF/print preview" (`/crm/opportunities/[id]/quotation-preview`), dan "send mock ke client".
   */
  taxIdr?: number
  markupIdr?: number
  /** Default `IDR` bila kosong — mockup, bukan multi-currency nyata (tidak ada konversi kurs). */
  currency?: string
  validUntil?: string
  termsAndConditions?: string
  inclusions?: string
  exclusions?: string
  /** "Send mock ke client" — timestamp simulasi, TIDAK mengirim email/WA nyata (D-006). */
  sentToClientAt?: string

  /**
   * Section 10 — Product Planning dan Costing. Referensi Cost Sheet yang dipakai membentuk quotation ini
   * (lihat `applyCostSheetToQuotation`, `app/data/index.ts`) — traceability collaboration Product
   * Planner↔AE, TIDAK menggantikan `estimatedCostIdr`/`estimatedMarginIdr` yang tetap disalin (snapshot)
   * ke field di atas agar Quotation tetap berdiri sendiri meski Cost Sheet sumber kelak direvisi.
   */
  costSheetId?: ID
}
