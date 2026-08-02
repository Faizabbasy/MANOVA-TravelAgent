<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getHotelBookingById, getProjectById, getTravelers } from '~/data'
import { HOTEL_BOOKING_STATUSES, MEAL_PLANS, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'

/**
 * "Documents/ticket preview" analog untuk hotel — "Voucher" (Section 14 — roadmap Section 00–24 baru,
 * Wajib) — mockup frontend-only: halaman print-friendly (tanpa layout dashboard), `window.print()`, pola
 * IDENTIK `eticket-preview.vue` (D-070)/`quotation-preview.vue`/`manifest-preview.vue`/`run-sheet-preview.vue`
 * — dilarang generator dokumen produksi (D-006). SANITIZED — TIDAK PERNAH menampilkan `netCostIdr` (internal,
 * "Internal cost isolation" Wajib mensyaratkan dokumen client-facing tidak membocorkannya, pola sama
 * sanitasi Client Portal D-065/e-ticket preview D-070).
 */
definePageMeta({ layout: false, middleware: 'auth' })

const route = useRoute()
const { canView } = usePermissions()

const booking = computed(() => getHotelBookingById(String(route.params.id)))
const project = computed(() => (booking.value ? getProjectById(booking.value.projectId) : undefined))
const travelers = computed(() => (project.value ? getTravelers(project.value.id) : []))
const selectedOption = computed(() => booking.value?.options.find(option => option.isSelected) ?? booking.value?.options[0])

useHead({ title: computed(() => booking.value ? `Voucher — ${booking.value.id}` : 'Hotel Booking Tidak Ditemukan') })

function travelerName (id: string) {
  return travelers.value.find(traveler => traveler.id === id)?.name ?? id
}

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
            title="Hotel Booking tidak ditemukan"
            :description="`Hotel Booking dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
          >
            <NuxtLink to="/accommodation">
              <Button>Kembali ke Accommodation</Button>
            </NuxtLink>
          </EmptyState>
        </div>
      </template>

      <template v-else-if="!canView('accommodation')">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <RoleAccessState module-label="modul Accommodation" />
        </div>
      </template>

      <template v-else>
        <div class="mb-4 flex items-center justify-between print:hidden">
          <NuxtLink :to="`/accommodation/${booking.id}`" class="text-sm text-primary hover:underline">
            ← Kembali ke Hotel Booking
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
                Travel Agent B2B — Hotel Voucher (Mock)
              </p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold text-foreground">
                VOUCHER
              </p>
              <p class="text-sm text-muted-foreground">
                Konfirmasi: {{ booking.confirmationNumber ?? 'Belum terbit' }}
              </p>
              <StatusBadge :label="findStatusOption(HOTEL_BOOKING_STATUSES, booking.status).label" :tone="findStatusOption(HOTEL_BOOKING_STATUSES, booking.status).tone" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Project
              </p>
              <p class="text-sm text-foreground">
                {{ project?.name ?? booking.projectId }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ project?.destination }}
              </p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Check-in / Check-out
              </p>
              <p class="text-sm text-foreground">
                {{ booking.checkInDate ? formatDate(booking.checkInDate) : '—' }} – {{ booking.checkOutDate ? formatDate(booking.checkOutDate) : '—' }}
              </p>
              <p v-if="booking.earlyCheckInRequested || booking.lateCheckOutRequested" class="text-xs text-muted-foreground">
                {{ [booking.earlyCheckInRequested ? 'Early check-in diminta' : null, booking.lateCheckOutRequested ? 'Late check-out diminta' : null].filter(Boolean).join(' · ') }}
              </p>
            </div>
          </div>

          <div v-if="selectedOption" class="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Property / Room Type
              </p>
              <p class="text-foreground">
                {{ selectedOption.propertyName }} — {{ selectedOption.roomType }}
              </p>
              <p class="text-muted-foreground">
                {{ selectedOption.ratePlan }} · {{ findStatusOption(MEAL_PLANS, selectedOption.mealPlan).label }}
              </p>
              <p v-if="selectedOption.policies" class="text-muted-foreground">
                {{ selectedOption.policies }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Total (Sell Price)
              </p>
              <p class="text-lg font-semibold text-foreground">
                {{ booking.sellPriceIdr !== undefined ? formatCurrencyIdr(booking.sellPriceIdr) : '—' }}
              </p>
              <p v-if="booking.roomsBlocked" class="text-xs text-muted-foreground">
                {{ booking.roomsBlocked }} kamar
              </p>
            </div>
          </div>

          <div class="mb-6">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Traveler / Guest List
            </p>
            <ul class="text-sm text-foreground grid grid-cols-2 gap-1">
              <li v-for="travelerId in booking.travelerIds" :key="travelerId">
                {{ travelerName(travelerId) }}
              </li>
            </ul>
            <p v-if="booking.travelerIds.length === 0" class="text-sm text-muted-foreground">
              Belum ada traveler ditugaskan.
            </p>
          </div>

          <div v-if="booking.cancellationDeadline" class="border-t border-border pt-4 text-xs text-muted-foreground">
            <p class="font-semibold uppercase tracking-wide mb-1">
              Cancellation Policy
            </p>
            <p>Batas pembatalan tanpa penalti penuh: {{ formatDate(booking.cancellationDeadline) }}.</p>
          </div>

          <p class="mt-8 text-center text-[10px] text-muted-foreground">
            Dokumen mock untuk keperluan demo — bukan voucher resmi hotel/OTA.
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
