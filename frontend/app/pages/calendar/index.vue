<script setup lang="ts">
import BookingCalendarPanel from '~/components/operations/BookingCalendarPanel.vue'

/**
 * Operations > Kalender — dipisah dari menu "Daftar Booking" (dulu section "Calendar & Map" di
 * `/bookings`, sebelumnya `/operations/calendar`). Halaman ini murni kalender, tanpa section lain.
 * Isinya dipindah apa adanya ke `app/components/operations/BookingCalendarPanel.vue` — tidak ada
 * logic/data baru di sini, komponennya sudah punya gerbang akses sendiri (`canView('operations')`).
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Kalender' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Kalender"
      description="Kalender & peta perencanaan booking Flight/Hotel/Transport/MICE."
      :breadcrumb="[{ label: 'Kalender' }]"
    />

    <BookingCalendarPanel />
  </div>
</template>
