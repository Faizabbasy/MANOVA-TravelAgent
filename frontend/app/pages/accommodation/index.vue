<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — list Accommodation melebur jadi section "Accommodation" di
 * `/services`, lihat `app/components/operations/AccommodationListPanel.vue`. Redirect ke anchor
 * `#accommodation` (section bertumpuk, bukan tab). Route detail `/accommodation/[id]` TIDAK terpengaruh.
 * Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/services', query: route.query, hash: '#accommodation' })
</script>

<template>
  <div />
</template>
