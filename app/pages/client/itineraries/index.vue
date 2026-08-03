<script setup lang="ts">
import { computed } from 'vue'
import { Calendar } from 'lucide-vue-next'
import { getProjectsByParty, getClientVisibleItineraryItems, getLatestItineraryVersion } from '~/data'
import { ITINERARY_VERSION_STATUSES, findStatusOption } from '~/constants/status'
import { formatDateRange } from '~/utils/format'

/**
 * Itineraries — List (Repair Phase Section 4 — Core Project). Satu baris per Project Order yang punya
 * itinerary — detail lengkap (versioning/compare/comment/approve) di `/client/itineraries/:projectId`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Itineraries' })

const { canView, clientScopeId } = usePermissions()

const rows = computed(() => {
  const projects = clientScopeId.value ? getProjectsByParty(clientScopeId.value) : []
  return projects
    .map(project => ({ project, items: getClientVisibleItineraryItems(project.id), version: getLatestItineraryVersion(project.id) }))
    .filter(row => row.items.length > 0)
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Itineraries"
      description="Itinerary Project Order company Anda."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Travel Management' }, { label: 'Itineraries' }]"
    />

    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <SectionCard>
        <ul v-if="rows.length" class="divide-y divide-border">
          <li v-for="row in rows" :key="row.project.id" class="py-3">
            <NuxtLink :to="`/client/itineraries/${row.project.id}`" class="flex items-center justify-between gap-3 group">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground truncate group-hover:underline">
                  {{ row.project.name }}
                </p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ row.project.destination }} · {{ formatDateRange(row.project.travelStartDate, row.project.travelEndDate) }} · {{ row.items.length }} item
                </p>
              </div>
              <StatusBadge
                v-if="row.version"
                :label="findStatusOption(ITINERARY_VERSION_STATUSES, row.version.status).label"
                :tone="findStatusOption(ITINERARY_VERSION_STATUSES, row.version.status).tone"
              />
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else :icon="Calendar" title="Belum ada itinerary" description="Itinerary akan tampil di sini setelah tim kami menyusunnya untuk salah satu Project Order Anda." />
      </SectionCard>
    </template>
  </div>
</template>
