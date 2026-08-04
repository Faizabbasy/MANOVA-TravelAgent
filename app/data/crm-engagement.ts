import { reactive } from 'vue'
import { differenceInCalendarDays, parseISO, addDays, format } from 'date-fns'
import type {
  FollowUpRule,
  FollowUpTask,
  FollowUpChannel,
  LoyaltyAdjustment,
  LoyaltyAccountSummary,
  LoyaltyTier
} from '~/types/crm-engagement'
import { LEADS } from './leads'
import { PARTIES } from './parties'
import { PROJECTS } from './projects'
import { INVOICES } from './finance'
import { CONTACTS } from './parties'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'

/**
 * Modul CRM — Follow-up Otomatis, Loyalty Program, dan helper WhatsApp (Revisi 9-Modul).
 *
 * Sengaja berdiri sendiri (tidak menumpang `app/data/index.ts` yang sudah 6.600+ baris), sesuai aturan
 * yang ditetapkan untuk inisiatif ini: domain baru mengekspor selector-nya sendiri.
 */

export const FOLLOW_UP_RULES: FollowUpRule[] = reactive([
  {
    id: 'FUR-001',
    name: 'Sapa Lead Baru',
    trigger: 'lead-created',
    offsetDays: 1,
    channel: 'whatsapp',
    messageTemplate: 'Halo {{nama}}, terima kasih sudah menghubungi MANOVA. Boleh saya bantu susunkan opsi perjalanan untuk {{perusahaan}}?',
    isActive: true,
    description: 'Menghubungi lead baru satu hari setelah masuk, sebelum minat mereka dingin.'
  },
  {
    id: 'FUR-002',
    name: 'Tindak Lanjut Penawaran',
    trigger: 'quotation-sent',
    offsetDays: 3,
    channel: 'whatsapp',
    messageTemplate: 'Halo {{nama}}, mengecek penawaran yang kami kirim untuk {{perusahaan}}. Ada bagian yang ingin disesuaikan?',
    isActive: true,
    description: 'Menyusul tiga hari setelah penawaran dikirim agar tidak menggantung.'
  },
  {
    id: 'FUR-003',
    name: 'Minta Review Pasca Trip',
    trigger: 'project-completed',
    offsetDays: 3,
    channel: 'email',
    messageTemplate: 'Halo {{nama}}, semoga perjalanan {{perusahaan}} berjalan lancar. Boleh kami minta penilaian singkat untuk perbaikan layanan?',
    isActive: true,
    description: 'Mengumpulkan review selagi pengalaman perjalanan masih segar.'
  },
  {
    id: 'FUR-004',
    name: 'Aktivasi Customer Pasif',
    trigger: 'no-contact',
    offsetDays: 90,
    channel: 'phone',
    messageTemplate: 'Halo {{nama}}, sudah cukup lama sejak perjalanan terakhir {{perusahaan}}. Ada rencana perjalanan dalam waktu dekat?',
    isActive: true,
    description: 'Menghubungi kembali customer yang sudah 90 hari tidak ada project.'
  }
])

export const LOYALTY_TIERS: LoyaltyTier[] = [
  { key: 'bronze', label: 'Bronze', minSpendIdr: 0, pointsPerMillion: 10, benefits: ['Prioritas respons 1x24 jam'] },
  { key: 'silver', label: 'Silver', minSpendIdr: 250_000_000, pointsPerMillion: 12, benefits: ['Prioritas respons 1x24 jam', 'Gratis 1 kali penyesuaian itinerary'] },
  { key: 'gold', label: 'Gold', minSpendIdr: 750_000_000, pointsPerMillion: 15, benefits: ['Dedicated account executive', 'Gratis 2 kali penyesuaian itinerary', 'Termin pembayaran lebih panjang'] },
  { key: 'platinum', label: 'Platinum', minSpendIdr: 2_000_000_000, pointsPerMillion: 20, benefits: ['Dedicated account executive', 'Penyesuaian itinerary tanpa batas', 'Termin pembayaran lebih panjang', 'Complimentary tour leader'] }
]

export const LOYALTY_ADJUSTMENTS: LoyaltyAdjustment[] = reactive([
  { id: 'LYA-001', partyId: 'PTY-001', points: 250, reason: 'Bonus referral — merekomendasikan dua klien korporat baru.', createdAt: '2026-06-15', createdBy: 'USR-014' },
  { id: 'LYA-002', partyId: 'PTY-002', points: -100, reason: 'Penukaran poin untuk upgrade kelas penerbangan.', createdAt: '2026-07-02', createdBy: 'USR-014' }
])

/* ------------------------------------------------------------------ *
 * WhatsApp
 * ------------------------------------------------------------------ */

/**
 * Menormalkan nomor telepon Indonesia ke format internasional tanpa tanda baca, sesuai yang diminta
 * `wa.me`. Menerima `0812...`, `+62 812-...`, dan `62812...`.
 */
export function toWhatsAppNumber (phone?: string): string | undefined {
  if (!phone) { return undefined }
  const digits = phone.replace(/\D/g, '')
  if (!digits) { return undefined }
  if (digits.startsWith('62')) { return digits }
  if (digits.startsWith('0')) { return `62${digits.slice(1)}` }
  return digits
}

/** Tautan `wa.me` siap pakai, lengkap dengan pesan yang sudah di-encode. `undefined` bila nomor tidak valid. */
export function buildWhatsAppLink (phone?: string, message?: string): string | undefined {
  const number = toWhatsAppNumber(phone)
  if (!number) { return undefined }
  return message ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : `https://wa.me/${number}`
}

/* ------------------------------------------------------------------ *
 * Follow-up otomatis
 * ------------------------------------------------------------------ */

function renderTemplate (template: string, nama: string, perusahaan?: string): string {
  return template.replace(/\{\{nama\}\}/g, nama).replace(/\{\{perusahaan\}\}/g, perusahaan || 'perusahaan Anda')
}

function toTask (
  rule: FollowUpRule,
  source: { type: 'lead' | 'party'; id: string; contactName: string; companyName?: string; phone?: string; email?: string },
  anchorDate: string,
  referenceIso: string
): FollowUpTask {
  const dueDate = format(addDays(parseISO(anchorDate), rule.offsetDays), 'yyyy-MM-dd')
  const overdueDays = differenceInCalendarDays(parseISO(referenceIso), parseISO(dueDate))
  return {
    id: `${rule.id}-${source.id}`,
    ruleId: rule.id,
    ruleName: rule.name,
    channel: rule.channel,
    sourceType: source.type,
    sourceId: source.id,
    contactName: source.contactName,
    companyName: source.companyName,
    phone: source.phone,
    email: source.email,
    dueDate,
    overdueDays,
    status: overdueDays >= 0 ? 'due' : 'upcoming',
    message: renderTemplate(rule.messageTemplate, source.contactName, source.companyName)
  }
}

function primaryContact (partyId: string) {
  return CONTACTS.find(contact => contact.partyId === partyId)
}

/**
 * Menurunkan seluruh task follow-up dari rule aktif terhadap data existing. Tidak ada task yang disimpan —
 * setiap pemanggilan menghitung ulang terhadap `referenceIso`, sehingga daftar selalu benar dan tidak perlu
 * proses latar belakang apa pun.
 */
export function getFollowUpTasks (referenceIso = DEMO_REFERENCE_DATE): FollowUpTask[] {
  const tasks: FollowUpTask[] = []

  for (const rule of FOLLOW_UP_RULES.filter(item => item.isActive)) {
    if (rule.trigger === 'lead-created') {
      /** Lead yang sudah `qualified` sudah punya Opportunity — follow-up-nya berpindah ke rule Penawaran. */
      for (const lead of LEADS.filter(item => !item.archived && (item.stage === 'new' || item.stage === 'contacted'))) {
        tasks.push(toTask(rule, {
          type: 'lead',
          id: lead.id,
          contactName: lead.name,
          companyName: lead.companyName,
          phone: lead.phone,
          email: lead.email
        }, lead.createdAt, referenceIso))
      }
    }

    if (rule.trigger === 'quotation-sent') {
      for (const party of PARTIES.filter(item => item.lifecycleStatus === 'prospect')) {
        const contact = primaryContact(party.id)
        tasks.push(toTask(rule, {
          type: 'party',
          id: party.id,
          contactName: contact?.name ?? party.name,
          companyName: party.name,
          phone: contact?.phone ?? party.phone,
          email: contact?.email ?? party.email
        }, party.createdAt, referenceIso))
      }
    }

    if (rule.trigger === 'project-completed') {
      for (const project of PROJECTS.filter(item => item.status === 'completed')) {
        const party = PARTIES.find(item => item.id === project.partyId)
        const contact = primaryContact(project.partyId)
        tasks.push(toTask(rule, {
          type: 'party',
          id: project.partyId,
          contactName: contact?.name ?? party?.name ?? project.partyId,
          companyName: party?.name,
          phone: contact?.phone ?? party?.phone,
          email: contact?.email ?? party?.email
        }, project.travelEndDate, referenceIso))
      }
    }

    if (rule.trigger === 'no-contact') {
      for (const party of PARTIES.filter(item => item.lifecycleStatus === 'client')) {
        const projects = PROJECTS.filter(item => item.partyId === party.id)
        if (!projects.length) { continue }
        const lastDate = projects.map(item => item.travelEndDate).sort().at(-1)!
        const contact = primaryContact(party.id)
        tasks.push(toTask(rule, {
          type: 'party',
          id: party.id,
          contactName: contact?.name ?? party.name,
          companyName: party.name,
          phone: contact?.phone ?? party.phone,
          email: contact?.email ?? party.email
        }, lastDate, referenceIso))
      }
    }
  }

  /** Yang paling terlambat lebih dulu — itulah yang paling berisiko hilang. */
  return tasks.sort((a, b) => b.overdueDays - a.overdueDays)
}

export function getDueFollowUps (referenceIso = DEMO_REFERENCE_DATE): FollowUpTask[] {
  return getFollowUpTasks(referenceIso).filter(task => task.status === 'due')
}

export function createFollowUpRule (input: Omit<FollowUpRule, 'id' | 'isActive'> & { isActive?: boolean }): FollowUpRule {
  const rule: FollowUpRule = {
    ...input,
    id: `FUR-${String(FOLLOW_UP_RULES.length + 1).padStart(3, '0')}`,
    isActive: input.isActive ?? true
  }
  FOLLOW_UP_RULES.push(rule)
  return rule
}

export function toggleFollowUpRule (ruleId: string): FollowUpRule | undefined {
  const rule = FOLLOW_UP_RULES.find(item => item.id === ruleId)
  if (!rule) { return undefined }
  rule.isActive = !rule.isActive
  return rule
}

/* ------------------------------------------------------------------ *
 * Loyalty
 * ------------------------------------------------------------------ */

function tierForSpend (spendIdr: number): LoyaltyTier {
  return [...LOYALTY_TIERS].reverse().find(tier => spendIdr >= tier.minSpendIdr) ?? LOYALTY_TIERS[0]
}

function nextTierAfter (tier: LoyaltyTier): LoyaltyTier | undefined {
  const index = LOYALTY_TIERS.findIndex(item => item.key === tier.key)
  return LOYALTY_TIERS[index + 1]
}

/**
 * Ringkasan loyalty per customer — DITURUNKAN dari invoice yang benar-benar sudah dibayar, bukan angka
 * yang diketik terpisah. Poin dasar = (total belanja dalam juta) × rate tier, ditambah penyesuaian manual.
 */
export function getLoyaltyAccount (partyId: string, referenceIso = DEMO_REFERENCE_DATE): LoyaltyAccountSummary | undefined {
  const party = PARTIES.find(item => item.id === partyId)
  if (!party) { return undefined }

  const projects = PROJECTS.filter(item => item.partyId === partyId)
  const projectIds = new Set(projects.map(item => item.id))
  const totalSpendIdr = INVOICES
    .filter(invoice => projectIds.has(invoice.projectId) && invoice.status === 'paid')
    .reduce((sum, invoice) => sum + invoice.amountIdr, 0)

  const tier = tierForSpend(totalSpendIdr)
  const nextTier = nextTierAfter(tier)
  const basePoints = Math.round((totalSpendIdr / 1_000_000) * tier.pointsPerMillion)
  const adjustmentPoints = LOYALTY_ADJUSTMENTS
    .filter(item => item.partyId === partyId)
    .reduce((sum, item) => sum + item.points, 0)

  const lastProjectAt = projects.map(item => item.travelEndDate).sort().at(-1)

  return {
    partyId,
    partyName: party.name,
    totalSpendIdr,
    projectCount: projects.length,
    basePoints,
    adjustmentPoints,
    totalPoints: basePoints + adjustmentPoints,
    tier,
    nextTier,
    spendToNextTierIdr: nextTier ? Math.max(0, nextTier.minSpendIdr - totalSpendIdr) : 0,
    lastProjectAt,
    daysSinceLastProject: lastProjectAt ? differenceInCalendarDays(parseISO(referenceIso), parseISO(lastProjectAt)) : undefined
  }
}

export function getLoyaltyLeaderboard (referenceIso = DEMO_REFERENCE_DATE): LoyaltyAccountSummary[] {
  return PARTIES
    .filter(party => party.lifecycleStatus === 'client')
    .map(party => getLoyaltyAccount(party.id, referenceIso))
    .filter((account): account is LoyaltyAccountSummary => Boolean(account))
    .sort((a, b) => b.totalPoints - a.totalPoints)
}

export function getLoyaltyAdjustments (partyId: string): LoyaltyAdjustment[] {
  return LOYALTY_ADJUSTMENTS.filter(item => item.partyId === partyId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function addLoyaltyAdjustment (partyId: string, points: number, reason: string, createdBy: string): LoyaltyAdjustment | undefined {
  if (!reason.trim() || !Number.isFinite(points) || points === 0) { return undefined }
  const adjustment: LoyaltyAdjustment = {
    id: `LYA-${String(LOYALTY_ADJUSTMENTS.length + 1).padStart(3, '0')}`,
    partyId,
    points: Math.round(points),
    reason: reason.trim(),
    createdAt: DEMO_REFERENCE_DATE,
    createdBy
  }
  LOYALTY_ADJUSTMENTS.push(adjustment)
  return adjustment
}

export const FOLLOW_UP_CHANNEL_LABEL: Record<FollowUpChannel, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  phone: 'Telepon'
}
