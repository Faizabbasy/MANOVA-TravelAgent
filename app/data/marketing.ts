import { reactive } from 'vue'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type {
  Campaign,
  CampaignChannelSpend,
  PromoCode,
  PromoVariantResult,
  FunnelStage,
  ChannelAcquisition,
  CustomerLifetimeValue
} from '~/types/marketing'
import type { StatusOption } from '~/types/common'
import type { LeadSource } from '~/types/lead'
import { LEADS } from './leads'
import { QUOTATIONS } from './quotations'
import { PROJECTS } from './projects'
import { PARTIES } from './parties'
import { INVOICES } from './finance'
import { LEAD_SOURCES } from '~/constants/status'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'

/**
 * Marketing & Analysis (Revisi 9-Modul, modul 8).
 *
 * Hanya `CAMPAIGNS`, `CAMPAIGN_CHANNEL_SPEND`, dan `PROMO_CODES` yang benar-benar data baru — funnel, CAC,
 * dan LTV SELURUHNYA diturunkan dari lead/quotation/project/invoice yang sudah ada. Konsekuensinya:
 * angka marketing tidak mungkin bercerita berbeda dari angka Sales dan Finance.
 */

export const CAMPAIGN_STATUSES: StatusOption<Campaign['status']>[] = [
  { value: 'planned', label: 'Direncanakan', tone: 'neutral', order: 1 },
  { value: 'running', label: 'Berjalan', tone: 'primary', order: 2 },
  { value: 'paused', label: 'Dijeda', tone: 'warning', order: 3 },
  { value: 'completed', label: 'Selesai', tone: 'success', order: 4 }
]

export const CAMPAIGN_OBJECTIVES: StatusOption<Campaign['objective']>[] = [
  { value: 'awareness', label: 'Awareness', tone: 'info', order: 1 },
  { value: 'lead-generation', label: 'Lead Generation', tone: 'primary', order: 2 },
  { value: 'conversion', label: 'Conversion', tone: 'success', order: 3 },
  { value: 'retention', label: 'Retention', tone: 'purple', order: 4 }
]

export const PROMO_STATUSES: StatusOption<PromoCode['status']>[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral', order: 1 },
  { value: 'running', label: 'Berjalan', tone: 'primary', order: 2 },
  { value: 'ended', label: 'Berakhir', tone: 'neutral', order: 3 }
]

export const CAMPAIGNS: Campaign[] = reactive([
  { id: 'CMP-001', name: 'Corporate Retreat Season 2026', objective: 'lead-generation', status: 'running', startDate: '2026-05-01', endDate: '2026-08-31', budgetIdr: 180_000_000, spendIdr: 124_500_000, channels: ['instagram', 'website', 'email'], ownerId: 'USR-001', note: 'Menyasar HR dan GA perusahaan menengah-besar di Jabodetabek.' },
  { id: 'CMP-002', name: 'MICE Nusantara Expo', objective: 'awareness', status: 'completed', startDate: '2026-06-01', endDate: '2026-06-30', budgetIdr: 95_000_000, spendIdr: 92_800_000, channels: ['event', 'referral'], ownerId: 'USR-001', note: 'Sponsorship booth di travel fair nasional.' },
  { id: 'CMP-003', name: 'Referral Booster Q3', objective: 'retention', status: 'running', startDate: '2026-07-01', endDate: '2026-09-30', budgetIdr: 60_000_000, spendIdr: 21_400_000, channels: ['referral', 'whatsapp'], ownerId: 'USR-001', note: 'Insentif untuk klien lama yang merekomendasikan klien baru.' },
  { id: 'CMP-004', name: 'TikTok Travel Story', objective: 'awareness', status: 'running', startDate: '2026-07-10', endDate: '2026-10-10', budgetIdr: 75_000_000, spendIdr: 28_900_000, channels: ['tiktok', 'instagram'], ownerId: 'USR-001' },
  { id: 'CMP-005', name: 'Outbound Korporat Q4', objective: 'conversion', status: 'planned', startDate: '2026-09-01', endDate: '2026-12-15', budgetIdr: 140_000_000, spendIdr: 0, channels: ['outreach', 'email'], ownerId: 'USR-001' }
])

export const CAMPAIGN_CHANNEL_SPEND: CampaignChannelSpend[] = reactive([
  { id: 'CCS-001', campaignId: 'CMP-001', channel: 'instagram', spendIdr: 62_000_000, impressions: 1_840_000, clicks: 41_200 },
  { id: 'CCS-002', campaignId: 'CMP-001', channel: 'website', spendIdr: 38_500_000, impressions: 620_000, clicks: 28_400 },
  { id: 'CCS-003', campaignId: 'CMP-001', channel: 'email', spendIdr: 24_000_000, impressions: 96_000, clicks: 12_800 },
  { id: 'CCS-004', campaignId: 'CMP-002', channel: 'event', spendIdr: 78_800_000, impressions: 42_000, clicks: 3_600 },
  { id: 'CCS-005', campaignId: 'CMP-002', channel: 'referral', spendIdr: 14_000_000, impressions: 8_400, clicks: 1_900 },
  { id: 'CCS-006', campaignId: 'CMP-003', channel: 'referral', spendIdr: 15_400_000, impressions: 12_000, clicks: 2_700 },
  { id: 'CCS-007', campaignId: 'CMP-003', channel: 'whatsapp', spendIdr: 6_000_000, impressions: 24_000, clicks: 7_100 },
  { id: 'CCS-008', campaignId: 'CMP-004', channel: 'tiktok', spendIdr: 19_600_000, impressions: 2_450_000, clicks: 58_900 },
  { id: 'CCS-009', campaignId: 'CMP-004', channel: 'instagram', spendIdr: 9_300_000, impressions: 410_000, clicks: 11_200 }
])

/**
 * Promo dengan dua varian — inilah bentuk "A/B Testing Promo" yang bisa benar-benar dievaluasi: kode yang
 * sama dikirim dalam dua varian potongan, lalu redemption rate dan revenue per pengiriman dibandingkan.
 */
export const PROMO_CODES: PromoCode[] = reactive([
  {
    id: 'PRM-001',
    code: 'CORP2026',
    name: 'Diskon Corporate Retreat',
    status: 'running',
    startDate: '2026-05-15',
    endDate: '2026-08-31',
    campaignId: 'CMP-001',
    variants: [
      { key: 'A', label: 'Potongan 5%', discountPercent: 5, sentCount: 420, redeemedCount: 38, revenueIdr: 1_140_000_000 },
      { key: 'B', label: 'Potongan 10%', discountPercent: 10, sentCount: 418, redeemedCount: 61, revenueIdr: 1_525_000_000 }
    ],
    note: 'Varian B memberi potongan dua kali lipat tapi menghasilkan revenue lebih tinggi — elastisitas harga tinggi pada segmen ini.'
  },
  {
    id: 'PRM-002',
    code: 'REFER50',
    name: 'Insentif Referral',
    status: 'running',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    campaignId: 'CMP-003',
    variants: [
      { key: 'A', label: 'Cashback tetap Rp 5 juta', discountPercent: 0, sentCount: 96, redeemedCount: 14, revenueIdr: 690_000_000 },
      { key: 'B', label: 'Potongan 3% project berikutnya', discountPercent: 3, sentCount: 94, redeemedCount: 9, revenueIdr: 405_000_000 }
    ],
    note: 'Cashback nominal lebih menarik dibanding potongan persentase untuk program referral.'
  },
  {
    id: 'PRM-003',
    code: 'MICEEXPO',
    name: 'Promo Pengunjung Expo',
    status: 'ended',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    campaignId: 'CMP-002',
    variants: [
      { key: 'A', label: 'Gratis site visit', discountPercent: 0, sentCount: 210, redeemedCount: 27, revenueIdr: 810_000_000 },
      { key: 'B', label: 'Potongan 7%', discountPercent: 7, sentCount: 208, redeemedCount: 22, revenueIdr: 638_000_000 }
    ]
  }
])

/* ------------------------------------------------------------------ *
 * Campaign
 * ------------------------------------------------------------------ */

export function getCampaignById (campaignId: string): Campaign | undefined {
  return CAMPAIGNS.find(campaign => campaign.id === campaignId)
}

export function getCampaignSpend (campaignId: string): CampaignChannelSpend[] {
  return CAMPAIGN_CHANNEL_SPEND.filter(spend => spend.campaignId === campaignId)
}

export interface CampaignPerformance {
  campaign: Campaign
  leads: number
  qualifiedLeads: number
  wonOpportunities: number
  revenueIdr: number
  costPerLeadIdr: number
  /** Return on ad spend — revenue ÷ belanja. `null` bila belum ada belanja. */
  roas: number | null
  budgetUsedPercent: number
}

/**
 * Performa campaign — lead diatribusikan lewat kecocokan `Lead.source` dengan `Campaign.channels` DAN
 * rentang tanggal campaign. Atribusi sederhana (bukan multi-touch), tapi jujur: tidak ada angka lead
 * yang diketik manual ke dalam campaign.
 */
export function getCampaignPerformance (): CampaignPerformance[] {
  return CAMPAIGNS.map((campaign) => {
    const attributedLeads = LEADS.filter(lead =>
      campaign.channels.includes(lead.source) &&
      lead.createdAt >= campaign.startDate &&
      lead.createdAt <= campaign.endDate)

    const qualified = attributedLeads.filter(lead => lead.stage === 'qualified')
    const attributedLeadIds = new Set(attributedLeads.map(lead => lead.id))
    const wonLeads = attributedLeads.filter(lead => Boolean(lead.projectId))
    const revenueIdr = PROJECTS
      .filter(project => project.leadId && attributedLeadIds.has(project.leadId))
      .reduce((sum, project) => sum + project.quotationAmountIdr, 0)

    return {
      campaign,
      leads: attributedLeads.length,
      qualifiedLeads: qualified.length,
      wonOpportunities: wonLeads.length,
      revenueIdr,
      costPerLeadIdr: attributedLeads.length ? Math.round(campaign.spendIdr / attributedLeads.length) : 0,
      roas: campaign.spendIdr ? revenueIdr / campaign.spendIdr : null,
      budgetUsedPercent: campaign.budgetIdr ? Math.round((campaign.spendIdr / campaign.budgetIdr) * 100) : 0
    }
  })
}

/* ------------------------------------------------------------------ *
 * Promo A/B
 * ------------------------------------------------------------------ */

export function getPromoResults (promoId: string): PromoVariantResult[] {
  const promo = PROMO_CODES.find(item => item.id === promoId)
  if (!promo) { return [] }

  const enriched = promo.variants.map(variant => ({
    ...variant,
    redemptionRatePercent: variant.sentCount ? (variant.redeemedCount / variant.sentCount) * 100 : 0,
    revenuePerSentIdr: variant.sentCount ? Math.round(variant.revenueIdr / variant.sentCount) : 0,
    isWinner: false
  }))

  /** Pemenang ditentukan oleh revenue per pengiriman, bukan sekadar redemption rate — diskon besar bisa saja menang jumlah tapi kalah nilai. */
  const best = Math.max(...enriched.map(variant => variant.revenuePerSentIdr))
  for (const variant of enriched) { variant.isWinner = variant.revenuePerSentIdr === best && best > 0 }
  return enriched
}

/* ------------------------------------------------------------------ *
 * Conversion funnel
 * ------------------------------------------------------------------ */

export function getConversionFunnel (channel?: LeadSource): FunnelStage[] {
  const leads = channel ? LEADS.filter(lead => lead.source === channel) : LEADS
  const leadIds = new Set(leads.map(lead => lead.id))
  const dealLeadIds = new Set(leads.filter(lead => lead.quotationId).map(lead => lead.id))

  const qualified = leads.filter(lead => lead.stage === 'qualified')
  const quotations = QUOTATIONS.filter(quotation => dealLeadIds.has(quotation.leadId))
  const won = leads.filter(lead => Boolean(lead.projectId))
  const projects = PROJECTS.filter(project => project.leadId && leadIds.has(project.leadId))

  const raw = [
    { key: 'lead', label: 'Lead Masuk', count: leadIds.size },
    { key: 'qualified', label: 'Terkualifikasi', count: qualified.length },
    { key: 'quotation', label: 'Quotation Terkirim', count: quotations.length },
    { key: 'won', label: 'Won', count: won.length },
    { key: 'project', label: 'Project Berjalan', count: projects.length }
  ]

  return raw.map((stage, index) => {
    const previous = index === 0 ? stage.count : raw[index - 1].count
    const conversionPercent = previous ? (stage.count / previous) * 100 : 0
    return {
      ...stage,
      conversionPercent: index === 0 ? 100 : conversionPercent,
      dropOffPercent: index === 0 ? 0 : Math.max(0, 100 - conversionPercent)
    }
  })
}

/* ------------------------------------------------------------------ *
 * Customer acquisition cost
 * ------------------------------------------------------------------ */

export function getChannelAcquisition (): ChannelAcquisition[] {
  return LEAD_SOURCES.map((source) => {
    const channel = source.value as LeadSource
    const leads = LEADS.filter(lead => lead.source === channel)
    const won = leads.filter(lead => Boolean(lead.projectId))
    const newClients = new Set(leads.map(lead => lead.partyId).filter(Boolean)).size
    const spendIdr = CAMPAIGN_CHANNEL_SPEND.filter(spend => spend.channel === channel).reduce((sum, spend) => sum + spend.spendIdr, 0)

    return {
      channel,
      channelLabel: source.label,
      leads: leads.length,
      qualifiedLeads: leads.filter(lead => lead.stage === 'qualified').length,
      wonOpportunities: won.length,
      newClients,
      spendIdr,
      costPerLeadIdr: leads.length ? Math.round(spendIdr / leads.length) : 0,
      cacIdr: newClients ? Math.round(spendIdr / newClients) : null,
      conversionPercent: leads.length ? (won.length / leads.length) * 100 : 0
    }
  }).sort((a, b) => b.leads - a.leads)
}

/* ------------------------------------------------------------------ *
 * Customer lifetime value
 * ------------------------------------------------------------------ */

export function getCustomerLifetimeValues (referenceIso = DEMO_REFERENCE_DATE): CustomerLifetimeValue[] {
  return PARTIES
    .filter(party => party.lifecycleStatus === 'client')
    .map((party) => {
      const projects = PROJECTS.filter(project => project.partyId === party.id)
      const projectIds = new Set(projects.map(project => project.id))
      const totalRevenueIdr = INVOICES
        .filter(invoice => projectIds.has(invoice.projectId) && invoice.status === 'paid')
        .reduce((sum, invoice) => sum + invoice.amountIdr, 0)

      const dates = projects.map(project => project.travelStartDate).sort()
      const firstProjectAt = dates[0]
      const lastProjectAt = dates.at(-1)
      const tenureDays = firstProjectAt ? differenceInCalendarDays(parseISO(referenceIso), parseISO(firstProjectAt)) : 0

      return {
        partyId: party.id,
        partyName: party.name,
        firstProjectAt,
        lastProjectAt,
        projectCount: projects.length,
        totalRevenueIdr,
        averageProjectValueIdr: projects.length ? Math.round(totalRevenueIdr / projects.length) : 0,
        tenureMonths: Math.max(1, Math.round(tenureDays / 30)),
        isRepeatCustomer: projects.length > 1,
        acquisitionChannel: LEADS.find(lead => lead.partyId === party.id)?.source
      }
    })
    .sort((a, b) => b.totalRevenueIdr - a.totalRevenueIdr)
}

export interface MarketingRoiSummary {
  totalSpendIdr: number
  attributedRevenueIdr: number
  roas: number | null
  roiPercent: number | null
  averageCacIdr: number | null
  averageLtvIdr: number
  /** LTV ÷ CAC — di bawah 3 umumnya dianggap belum sehat. */
  ltvToCacRatio: number | null
}

/** Dipakai oleh modul Reporting & BI (Marketing ROI) — satu perhitungan, satu sumber. */
export function getMarketingRoiSummary (): MarketingRoiSummary {
  const performance = getCampaignPerformance()
  const totalSpendIdr = performance.reduce((sum, row) => sum + row.campaign.spendIdr, 0)
  const attributedRevenueIdr = performance.reduce((sum, row) => sum + row.revenueIdr, 0)

  const acquisitions = getChannelAcquisition().filter(row => row.cacIdr !== null)
  const averageCacIdr = acquisitions.length
    ? Math.round(acquisitions.reduce((sum, row) => sum + (row.cacIdr ?? 0), 0) / acquisitions.length)
    : null

  const ltvs = getCustomerLifetimeValues()
  const averageLtvIdr = ltvs.length ? Math.round(ltvs.reduce((sum, row) => sum + row.totalRevenueIdr, 0) / ltvs.length) : 0

  return {
    totalSpendIdr,
    attributedRevenueIdr,
    roas: totalSpendIdr ? attributedRevenueIdr / totalSpendIdr : null,
    roiPercent: totalSpendIdr ? ((attributedRevenueIdr - totalSpendIdr) / totalSpendIdr) * 100 : null,
    averageCacIdr,
    averageLtvIdr,
    ltvToCacRatio: averageCacIdr ? averageLtvIdr / averageCacIdr : null
  }
}
