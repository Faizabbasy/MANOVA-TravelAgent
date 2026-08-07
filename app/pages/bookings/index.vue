<script setup lang="ts">
import BookingCalendarPanel from '~/components/operations/BookingCalendarPanel.vue'
import BookingTimelinePanel from '~/components/operations/BookingTimelinePanel.vue'
import BookingExceptionsPanel from '~/components/operations/BookingExceptionsPanel.vue'

/**
 * Operations > Booking & Schedule (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling
 * ngalir") — satu menu menampung Booking Calendar & Map (dulu `/operations/calendar`), Booking Timeline
 * (dulu halaman ini sendiri), dan Exception Queue (dulu `/bookings/exceptions`). Konten tiap section
 * dipindah apa adanya ke `app/components/operations/*Panel.vue`. Disusun sebagai section bertumpuk dalam
 * satu halaman scroll (BUKAN `<Tabs>`) — tiap section punya `id` untuk deep-link `#section`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Booking & Schedule' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Booking & Schedule"
      description="Kalender & peta perencanaan, timeline konsolidasi Flight/Hotel/Transport/MICE, dan antrean exception — dalam satu menu."
      :breadcrumb="[{ label: 'Booking & Schedule' }]"
    />

    <section id="calendar" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Calendar & Map
      </h2>
      <BookingCalendarPanel />
    </section>

    <Separator />

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
