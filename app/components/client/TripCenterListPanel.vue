<script setup lang="ts">
import { computed } from 'vue'
import { Compass } from 'lucide-vue-next'
import { getProjectsByParty, getTripCenterMode, getProjectOrderStatus } from '~/data'
import { PROJECT_ORDER_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate, daysUntil } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { BadgeTone } from '~/types/common'

/**
 * Tab "Trip Center" — Menu Client Portal > My Trips (Penyederhanaan 7-Role/Menu). Dulu `/client/trip-center`,
 * kini tab dalam satu menu bersama Projects/Participants/Itineraries/Reservations/Change Requests — logika
 * tidak diubah. Daftar Project Order company dikelompokkan menurut mode (Pre-departure/Active/Trip
 * Completed, derivasi `getTripCenterMode`) — halaman detail penuh di `/client/trip-center/[projectId]`.
 */

const { canView, clientScopeId } = usePermissions()

const MODE_LABEL: Record<string, string> = { 'pre-departure': 'Pra-Keberangkatan', active: 'Sedang Berjalan', completed: 'Selesai' }
const MODE_TONE: Record<string, BadgeTone> = { 'pre-departure': 'info', active: 'warning', completed: 'success' }

const rows = computed(() => {
  const projects = clientScopeId.value ? getProjectsByParty(clientScopeId.value) : []
  return projects
    .map(project => ({ project, mode: getTripCenterMode(project) }))
    .sort((a, b) => {
      const order = { active: 0, 'pre-departure': 1, completed: 2 }
      return order[a.mode] - order[b.mode] || a.project.travelStartDate.localeCompare(b.project.travelStartDate)
    })
})

function countdownLabel (row: { project: { travelStartDate: string; travelEndDate: string }; mode: string }): string {
  if (row.mode === 'pre-departure') {
    const days = daysUntil(row.project.travelStartDate, DEMO_REFERENCE_DATE)
    return `Keberangkatan H-${days}`
  }
  if (row.mode === 'active') {
    const days = daysUntil(row.project.travelEndDate, DEMO_REFERENCE_DATE)
    return days > 0 ? `Berakhir H-${days}` : 'Hari terakhir trip'
  }
  return `Selesai ${formatDate(row.project.travelEndDate)}`
}
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <SectionCard>
        <ul v-if="rows.length" class="divide-y divide-border">
          <li v-for="row in rows" :key="row.project.id" class="py-3">
            <NuxtLink :to="`/client/trip-center/${row.project.id}`" class="flex items-center justify-between gap-3 group">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground truncate group-hover:underline">
                  {{ row.project.name }}
                </p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ row.project.destination }} · {{ countdownLabel(row) }} · {{ findStatusOption(PROJECT_ORDER_STATUSES, getProjectOrderStatus(row.project)).label }}
                </p>
              </div>
              <StatusBadge :label="MODE_LABEL[row.mode]" :tone="MODE_TONE[row.mode]" />
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else :icon="Compass" title="Belum ada Project Order" description="Trip Center akan tampil di sini setelah Project Order Anda dibuat." />
      </SectionCard>
    </template>
  </div>
</template>
