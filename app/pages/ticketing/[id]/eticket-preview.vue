<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getFlightBookingById, getProjectById, getTravelers } from '~/data'
import { FLIGHT_BOOKING_STATUSES, CABIN_CLASSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateTime } from '~/utils/format'

/**
 * "Documents/ticket preview" (Section 13 — roadmap Section 00–24 baru, Wajib) — mockup frontend-only:
 * halaman print-friendly (tanpa layout dashboard), `window.print()`, pola IDENTIK `quotation-preview.vue`
 * (D-062)/`manifest-preview.vue`/`run-sheet-preview.vue` (D-068/D-069) — dilarang generator dokumen
 * produksi (D-006). SANITIZED — TIDAK PERNAH menampilkan `netCostIdr` (internal, Wajib literal "Internal
 * net cost vs client sell price" secara implisit mensyaratkan dokumen client-facing tidak membocorkannya,
 * pola sama sanitasi Client Portal D-065).
 */
definePageMeta({ layout: false, middleware: 'auth' })

const route = useRoute()
const { canView } = usePermissions()

const booking = computed(() => getFlightBookingById(String(route.params.id)))
const project = computed(() => (booking.value ? getProjectById(booking.value.projectId) : undefined))
const travelers = computed(() => (project.value ? getTravelers(project.value.id) : []))
const selectedOption = computed(() => booking.value?.options.find(option => option.isSelected) ?? booking.value?.options[0])

useHead({ title: computed(() => booking.value ? `E-Ticket — ${booking.value.id}` : 'Flight Booking Tidak Ditemukan') })

function travelerName(id: string) {
  return travelers.value.find(traveler => traveler.id === id)?.name ?? id
}

function printPage() {
  window.print()
}
</script>

<template>
  <div class="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
    <div class="mx-auto max-w-3xl px-4 print:px-0 print:max-w-none">
      <template v-if="!booking">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <EmptyState
            :icon="FileX"
            title="Flight Booking tidak ditemukan"
            :description="`Flight Booking dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
          >
            <NuxtLink to="/ticketing"><Button>Kembali ke Ticketing</Button></NuxtLink>
          </EmptyState>
        </div>
      </template>

      <template v-else-if="!canView('ticketing')">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <RoleAccessState module-label="modul Ticketing" />
        </div>
      </template>

      <template v-else>
        <div class="mb-4 flex items-center justify-between print:hidden">
          <NuxtLink :to="`/ticketing/${booking.id}`" class="text-sm text-primary hover:underline">← Kembali ke Flight Booking</NuxtLink>
          <Button size="sm" @click="printPage">Print / Save as PDF</Button>
        </div>

        <div class="rounded-xl border border-border bg-card p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none print:p-0">
          <div class="flex items-start justify-between border-b border-border pb-6 mb-6">
            <div>
              <p class="text-2xl font-bold tracking-tight text-foreground">MANOVA</p>
              <p class="text-xs text-muted-foreground">Travel Agent B2B — E-Ticket / Itinerary Receipt (Mock)</p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold text-foreground">E-TICKET</p>
              <p class="text-sm text-muted-foreground">PNR: {{ booking.pnr ?? 'Belum terbit' }}</p>
              <StatusBadge :label="findStatusOption(FLIGHT_BOOKING_STATUSES, booking.status).label" :tone="findStatusOption(FLIGHT_BOOKING_STATUSES, booking.status).tone" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Project</p>
              <p class="text-sm text-foreground">{{ project?.name ?? booking.projectId }}</p>
              <p class="text-sm text-muted-foreground">{{ project?.destination }}</p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Ticketing Deadline</p>
              <p class="text-sm text-foreground">{{ booking.ticketingDeadline ? formatDate(booking.ticketingDeadline) : '—' }}</p>
            </div>
          </div>

          <table class="w-full text-sm mb-6">
            <thead>
              <tr class="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th class="py-2">Rute</th>
                <th class="py-2">No. Penerbangan</th>
                <th class="py-2">Keberangkatan</th>
                <th class="py-2">Kedatangan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(segment, index) in booking.segments" :key="index" class="border-b border-border/60">
                <td class="py-2 text-foreground">{{ segment.origin }} → {{ segment.destination }}</td>
                <td class="py-2 text-muted-foreground">{{ segment.flightNumber ?? '—' }}</td>
                <td class="py-2 text-muted-foreground">{{ formatDateTime(segment.departureAt) }}</td>
                <td class="py-2 text-muted-foreground">{{ segment.arrivalAt ? formatDateTime(segment.arrivalAt) : '—' }}</td>
              </tr>
              <tr v-if="booking.segments.length === 0"><td colspan="4" class="py-2 text-muted-foreground">Belum ada segmen tercatat.</td></tr>
            </tbody>
          </table>

          <div v-if="selectedOption" class="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Maskapai / Cabin</p>
              <p class="text-foreground">{{ selectedOption.airline }} — {{ findStatusOption(CABIN_CLASSES, selectedOption.cabinClass).label }}</p>
              <p v-if="selectedOption.baggageAllowance" class="text-muted-foreground">Bagasi: {{ selectedOption.baggageAllowance }}</p>
              <p v-if="selectedOption.ancillaries" class="text-muted-foreground">{{ selectedOption.ancillaries }}</p>
            </div>
            <div class="text-right">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total (Sell Price)</p>
              <p class="text-lg font-semibold text-foreground">{{ booking.sellPriceIdr !== undefined ? formatCurrencyIdr(booking.sellPriceIdr) : '—' }}</p>
            </div>
          </div>

          <div class="mb-6">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Traveler / Name List</p>
            <ul class="text-sm text-foreground grid grid-cols-2 gap-1">
              <li v-for="travelerId in booking.travelerIds" :key="travelerId">{{ travelerName(travelerId) }}</li>
            </ul>
            <p v-if="booking.travelerIds.length === 0" class="text-sm text-muted-foreground">Belum ada traveler ditugaskan.</p>
          </div>

          <div v-if="booking.fareRules" class="border-t border-border pt-4 text-xs text-muted-foreground">
            <p class="font-semibold uppercase tracking-wide mb-1">Fare Rules</p>
            <p class="whitespace-pre-line">{{ booking.fareRules }}</p>
          </div>

          <p class="mt-8 text-center text-[10px] text-muted-foreground">
            Dokumen mock untuk keperluan demo — bukan e-ticket resmi maskapai/GDS.
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<style>
@media print {
  @page { margin: 1.5cm; }
}
</style>
