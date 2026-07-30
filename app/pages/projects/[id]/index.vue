<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Wallet, Users, Truck } from 'lucide-vue-next'
import {
  getProjectById, getPartyById, getUserById, getVendorById,
  getProjectServices, getTravelerGroups, getTravelers,
  getInvoicesByProject, getTasksByProject, getDocumentsByProject, getActivitiesByProject,
} from '~/data'
import {
  PROJECT_STATUSES, PROJECT_CHARACTERISTICS, SERVICE_STATUSES, SERVICE_TYPES,
  INVOICE_STATUSES, TASK_STATUSES, findStatusOption,
} from '~/constants/status'
import { formatCurrencyIdr, formatDateRange, formatDate, formatTravelerCount } from '~/utils/format'
import { isProjectNeedingAttention, isUpcomingDeparture } from '~/utils/attention'
import type { ProjectDetailTab } from '~/types/project'
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView } = usePermissions()

const project = computed(() => getProjectById(String(route.params.id)))

useHead({ title: computed(() => project.value ? project.value.name : 'Project Tidak Ditemukan') })

const activeTab = computed<ProjectDetailTab>({
  get: () => (route.query.tab as ProjectDetailTab) || 'overview',
  set: (value) => router.replace({ query: { ...route.query, tab: value } }),
})

const TABS: { value: ProjectDetailTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'itinerary-services', label: 'Itinerary & Services' },
  { value: 'travelers', label: 'Travelers' },
  { value: 'vendors', label: 'Vendors' },
  { value: 'finance', label: 'Finance' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'documents', label: 'Documents' },
  { value: 'activity-changes', label: 'Activity & Changes' },
]

const party = computed(() => project.value ? getPartyById(project.value.partyId) : undefined)
const owner = computed(() => project.value ? getUserById(project.value.ownerId) : undefined)
const team = computed(() => project.value
  ? project.value.teamUserIds.map(id => getUserById(id)).filter((user): user is NonNullable<typeof user> => Boolean(user))
  : [])
const services = computed(() => project.value ? getProjectServices(project.value.id) : [])
const groups = computed(() => project.value ? getTravelerGroups(project.value.id) : [])
const travelers = computed(() => project.value ? getTravelers(project.value.id) : [])
const invoices = computed(() => project.value ? getInvoicesByProject(project.value.id) : [])
const tasks = computed(() => project.value ? getTasksByProject(project.value.id) : [])
const documents = computed(() => project.value ? getDocumentsByProject(project.value.id) : [])
const activities = computed(() => project.value ? getActivitiesByProject(project.value.id) : [])
const changesOnly = ref(false)
const visibleActivities = computed(() => changesOnly.value ? activities.value.filter(a => a.isChange) : activities.value)

const vendorsForProject = computed(() => {
  const ids = new Set(services.value.map(service => service.vendorId).filter((id): id is string => Boolean(id)))
  return [...ids]
    .map(id => getVendorById(id))
    .filter((vendor): vendor is NonNullable<typeof vendor> => Boolean(vendor))
})

const needsAttention = computed(() => project.value
  ? isProjectNeedingAttention(project.value, { invoices: invoices.value, tasks: tasks.value, activities: activities.value })
  : false)

/** Ringkasan Overview (Section 10) — breakdown/preview dari data tab lain, bukan detail penuh (hard rule: jangan
 * kerjakan seluruh detail traveler/operations/vendor/finance di sini, tab masing-masing tetap sumber lengkapnya). */
const serviceStatusSummary = computed<StatusBreakdownItem[]>(() => {
  const byStatus = new Map<string, number>()
  for (const service of services.value) byStatus.set(service.status, (byStatus.get(service.status) ?? 0) + 1)
  return SERVICE_STATUSES
    .filter(status => byStatus.has(status.value))
    .sort((a, b) => a.order - b.order)
    .map(status => ({ key: status.value, label: status.label, tone: status.tone, count: byStatus.get(status.value)! }))
})

const taskStatusSummary = computed<StatusBreakdownItem[]>(() => {
  const byStatus = new Map<string, number>()
  for (const task of tasks.value) byStatus.set(task.status, (byStatus.get(task.status) ?? 0) + 1)
  return TASK_STATUSES
    .filter(status => byStatus.has(status.value))
    .sort((a, b) => a.order - b.order)
    .map(status => ({ key: status.value, label: status.label, tone: status.tone, count: byStatus.get(status.value)! }))
})

const recentDocuments = computed(() => [...documents.value].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).slice(0, 3))
const recentActivityPreview = computed(() => [...activities.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3))

function goToActivityTab() {
  activeTab.value = 'activity-changes'
}

const summaryMetadata = computed(() => {
  if (!project.value) return []
  return [
    { label: 'Client', value: party.value?.name ?? '—' },
    { label: 'Destinasi', value: project.value.destination },
    { label: 'Tanggal Perjalanan', value: formatDateRange(project.value.travelStartDate, project.value.travelEndDate) },
    { label: 'Project Owner', value: owner.value?.name ?? '—' },
    { label: 'Jumlah Traveler', value: formatTravelerCount(project.value.travelerCount) },
    { label: 'Budget', value: formatCurrencyIdr(project.value.budgetIdr) },
    { label: 'Actual Cost', value: formatCurrencyIdr(project.value.actualCostIdr) },
    { label: 'Nilai Quotation', value: formatCurrencyIdr(project.value.quotationAmountIdr) },
  ]
})
</script>

<template>
  <div class="space-y-6">
    <template v-if="!project">
      <PageHeader title="Project Tidak Ditemukan" :breadcrumb="[{ label: 'Projects', to: '/projects' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="Project tidak ditemukan"
          :description="`Project dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/projects')">Kembali ke Daftar Project</Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('project')" module-label="modul Projects" />

    <template v-else>
      <PageHeader
        :title="project.name"
        :breadcrumb="[{ label: 'Projects', to: '/projects' }, { label: project.name }]"
      >
        <template #actions>
          <StatusBadge
            :label="findStatusOption(PROJECT_STATUSES, project.status).label"
            :tone="findStatusOption(PROJECT_STATUSES, project.status).tone"
          />
          <StatusBadge
            :label="findStatusOption(PROJECT_CHARACTERISTICS, project.characteristic).label"
            :tone="findStatusOption(PROJECT_CHARACTERISTICS, project.characteristic).tone"
          />
          <AttentionIndicator v-if="needsAttention" severity="high" />
          <StatusBadge v-if="isUpcomingDeparture(project)" label="Upcoming Departure" tone="info" />
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
      </SectionCard>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger v-for="tab in TABS" :key="tab.value" :value="tab.value">{{ tab.label }}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div class="space-y-6">
            <SectionCard title="Ringkasan Layanan">
              <div class="flex flex-wrap gap-2 mb-4">
                <StatusBadge
                  v-for="type in SERVICE_TYPES.filter(t => project.serviceScope.includes(t.value))"
                  :key="type.value"
                  :label="type.label"
                  :tone="type.tone"
                />
              </div>
              <p class="text-sm text-muted-foreground mb-4">
                Project ini berasal dari opportunity <NuxtLink v-if="project.opportunityId" to="/crm/opportunities" class="text-primary hover:underline">{{ project.opportunityId }}</NuxtLink><span v-else>—</span>.
              </p>
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tim Project</p>
              <div class="flex flex-wrap gap-2">
                <StatusBadge :label="`Owner: ${owner?.name ?? '—'}`" tone="primary" />
                <StatusBadge v-for="member in team" :key="member.id" :label="member.name" tone="neutral" />
              </div>
            </SectionCard>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard title="Service Summary">
                <StatusBreakdownList :items="serviceStatusSummary" empty-label="Belum ada layanan tercatat" />
              </SectionCard>

              <SectionCard title="Milestone / Task Summary">
                <StatusBreakdownList :items="taskStatusSummary" empty-label="Belum ada task tercatat" />
              </SectionCard>

              <SectionCard title="Document Summary" :description="`${documents.length} dokumen tersimpan`">
                <ul v-if="recentDocuments.length" class="divide-y divide-border">
                  <li v-for="document in recentDocuments" :key="document.id" class="py-2 flex items-center justify-between gap-3">
                    <span class="text-sm text-foreground truncate">{{ document.name }}</span>
                    <span class="text-xs text-muted-foreground shrink-0">{{ formatDate(document.uploadedAt) }}</span>
                  </li>
                </ul>
                <EmptyState v-else title="Belum ada dokumen diunggah" />
              </SectionCard>

              <SectionCard title="Recent Activity">
                <template #actions>
                  <Button v-if="activities.length > 0" size="sm" variant="outline" @click="goToActivityTab">Lihat Semua</Button>
                </template>
                <ul v-if="recentActivityPreview.length" class="divide-y divide-border">
                  <li v-for="entry in recentActivityPreview" :key="entry.id" class="py-2">
                    <p class="text-sm text-foreground">{{ entry.message }}</p>
                    <p class="text-xs text-muted-foreground">{{ formatDate(entry.createdAt) }}</p>
                  </li>
                </ul>
                <EmptyState v-else title="Belum ada aktivitas tercatat" />
              </SectionCard>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="itinerary-services">
          <SectionCard title="Itinerary & Services" description="Sub-section tampil sesuai kombinasi layanan project (conditional service visibility).">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jenis Layanan</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="service in services" :key="service.id">
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(SERVICE_TYPES, service.type).label"
                      :tone="findStatusOption(SERVICE_TYPES, service.type).tone"
                    />
                  </TableCell>
                  <TableCell class="text-foreground">{{ service.label }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ service.vendorId ? getVendorById(service.vendorId)?.name : '—' }}</TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(SERVICE_STATUSES, service.status).label"
                      :tone="findStatusOption(SERVICE_STATUSES, service.status).tone"
                    />
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="services.length === 0" :colspan="4">Belum ada layanan tercatat.</TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="travelers">
          <SectionCard title="Travelers" :description="formatTravelerCount(project.travelerCount)">
            <div v-if="groups.length" class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div v-for="group in groups" :key="group.id" class="p-4 rounded-lg border border-border">
                <p class="text-sm font-medium text-foreground">{{ group.name }}</p>
                <p class="text-xs text-muted-foreground">{{ formatTravelerCount(group.paxCount) }}</p>
              </div>
            </div>
            <div v-if="travelers.length">
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Special Request</p>
              <ul class="space-y-1">
                <li v-for="traveler in travelers" :key="traveler.id" class="text-sm text-foreground">
                  {{ traveler.name }} — <span class="text-muted-foreground">{{ traveler.specialRequest }}</span>
                </li>
              </ul>
            </div>
            <EmptyState v-if="!groups.length && !travelers.length" :icon="Users" title="Belum ada detail traveler tercatat" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="vendors">
          <SectionCard title="Vendors" description="Vendor yang ditugaskan pada layanan project ini.">
            <ul v-if="vendorsForProject.length" class="divide-y divide-border">
              <li v-for="vendor in vendorsForProject" :key="vendor.id" class="py-3 flex items-center justify-between">
                <span class="text-sm font-medium text-foreground">{{ vendor.name }}</span>
                <span class="text-xs text-muted-foreground">{{ vendor.contactName }}</span>
              </li>
            </ul>
            <EmptyState v-else :icon="Truck" title="Belum ada vendor ditugaskan" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="finance">
          <SectionCard title="Finance">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <StatsCard title="Budget" :value="formatCurrencyIdr(project.budgetIdr)" :icon="Wallet" />
              <StatsCard title="Actual Cost" :value="formatCurrencyIdr(project.actualCostIdr)" :icon="Wallet" :icon-color="project.actualCostIdr > project.budgetIdr ? 'destructive' : 'success'" />
              <StatsCard title="Nilai Quotation" :value="formatCurrencyIdr(project.quotationAmountIdr)" :icon="Wallet" icon-color="primary" />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Jatuh Tempo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="invoice in invoices" :key="invoice.id">
                  <TableCell class="text-foreground">{{ invoice.label }}</TableCell>
                  <TableCell>{{ formatCurrencyIdr(invoice.amountIdr) }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ formatDate(invoice.dueAt) }}</TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(INVOICE_STATUSES, invoice.status).label"
                      :tone="findStatusOption(INVOICE_STATUSES, invoice.status).tone"
                    />
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="invoices.length === 0" :colspan="4">Belum ada invoice.</TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="tasks">
          <SectionCard title="Tasks">
            <ul class="divide-y divide-border">
              <li v-for="task in tasks" :key="task.id" class="py-3 flex items-center justify-between gap-3">
                <span class="text-sm text-foreground">{{ task.title }}</span>
                <StatusBadge
                  :label="findStatusOption(TASK_STATUSES, task.status).label"
                  :tone="findStatusOption(TASK_STATUSES, task.status).tone"
                />
              </li>
            </ul>
            <EmptyState v-if="tasks.length === 0" title="Belum ada task tercatat" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="documents">
          <SectionCard title="Documents">
            <ul class="divide-y divide-border">
              <li v-for="document in documents" :key="document.id" class="py-3 flex items-center justify-between gap-3">
                <span class="text-sm text-foreground">{{ document.name }}</span>
                <span class="text-xs text-muted-foreground">{{ formatDate(document.uploadedAt) }}</span>
              </li>
            </ul>
            <EmptyState v-if="documents.length === 0" title="Belum ada dokumen diunggah" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="activity-changes">
          <SectionCard title="Activity & Changes">
            <div class="flex items-center gap-2 mb-4">
              <button
                @click="changesOnly = false"
                :class="['px-3 py-1.5 text-xs rounded-lg border', !changesOnly ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground']"
              >All</button>
              <button
                @click="changesOnly = true"
                :class="['px-3 py-1.5 text-xs rounded-lg border', changesOnly ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground']"
              >Changes only</button>
            </div>
            <ul class="divide-y divide-border">
              <li v-for="entry in visibleActivities" :key="entry.id" class="py-3 flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm text-foreground">{{ entry.message }}</p>
                  <p class="text-xs text-muted-foreground">{{ formatDate(entry.createdAt) }}</p>
                </div>
                <StatusBadge v-if="entry.isChange" :label="entry.reviewed ? 'Change (Reviewed)' : 'Change (Belum Direview)'" :tone="entry.reviewed ? 'info' : 'warning'" />
              </li>
            </ul>
            <EmptyState v-if="visibleActivities.length === 0" title="Belum ada aktivitas tercatat" />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
