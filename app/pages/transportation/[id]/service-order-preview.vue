<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getTransportBookingById, getProjectById, getTravelers } from '~/data'
import { TRANSPORT_BOOKING_STATUSES, VEHICLE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDateTime } from '~/utils/format'

/**
 * "Service order" (Section 15 — roadmap Section 00–24 baru, Wajib) — mockup frontend-only: halaman
 * print-friendly (tanpa layout dashboard), `window.print()`, pola IDENTIK `eticket-preview.vue`
 * (D-070)/`voucher-preview.vue` (D-071) — dilarang generator dokumen produksi (D-006). SANITIZED —
 * TIDAK PERNAH menampilkan `netCostIdr` (internal, hard rule protokol "Jangan menampilkan internal
 * cost/margin kepada Client"), pola sama sanitasi Client Portal/e-ticket/voucher.
 */
definePageMeta({ layout: false, middleware: 'auth' })

const route = useRoute()
const { canView } = usePermissions()

const booking = computed(() => getTransportBookingById(String(route.params.id)))
const project = computed(() => (booking.value ? getProjectById(booking.value.projectId) : undefined))
const travelers = computed(() => (project.value ? getTravelers(project.value.id) : []))
const selectedOption = computed(() => booking.value?.options.find(option => option.isSelected) ?? booking.value?.options[0])

useHead({ title: computed(() => booking.value ? `Service Order — ${booking.value.id}` : 'Transport Booking Tidak Ditemukan') })

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
            title="Transport Booking tidak ditemukan"
            :description="`Transport Booking dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
          >
            <NuxtLink to="/transportation"><Button>Kembali ke Transportation</Button></NuxtLink>
          </EmptyState>
        </div>
      </template>

      <template v-else-if="!canView('transportation')">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <RoleAccessState module-label="modul Transportation" />
        </div>
      </template>

      <template v-else>
        <div class="mb-4 flex items-center justify-between print:hidden">
          <NuxtLink :to="`/transportation/${booking.id}`" class="text-sm text-primary hover:underline">← Kembali ke Transport Booking</NuxtLink>
          <Button size="sm" @click="printPage">Print / Save as PDF</Button>
        </div>

        <div class="rounded-xl border border-border bg-card p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none print:p-0">
          <div class="flex items-start justify-between border-b border-border pb-6 mb-6">
            <div>
              <p class="text-2xl font-bold tracking-tight text-foreground">MANOVA</p>
              <p class="text-xs text-muted-foreground">Travel Agent B2B — Transportation Service Order (Mock)</p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold text-foreground">SERVICE ORDER</p>
              <p class="text-sm text-muted-foreground">{{ booking.id }}</p>
              <StatusBadge :label="findStatusOption(TRANSPORT_BOOKING_STATUSES, booking.status).label" :tone="findStatusOption(TRANSPORT_BOOKING_STATUSES, booking.status).tone" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Project</p>
              <p class="text-sm text-foreground">{{ project?.name ?? booking.projectId }}</p>
              <p class="text-sm text-muted-foreground">{{ project?.destination }}</p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Jenis Permintaan</p>
              <p class="text-sm text-foreground">{{ booking.transferType ?? '—' }}</p>
            </div>
          </div>

          <div v-if="selectedOption" class="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Kendaraan</p>
              <p class="text-foreground">{{ findStatusOption(VEHICLE_TYPES, selectedOption.vehicleType).label }} — {{ selectedOption.capacity }} pax</p>
              <p v-if="selectedOption.luggageCapacity" class="text-muted-foreground">Bagasi: {{ selectedOption.luggageCapacity }}</p>
              <p v-if="selectedOption.accessibilityFeatures" class="text-muted-foreground">{{ selectedOption.accessibilityFeatures }}</p>
            </div>
            <div class="text-right">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total (Sell Price)</p>
              <p class="text-lg font-semibold text-foreground">{{ booking.sellPriceIdr !== undefined ? formatCurrencyIdr(booking.sellPriceIdr) : '—' }}</p>
            </div>
          </div>

          <table class="w-full text-sm mb-6">
            <thead>
              <tr class="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th class="py-2">Leg</th>
                <th class="py-2">Pickup</th>
                <th class="py-2">Drop-off</th>
                <th class="py-2">Jadwal</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(leg, index) in booking.legs" :key="index" class="border-b border-border/60">
                <td class="py-2 text-foreground">{{ leg.label ?? `Leg ${index + 1}` }}</td>
                <td class="py-2 text-muted-foreground">{{ leg.pickupLocation }}</td>
                <td class="py-2 text-muted-foreground">{{ leg.dropoffLocation }}</td>
                <td class="py-2 text-muted-foreground">{{ formatDateTime(leg.scheduledAt) }}</td>
              </tr>
              <tr v-if="booking.legs.length === 0"><td colspan="4" class="py-2 text-muted-foreground">Belum ada leg tercatat.</td></tr>
            </tbody>
          </table>

          <div class="mb-6">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Traveler / Passenger List</p>
            <ul class="text-sm text-foreground grid grid-cols-2 gap-1">
              <li v-for="travelerId in booking.travelerIds" :key="travelerId">{{ travelerName(travelerId) }}</li>
            </ul>
            <p v-if="booking.travelerIds.length === 0" class="text-sm text-muted-foreground">Belum ada traveler ditugaskan.</p>
          </div>

          <p class="mt-8 text-center text-[10px] text-muted-foreground">
            Dokumen mock untuk keperluan demo — bukan service order resmi vendor transportasi.
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
