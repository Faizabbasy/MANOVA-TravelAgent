<script setup lang="ts">
import { Inbox, Search, Send } from 'lucide-vue-next'
import { isApiError } from '~/lib/api/errors'
import { TRAVEL_REQUEST_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate, formatDateRange } from '~/utils/format'
import type { TravelRequestDto } from '~/types/api'

/**
 * S12c-3: travel request dari portal client — sales meninjau, meminta klarifikasi, menjadikannya Lead, atau
 * menutupnya. Draft client tidak pernah tampil di sini. Halaman memuat datanya sendiri (`GET /travel-requests`).
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Travel Request' })

const api = useApi()
const session = useServerSession()
const { canView } = usePermissions()

const requests = ref<TravelRequestDto[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')
const loadError = ref('')
async function load () {
  if (!canView('sales')) { return }
  status.value = 'loading'
  try {
    await session.ensure()
    requests.value = (await api.core.listTravelRequests()).data
    status.value = 'ready'
  } catch (error) {
    loadError.value = isApiError(error) ? error.message : 'Server belum bisa dihubungi.'
    status.value = 'error'
  }
}
onMounted(load)

const OPEN = ['submitted', 'under-review', 'need-clarification', 'proposal-preparation']
const view = ref<'open' | 'all'>('open')
const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return requests.value
    .filter(r => view.value === 'all' || OPEN.includes(r.status))
    .filter(r => !q || [r.id, r.requestName, r.partyName, r.destination].some(text => text.toLowerCase().includes(q)))
})
const counts = computed(() => ({
  incoming: requests.value.filter(r => r.status === 'submitted').length,
  reviewing: requests.value.filter(r => r.status === 'under-review').length,
  waiting: requests.value.filter(r => r.status === 'need-clarification').length
}))
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Travel Request" description="Permintaan perjalanan dari portal client — tinjau, minta klarifikasi, atau jadikan Lead." :breadcrumb="[{ label: 'Sales' }, { label: 'Travel Request' }]" />

    <RoleAccessState v-if="!canView('sales')" module-label="Sales" />

    <template v-else>
      <div class="grid grid-cols-3 gap-4">
        <StatsCard title="Baru Masuk" :value="String(counts.incoming)" :icon="Inbox" :icon-color="counts.incoming ? 'warning' : 'success'" />
        <StatsCard title="Sedang Ditinjau" :value="String(counts.reviewing)" :icon="Send" />
        <StatsCard title="Menunggu Client" :value="String(counts.waiting)" :icon="Send" />
      </div>

      <SectionCard>
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div class="relative flex-1 max-w-sm w-full">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="search" placeholder="Cari nama, customer, destinasi..." class="pl-9" />
          </div>
          <select v-model="view" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="open">
              Yang masih berjalan
            </option>
            <option value="all">
              Semua termasuk selesai
            </option>
          </select>
        </div>

        <div v-if="status === 'loading'" class="h-24 animate-pulse rounded-xl bg-muted" />
        <EmptyState v-else-if="status === 'error'" :icon="Send" title="Travel request belum bisa dimuat" :description="loadError">
          <Button variant="outline" @click="load">
            Coba lagi
          </Button>
        </EmptyState>
        <ul v-else-if="filtered.length" class="divide-y divide-border">
          <li v-for="r in filtered" :key="r.id">
            <NuxtLink :to="`/travel-requests/${r.id}`" class="py-3 flex items-center justify-between gap-3 group">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground truncate group-hover:underline">
                  {{ r.requestName }}
                </p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ r.id }} · {{ r.partyName }} · {{ r.destination || '—' }}
                  <template v-if="r.travelStartDate">
                    · {{ r.travelEndDate ? formatDateRange(r.travelStartDate, r.travelEndDate) : formatDate(r.travelStartDate) }}
                  </template>
                  · {{ r.reviewerName ?? 'Belum ditinjau' }}
                </p>
              </div>
              <StatusBadge :label="findStatusOption(TRAVEL_REQUEST_STATUSES, r.status).label" :tone="findStatusOption(TRAVEL_REQUEST_STATUSES, r.status).tone" />
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else :icon="Send" title="Tidak ada travel request" description="Tidak ada permintaan yang cocok dengan filter ini." />
      </SectionCard>
    </template>
  </div>
</template>
