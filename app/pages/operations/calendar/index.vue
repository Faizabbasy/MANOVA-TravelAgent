<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Booking Calendar & Map kini halaman tersendiri "Kalender"
 * (`/calendar`, lihat `app/pages/calendar/index.vue`) — sebelumnya sempat jadi section di `/bookings`,
 * sekarang dipisah lagi. Route lama dipertahankan sebagai redirect murni supaya bookmark/link lama
 * tidak 404.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/calendar', query: route.query })
</script>

<template>
  <div />
</template>
