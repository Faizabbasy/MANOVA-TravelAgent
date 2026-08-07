<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Procurement Performance Review melebur jadi section "Rating &
 * Performance" di `/vendors`, lihat `app/components/vendor/VendorPerformancePanel.vue`. Redirect ke anchor
 * `#performance` (section bertumpuk, bukan tab). Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/vendors', query: route.query, hash: '#performance' })
</script>

<template>
  <div />
</template>
