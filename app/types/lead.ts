import type { ID } from './common'
import type { PartyActivityType } from './party'
import type { ServiceTypeKey } from './project'

/**
 * Lead. Pre-Party record hasil capture awal (sebelum jadi Prospect/Company/Client), dikelola Sales sampai
 * `qualified`. Bukan pengganti `Party` — begitu di-qualify, sebuah `Party` baru dibuat (atau di-link ke
 * `Party` existing bila `companyName` cocok) dan `Lead.partyId` diisi sebagai referensi.
 *
 * Sengaja TIDAK ada entitas "Opportunity" terpisah di antara Lead dan hasil akhirnya (dihapus — flat by
 * design, mockup tidak butuh deal-record tambahan). Lead sendiri jadi satu-satunya pre-sale record untuk
 * kedua jalur:
 * - B2B (`serviceCategory` selain `individual-travel`): Lead → qualify (`qualifyLeadForQuotation`) →
 *   `Quotation` dibuat langsung di Lead ini (`Lead.quotationId`) → approval Management → "Mark as Won"
 *   (`markLeadWon`, satu langkah, digerbangi `Quotation.approvalStatus === 'approved'`) → `Project` dibuat
 *   (`Lead.projectId`).
 * - B2C (`serviceCategory === 'individual-travel'`): Lead → qualify sekaligus buat `SalesOrder`
 *   (`qualifyLeadAndCreateSalesOrder`, `Lead.salesOrderId`) — tanpa Quotation/approval, langsung order.
 */
export type LeadSource = 'website' | 'instagram' | 'tiktok' | 'whatsapp' | 'referral' | 'event' | 'email' | 'sales-outreach' | 'client-portal' | 'other'

export type LeadStage = 'new' | 'contacted' | 'qualified' | 'unqualified'

/** Jenis kebutuhan (Prompt 20 — Change Request, form Qualification). */
export type LeadServiceCategory = 'corporate-travel' | 'group-travel' | 'individual-travel' | 'mice-event'

/** Tingkat urgensi (Prompt 20) — field opsional form Qualification. */
export type LeadUrgency = 'low' | 'medium' | 'high'

/** Group Trip B2C Qualification (`qualifyGroupTripLead`, `app/data/index.ts`) — field khusus Lead
 * `serviceCategory: 'individual-travel'` yang memilih Project B2C existing, bukan booking standalone. */
export type B2cPriceAcceptance = 'accept' | 'need-discussion' | 'not-suitable'
export type B2cBookingReadiness = 'ready' | 'need-follow-up' | 'still-considering'
export type B2cQualificationResult = 'qualified' | 'follow-up' | 'waitlist' | 'not-qualified'

/**
 * Status workflow AE-facing — DIRIVASI (bukan field tersimpan) lewat `getLeadWorkflowStatus`
 * (`app/data/index.ts`) dari kombinasi `Lead.stage` + `Quotation.approvalStatus` + `Lead.projectId`/
 * `salesOrderId`, pola sama derived-status lain di codebase (`getProjectOrderStatus`). Menggantikan
 * `OpportunityWorkflowStatus` lama — tidak lagi ada gerbang requirement/client-confirmation terpisah.
 */
export type LeadWorkflowStatus =
  | 'unqualified'
  | 'qualified-pending-quotation'
  | 'quotation-draft'
  | 'pending-management-approval'
  | 'quotation-approved'
  | 'won'
  | 'sales-order-created'

export interface Lead {
  id: ID
  name: string
  companyName?: string
  source: LeadSource
  stage: LeadStage
  /** Sales yang menangani screening/qualification; berpindah ke AE (`handedOverTo`) setelah handover. */
  ownerId: ID
  /**
   * Account Executive tujuan handover — diisi Sales secara eksplisit sebagai field wajib form Qualification
   * ("Account Executive yang menerima lead"), bukan diputuskan otomatis saat tombol Qualify diklik.
   */
  handedOverTo?: ID
  phone?: string
  email?: string
  /** "Catatan hasil komunikasi" — field opsional Qualification. */
  qualificationNotes?: string
  expectedCloseDate?: string
  createdAt: string
  lastUpdatedAt: string
  archived: boolean
  /** Terisi begitu Lead di-qualify — referensi, bukan duplikasi (Party tetap satu sumber). */
  partyId?: ID
  /** Timestamp saat `stage` berpindah ke `qualified` — dipakai laporan SLA "Lead → Quotation cycle-time" sebagai titik awal yang presisi (`Lead.createdAt` sendiri mendahului qualification, jadi bukan proxy yang akurat). */
  qualifiedAt?: string
  /** Judul deal opsional (tampil di header halaman detail Lead B2B) — kosong untuk Lead B2C. */
  title?: string
  /** B2B — terisi begitu Quotation dibuat untuk Lead ini (`createQuotation`). */
  quotationId?: ID
  /** B2B — terisi begitu "Mark as Won" berhasil (`markLeadWon`), menandakan Project sudah dibuat. JUGA
   * dipakai Group Trip B2C (`qualifyGroupTripLead`) — terisi begitu Lead benar-benar Qualified (Awaiting
   * DP), bukan sekadar memilih Project di dropdown (lihat `groupTripProjectId` di bawah untuk itu). */
  projectId?: ID
  /** B2C — terisi begitu Lead individual-travel di-qualify sekaligus jadi Sales Order (`qualifyLeadAndCreateSalesOrder`). */
  salesOrderId?: ID

  /**
   * Qualification. Diisi progresif oleh Sales lewat tombol "Simpan Draft" (`updateLeadQualification`) —
   * seluruh field di bawah opsional untuk disimpan sebagai draft, tapi WAJIB lengkap (lihat
   * `getLeadMissingQualification`) sebelum tombol Qualify aktif. "Hasil qualification" sengaja TIDAK
   * disimpan sebagai field terpisah — direpresentasikan oleh `stage` itu sendiri (`qualified`/`unqualified`).
   */
  serviceCategory?: LeadServiceCategory
  destination?: string
  travelStartDate?: string
  travelEndDate?: string
  travelerEstimate?: number
  serviceScope?: ServiceTypeKey[]
  /** "Ringkasan kebutuhan awal" — wajib sebelum Qualified. */
  requirementSummary?: string
  /** Field opsional Qualification. */
  budgetRange?: string
  dateFlexible?: boolean
  decisionMaker?: string
  urgency?: LeadUrgency
  specialRequestNote?: string

  /** Group Trip B2C — Project B2C yang dipilih di form, terisi begitu dropdown dipilih, LEPAS dari hasil
   * qualification (beda dari `projectId` di bawah, yang baru terisi begitu benar-benar Qualified/won).
   * Dipakai Project detail untuk bucket "Linked/Qualified Leads" (superset — termasuk waitlist/follow-up). */
  groupTripProjectId?: ID
  b2cAdultCount?: number
  b2cChildCount?: number
  b2cInfantCount?: number
  b2cPriceAcceptance?: B2cPriceAcceptance
  b2cBookingReadiness?: B2cBookingReadiness
  b2cQualificationResult?: B2cQualificationResult
  b2cNextFollowUpDate?: string
}

/**
 * Activity level-Lead — menggabungkan "Activities" dan "Follow-ups" (drawer Prompt 19-5A) dalam satu
 * entitas, mengikuti pola `PartyActivity` (Section 07): follow-up adalah activity dengan `dueAt` terisi.
 */
export interface LeadActivity {
  id: ID
  leadId: ID
  type: PartyActivityType
  message: string
  ownerId: ID
  createdAt: string
  dueAt?: string
}
