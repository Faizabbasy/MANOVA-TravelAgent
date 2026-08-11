<script setup lang="ts">
import BookingTimelinePanel from '~/components/operations/BookingTimelinePanel.vue'
import BookingExceptionsPanel from '~/components/operations/BookingExceptionsPanel.vue'

/**
 * Operations > Daftar Booking (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling
 * ngalir") — satu menu menampung Booking Timeline (dulu halaman ini sendiri) dan Exception Queue (dulu
 * `/bookings/exceptions`). Booking Calendar & Map dipindah keluar ke menu "Kalender" tersendiri
 * (`/calendar`, lihat `app/pages/calendar/index.vue`) — bukan lagi section di halaman ini. Konten tiap
 * section dipindah apa adanya ke `app/components/operations/*Panel.vue`. Disusun sebagai section
 * bertumpuk dalam satu halaman scroll (BUKAN `<Tabs>`) — tiap section punya `id` untuk deep-link `#section`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Daftar Booking' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Daftar Booking"
      description="Timeline konsolidasi Flight/Hotel/Transport/MICE dan antrean exception — dalam satu menu."
      :breadcrumb="[{ label: 'Daftar Booking' }]"
    />

    <section id="bookings" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Bookings
      </h2>
      <BookingTimelinePanel />
    </section>

    <Separator />

    <section id="exceptions" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Exceptions
      </h2>
      <BookingExceptionsPanel />
    </section>
  </div>
</template>
