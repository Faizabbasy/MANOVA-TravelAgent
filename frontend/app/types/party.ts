import type { ID } from './common'
import type { InvoiceCurrency } from './finance'

export type PartyLifecycleStatus = 'prospect' | 'client'

export type CompanyType = 'private-company' | 'bumn' | 'government-agency' | 'university' | 'foundation' | 'event-organizer' | 'travel-agent' | 'other'

/** Sales Order (B2C) — default tersirat `'company'` saat absen; seluruh Party lama tidak berubah perilaku. */
export type PartyType = 'company' | 'individual'

/**
 * "Verification state for sensitive changes" (Repair Phase Section 7 — Insights & Company, Master Prompt
 * bagian 18) — field legal/finansial sensitif (registrasi/pajak/billing/payment term) TIDAK PERNAH ditulis
 * langsung oleh `updateCompanyProfile`; disimpan dulu ke `Party.pendingProfileChange`, baru diterapkan oleh
 * `runCompanyProfileVerificationMock` (dipicu lazy, pola sama `runPaymentVerificationMock` Section 6).
 */
export interface SensitiveCompanyProfileFields {
  registrationNumber?: string
  npwp?: string
  billingName?: string
  billingAddress?: string
  paymentTerm?: string
}

export interface Party {
  id: ID
  name: string
  lifecycleStatus: PartyLifecycleStatus
  industry?: string
  /** Sales Order (B2C individual) — Party dengan `partyType: 'individual'` dibuat lewat `createSalesOrder`. */
  partyType?: PartyType
  createdAt: string
  /** Field Prompt 19 (Change Request) di bawah ini opsional — dipakai tampilan "Company" pada modul Customer Journey, entitas yang sama dengan `Party` (bukan duplikasi, lihat D-046). */
  size?: string
  city?: string
  phone?: string
  /** Account Executive pemilik relationship company ini (berbeda dari `Opportunity.ownerId` yang per-deal) — Prompt 19. */
  accountOwnerId?: ID

  /**
   * Company Profile (Repair Phase Section 7 — Insights & Company, Master Prompt bagian 18). Seluruhnya
   * opsional/aditif — field lama TIDAK diubah/dihapus, halaman internal (`/crm/parties/[id]` dkk.) yang
   * belum memakai field ini tetap berfungsi identik.
   */
  logoFileName?: string
  companyType?: CompanyType
  address?: string
  province?: string
  country?: string
  postalCode?: string
  website?: string
  email?: string
  preferredCurrency?: InvoiceCurrency
  poRequired?: boolean
  travelPreferences?: string
  /** Field sensitif (Wajib "Verification state") — nilai AKTIF/terverifikasi, lihat `SensitiveCompanyProfileFields`. */
  registrationNumber?: string
  npwp?: string
  billingName?: string
  billingAddress?: string
  paymentTerm?: string
  /** Perubahan field sensitif yang belum diverifikasi — kosong berarti tidak ada perubahan pending. */
  pendingProfileChange?: SensitiveCompanyProfileFields
  pendingProfileChangeSubmittedAt?: string
  pendingProfileChangeSubmittedBy?: ID
}

export interface ContactPerson {
  id: ID
  partyId: ID
  name: string
  title: string
  email?: string
  phone?: string
}

/** Tab identifiers for Party Detail (docs/mockup-information-architecture.md bagian 3.2 — Overview/Contacts/Leads/Activities/Projects*). */
/** `travel-history` ditambahkan Revisi 9-Modul (`revisi.md` #5 "History Perjalanan & Preferensi"). */
/** `leads` (dulu `opportunities`) — entitas Opportunity dihapus, lihat komentar desain di `app/types/lead.ts`. */
export type PartyDetailTab = 'overview' | 'contacts' | 'leads' | 'activities' | 'projects' | 'travel-history'

export type PartyActivityType = 'call' | 'meeting' | 'email' | 'note' | 'follow-up'

/**
 * Activity level-Party (Section 07) — berbeda dari `ActivityEntry` (~/types/activity.ts) yang scoped ke Project.
 * Dipakai tab "Activities" Party Detail, dan widget Dashboard Sales "Follow-up Mendatang" (via `ownerId`+`dueAt`).
 */
export interface PartyActivity {
  id: ID
  partyId: ID
  /** Opsional — bila diisi, activity ini juga tampil di tab "Activity/Follow-up" halaman detail Lead. */
  leadId?: ID
  type: PartyActivityType
  message: string
  ownerId: ID
  createdAt: string
  dueAt?: string
}
