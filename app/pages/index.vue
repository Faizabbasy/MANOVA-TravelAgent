<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { FolderKanban, Handshake, PlaneTakeoff, AlertTriangle, Receipt, Activity } from 'lucide-vue-next'
import {
  PROJECTS, OPPORTUNITIES, ACTIVITIES,
  getPartyById, getProjectById, getOutstandingInvoices, getProjectsNeedingAttention,
  getInvoicesByProject, getTasksByProject, getActivitiesByProject,
} from '~/data'
import { PROJECT_STATUSES, OPPORTUNITY_STAGES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDateRange, formatDateTime } from '~/utils/format'
import { isUpcomingDeparture, isBudgetOverrun, isInvoiceOverdue, hasUnreviewedChange } from '~/utils/attention'
import type { RoleId } from '~/types/user'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Dashboard' })

const { currentRole } = useCurrentUser()

// Simulasi loading state singkat (Prompt 5-N: "loading state dapat disimulasikan") — data fixture sebenarnya sinkron.
const isLoading = ref(true)
onMounted(() => {
  setTimeout(() => { isLoading.value = false }, 400)
})

function visibleTo(...roles: RoleId[]) {
  return computed(() => roles.includes(currentRole.value))
}

const activeProjects = computed(() => PROJECTS.filter(p => !['completed', 'cancelled'].includes(p.status)))
const openOpportunities = computed(() => OPPORTUNITIES.filter(o => !['won', 'lost'].includes(o.stage)))
const upcomingDepartures = computed(() => PROJECTS.filter(project => isUpcomingDeparture(project)))
const attentionProjects = computed(() => getProjectsNeedingAttention())
const outstandingInvoices = computed(() => getOutstandingInvoices())
const outstandingTotal = computed(() => outstandingInvoices.value.reduce((sum, invoice) => sum + invoice.amountIdr, 0))
const recentActivities = computed(() => [...ACTIVITIES].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6))

function attentionReasons(projectId: string): string[] {
  const project = getProjectById(projectId)!
  const reasons: string[] = []
  if (project.status === 'on-hold') reasons.push('Status On Hold')
  if (isBudgetOverrun(project)) reasons.push('Actual cost melebihi budget')
  if (getInvoicesByProject(projectId).some(invoice => isInvoiceOverdue(invoice))) reasons.push('Ada invoice overdue')
  if (getTasksByProject(projectId).some(task => task.status === 'overdue')) reasons.push('Ada task overdue')
  if (hasUnreviewedChange(getActivitiesByProject(projectId))) reasons.push('Ada perubahan belum direview')
  return reasons
}

const kpiCards = computed(() => [
  {
    key: 'active-projects', title: 'Active Projects', value: String(activeProjects.value.length), icon: FolderKanban,
    visible: visibleTo('management', 'project-manager', 'operations', 'ticketing', 'accommodation', 'transportation', 'mice', 'finance', 'super-admin', 'viewer').value,
  },
  {
    key: 'open-opportunities', title: 'Open Opportunities', value: String(openOpportunities.value.length), icon: Handshake,
    visible: visibleTo('sales', 'management', 'super-admin', 'viewer').value,
  },
  {
    key: 'upcoming-departures', title: 'Upcoming Departures', value: String(upcomingDepartures.value.length), icon: PlaneTakeoff,
    visible: visibleTo('project-manager', 'operations', 'ticketing', 'accommodation', 'transportation', 'mice', 'super-admin', 'viewer').value,
  },
  {
    key: 'attention', title: 'Project Perlu Perhatian', value: String(attentionProjects.value.length), icon: AlertTriangle, iconColor: 'destructive' as const,
    visible: visibleTo('management', 'project-manager', 'super-admin', 'viewer').value,
  },
  {
    key: 'outstanding', title: 'Outstanding Invoices', value: formatCurrencyIdr(outstandingTotal.value), icon: Receipt, iconColor: 'warning' as const,
    visible: visibleTo('finance', 'management', 'super-admin', 'viewer').value,
  },
])

const showActiveProjects = visibleTo('management', 'project-manager', 'operations', 'ticketing', 'accommodation', 'transportation', 'mice', 'finance', 'super-admin', 'viewer')
const showOpenOpportunities = visibleTo('sales', 'management', 'super-admin', 'viewer')
const showUpcomingDepartures = visibleTo('project-manager', 'operations', 'ticketing', 'accommodation', 'transportation', 'mice', 'super-admin', 'viewer')
const showAttention = visibleTo('management', 'project-manager', 'super-admin', 'viewer')
const showOutstanding = visibleTo('finance', 'management', 'super-admin', 'viewer')
const showRecentActivity = computed(() => true)
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Dashboard"
      description="Ringkasan lintas-domain, konten menyesuaikan role yang sedang login."
    />

    <LoadingState v-if="isLoading" message="Memuat ringkasan dashboard..." :rows="4" />

    <template v-else>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <template v-for="card in kpiCards" :key="card.key">
        <StatsCard v-if="card.visible" :title="card.title" :value="card.value" :icon="card.icon" :icon-color="card.iconColor" />
      </template>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SectionCard v-if="showActiveProjects" title="Active Projects">
        <ul class="divide-y divide-border">
          <li v-for="project in activeProjects" :key="project.id" class="py-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <NuxtLink :to="`/projects/${project.id}`" class="text-sm font-medium text-foreground hover:underline truncate block">
                {{ project.name }}
              </NuxtLink>
              <p class="text-xs text-muted-foreground truncate">{{ getPartyById(project.partyId)?.name }}</p>
            </div>
            <StatusBadge
              :label="findStatusOption(PROJECT_STATUSES, project.status).label"
              :tone="findStatusOption(PROJECT_STATUSES, project.status).tone"
            />
          </li>
        </ul>
        <EmptyState v-if="activeProjects.length === 0" title="Belum ada project aktif" />
      </SectionCard>

      <SectionCard v-if="showOpenOpportunities" title="Open Opportunities">
        <ul class="divide-y divide-border">
          <li v-for="opportunity in openOpportunities" :key="opportunity.id" class="py-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-foreground truncate">{{ opportunity.title }}</p>
              <p class="text-xs text-muted-foreground truncate">{{ getPartyById(opportunity.partyId)?.name }}</p>
            </div>
            <StatusBadge
              :label="findStatusOption(OPPORTUNITY_STAGES, opportunity.stage).label"
              :tone="findStatusOption(OPPORTUNITY_STAGES, opportunity.stage).tone"
            />
          </li>
        </ul>
        <EmptyState v-if="openOpportunities.length === 0" title="Tidak ada opportunity terbuka" />
      </SectionCard>

      <SectionCard v-if="showUpcomingDepartures" title="Upcoming Departures">
        <ul class="divide-y divide-border">
          <li v-for="project in upcomingDepartures" :key="project.id" class="py-3">
            <NuxtLink :to="`/projects/${project.id}`" class="text-sm font-medium text-foreground hover:underline">{{ project.name }}</NuxtLink>
            <p class="text-xs text-muted-foreground">{{ project.destination }} · {{ formatDateRange(project.travelStartDate, project.travelEndDate) }}</p>
          </li>
        </ul>
        <EmptyState v-if="upcomingDepartures.length === 0" title="Tidak ada keberangkatan dalam 30 hari ke depan" />
      </SectionCard>

      <SectionCard v-if="showAttention" title="Project Perlu Perhatian">
        <ul class="divide-y divide-border">
          <li v-for="project in attentionProjects" :key="project.id" class="py-3">
            <div class="flex items-center justify-between gap-2">
              <NuxtLink :to="`/projects/${project.id}`" class="text-sm font-medium text-foreground hover:underline">{{ project.name }}</NuxtLink>
              <AttentionIndicator severity="high" label="Perlu Perhatian" />
            </div>
            <ul class="mt-1 text-xs text-muted-foreground list-disc list-inside">
              <li v-for="reason in attentionReasons(project.id)" :key="reason">{{ reason }}</li>
            </ul>
          </li>
        </ul>
        <EmptyState v-if="attentionProjects.length === 0" title="Tidak ada project yang butuh perhatian" />
      </SectionCard>

      <SectionCard v-if="showOutstanding" title="Outstanding Invoices">
        <ul class="divide-y divide-border">
          <li v-for="invoice in outstandingInvoices" :key="invoice.id" class="py-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-foreground truncate">{{ invoice.label }}</p>
              <p class="text-xs text-muted-foreground truncate">{{ getProjectById(invoice.projectId)?.name }}</p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-medium text-foreground">{{ formatCurrencyIdr(invoice.amountIdr) }}</p>
              <StatusBadge v-if="isInvoiceOverdue(invoice)" label="Overdue" tone="destructive" />
            </div>
          </li>
        </ul>
        <EmptyState v-if="outstandingInvoices.length === 0" title="Tidak ada invoice outstanding" />
      </SectionCard>

      <SectionCard v-if="showRecentActivity" title="Recent Activity">
        <ul class="divide-y divide-border">
          <li v-for="activity in recentActivities" :key="activity.id" class="py-3 flex items-start gap-3">
            <Activity class="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div class="min-w-0">
              <p class="text-sm text-foreground">{{ activity.message }}</p>
              <p class="text-xs text-muted-foreground">
                {{ getProjectById(activity.projectId)?.name }} · {{ formatDateTime(activity.createdAt) }}
              </p>
            </div>
          </li>
        </ul>
        <EmptyState v-if="recentActivities.length === 0" title="Belum ada aktivitas" />
      </SectionCard>
    </div>
    </template>
  </div>
</template>
