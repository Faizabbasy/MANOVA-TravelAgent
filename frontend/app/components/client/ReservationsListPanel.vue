<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, PlaneTakeoff } from 'lucide-vue-next'
import { getProjectsByParty, getClientReservations } from '~/data'
import { RESERVATION_CATEGORIES, findStatusOption } from '~/constants/status'
import { formatDate } from '~/utils/format'
import type { ReservationCategory } from '~/types/reservation'

/**
 * Tab "Reservations" — Menu Client Portal > My Trips (Penyederhanaan 7-Role/Menu). Dulu `/client/reservations`,
 * kini tab dalam satu menu bersama Projects/Participants/Itineraries/Trip Center/Change Requests — logika
 * tidak diubah. Client hanya view + request change lewat Change Request — TIDAK ADA aksi edit booking
 * vendor langsung di halaman ini.
 */

const { canView, clientScopeId } = usePermissions()

const search = ref('')
const categoryFilter = ref<'all' | ReservationCategory>('all')

const rows = computed(() => {
  const projects = clientScopeId.value ? getProjectsByParty(clientScopeId.value) : []
  return projects.flatMap(project => getClientReservations(project.id))
})

const filteredRows = computed(() => {
  let result = rows.value
  if (categoryFilter.value !== 'all') { result = result.filter(row => row.category === categoryFilter.value) }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    result = result.filter(row => row.label.toLowerCase().includes(q) || row.projectName.toLowerCase().includes(q) || (row.reference ?? '').toLowerCase().includes(q))
  }
  return result.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))
})
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <SectionCard>
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div class="relative flex-1 max-w-sm w-full">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="search" placeholder="Cari layanan, project, atau referensi..." class="pl-9" />
          </div>
          <select v-model="categoryFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Kategori
            </option>
            <option v-for="option in RESERVATION_CATEGORIES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <ul v-if="filteredRows.length" class="divide-y divide-border">
          <li v-for="reservation in filteredRows" :key="`${reservation.bookingType}-${reservation.bookingId}`" class="py-3">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground truncate">
                  {{ reservation.label }}
                </p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ reservation.projectName }} · {{ findStatusOption(RESERVATION_CATEGORIES, reservation.category).label }}
                  <template v-if="reservation.reference">
                    · Ref. {{ reservation.reference }}
                  </template>
                  <template v-if="reservation.startDate">
                    · {{ formatDate(reservation.startDate) }}
                  </template>
                </p>
              </div>
              <StatusBadge :label="reservation.clientVisibleStatus" tone="info" />
            </div>
            <NuxtLink :to="`/client/reservations/${reservation.bookingType}/${reservation.bookingId}/preview`" class="text-xs text-primary hover:underline">
              Lihat konfirmasi/tiket →
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else :icon="PlaneTakeoff" :title="rows.length ? 'Tidak ada reservasi yang cocok' : 'Belum ada reservasi'" :description="rows.length ? 'Coba ubah kata kunci pencarian atau filter kategori.' : 'Reservasi akan tampil di sini setelah tim kami memproses booking Anda.'" />
      </SectionCard>
    </template>
  </div>
</template>
