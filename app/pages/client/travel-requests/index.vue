<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Plus, Send } from 'lucide-vue-next'
import { getTravelRequestsByParty } from '~/data'
import { TRAVEL_REQUEST_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate, formatDateRange } from '~/utils/format'
import type { TravelRequestStatus } from '~/types/travel-request'

/**
 * Travel Requests — List (Repair Phase Section 3 — Request & Commercial). Menggantikan `ModulePlaceholder`
 * Section 1. Isolasi lewat `clientScopeId` (pola sama seluruh halaman `/client/**`).
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Travel Requests' })

const { canView, clientScopeId } = usePermissions()

const search = ref('')
const statusFilter = ref<'all' | TravelRequestStatus>('all')
const sortBy = ref<'newest' | 'oldest' | 'name'>('newest')

const travelRequests = computed(() => (clientScopeId.value ? getTravelRequestsByParty(clientScopeId.value) : []))

const filteredTravelRequests = computed(() => {
  let result = travelRequests.value
  if (statusFilter.value !== 'all') { result = result.filter(item => item.status === statusFilter.value) }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    result = result.filter(item => item.requestName.toLowerCase().includes(q) || item.destination.toLowerCase().includes(q))
  }
  return [...result].sort((a, b) => {
    if (sortBy.value === 'name') { return a.requestName.localeCompare(b.requestName) }
    return sortBy.value === 'newest' ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)
  })
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Travel Requests"
      description="Ajukan dan pantau status permintaan perjalanan Anda."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Request & Commercial' }, { label: 'Travel Requests' }]"
    >
      <template #actions>
        <NuxtLink to="/client/travel-requests/new">
          <Button size="sm">
            <Plus class="h-4 w-4 mr-1.5" />Ajukan Travel Request
          </Button>
        </NuxtLink>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <SectionCard>
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div class="relative flex-1 max-w-sm w-full">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="search" placeholder="Cari nama permintaan atau destinasi..." class="pl-9" />
          </div>
          <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Status
            </option>
            <option v-for="option in TRAVEL_REQUEST_STATUSES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <select v-model="sortBy" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="newest">
              Terbaru
            </option>
            <option value="oldest">
              Terlama
            </option>
            <option value="name">
              Nama (A-Z)
            </option>
          </select>
        </div>

        <ul v-if="filteredTravelRequests.length" class="divide-y divide-border">
          <li v-for="item in filteredTravelRequests" :key="item.id" class="py-3">
            <NuxtLink :to="`/client/travel-requests/${item.id}`" class="flex items-center justify-between gap-3 group">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground truncate group-hover:underline">
                  {{ item.requestName }}
                </p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ item.destination }}
                  <template v-if="item.travelStartDate && item.travelEndDate">
                    · {{ formatDateRange(item.travelStartDate, item.travelEndDate) }}
                  </template>
                  <template v-else-if="item.dateFlexible">
                    · Tanggal fleksibel
                  </template>
                  · Diajukan {{ formatDate(item.createdAt) }}
                </p>
              </div>
              <StatusBadge :label="findStatusOption(TRAVEL_REQUEST_STATUSES, item.status).label" :tone="findStatusOption(TRAVEL_REQUEST_STATUSES, item.status).tone" />
            </NuxtLink>
          </li>
        </ul>
        <EmptyState
          v-else
          :icon="Send"
          :title="travelRequests.length ? 'Tidak ada permintaan yang cocok' : 'Belum ada Travel Request'"
          :description="travelRequests.length ? 'Coba ubah kata kunci pencarian atau filter status.' : 'Ajukan permintaan perjalanan pertama Anda.'"
        />
      </SectionCard>
    </template>
  </div>
</template>
