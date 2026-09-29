<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getTransportBookingById, getProjectById, getTravelers } from '~/data'
import { TRANSPORT_BOOKING_STATUSES, VEHICLE_TYPES, findStatusOption } from '~/constants/status'
import { formatDateTime } from '~/utils/format'

/**
 * "Driver sheet" (Section 15 — roadmap Section 00–24 baru, Wajib) — mockup frontend-only: halaman
 * print-friendly (tanpa layout dashboard), `window.print()`, dokumen INTERNAL untuk driver di lapangan
 * (bukan client-facing seperti `service-order-preview.vue`) — SENGAJA TIDAK menampilkan `netCostIdr`
 * MAUPUN `sellPriceIdr` sama sekali (driver tidak butuh info harga, hanya route/vehicle/manifest/kontak
 * darurat), pola print-friendly IDENTIK `run-sheet-preview.vue` (D-069).
 */
definePageMeta({ layout: false, middleware: 'auth' })

const route = useRoute()
const { canView } = usePermissions()

const booking = computed(() => getTransportBookingById(String(route.params.id)))
const project = computed(() => (booking.value ? getProjectById(booking.value.projectId) : undefined))
const travelers = computed(() => (project.value ? getTravelers(project.value.id) : []))
const passengers = computed(() => (booking.value ? booking.value.travelerIds.map(id => travelers.value.find(t => t.id === id)).filter((t): t is NonNullable<typeof t> => Boolean(t)) : []))
const selectedOption = computed(() => booking.value?.options.find(option => option.isSelected) ?? booking.value?.options[0])

useHead({ title: computed(() => booking.value ? `Driver Sheet — ${booking.value.id}` : 'Transport Booking Tidak Ditemukan') })

function printPage () {
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
            <NuxtLink to="/transportation">
              <Button>Kembali ke Transportation</Button>
            </NuxtLink>
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
          <NuxtLink :to="`/transportation/${booking.id}`" class="text-sm text-primary hover:underline">
            ← Kembali ke Transport Booking
          </NuxtLink>
          <Button size="sm" @click="printPage">
            Print / Save as PDF
          </Button>
        </div>

        <div class="rounded-xl border border-border bg-card p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none print:p-0">
          <div class="flex items-start justify-between border-b border-border pb-6 mb-6">
            <div>
              <p class="text-2xl font-bold tracking-tight text-foreground">
                MANOVA
              </p>
              <p class="text-xs text-muted-foreground">
                Internal — Driver Sheet (Mock, tanpa informasi harga)
              </p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold text-foreground">
                DRIVER SHEET
              </p>
              <p class="text-sm text-muted-foreground">
                {{ booking.id }}
              </p>
              <StatusBadge :label="findStatusOption(TRANSPORT_BOOKING_STATUSES, booking.status).label" :tone="findStatusOption(TRANSPORT_BOOKING_STATUSES, booking.status).tone" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Driver / Unit
              </p>
              <p class="text-foreground">
                {{ booking.driverName ?? 'Belum ditugaskan' }}<span v-if="booking.driverPhone"> · {{ booking.driverPhone }}</span>
              </p>
              <p class="text-muted-foreground">
                Plat: {{ booking.assignedVehiclePlateNumber ?? '—' }}
              </p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Kendaraan
              </p>
              <p v-if="selectedOption" class="text-foreground">
                {{ findStatusOption(VEHICLE_TYPES, selectedOption.vehicleType).label }} — kapasitas {{ selectedOption.capacity }} pax
              </p>
              <p v-if="selectedOption?.accessibilityFeatures" class="text-muted-foreground">
                {{ selectedOption.accessibilityFeatures }}
              </p>
            </div>
          </div>

          <table class="w-full text-sm mb-6">
            <thead>
              <tr class="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th class="py-2">
                  Leg
                </th>
                <th class="py-2">
                  Pickup
                </th>
                <th class="py-2">
                  Drop-off
                </th>
                <th class="py-2">
                  Jadwal
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(leg, index) in booking.legs" :key="index" class="border-b border-border/60">
                <td class="py-2 text-foreground">
                  {{ leg.label ?? `Leg ${index + 1}` }}
                </td>
                <td class="py-2 text-muted-foreground">
                  {{ leg.pickupLocation }}
                </td>
                <td class="py-2 text-muted-foreground">
                  {{ leg.dropoffLocation }}
                </td>
                <td class="py-2 text-muted-foreground">
                  {{ formatDateTime(leg.scheduledAt) }}
                </td>
              </tr>
              <tr v-if="booking.legs.length === 0">
                <td colspan="4" class="py-2 text-muted-foreground">
                  Belum ada leg tercatat.
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="booking.standbyHours || booking.overtimeHours || booking.tollFeeIdr" class="mb-6 text-sm">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Catatan Operasional
            </p>
            <ul class="text-muted-foreground list-disc list-inside space-y-1">
              <li v-if="booking.standbyHours">
                Standby {{ booking.standbyHours }} jam
              </li>
              <li v-if="booking.overtimeHours">
                Overtime {{ booking.overtimeHours }} jam
              </li>
              <li v-if="booking.tollFeeIdr">
                Estimasi toll dibebankan ke perusahaan — simpan struk toll
              </li>
            </ul>
          </div>

          <div class="mb-6">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Passenger Manifest ({{ passengers.length }} pax)
            </p>
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th class="py-2">
                    Nama
                  </th>
                  <th class="py-2">
                    Kontak Darurat
                  </th>
                  <th class="py-2">
                    Catatan Khusus
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="passenger in passengers" :key="passenger.id" class="border-b border-border/60">
                  <td class="py-2 text-foreground">
                    {{ passenger.name }}
                  </td>
                  <td class="py-2 text-muted-foreground">
                    {{ passenger.emergencyContactName ? `${passenger.emergencyContactName} (${passenger.emergencyContactPhone ?? '—'})` : '—' }}
                  </td>
                  <td class="py-2 text-muted-foreground">
                    {{ [passenger.specialRequest, passenger.dietaryRestrictions, passenger.accessibilityNeeds].filter(Boolean).join(' · ') || '—' }}
                  </td>
                </tr>
                <tr v-if="passengers.length === 0">
                  <td colspan="3" class="py-2 text-muted-foreground">
                    Belum ada traveler ditugaskan.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="booking.hasChange || booking.hasIncident" class="border-t border-border pt-4 text-xs text-muted-foreground space-y-2">
            <p v-if="booking.hasChange">
              <span class="font-semibold text-foreground">Change:</span> {{ booking.changeNote }}
            </p>
            <p v-if="booking.hasIncident">
              <span class="font-semibold text-foreground">Incident:</span> {{ booking.incidentNote }}
            </p>
          </div>

          <p class="mt-8 text-center text-[10px] text-muted-foreground">
            Dokumen internal mock untuk keperluan demo — tidak mencantumkan informasi harga.
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
