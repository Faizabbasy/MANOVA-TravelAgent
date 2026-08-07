<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Booking Calendar & Map melebur jadi section "Calendar & Map" di
 * `/bookings`, lihat `app/components/operations/BookingCalendarPanel.vue`. Redirect ke anchor `#calendar`
 * (section bertumpuk, bukan tab). Route lama dipertahankan sebagai redirect murni supaya bookmark/link
 * lama tidak 404.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/bookings', query: route.query, hash: '#calendar' })
</script>

<template>
  <div />
</template>
