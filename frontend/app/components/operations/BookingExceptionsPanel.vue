<script setup lang="ts">
import { computed } from 'vue'
import { ListChecks } from 'lucide-vue-next'
import { getBookingExceptionQueue } from '~/data'
import { formatDate } from '~/utils/format'
import type { BookingDomain } from '~/types/booking-orchestration'

/** Tab "Exceptions" — Menu Operations > Daftar Booking (Penyederhanaan 7-Role/Menu). Dulu
 * `/bookings/exceptions`, kini tab dalam satu menu bersama Bookings (Calendar dipisah ke menu "Kalender"
 * tersendiri) — logika tidak diubah. */

const { canView } = usePermissions()

const DOMAIN_LABEL: Record<BookingDomain, string> = { flight: 'Flight', hotel: 'Hotel', transport: 'Transport', mice: 'MICE' }
const DOMAIN_TONE: Record<BookingDomain, string> = { flight: 'info', hotel: 'purple', transport: 'warning', mice: 'primary' }

const rows = computed(() => getBookingExceptionQueue())
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('bookings')" module-label="modul Daftar Booking" />

    <template v-else>
      <SectionCard title="Daftar Exception" :description="`${rows.length} booking membutuhkan perhatian`">
        <div v-if="rows.length" class="divide-y divide-border">
          <div v-for="entry in rows" :key="`${entry.bookingType}-${entry.bookingId}`" class="py-4">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div class="flex items-center gap-2">
                <StatusBadge :label="DOMAIN_LABEL[entry.bookingType]" :tone="DOMAIN_TONE[entry.bookingType]" />
                <NuxtLink :to="entry.detailHref" class="text-sm font-medium text-foreground hover:text-primary hover:underline">
                  {{ entry.bookingId }}
                </NuxtLink>
                <span class="text-xs text-muted-foreground">— {{ entry.label }} · {{ entry.projectName }}</span>
              </div>
              <div class="flex items-center gap-2">
                <StatusBadge :label="entry.internalStatus" :tone="entry.internalStatusTone" />
                <span v-if="entry.deadlineDate" class="text-xs text-muted-foreground">Deadline: {{ formatDate(entry.deadlineDate) }}</span>
              </div>
            </div>
            <ul class="space-y-1 pl-1">
              <li v-for="(exception, index) in entry.exceptions" :key="index" class="flex items-start gap-2 text-sm text-destructive">
                <ListChecks class="h-4 w-4 mt-0.5 shrink-0" />
                <span>{{ exception }}</span>
              </li>
            </ul>
          </div>
        </div>
        <EmptyState v-else :icon="ListChecks" title="Tidak ada exception" description="Seluruh booking Flight/Hotel/Transport/MICE saat ini bebas dari dependency belum terpenuhi, percobaan gagal, duplicate flag, atau perubahan/insiden domain." />
      </SectionCard>
    </template>
  </div>
</template>
