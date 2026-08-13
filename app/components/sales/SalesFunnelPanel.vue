<script setup lang="ts">
import { computed } from 'vue'
import { Users, Target, Building2, FolderKanban } from 'lucide-vue-next'
import {
  LEADS, QUOTATIONS, PARTIES, PROJECTS,
  getLeadsByOwner, getProjectsByAccountExecutive, getPartiesByAccountOwner, getQuotationByLead
} from '~/data'
import { LEAD_STAGES, QUOTATION_APPROVAL_STATUSES, LEAD_SOURCES, findStatusOption } from '~/constants/status'
import { formatPercentage } from '~/utils/format'
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'

/**
 * Tab "Funnel" — Menu Sales > Pipeline. Gabungan `/customer-journey` (funnel Lead→Qualified→Quotation→
 * Approved→Won→Client→Project Order) DAN `/customer-journey/lead-sources` (rekap performa per sumber lead)
 * — dua halaman terpisah yang dulu keduanya di bawah modul "CRM" tapi secara isi sama-sama membaca `LEADS`,
 * sekarang jadi satu tab. Route lama tetap ada sebagai redirect (`app/pages/customer-journey/index.vue`,
 * `app/pages/customer-journey/lead-sources/index.vue`). Tahap "Opportunity" DIHAPUS (entitas Opportunity
 * dihapus — lihat komentar desain di `app/types/lead.ts`), digantikan tahap "Quotation" (Lead dengan
 * `quotationId` terisi).
 */

const { currentUser } = useCurrentUser()
const { canView, isRole } = usePermissions()

/**
 * Dulu Sales dibatasi ke Lead saja sementara Account Executive memegang Opportunity ke atas. Sejak
 * `account-executive` melebur ke `sales` (Revisi 9-Modul), satu role yang sama memiliki seluruh rantai
 * Lead → Quotation, sehingga pembatasan "lead only" dihapus.
 */
const isLeadOnlyView = computed(() => false)

/** Portfolio scoping: Sales melihat datanya sendiri, role lain (Management/Super Admin) melihat penuh. */
const isAeScoped = computed(() => isRole('sales'))

/** Sales melihat Lead miliknya sendiri — baik yang ia buat (`ownerId`) maupun yang di-handover kepadanya. */
const scopedLeads = computed(() => {
  if (!isAeScoped.value) { return LEADS }
  return LEADS.filter(lead => lead.ownerId === currentUser.value.id || lead.handedOverTo === currentUser.value.id)
})
/** Lead ber-deal (Quotation sudah dibuat) — pengganti `scopedOpportunities` lama. */
const scopedDealLeads = computed(() => (isAeScoped.value ? getLeadsByOwner(currentUser.value.id).filter(lead => lead.quotationId) : LEADS.filter(lead => lead.quotationId)))
const scopedQuotations = computed(() => {
  const dealLeadIds = new Set(scopedDealLeads.value.map(lead => lead.id))
  return QUOTATIONS.filter(quotation => dealLeadIds.has(quotation.leadId))
})
/** Party/Company (Section 07) — sebelumnya "Active Clients" selalu dihitung dari seluruh `PARTIES`, tidak ter-scope untuk AE. */
const scopedParties = computed(() => (isAeScoped.value ? getPartiesByAccountOwner(currentUser.value.id) : PARTIES))
const scopedProjectOrders = computed(() => (isAeScoped.value ? getProjectsByAccountExecutive(currentUser.value.id) : undefined))

const activeLeadCount = computed(() => scopedLeads.value.filter(lead => !lead.archived).length)
const qualifiedLeadCount = computed(() => scopedLeads.value.filter(lead => lead.stage === 'qualified').length)
const activeClientCount = computed(() => scopedParties.value.filter(party => party.lifecycleStatus === 'client').length)

/**
 * Customer Journey Funnel (Wajib "Overview funnel Lead→Qualified→Quotation→Approved→Won→Client→Project
 * Order") — setiap tahap DIHITUNG independen dari kondisi TERKINI data (snapshot, bukan cohort historis
 * per-lead — codebase tidak menyimpan event-log per transisi). Setiap tahap dapat diklik untuk drill-down.
 */
const funnelStages = computed(() => {
  const approvedQuotationCount = scopedQuotations.value.filter(quotation => quotation.approvalStatus === 'approved').length
  const wonLeadCount = scopedDealLeads.value.filter(lead => Boolean(lead.projectId)).length

  const raw = [
    { key: 'lead', label: 'Lead', count: activeLeadCount.value, to: '/sales/pipeline#leads' },
    { key: 'qualified', label: 'Qualified', count: qualifiedLeadCount.value, to: '/sales/pipeline?stage=qualified#leads' },
    { key: 'quotation', label: 'Quotation', count: scopedDealLeads.value.length, to: '/sales/pipeline#quotations' },
    { key: 'approved', label: 'Approved', count: approvedQuotationCount, to: '/sales/pipeline?qtab=all&status=approved#quotations' },
    { key: 'won', label: 'Won', count: wonLeadCount, to: '/sales/pipeline?stage=qualified#leads' },
    { key: 'client', label: 'Client', count: activeClientCount.value, to: '/customer-journey/customers?status=client' },
    { key: 'project-order', label: 'Project Order', count: scopedProjectOrders.value ? scopedProjectOrders.value.length : PROJECTS.length, to: '/project-orders' }
  ]
  const maxCount = Math.max(1, ...raw.map(stage => stage.count))
  return raw.map((stage, index) => ({
    ...stage,
    barPct: (stage.count / maxCount) * 100,
    conversionPct: index === 0 ? null : (raw[index - 1].count === 0 ? 0 : (stage.count / raw[index - 1].count) * 100)
  }))
})

const leadStageBreakdown = computed<StatusBreakdownItem[]>(() => {
  const byStage = new Map<string, number>()
  for (const lead of scopedLeads.value.filter(l => !l.archived)) { byStage.set(lead.stage, (byStage.get(lead.stage) ?? 0) + 1) }
  return LEAD_STAGES
    .filter(stage => byStage.has(stage.value))
    .sort((a, b) => a.order - b.order)
    .map(stage => ({ key: stage.value, label: stage.label, tone: stage.tone, count: byStage.get(stage.value)! }))
})

/** Breakdown status approval Quotation — pengganti "Opportunity Pipeline" (stage machine Opportunity) lama. */
const quotationApprovalBreakdown = computed<StatusBreakdownItem[]>(() => {
  const byStatus = new Map<string, number>()
  for (const quotation of scopedQuotations.value) { byStatus.set(quotation.approvalStatus ?? 'draft', (byStatus.get(quotation.approvalStatus ?? 'draft') ?? 0) + 1) }
  return QUOTATION_APPROVAL_STATUSES
    .filter(status => byStatus.has(status.value))
    .sort((a, b) => a.order - b.order)
    .map(status => ({ key: status.value, label: status.label, tone: status.tone, count: byStatus.get(status.value)! }))
})

const links = [
  { label: 'Customers', to: '/customer-journey/customers', icon: Building2, description: 'Directory company, Account Owner, lifecycle.' },
  { label: 'Project', to: '/project-orders', icon: FolderKanban, description: 'Seluruh Project lintas client.' }
]

/**
 * Rekap Sumber Lead (dulu `/customer-journey/lead-sources`) — reuse fixture `LEADS` yang sama, TIDAK
 * ter-scope AE (agregat lintas seluruh sumber, bukan portfolio pribadi), konsisten perilaku halaman asal.
 */
const sourceRecapRows = computed(() => LEAD_SOURCES.map((source) => {
  const leads = LEADS.filter(lead => lead.source === source.value)
  const qualified = leads.filter(lead => lead.stage === 'qualified')
  const dealsCreated = leads.filter(lead => lead.quotationId || lead.salesOrderId)
  const won = leads.filter(lead => lead.projectId || lead.salesOrderId)
  return {
    source,
    totalLeads: leads.length,
    qualifiedLeads: qualified.length,
    dealsCreated: dealsCreated.length,
    won: won.length,
    conversionRatePct: leads.length === 0 ? 0 : (won.length / leads.length) * 100
  }
}).filter(row => row.totalLeads > 0))

const sourceTotalLeads = computed(() => LEADS.length)
const sourceTotalQualified = computed(() => LEADS.filter(lead => lead.stage === 'qualified').length)
const sourceTotalDeals = computed(() => LEADS.filter(lead => lead.quotationId || lead.salesOrderId).length)
const sourceTotalWon = computed(() => LEADS.filter(lead => lead.projectId || lead.salesOrderId).length)

/** Copy sebelum sort — `recapRows`/`sourceRecapRows` dipakai juga oleh tabel "Detail per Sumber" tanpa urutan berubah (sort in-place pernah jadi bug, Section 24). */
const sourceBreakdown = computed<StatusBreakdownItem[]>(() =>
  [...sourceRecapRows.value]
    .sort((a, b) => b.totalLeads - a.totalLeads)
    .map(row => ({ key: row.source.value, label: row.source.label, tone: row.source.tone, count: row.totalLeads }))
)
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('crm')" module-label="modul Sales" />

    <template v-else>
      <p v-if="isAeScoped" class="text-xs text-muted-foreground">
        Menampilkan portfolio Anda saja (Lead di-handover ke Anda, Quotation/Company/Project Order milik Anda). Management/Super Admin melihat seluruh data.
      </p>

      <SectionCard
        v-if="!isLeadOnlyView"
        title="Customer Journey Funnel"
        description="Lead → Qualified → Quotation → Approved → Won → Client → Project Order. Klik tahap mana pun untuk melihat daftar record terkait (drill-down)."
      >
        <ol class="divide-y divide-border">
          <li v-for="(stage, index) in funnelStages" :key="stage.key">
            <NuxtLink :to="stage.to" class="group flex items-center justify-between gap-3 py-3 px-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors">
              <div class="flex items-center gap-3 min-w-0">
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{{ index + 1 }}</span>
                <span class="text-sm font-medium text-foreground group-hover:underline truncate">{{ stage.label }}</span>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <span v-if="stage.conversionPct !== null" class="text-xs text-muted-foreground">{{ formatPercentage(stage.conversionPct) }} dari tahap sebelumnya</span>
                <span class="text-lg font-bold text-foreground tabular-nums">{{ stage.count }}</span>
              </div>
            </NuxtLink>
            <div class="mx-2 mb-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div class="h-full rounded-full bg-primary" :style="{ width: `${stage.barPct}%` }" />
            </div>
          </li>
        </ol>
        <p class="text-[11px] text-muted-foreground mt-1">
          Setiap tahap dihitung dari kondisi data saat ini (bukan histori kohort per-lead).
        </p>
      </SectionCard>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Lead Pipeline">
          <StatusBreakdownList :items="leadStageBreakdown" empty-label="Tidak ada lead aktif" />
        </SectionCard>
        <SectionCard v-if="!isLeadOnlyView" title="Quotation Pipeline">
          <StatusBreakdownList :items="quotationApprovalBreakdown" empty-label="Tidak ada quotation" />
        </SectionCard>
        <SectionCard v-if="scopedProjectOrders" title="Project Orders Milik Saya">
          <ul v-if="scopedProjectOrders.length" class="divide-y divide-border">
            <li v-for="project in scopedProjectOrders" :key="project.id" class="py-3 flex items-center justify-between gap-3">
              <NuxtLink :to="`/project-orders/${project.id}`" class="text-sm font-medium text-foreground hover:underline truncate">
                {{ project.name }}
              </NuxtLink>
              <span class="text-xs text-muted-foreground shrink-0">{{ project.id }}</span>
            </li>
          </ul>
          <EmptyState v-else title="Belum ada Project Order milik Anda" />
        </SectionCard>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <NuxtLink v-for="link in links" v-show="!isLeadOnlyView" :key="link.to" :to="link.to">
          <SectionCard :title="link.label" :description="link.description">
            <component :is="link.icon" class="h-5 w-5 text-muted-foreground" />
          </SectionCard>
        </NuxtLink>
      </div>

      <!-- Rekap Sumber Lead (dulu /customer-journey/lead-sources) -->
      <div class="pt-2 border-t border-border">
        <h2 class="text-sm font-semibold text-foreground mb-1">
          Rekap Sumber Lead
        </h2>
        <p class="text-xs text-muted-foreground mb-4">
          Performa sumber lead lintas Website/Instagram/TikTok/WhatsApp/Referral/Event/Email/Sales Outreach/Lainnya — agregat seluruh Sales, tidak ter-scope portfolio.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard title="Total Leads" :value="String(sourceTotalLeads)" :icon="Users" />
          <StatsCard title="Qualified Leads" :value="String(sourceTotalQualified)" :icon="Users" icon-color="success" />
          <StatsCard title="Deals Created" :value="String(sourceTotalDeals)" :icon="Target" />
          <StatsCard title="Won" :value="String(sourceTotalWon)" :icon="Target" icon-color="success" />
        </div>

        <SectionCard title="Distribusi Lead per Sumber">
          <StatusBreakdownList :items="sourceBreakdown" empty-label="Belum ada lead" />
        </SectionCard>

        <SectionCard title="Detail per Sumber" class="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sumber</TableHead>
                <TableHead>Total Leads</TableHead>
                <TableHead>Qualified</TableHead>
                <TableHead>Deals Created</TableHead>
                <TableHead>Won</TableHead>
                <TableHead>Conversion Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in sourceRecapRows" :key="row.source.value">
                <TableCell>
                  <StatusBadge :label="findStatusOption(LEAD_SOURCES, row.source.value).label" :tone="findStatusOption(LEAD_SOURCES, row.source.value).tone" />
                </TableCell>
                <TableCell>{{ row.totalLeads }}</TableCell>
                <TableCell>{{ row.qualifiedLeads }}</TableCell>
                <TableCell>{{ row.dealsCreated }}</TableCell>
                <TableCell>{{ row.won }}</TableCell>
                <TableCell>{{ formatPercentage(row.conversionRatePct) }}</TableCell>
              </TableRow>
              <TableEmpty v-if="sourceRecapRows.length === 0" :colspan="6">
                Belum ada data lead.
              </TableEmpty>
            </TableBody>
          </Table>
        </SectionCard>
      </div>
    </template>
  </div>
</template>
