<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Exception Queue melebur jadi section "Exceptions" di `/bookings`,
 * lihat `app/components/operations/BookingExceptionsPanel.vue`. Redirect ke anchor `#exceptions` (section
 * bertumpuk, bukan tab). Route lama dipertahankan sebagai redirect murni supaya bookmark/link lama tidak 404.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/bookings', query: route.query, hash: '#exceptions' })
</script>

<template>
  <div />
</template>
