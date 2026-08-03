<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, FolderKanban } from 'lucide-vue-next'
import { getProjectsByParty, getActivitiesByProject, getUserById, getClientProjectReadiness } from '~/data'
import { PROJECT_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDateRange, formatDate } from '~/utils/format'
import type { Project } from '~/types/project'

/**
 * Projects — List (Repair Phase Section 4 — Core Project). Detail tetap `/client/project-orders/[id]`
 * (Project Workspace existing, Section 08 — diperluas section ini, TIDAK dibangun ulang, mengikuti
 * rekomendasi `docs/client-page-inventory.md` #6). "Project value" = `quotationAmountIdr` (selling price,
 * BUKAN `budgetIdr`/`actualCostIdr` internal). "Last activity" = `ACTIVITIES` terbaru project tsb.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Projects' })

const { canView, clientScopeId } = usePermissions()

const search = ref('')
const statusFilter = ref<'all' | Project['status']>('all')

const projects = computed(() => (clientScopeId.value ? getProjectsByParty(clientScopeId.value) : []))

function lastActivityAt (projectId: string): string | undefined {
  const activities = getActivitiesByProject(projectId)
  return activities[0]?.createdAt
}

const rows = computed(() => projects.value.map(project => ({
  project,
  readiness: getClientProjectReadiness(project.id).overallPercent,
  pic: getUserById(project.ownerId)?.name ?? '—',
  lastActivity: lastActivityAt(project.id)
})))

const filteredRows = computed(() => {
  let result = rows.value
  if (statusFilter.value !== 'all') { result = result.filter(row => row.project.status === statusFilter.value) }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    result = result.filter(row => row.project.name.toLowerCase().includes(q) || row.project.destination.toLowerCase().includes(q) || row.project.id.toLowerCase().includes(q))
  }
  return result.sort((a, b) => (b.lastActivity ?? b.project.travelStartDate).localeCompare(a.lastActivity ?? a.project.travelStartDate))
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Projects"
      description="Daftar Project Order company Anda."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Travel Management' }, { label: 'Projects' }]"
    />

    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <SectionCard>
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div class="relative flex-1 max-w-sm w-full">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="search" placeholder="Cari nama project, ID, atau destinasi..." class="pl-9" />
          </div>
          <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Status
            </option>
            <option v-for="option in PROJECT_STATUSES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Destinasi</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Peserta</TableHead>
                <TableHead>Nilai Project</TableHead>
                <TableHead>Readiness</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Manova PIC</TableHead>
                <TableHead>Aktivitas Terakhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in filteredRows" :key="row.project.id">
                <TableCell class="font-medium">
                  <NuxtLink :to="`/client/project-orders/${row.project.id}`" class="text-primary hover:underline">
                    {{ row.project.name }}
                  </NuxtLink>
                  <p class="text-xs text-muted-foreground">
                    {{ row.project.id }}
                  </p>
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ row.project.destination }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ formatDateRange(row.project.travelStartDate, row.project.travelEndDate) }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ row.project.travelerCount }} pax
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ formatCurrencyIdr(row.project.quotationAmountIdr) }}
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-2 min-w-[100px]">
                    <Progress :model-value="row.readiness" class="w-16" />
                    <span class="text-xs text-muted-foreground shrink-0">{{ row.readiness }}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge :label="findStatusOption(PROJECT_STATUSES, row.project.status).label" :tone="findStatusOption(PROJECT_STATUSES, row.project.status).tone" />
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ row.pic }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ row.lastActivity ? formatDate(row.lastActivity) : '—' }}
                </TableCell>
              </TableRow>
              <TableEmpty v-if="filteredRows.length === 0" :colspan="9">
                <EmptyState :icon="FolderKanban" :title="projects.length ? 'Tidak ada project yang cocok' : 'Belum ada Project Order'" :description="projects.length ? 'Coba ubah kata kunci pencarian atau filter status.' : 'Project Order company Anda akan tampil di sini setelah Opportunity Won.'" />
              </TableEmpty>
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </template>
  </div>
</template>
