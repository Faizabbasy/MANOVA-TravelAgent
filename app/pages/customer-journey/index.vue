<script setup lang="ts">
import { computed } from 'vue'
import { Users, Target, Building2, FolderKanban, BarChart3 } from 'lucide-vue-next'
import { LEADS, OPPORTUNITIES, PARTIES, getOpportunitiesByOwner, getProjectsByAccountExecutive } from '~/data'
import { LEAD_STAGES, OPPORTUNITY_STAGES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr } from '~/utils/format'
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Customer Journey' })

const { currentUser, currentRole } = useCurrentUser()
const { canView } = usePermissions()

/** Sales dibatasi ke Lead saja (docs Prompt 19-10); AE/Management/Super Admin/Viewer melihat seluruh Customer Journey. */
const isLeadOnlyView = computed(() => currentRole.value === 'sales')

const scopedOpportunities = computed(() =>
  currentRole.value === 'account-executive' ? getOpportunitiesByOwner(currentUser.value.id) : OPPORTUNITIES,
)
const scopedLeads = computed(() =>
  currentRole.value === 'sales' ? LEADS.filter(lead => lead.ownerId === currentUser.value.id) : LEADS,
)
const scopedProjectOrders = computed(() =>
  currentRole.value === 'account-executive' ? getProjectsByAccountExecutive(currentUser.value.id) : undefined,
)

const activeLeadCount = computed(() => scopedLeads.value.filter(lead => !lead.archived).length)
const qualifiedLeadCount = computed(() => scopedLeads.value.filter(lead => lead.stage === 'qualified').length)
const openOpportunityCount = computed(() => scopedOpportunities.value.filter(opp => !['won', 'lost'].includes(opp.stage)).length)
const activeClientCount = computed(() => PARTIES.filter(party => party.lifecycleStatus === 'client').length)
const pipelineValueIdr = computed(() => scopedOpportunities.value
  .filter(opp => !['won', 'lost'].includes(opp.stage))
  .reduce((sum, opp) => sum + opp.estimatedValueIdr, 0))

const leadStageBreakdown = computed<StatusBreakdownItem[]>(() => {
  const byStage = new Map<string, number>()
  for (const lead of scopedLeads.value.filter(l => !l.archived)) byStage.set(lead.stage, (byStage.get(lead.stage) ?? 0) + 1)
  return LEAD_STAGES
    .filter(stage => byStage.has(stage.value))
    .sort((a, b) => a.order - b.order)
    .map(stage => ({ key: stage.value, label: stage.label, tone: stage.tone, count: byStage.get(stage.value)! }))
})

const opportunityStageBreakdown = computed<StatusBreakdownItem[]>(() => {
  const byStage = new Map<string, number>()
  for (const opp of scopedOpportunities.value) byStage.set(opp.stage, (byStage.get(opp.stage) ?? 0) + 1)
  return OPPORTUNITY_STAGES
    .filter(stage => byStage.has(stage.value))
    .sort((a, b) => a.order - b.order)
    .map(stage => ({ key: stage.value, label: stage.label, tone: stage.tone, count: byStage.get(stage.value)! }))
})

const links = [
  { label: 'Leads', to: '/customer-journey/leads', icon: Users, description: 'Table/Kanban/Inbox, screening dan qualification.' },
  { label: 'Customers', to: '/customer-journey/customers', icon: Building2, description: 'Directory company, Account Owner, lifecycle.', leadOnly: false },
  { label: 'Project Orders', to: '/customer-journey/project-orders', icon: FolderKanban, description: 'Seluruh Project Order lintas client.', leadOnly: false },
  { label: 'Lead Source Recap', to: '/customer-journey/lead-sources', icon: BarChart3, description: 'Rekap performa sumber lead dan conversion rate.', leadOnly: false },
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
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard title="Lead Aktif" :value="String(activeLeadCount)" :icon="Users" />
        <StatsCard title="Lead Qualified" :value="String(qualifiedLeadCount)" :icon="Users" icon-color="success" />
        <template v-if="!isLeadOnlyView">
          <StatsCard title="Open Opportunities" :value="String(openOpportunityCount)" :icon="Target" />
          <StatsCard title="Nilai Pipeline" :value="formatCurrencyIdr(pipelineValueIdr)" :icon="Target" icon-color="primary" />
          <StatsCard title="Active Clients" :value="String(activeClientCount)" :icon="Building2" icon-color="success" />
        </template>
      </div>

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
              <NuxtLink :to="`/customer-journey/project-orders/${project.id}`" class="text-sm font-medium text-foreground hover:underline truncate">{{ project.name }}</NuxtLink>
              <span class="text-xs text-muted-foreground shrink-0">{{ project.id }}</span>
            </li>
          </ul>
          <EmptyState v-else title="Belum ada Project Order milik Anda" />
        </SectionCard>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <NuxtLink v-for="link in links" :key="link.to" v-show="!isLeadOnlyView || link.label === 'Leads'" :to="link.to">
          <SectionCard :title="link.label" :description="link.description">
            <component :is="link.icon" class="h-5 w-5 text-muted-foreground" />
          </SectionCard>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>
