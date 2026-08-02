<script setup lang="ts">
import { computed } from 'vue'
import { Users, Target, Building2, FolderKanban, BarChart3 } from 'lucide-vue-next'
import {
  LEADS, OPPORTUNITIES, PARTIES, PROJECTS,
  getOpportunitiesByOwner, getProjectsByAccountExecutive, getPartiesByAccountOwner, getQuotationByOpportunity
} from '~/data'
import { LEAD_STAGES, OPPORTUNITY_STAGES } from '~/constants/status'
import { formatCurrencyIdr, formatPercentage } from '~/utils/format'
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Customer Journey' })

const { currentUser, currentRole } = useCurrentUser()
const { canView } = usePermissions()

/** Sales dibatasi ke Lead saja (docs Prompt 19-10); AE/Management/Super Admin/Viewer melihat seluruh Customer Journey. */
const isLeadOnlyView = computed(() => currentRole.value === 'sales')
/** "AE data scope ke portfolio miliknya; Super Admin seluruh data" (Section 07, Wajib) — narrow scoping hanya untuk role account-executive, seluruh role lain (termasuk Management/Viewer) tetap melihat data penuh, konsisten pola existing `scopedOpportunities`. */
const isAeScoped = computed(() => currentRole.value === 'account-executive')

/**
 * Section 07 — sebelumnya `scopedLeads` untuk AE TIDAK ter-scope sama sekali (bug: AE melihat seluruh
 * LEADS, sama seperti Super Admin). Diperbaiki: AE melihat Lead yang di-handover ke dirinya
 * (`handedOverTo`, field yang sama dipakai toggle "Assigned to Me" di `/customer-journey/leads`).
 */
const scopedLeads = computed(() => {
  if (currentRole.value === 'sales') { return LEADS.filter(lead => lead.ownerId === currentUser.value.id) }
  if (isAeScoped.value) { return LEADS.filter(lead => lead.handedOverTo === currentUser.value.id) }
  return LEADS
})
const scopedOpportunities = computed(() => (isAeScoped.value ? getOpportunitiesByOwner(currentUser.value.id) : OPPORTUNITIES))
/** Party/Company (Section 07, baru) — sebelumnya "Active Clients" selalu dihitung dari seluruh `PARTIES`, tidak ter-scope untuk AE. */
const scopedParties = computed(() => (isAeScoped.value ? getPartiesByAccountOwner(currentUser.value.id) : PARTIES))
const scopedProjectOrders = computed(() => (isAeScoped.value ? getProjectsByAccountExecutive(currentUser.value.id) : undefined))

const activeLeadCount = computed(() => scopedLeads.value.filter(lead => !lead.archived).length)
const qualifiedLeadCount = computed(() => scopedLeads.value.filter(lead => lead.stage === 'qualified').length)
const openOpportunityCount = computed(() => scopedOpportunities.value.filter(opp => !['won', 'lost'].includes(opp.stage)).length)
const activeClientCount = computed(() => scopedParties.value.filter(party => party.lifecycleStatus === 'client').length)
const pipelineValueIdr = computed(() => scopedOpportunities.value
  .filter(opp => !['won', 'lost'].includes(opp.stage))
  .reduce((sum, opp) => sum + opp.estimatedValueIdr, 0))

/**
 * Customer Journey Funnel (Section 07, Wajib "Overview funnel Lead→Qualified→Opportunity→Approved→Won→
 * Client→Project Order") — setiap tahap DIHITUNG independen dari kondisi TERKINI data (snapshot, bukan
 * cohort historis per-lead — codebase tidak menyimpan event-log per transisi), konsisten pola
 * `/customer-journey/lead-sources` (Total Leads/Qualified/Opportunities Created/Won). Karena sebagian
 * Opportunity fixture historis dibuat sebelum entitas `Lead` ada (tidak semua Opportunity claim asal dari
 * Lead), angka "Opportunity" bisa melebihi "Qualified" — didokumentasikan sebagai karakteristik data
 * demo, bukan bug perhitungan. Setiap tahap dapat diklik untuk drill-down ke daftar record terkait.
 */
const funnelStages = computed(() => {
  const approvedOpportunityCount = scopedOpportunities.value.filter(opp => getQuotationByOpportunity(opp.id)?.approvalStatus === 'approved').length
  const wonOpportunityCount = scopedOpportunities.value.filter(opp => opp.stage === 'won').length

  const raw = [
    { key: 'lead', label: 'Lead', count: activeLeadCount.value, to: '/customer-journey/leads' },
    { key: 'qualified', label: 'Qualified', count: qualifiedLeadCount.value, to: '/customer-journey/leads?stage=qualified' },
    { key: 'opportunity', label: 'Opportunity', count: scopedOpportunities.value.length, to: '/crm/opportunities' },
    { key: 'approved', label: 'Approved', count: approvedOpportunityCount, to: '/crm/quotations?tab=all&status=approved' },
    { key: 'won', label: 'Won', count: wonOpportunityCount, to: '/crm/opportunities?stage=won' },
    { key: 'client', label: 'Client', count: activeClientCount.value, to: '/customer-journey/customers?status=client' },
    { key: 'project-order', label: 'Project Order', count: scopedProjectOrders.value ? scopedProjectOrders.value.length : PROJECTS.length, to: '/customer-journey/project-orders' }
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

const opportunityStageBreakdown = computed<StatusBreakdownItem[]>(() => {
  const byStage = new Map<string, number>()
  for (const opp of scopedOpportunities.value) { byStage.set(opp.stage, (byStage.get(opp.stage) ?? 0) + 1) }
  return OPPORTUNITY_STAGES
    .filter(stage => byStage.has(stage.value))
    .sort((a, b) => a.order - b.order)
    .map(stage => ({ key: stage.value, label: stage.label, tone: stage.tone, count: byStage.get(stage.value)! }))
})

const links = [
  { label: 'Leads', to: '/customer-journey/leads', icon: Users, description: 'Table/Kanban/Inbox, screening dan qualification.' },
  { label: 'Customers', to: '/customer-journey/customers', icon: Building2, description: 'Directory company, Account Owner, lifecycle.', leadOnly: false },
  { label: 'Project Orders', to: '/customer-journey/project-orders', icon: FolderKanban, description: 'Seluruh Project Order lintas client.', leadOnly: false },
  { label: 'Lead Source Recap', to: '/customer-journey/lead-sources', icon: BarChart3, description: 'Rekap performa sumber lead dan conversion rate.', leadOnly: false }
]
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Customer Journey"
      description="Lead → Qualified → Opportunity → Quotation → Management Approval → Won → Active Client → Project Order."
      :breadcrumb="[{ label: 'Customer Journey' }]"
    />

    <RoleAccessState v-if="!canView('crm')" module-label="modul Customer Journey" />

    <template v-else>
      <p v-if="isAeScoped" class="text-xs text-muted-foreground -mt-2">
        Menampilkan portfolio Anda saja (Lead di-handover ke Anda, Opportunity/Company/Project Order milik Anda). Management/Super Admin melihat seluruh data.
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard title="Lead Aktif" :value="String(activeLeadCount)" :icon="Users" />
        <StatsCard title="Lead Qualified" :value="String(qualifiedLeadCount)" :icon="Users" icon-color="success" />
        <template v-if="!isLeadOnlyView">
          <StatsCard title="Open Opportunities" :value="String(openOpportunityCount)" :icon="Target" />
          <StatsCard title="Nilai Pipeline" :value="formatCurrencyIdr(pipelineValueIdr)" :icon="Target" icon-color="primary" />
          <StatsCard title="Active Clients" :value="String(activeClientCount)" :icon="Building2" icon-color="success" />
        </template>
      </div>

      <SectionCard
        v-if="!isLeadOnlyView"
        title="Customer Journey Funnel"
        description="Lead → Qualified → Opportunity → Approved → Won → Client → Project Order. Klik tahap mana pun untuk melihat daftar record terkait (drill-down)."
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
          Setiap tahap dihitung dari kondisi data saat ini (bukan histori kohort per-lead). "Opportunity" dapat melebihi "Qualified" karena sebagian data demo dibuat sebelum entitas Lead ada.
        </p>
      </SectionCard>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Lead Pipeline">
          <StatusBreakdownList :items="leadStageBreakdown" empty-label="Tidak ada lead aktif" />
        </SectionCard>
        <SectionCard v-if="!isLeadOnlyView" title="Opportunity Pipeline">
          <StatusBreakdownList :items="opportunityStageBreakdown" empty-label="Tidak ada opportunity" />
        </SectionCard>
        <SectionCard v-if="scopedProjectOrders" title="Project Orders Milik Saya">
          <ul v-if="scopedProjectOrders.length" class="divide-y divide-border">
            <li v-for="project in scopedProjectOrders" :key="project.id" class="py-3 flex items-center justify-between gap-3">
              <NuxtLink :to="`/customer-journey/project-orders/${project.id}`" class="text-sm font-medium text-foreground hover:underline truncate">
                {{ project.name }}
              </NuxtLink>
              <span class="text-xs text-muted-foreground shrink-0">{{ project.id }}</span>
            </li>
          </ul>
          <EmptyState v-else title="Belum ada Project Order milik Anda" />
        </SectionCard>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <NuxtLink v-for="link in links" v-show="!isLeadOnlyView || link.label === 'Leads'" :key="link.to" :to="link.to">
          <SectionCard :title="link.label" :description="link.description">
            <component :is="link.icon" class="h-5 w-5 text-muted-foreground" />
          </SectionCard>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>
