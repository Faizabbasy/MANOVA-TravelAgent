<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Calendar, Users, Wallet } from 'lucide-vue-next'
import { PROJECTS, USERS, getPartyById, getInvoicesByProject, getTasksByProject, getActivitiesByProject } from '~/data'
import { PROJECT_STATUSES, PROJECT_CHARACTERISTICS, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDateRange, formatTravelerCount } from '~/utils/format'
import { isProjectNeedingAttention, isUpcomingDeparture } from '~/utils/attention'
import type { Project } from '~/types/project'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Projects' })

const { canView } = usePermissions()

const searchQuery = ref('')
const selectedStatus = ref('all')
const selectedType = ref('all')
const selectedClient = ref('all')
const selectedOwner = ref('all')
const sortBy = ref<'name' | 'date' | 'budget'>('date')

const clientOptions = computed(() => {
  const ids = [...new Set(PROJECTS.map(p => p.partyId))]
  return ids.map(id => getPartyById(id)).filter((party): party is NonNullable<typeof party> => Boolean(party))
})
const ownerOptions = computed(() => {
  const ids = [...new Set(PROJECTS.map(p => p.ownerId))]
  return ids.map(id => USERS.find(u => u.id === id)).filter((user): user is NonNullable<typeof user> => Boolean(user))
})

/** Progress linear (Section 10) — hanya berlaku untuk status di jalur utama; On Hold/Cancelled bukan progres linear. */
const LINEAR_STATUSES: Project['status'][] = ['draft', 'planning', 'confirmed', 'in-progress', 'ongoing-trip', 'completed']
function getProjectProgress (project: Project): number | null {
  const index = LINEAR_STATUSES.indexOf(project.status)
  if (index === -1) { return null }
  return Math.round((index / (LINEAR_STATUSES.length - 1)) * 100)
}

const filteredProjects = computed(() => {
  let result = PROJECTS

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(project =>
      project.name.toLowerCase().includes(q) ||
      project.id.toLowerCase().includes(q) ||
      project.destination.toLowerCase().includes(q)
    )
  }

  if (selectedStatus.value !== 'all') {
    result = result.filter(project => project.status === selectedStatus.value)
  }
  if (selectedType.value !== 'all') {
    result = result.filter(project => project.characteristic === selectedType.value)
  }
  if (selectedClient.value !== 'all') {
    result = result.filter(project => project.partyId === selectedClient.value)
  }
  if (selectedOwner.value !== 'all') {
    result = result.filter(project => project.ownerId === selectedOwner.value)
  }

  return [...result].sort((a, b) => {
    if (sortBy.value === 'name') { return a.name.localeCompare(b.name) }
    if (sortBy.value === 'budget') { return b.budgetIdr - a.budgetIdr }
    return a.travelStartDate.localeCompare(b.travelStartDate)
  })
})

function needsAttention (projectId: string) {
  const project = PROJECTS.find(p => p.id === projectId)!
  return isProjectNeedingAttention(project, {
    invoices: getInvoicesByProject(projectId),
    tasks: getTasksByProject(projectId),
    activities: getActivitiesByProject(projectId)
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
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <select
          v-model="selectedStatus"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="all">
            Semua Status
          </option>
          <option v-for="option in PROJECT_STATUSES" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <select
          v-model="selectedType"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="all">
            Semua Tipe
          </option>
          <option v-for="option in PROJECT_CHARACTERISTICS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <select
          v-model="selectedClient"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="all">
            Semua Client
          </option>
          <option v-for="party in clientOptions" :key="party.id" :value="party.id">
            {{ party.name }}
          </option>
        </select>
        <select
          v-model="selectedOwner"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="all">
            Semua Owner
          </option>
          <option v-for="user in ownerOptions" :key="user.id" :value="user.id">
            {{ user.name }}
          </option>
        </select>
        <select
          v-model="sortBy"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="date">
            Urutkan: Tanggal Keberangkatan
          </option>
          <option value="name">
            Urutkan: Nama (A-Z)
          </option>
          <option value="budget">
            Urutkan: Budget Tertinggi
          </option>
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

          <h3 class="text-lg font-semibold text-foreground">
            {{ project.name }}
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            {{ getPartyById(project.partyId)?.name }} · {{ project.destination }}
          </p>

          <div class="grid grid-cols-3 gap-4 pt-4 mt-4 border-t border-border">
            <div class="flex items-center gap-2">
              <Calendar class="h-4 w-4 text-muted-foreground shrink-0" />
              <p class="text-sm text-foreground">
                {{ formatDateRange(project.travelStartDate, project.travelEndDate) }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <Users class="h-4 w-4 text-muted-foreground shrink-0" />
              <p class="text-sm text-foreground">
                {{ formatTravelerCount(project.travelerCount) }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <Wallet class="h-4 w-4 text-muted-foreground shrink-0" />
              <p class="text-sm text-foreground">
                {{ formatCurrencyIdr(project.budgetIdr) }}
              </p>
            </div>
          </div>

          <div class="mt-4">
            <template v-if="getProjectProgress(project) !== null">
              <div class="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Progres</span>
                <span>{{ getProjectProgress(project) }}%</span>
              </div>
              <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div class="h-full rounded-full bg-primary" :style="{ width: `${getProjectProgress(project)}%` }" />
              </div>
            </template>
            <p v-else class="text-xs text-muted-foreground">
              {{ project.status === 'on-hold' ? 'Progres dihentikan sementara (On Hold)' : 'Project dibatalkan' }}
            </p>
          </div>
        </NuxtLink>
      </div>

      <SectionCard v-else>
        <EmptyState
          :icon="Search"
          title="Tidak ada project ditemukan"
          description="Coba ubah kata kunci pencarian atau filter."
        />
      </SectionCard>
    </template>
  </div>
</template>
