<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Calendar, Users, Wallet } from 'lucide-vue-next'
import { PROJECTS, getPartyById } from '~/data'
import { PROJECT_STATUSES, PROJECT_CHARACTERISTICS, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDateRange, formatTravelerCount } from '~/utils/format'
import { isProjectNeedingAttention, isUpcomingDeparture } from '~/utils/attention'
import { getInvoicesByProject, getTasksByProject, getActivitiesByProject } from '~/data'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Projects' })

const { canView } = usePermissions()

const searchQuery = ref('')
const selectedStatus = ref('all')

const filteredProjects = computed(() => {
  let result = PROJECTS

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(project =>
      project.name.toLowerCase().includes(q) ||
      project.id.toLowerCase().includes(q) ||
      project.destination.toLowerCase().includes(q),
    )
  }

  if (selectedStatus.value !== 'all') {
    result = result.filter(project => project.status === selectedStatus.value)
  }

  return result
})

function needsAttention(projectId: string) {
  const project = PROJECTS.find(p => p.id === projectId)!
  return isProjectNeedingAttention(project, {
    invoices: getInvoicesByProject(projectId),
    tasks: getTasksByProject(projectId),
    activities: getActivitiesByProject(projectId),
  })
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Projects"
      description="Daftar seluruh project MANOVA."
      :breadcrumb="[{ label: 'Projects' }]"
    />

    <RoleAccessState v-if="!canView('project')" module-label="modul Projects" />

    <template v-else>
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari project..." class="pl-9" />
        </div>
        <select
          v-model="selectedStatus"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="all">Semua Status</option>
          <option v-for="option in PROJECT_STATUSES" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </div>

      <div v-if="filteredProjects.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <NuxtLink
          v-for="project in filteredProjects"
          :key="project.id"
          :to="`/projects/${project.id}`"
          class="bg-card rounded-xl p-6 card-shadow hover:card-shadow-lg transition-shadow block"
        >
          <div class="flex items-start justify-between mb-3 gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              <StatusBadge
                :label="findStatusOption(PROJECT_STATUSES, project.status).label"
                :tone="findStatusOption(PROJECT_STATUSES, project.status).tone"
              />
              <StatusBadge
                :label="findStatusOption(PROJECT_CHARACTERISTICS, project.characteristic).label"
                :tone="findStatusOption(PROJECT_CHARACTERISTICS, project.characteristic).tone"
              />
              <AttentionIndicator v-if="needsAttention(project.id)" severity="high" label="Perlu Perhatian" />
              <StatusBadge v-if="isUpcomingDeparture(project)" label="Upcoming Departure" tone="info" />
            </div>
          </div>

          <h3 class="text-lg font-semibold text-foreground">{{ project.name }}</h3>
          <p class="text-sm text-muted-foreground mt-1">{{ getPartyById(project.partyId)?.name }} · {{ project.destination }}</p>

          <div class="grid grid-cols-3 gap-4 pt-4 mt-4 border-t border-border">
            <div class="flex items-center gap-2">
              <Calendar class="h-4 w-4 text-muted-foreground shrink-0" />
              <p class="text-sm text-foreground">{{ formatDateRange(project.travelStartDate, project.travelEndDate) }}</p>
            </div>
            <div class="flex items-center gap-2">
              <Users class="h-4 w-4 text-muted-foreground shrink-0" />
              <p class="text-sm text-foreground">{{ formatTravelerCount(project.travelerCount) }}</p>
            </div>
            <div class="flex items-center gap-2">
              <Wallet class="h-4 w-4 text-muted-foreground shrink-0" />
              <p class="text-sm text-foreground">{{ formatCurrencyIdr(project.budgetIdr) }}</p>
            </div>
          </div>
        </NuxtLink>
      </div>

      <SectionCard v-else>
        <EmptyState
          :icon="Search"
          title="Tidak ada project ditemukan"
          description="Coba ubah kata kunci pencarian atau filter status."
        />
      </SectionCard>
    </template>
  </div>
</template>
