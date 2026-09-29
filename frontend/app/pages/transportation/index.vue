<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — list Transportation melebur jadi section "Transportation" di
 * `/services`, lihat `app/components/operations/TransportationListPanel.vue`. Redirect ke anchor
 * `#transportation` (section bertumpuk, bukan tab). Route detail `/transportation/[id]` TIDAK terpengaruh.
 * Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/services', query: route.query, hash: '#transportation' })
</script>

<template>
  <div />
</template>
