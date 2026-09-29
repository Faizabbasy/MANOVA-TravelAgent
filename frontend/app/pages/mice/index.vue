<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — list MICE melebur jadi section "MICE" di `/services`, lihat
 * `app/components/operations/MiceListPanel.vue`. Redirect ke anchor `#mice` (section bertumpuk, bukan tab).
 * Route detail `/mice/[id]` TIDAK terpengaruh. Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/services', query: route.query, hash: '#mice' })
</script>

<template>
  <div />
</template>
