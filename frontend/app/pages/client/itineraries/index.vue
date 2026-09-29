<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Itineraries melebur jadi section "Itineraries" di
 * `/client/project-orders`, lihat `app/components/client/ItinerariesListPanel.vue`. Redirect ke anchor
 * `#itineraries` (section bertumpuk, bukan tab). Route detail `/client/itineraries/[id]` TIDAK terpengaruh.
 * Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/client/project-orders', query: route.query, hash: '#itineraries' })
</script>

<template>
  <div />
</template>
