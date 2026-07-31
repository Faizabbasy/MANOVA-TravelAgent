import type { ID } from './common'

export type PartyLifecycleStatus = 'prospect' | 'client'

export interface Party {
  id: ID
  name: string
  lifecycleStatus: PartyLifecycleStatus
  industry?: string
  createdAt: string
  /** Field Prompt 19 (Change Request) di bawah ini opsional — dipakai tampilan "Company" pada modul Customer Journey, entitas yang sama dengan `Party` (bukan duplikasi, lihat D-046). */
  size?: string
  city?: string
  phone?: string
  /** Account Executive pemilik relationship company ini (berbeda dari `Opportunity.ownerId` yang per-deal) — Prompt 19. */
  accountOwnerId?: ID
}

export interface ContactPerson {
  id: ID
  partyId: ID
  name: string
  title: string
  email?: string
  phone?: string
}

/** Tab identifiers for Party Detail (docs/mockup-information-architecture.md bagian 3.2 — Overview/Contacts/Opportunities/Activities/Projects*). */
export type PartyDetailTab = 'overview' | 'contacts' | 'opportunities' | 'activities' | 'projects'

export type PartyActivityType = 'call' | 'meeting' | 'email' | 'note' | 'follow-up'

/**
 * Activity level-Party (Section 07) — berbeda dari `ActivityEntry` (~/types/activity.ts) yang scoped ke Project.
 * Dipakai tab "Activities" Party Detail, dan widget Dashboard Sales "Follow-up Mendatang" (via `ownerId`+`dueAt`).
 */
export interface PartyActivity {
  id: ID
  partyId: ID
  /** Opsional (Section 08) — bila diisi, activity ini juga tampil di tab "Activity/Follow-up" Opportunity Detail. */
  opportunityId?: ID
  type: PartyActivityType
  message: string
  ownerId: ID
  createdAt: string
  dueAt?: string
}
