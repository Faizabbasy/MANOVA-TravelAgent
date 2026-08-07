<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import {
  getFlightBookingById, getHotelBookingById, getTransportBookingById, getMiceEventById,
  getProjectById, getPartyById, getTravelers
} from '~/data'
import {
  FLIGHT_BOOKING_STATUSES, HOTEL_BOOKING_STATUSES, TRANSPORT_BOOKING_STATUSES, MICE_EVENT_STATUSES,
  findStatusOption
} from '~/constants/status'
import { formatDate, formatDateTime } from '~/utils/format'
import type { BadgeTone } from '~/types/common'

/**
 * Reservations — Confirmation/Ticket/Voucher Preview client-safe (Repair Phase Section 4, Master Prompt
 * bagian G.9 "Membuka ticket"/"Membuka voucher"). Halaman BARU — TIDAK menggunakan
 * `/ticketing/[id]/eticket-preview`/`/accommodation/[id]/voucher-preview`/
 * `/transportation/[id]/service-order-preview`/`/mice/[id]/rundown-preview` internal (SEMUA gated
 * `canView('ticketing'|'accommodation'|'transportation'|'mice')`, `NONE` untuk role client — pola bug yang
 * sama ditemukan di `/crm/opportunities/[id]/quotation-preview`, Section 3). SANITIZED — TIDAK PERNAH
 * `netCostIdr`/`sellPriceIdr`/`statusReason`/catatan operasional internal (incident/change note).
 * `:type` = `flight`/`hotel`/`transport`/`mice`, `:id` = booking id domain terkait.
 */
definePageMeta({ layout: false, middleware: 'auth' })

const route = useRoute()
const { canView, clientScopeId } = usePermissions()

const type = computed(() => String(route.params.type))
const bookingId = computed(() => String(route.params.id))

const flightBooking = computed(() => (type.value === 'flight' ? getFlightBookingById(bookingId.value) : undefined))
const hotelBooking = computed(() => (type.value === 'hotel' ? getHotelBookingById(bookingId.value) : undefined))
const transportBooking = computed(() => (type.value === 'transport' ? getTransportBookingById(bookingId.value) : undefined))
const miceEvent = computed(() => (type.value === 'mice' ? getMiceEventById(bookingId.value) : undefined))

const projectId = computed(() => flightBooking.value?.projectId ?? hotelBooking.value?.projectId ?? transportBooking.value?.projectId ?? miceEvent.value?.projectId)
const project = computed(() => (projectId.value ? getProjectById(projectId.value) : undefined))
const isOwnCompany = computed(() => Boolean(project.value && clientScopeId.value && project.value.partyId === clientScopeId.value))
const exists = computed(() => Boolean(flightBooking.value || hotelBooking.value || transportBooking.value || miceEvent.value))
const party = computed(() => (project.value ? getPartyById(project.value.partyId) : undefined))

function travelerName (id: string): string {
  if (!project.value) { return id }
  return getTravelers(project.value.id).find(t => t.id === id)?.name ?? id
}

interface ConfirmationLine { label: string; value: string }
interface ConfirmationView { title: string; statusLabel: string; statusTone: BadgeTone; reference?: string; lines: ConfirmationLine[]; travelerNames: string[] }

const confirmation = computed<ConfirmationView | undefined>(() => {
  if (flightBooking.value) {
    const booking = flightBooking.value
    const statusOption = findStatusOption(FLIGHT_BOOKING_STATUSES, booking.status)
    return {
      title: 'E-Ticket',
      statusLabel: statusOption.label,
      statusTone: statusOption.tone,
      reference: booking.pnr,
      lines: [
        ...booking.segments.map(segment => ({ label: `${segment.origin} → ${segment.destination}`, value: `${formatDateTime(segment.departureAt)}${segment.flightNumber ? ` · ${segment.flightNumber}` : ''}` })),
        ...(booking.ticketingDeadline ? [{ label: 'Ticketing Deadline', value: formatDate(booking.ticketingDeadline) }] : [])
      ],
      travelerNames: booking.travelerIds.map(travelerName)
    }
  }
  if (hotelBooking.value) {
    const booking = hotelBooking.value
    const statusOption = findStatusOption(HOTEL_BOOKING_STATUSES, booking.status)
    return {
      title: 'Hotel Voucher',
      statusLabel: statusOption.label,
      statusTone: statusOption.tone,
      reference: booking.confirmationNumber,
      lines: [
        ...(booking.checkInDate ? [{ label: 'Check-in', value: formatDate(booking.checkInDate) }] : []),
        ...(booking.checkOutDate ? [{ label: 'Check-out', value: formatDate(booking.checkOutDate) }] : []),
        ...(booking.roomsBlocked ? [{ label: 'Jumlah Kamar', value: String(booking.roomsBlocked) }] : []),
        ...(booking.voucherIssuedAt ? [{ label: 'Voucher Diterbitkan', value: formatDate(booking.voucherIssuedAt) }] : [])
      ],
      travelerNames: booking.travelerIds.map(travelerName)
    }
  }
  if (transportBooking.value) {
    const booking = transportBooking.value
    const statusOption = findStatusOption(TRANSPORT_BOOKING_STATUSES, booking.status)
    return {
      title: 'Service Order',
      statusLabel: statusOption.label,
      statusTone: statusOption.tone,
      lines: [
        ...booking.legs.map(leg => ({ label: `${leg.pickupLocation} → ${leg.dropoffLocation}`, value: formatDateTime(leg.scheduledAt) })),
        ...(booking.assignedVehiclePlateNumber ? [{ label: 'Kendaraan', value: booking.assignedVehiclePlateNumber }] : []),
        ...(booking.driverName ? [{ label: 'Driver', value: `${booking.driverName}${booking.driverPhone ? ` (${booking.driverPhone})` : ''}` }] : [])
      ],
      travelerNames: booking.travelerIds.map(travelerName)
    }
  }
  if (miceEvent.value) {
    const event = miceEvent.value
    const statusOption = findStatusOption(MICE_EVENT_STATUSES, event.status)
    return {
      title: 'Event Confirmation',
      statusLabel: statusOption.label,
      statusTone: statusOption.tone,
      lines: [
        ...(event.venueName ? [{ label: 'Venue', value: `${event.venueName}${event.venueAddress ? ` — ${event.venueAddress}` : ''}` }] : []),
        ...event.sessions.map(session => ({ label: session.sessionTitle, value: `${session.roomName} · ${formatDateTime(session.startAt)}` }))
      ],
      travelerNames: []
    }
  }
  return undefined
})

useHead({ title: computed(() => confirmation.value ? `${confirmation.value.title} — Preview` : 'Reservasi Tidak Ditemukan') })

function printPage () {
  window.print()
}
</script>

<template>
  <div class="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
    <div class="mx-auto max-w-2xl px-4 print:px-0 print:max-w-none">
      <template v-if="!exists || !project || !isOwnCompany">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <EmptyState :icon="FileX" title="Reservasi tidak ditemukan" description="Reservasi ini tidak ada atau bukan milik company Anda.">
            <NuxtLink to="/client/project-orders#reservations">
              <Button>Kembali</Button>
            </NuxtLink>
          </EmptyState>
        </div>
      </template>

      <template v-else-if="!canView('client-portal')">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <RoleAccessState module-label="Client Portal" />
        </div>
      </template>

      <template v-else-if="confirmation">
        <div class="mb-4 flex items-center justify-between print:hidden">
          <NuxtLink to="/client/project-orders#reservations" class="text-sm text-primary hover:underline">
            ← Kembali ke Reservations
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
                Travel Agent B2B — {{ confirmation.title }} (Mock)
              </p>
            </div>
            <div class="text-right">
              <StatusBadge :label="confirmation.statusLabel" :tone="confirmation.statusTone" />
              <p v-if="confirmation.reference" class="text-sm text-muted-foreground mt-1">
                Ref. {{ confirmation.reference }}
              </p>
            </div>
          </div>

          <div class="mb-6">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Project
            </p>
            <p class="text-sm text-foreground">
              {{ project.name }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ party?.name }} · {{ project.destination }}
            </p>
          </div>

          <ul class="space-y-2 mb-6">
            <li v-for="(line, index) in confirmation.lines" :key="index" class="flex items-center justify-between gap-3 text-sm border-b border-border/60 pb-2">
              <span class="text-muted-foreground">{{ line.label }}</span>
              <span class="text-foreground text-right">{{ line.value }}</span>
            </li>
          </ul>

          <div v-if="confirmation.travelerNames.length">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Peserta
            </p>
            <p class="text-sm text-foreground">
              {{ confirmation.travelerNames.join(', ') }}
            </p>
          </div>

          <p class="mt-8 text-center text-[10px] text-muted-foreground">
            Dokumen mock untuk keperluan demo — bukan dokumen komersial/legal yang sah.
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
