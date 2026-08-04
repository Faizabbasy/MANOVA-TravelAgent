import type { ID } from './common'

/**
 * CRM Engagement (Revisi 9-Modul) — Follow-up Otomatis, Loyalty Program, dan Review & Feedback
 * management, tiga dari lima fitur modul CRM pada daftar kebutuhan klien.
 *
 * Prinsip: TIDAK ada scheduler/cron. "Otomatis" di sini berarti *rule-driven dan berbasis tanggal* —
 * task follow-up diturunkan dari rule + tanggal acuan (`getDueFollowUps`), bukan disimpan satu per satu.
 * Ini konsisten dengan seluruh derivasi lain di codebase mock ini dan tidak mungkin basi.
 */

export type FollowUpTrigger =
  | 'lead-created'
  | 'quotation-sent'
  | 'project-completed'
  | 'no-contact'
  | 'birthday-anniversary'

export type FollowUpChannel = 'whatsapp' | 'email' | 'phone'

export interface FollowUpRule {
  id: ID
  name: string
  trigger: FollowUpTrigger
  /** Jumlah hari setelah kejadian pemicu sebelum follow-up jatuh tempo. */
  offsetDays: number
  channel: FollowUpChannel
  /** Template pesan. `{{nama}}` dan `{{perusahaan}}` diganti saat task dibentuk. */
  messageTemplate: string
  ownerRoleId?: ID
  isActive: boolean
  description?: string
}

export type FollowUpTaskStatus = 'due' | 'upcoming' | 'done' | 'skipped'

/** Task follow-up hasil derivasi rule × entitas sumber — bukan record tersimpan. */
export interface FollowUpTask {
  id: ID
  ruleId: ID
  ruleName: string
  channel: FollowUpChannel
  /** Entitas sumber: lead atau party. */
  sourceType: 'lead' | 'party'
  sourceId: ID
  contactName: string
  companyName?: string
  phone?: string
  email?: string
  dueDate: string
  /** Positif = sudah lewat jatuh tempo. */
  overdueDays: number
  status: FollowUpTaskStatus
  message: string
}

export type LoyaltyTierKey = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface LoyaltyTier {
  key: LoyaltyTierKey
  label: string
  /** Ambang batas total belanja (IDR) untuk masuk tier ini. */
  minSpendIdr: number
  /** Poin per juta rupiah transaksi. */
  pointsPerMillion: number
  benefits: string[]
}

export interface LoyaltyAdjustment {
  id: ID
  partyId: ID
  points: number
  reason: string
  createdAt: string
  createdBy: ID
}

/** Ringkasan loyalty per customer — diturunkan dari invoice + penyesuaian manual. */
export interface LoyaltyAccountSummary {
  partyId: ID
  partyName: string
  totalSpendIdr: number
  projectCount: number
  basePoints: number
  adjustmentPoints: number
  totalPoints: number
  tier: LoyaltyTier
  nextTier?: LoyaltyTier
  spendToNextTierIdr: number
  lastProjectAt?: string
  daysSinceLastProject?: number
}
