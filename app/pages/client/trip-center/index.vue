<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Trip Center melebur jadi section "Trip Center" di
 * `/client/project-orders`, lihat `app/components/client/TripCenterListPanel.vue`. Redirect ke anchor
 * `#trip-center` (section bertumpuk, bukan tab). Route detail `/client/trip-center/[projectId]` TIDAK
 * terpengaruh. Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/client/project-orders', query: route.query, hash: '#trip-center' })
</script>

<template>
  <div />
</template>
