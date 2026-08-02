<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Wallet } from 'lucide-vue-next'
import {
  getProjectById, getPartyById, getOpportunityById, getQuotationByOpportunity, getUserById,
  getActivitiesByProject, getDocumentsByProject
} from '~/data'
import { PROJECT_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateRange, formatTravelerCount } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, canViewFinancials } = usePermissions()
const { currentRole } = useCurrentUser()
/** Sales dibatasi ke Lead saja pada Customer Journey (docs Prompt 19-10) — narrow exception. */
const hasAccess = computed(() => canView('crm') && currentRole.value !== 'sales')

const project = computed(() => getProjectById(String(route.params.id)))
useHead({ title: computed(() => project.value ? project.value.name : 'Project Order Tidak Ditemukan') })

const party = computed(() => (project.value ? getPartyById(project.value.partyId) : undefined))
const opportunity = computed(() => (project.value?.opportunityId ? getOpportunityById(project.value.opportunityId) : undefined))
const quotation = computed(() => (opportunity.value ? getQuotationByOpportunity(opportunity.value.id) : undefined))
const accountExecutive = computed(() => (opportunity.value ? getUserById(opportunity.value.ownerId) : undefined))
const projectManager = computed(() => (project.value ? getUserById(project.value.ownerId) : undefined))
const activities = computed(() => (project.value ? getActivitiesByProject(project.value.id) : []))
const documents = computed(() => (project.value ? getDocumentsByProject(project.value.id) : []))

const varianceIdr = computed(() => project.value ? project.value.budgetIdr - project.value.actualCostIdr : 0)

const overviewMetadata = computed(() => {
  if (!project.value) { return [] }
  return [
    { label: 'Client', value: party.value?.name ?? '—' },
    { label: 'Account Executive', value: accountExecutive.value?.name ?? '—' },
    { label: 'Project Manager', value: projectManager.value?.name ?? '—' },
    { label: 'Destinasi', value: project.value.destination },
    { label: 'Tanggal Perjalanan', value: formatDateRange(project.value.travelStartDate, project.value.travelEndDate) },
    { label: 'Jumlah Traveler', value: formatTravelerCount(project.value.travelerCount) },
    { label: 'Related Opportunity', value: opportunity.value?.title ?? '—' },
    { label: 'Approved Quotation', value: quotation.value ? formatCurrencyIdr(quotation.value.amountIdr) : '—' }
  ]
})
</script>

<template>
  <div class="space-y-6">
    <template v-if="!project">
      <PageHeader title="Project Order Tidak Ditemukan" :breadcrumb="[{ label: 'Customer Journey', to: '/customer-journey' }, { label: 'Project Orders', to: '/customer-journey/project-orders' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Project Order tidak ditemukan" :description="`Project Order dengan ID '${route.params.id}' tidak ada di data demo saat ini.`">
          <Button @click="router.push('/customer-journey/project-orders')">
            Kembali ke Daftar Project Orders
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!hasAccess" module-label="modul Customer Journey" />

    <template v-else>
      <PageHeader
        :title="project.name"
        :description="`Project Order ${project.id}`"
        :breadcrumb="[{ label: 'Customer Journey', to: '/customer-journey' }, { label: 'Project Orders', to: '/customer-journey/project-orders' }, { label: project.name }]"
      >
        <template #actions>
          <StatusBadge :label="findStatusOption(PROJECT_STATUSES, project.status).label" :tone="findStatusOption(PROJECT_STATUSES, project.status).tone" />
          <NuxtLink :to="`/projects/${project.id}`" class="text-sm text-primary hover:underline">
            Buka Project Workspace penuh →
          </NuxtLink>
        </template>
      </PageHeader>

      <SectionCard title="Overview">
        <DetailMetadataList :items="overviewMetadata" />
        <div class="mt-4 pt-4 border-t border-border">
          <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Service Scope
          </p>
          <div class="flex flex-wrap gap-2">
            <StatusBadge
              v-for="type in SERVICE_TYPES.filter(t => project?.serviceScope.includes(t.value))"
              :key="type.value"
              :label="type.label"
              :tone="type.tone"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard v-if="canViewFinancials" title="Financial">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Budget" :value="formatCurrencyIdr(project.budgetIdr)" :icon="Wallet" />
          <StatsCard title="Actual Cost" :value="formatCurrencyIdr(project.actualCostIdr)" :icon="Wallet" :icon-color="project.actualCostIdr > project.budgetIdr ? 'destructive' : 'success'" />
          <StatsCard title="Variance" :value="formatCurrencyIdr(varianceIdr)" :icon="Wallet" :icon-color="varianceIdr >= 0 ? 'success' : 'destructive'" />
          <StatsCard title="Nilai Quotation" :value="formatCurrencyIdr(project.quotationAmountIdr)" :icon="Wallet" icon-color="primary" />
        </div>
        <p class="text-xs text-muted-foreground mt-3">
          Detail lengkap Budget/Actual/Margin/Invoice/Payment tersedia di tab "Finance" pada Project Workspace.
        </p>
      </SectionCard>

      <SectionCard title="Documents">
        <ul v-if="documents.length" class="divide-y divide-border">
          <li v-for="document in documents" :key="document.id" class="py-3 flex items-center justify-between gap-3">
            <span class="text-sm text-foreground truncate">{{ document.name }}</span>
            <span class="text-xs text-muted-foreground shrink-0">{{ formatDate(document.uploadedAt) }}</span>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada dokumen" />
      </SectionCard>

      <SectionCard title="Activity">
        <ul v-if="activities.length" class="divide-y divide-border">
          <li v-for="activity in activities" :key="activity.id" class="py-3">
            <p class="text-sm text-foreground">
              {{ activity.message }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ formatDate(activity.createdAt) }}
            </p>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada activity" />
      </SectionCard>
    </template>
  </div>
</template>
