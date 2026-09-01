import type { ID } from './common'
import type { LeadSource } from './lead'

/**
 * Marketing & Analysis (Revisi 9-Modul, modul 8 — versi olahan yang disepakati).
 *
 * Lima fitur pada daftar klien di-reframe agar benar-benar bisa dibangun di atas data yang ada:
 *   1. Campaign Tracking      → `Campaign` + `CampaignChannelSpend`
 *   2. A/B Testing Promo      → `PromoCode` + `PromoVariant` (perbandingan varian A/B pada promo nyata)
 *   3. Conversion Funnel      → diturunkan dari LEADS → QUOTATIONS → PROJECTS
 *   4. Customer Acquisition   → diturunkan dari belanja campaign ÷ klien baru per channel
 *   5. LTV / Customer         → diturunkan dari invoice lunas per Party
 *
 * "Marketing ROI" sengaja TIDAK ada di sini — ia dipindah ke modul 9 (Reporting & BI) agar tidak muncul
 * dua kali dengan angka yang berpotensi berbeda.
 */

export type CampaignStatus = 'planned' | 'running' | 'paused' | 'completed'

export type CampaignObjective = 'awareness' | 'lead-generation' | 'retention' | 'conversion'

export interface Campaign {
  id: ID
  name: string
  objective: CampaignObjective
  status: CampaignStatus
  startDate: string
  endDate: string
  budgetIdr: number
  spendIdr: number
  /** Channel yang dipakai — memakai `LeadSource` yang sudah ada agar atribusi lead nyambung otomatis. */
  channels: LeadSource[]
  ownerId?: ID
  note?: string
}

export interface CampaignChannelSpend {
  id: ID
  campaignId: ID
  channel: LeadSource
  spendIdr: number
  impressions: number
  clicks: number
}

export type PromoStatus = 'draft' | 'running' | 'ended'

export interface PromoVariant {
  key: 'A' | 'B'
  label: string
  /** Potongan dalam persen dari nilai kontrak. */
  discountPercent: number
  /** Berapa kali kode varian ini dikirim ke calon pelanggan. */
  sentCount: number
  redeemedCount: number
  revenueIdr: number
}

export interface PromoCode {
  id: ID
  code: string
  name: string
  status: PromoStatus
  startDate: string
  endDate: string
  campaignId?: ID
  variants: PromoVariant[]
  note?: string
}

export interface PromoVariantResult extends PromoVariant {
  redemptionRatePercent: number
  revenuePerSentIdr: number
  /** `true` untuk varian dengan revenue per pengiriman tertinggi. */
  isWinner: boolean
}

export interface FunnelStage {
  key: string
  label: string
  count: number
  /** Persentase terhadap tahap sebelumnya. */
  conversionPercent: number
  /** Persentase yang hilang di tahap ini. */
  dropOffPercent: number
}

export interface ChannelAcquisition {
  channel: LeadSource
  channelLabel: string
  leads: number
  qualifiedLeads: number
  wonOpportunities: number
  newClients: number
  spendIdr: number
  costPerLeadIdr: number
  /** Customer Acquisition Cost — belanja ÷ klien baru. `null` bila belum ada klien dari channel ini. */
  cacIdr: number | null
  conversionPercent: number
}

export type ContentPlatform = 'instagram' | 'tiktok' | 'website' | 'email' | 'youtube' | 'linkedin'

export type ContentScheduleStatus = 'draft' | 'scheduled' | 'published'

export interface ContentScheduleItem {
  id: ID
  publishDate: string
  platform: ContentPlatform
  title: string
  status: ContentScheduleStatus
  campaignId?: ID
  note?: string
}

export type ContentDevelopmentStage = 'idea' | 'draft' | 'review' | 'ready'

export interface ContentDevelopmentItem {
  id: ID
  title: string
  stage: ContentDevelopmentStage
  platform: ContentPlatform
  ownerId?: ID
  updatedAt: string
  note?: string
}

export interface CustomerLifetimeValue {
  partyId: ID
  partyName: string
  firstProjectAt?: string
  lastProjectAt?: string
  projectCount: number
  totalRevenueIdr: number
  averageProjectValueIdr: number
  /** Bulan sejak project pertama — dasar perhitungan LTV per bulan. */
  tenureMonths: number
  isRepeatCustomer: boolean
  acquisitionChannel?: LeadSource
}
