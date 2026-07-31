import type { ID } from './common'
import type { PartyActivityType } from './party'
import type { ServiceTypeKey } from './project'

/**
 * Lead (Prompt 19 — Change Request). Pre-Party record hasil capture awal (sebelum jadi Prospect/Company),
 * dikelola Sales sampai `qualified`, lalu diserahkan ke Account Executive untuk "Qualify & Create Opportunity".
 * Bukan pengganti `Party` — begitu di-qualify, sebuah `Party` baru dibuat (atau di-link ke `Party` existing bila
 * `companyName` cocok) dan `Lead.partyId`/`Lead.opportunityId` diisi sebagai referensi, konsisten dengan alur
 * "Lead→Qualified→Create Opportunity→Quotation→Management Approval→Won→Active Client→Project Order" (bukan
 * "Convert to Customer" — istilah tsb sengaja tidak dipakai sesuai instruksi literal Prompt 19-5A).
 */
export type LeadSource = 'website' | 'instagram' | 'tiktok' | 'whatsapp' | 'referral' | 'event' | 'email' | 'sales-outreach' | 'client-portal' | 'other'

export type LeadStage = 'new' | 'contacted' | 'qualified' | 'unqualified'

/** Jenis kebutuhan (Prompt 20 — Change Request, form Qualification). */
export type LeadServiceCategory = 'corporate-travel' | 'group-travel' | 'individual-travel' | 'mice-event'

/** Tingkat urgensi (Prompt 20) — field opsional form Qualification. */
export type LeadUrgency = 'low' | 'medium' | 'high'

export interface Lead {
  id: ID
  name: string
  companyName?: string
  source: LeadSource
  stage: LeadStage
  /** Sales yang menangani screening/qualification; berpindah ke AE (`handedOverTo`) setelah handover. */
  ownerId: ID
  /**
   * Account Executive tujuan handover — Prompt 20: kini diisi Sales secara eksplisit sebagai field wajib
   * form Qualification ("Account Executive yang menerima lead"), BUKAN lagi diputuskan otomatis saat tombol
   * "Qualify & Create Opportunity" diklik (lihat `qualifyLeadAndCreateOpportunity`, `app/data/index.ts`).
   */
  handedOverTo?: ID
  phone?: string
  email?: string
  /** "Catatan hasil komunikasi" (Prompt 20-4, field opsional Qualification) — nama field dipertahankan dari Prompt 19. */
  qualificationNotes?: string
  expectedCloseDate?: string
  createdAt: string
  lastUpdatedAt: string
  archived: boolean
  /** Terisi begitu Lead di-qualify dan Opportunity dibuat — referensi, bukan duplikasi (Party/Opportunity tetap satu sumber). */
  partyId?: ID
  opportunityId?: ID

  /**
   * Qualification (Prompt 20 — Change Request). Diisi progresif oleh Sales lewat tombol "Simpan Draft"
   * (`updateLeadQualification`) — seluruh field di bawah opsional untuk disimpan sebagai draft, tapi WAJIB
   * lengkap (lihat `getLeadMissingQualification`) sebelum tombol "Qualify & Create Opportunity" aktif.
   * "Hasil qualification" (Prompt 20-4) sengaja TIDAK disimpan sebagai field terpisah — direpresentasikan oleh
   * `stage` itu sendiri (`qualified`/`unqualified`), hasil dari aksi yang ditekan (mencegah field redundan).
   */
  serviceCategory?: LeadServiceCategory
  destination?: string
  travelStartDate?: string
  travelEndDate?: string
  travelerEstimate?: number
  serviceScope?: ServiceTypeKey[]
  /** "Ringkasan kebutuhan awal" — wajib sebelum Qualified, dibawa ke `Opportunity.requirementNotes` saat Qualify. */
  requirementSummary?: string
  /** Field opsional Qualification (Prompt 20-4). */
  budgetRange?: string
  dateFlexible?: boolean
  decisionMaker?: string
  urgency?: LeadUrgency
  specialRequestNote?: string
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
