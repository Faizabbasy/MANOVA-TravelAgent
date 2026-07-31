import type { ID } from './common'
import type { PartyActivityType } from './party'

/**
 * Lead (Prompt 19 — Change Request). Pre-Party record hasil capture awal (sebelum jadi Prospect/Company),
 * dikelola Sales sampai `qualified`, lalu diserahkan ke Account Executive untuk "Qualify & Create Opportunity".
 * Bukan pengganti `Party` — begitu di-qualify, sebuah `Party` baru dibuat (atau di-link ke `Party` existing bila
 * `companyName` cocok) dan `Lead.partyId`/`Lead.opportunityId` diisi sebagai referensi, konsisten dengan alur
 * "Lead→Qualified→Create Opportunity→Quotation→Management Approval→Won→Active Client→Project Order" (bukan
 * "Convert to Customer" — istilah tsb sengaja tidak dipakai sesuai instruksi literal Prompt 19-5A).
 */
export type LeadSource = 'website' | 'instagram' | 'tiktok' | 'whatsapp' | 'referral' | 'event' | 'email' | 'sales-outreach' | 'other'

export type LeadStage = 'new' | 'contacted' | 'qualified' | 'unqualified'

export interface Lead {
  id: ID
  name: string
  companyName?: string
  source: LeadSource
  stage: LeadStage
  /** Sales yang menangani screening/qualification; berpindah ke AE (`handedOverTo`) setelah handover. */
  ownerId: ID
  /** Account Executive tujuan handover setelah Lead di-qualify — opsional, terisi begitu "Qualify & Create Opportunity" dijalankan. */
  handedOverTo?: ID
  phone?: string
  email?: string
  qualificationNotes?: string
  expectedCloseDate?: string
  createdAt: string
  lastUpdatedAt: string
  archived: boolean
  /** Terisi begitu Lead di-qualify dan Opportunity dibuat — referensi, bukan duplikasi (Party/Opportunity tetap satu sumber). */
  partyId?: ID
  opportunityId?: ID
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
