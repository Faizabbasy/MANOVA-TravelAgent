<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Lead Source Recap jadi tab "Rekap Sumber Lead" tersendiri di
 * `/sales/pipeline`, lihat `app/components/sales/SalesLeadSourceRecapPanel.vue`. Redirect ke anchor
 * `#lead-sources` supaya tab yang benar otomatis terbuka. Route lama dipertahankan sebagai redirect murni
 * supaya bookmark/link lama tidak 404.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/sales/pipeline', query: route.query, hash: '#lead-sources' })
</script>

<template>
  <div />
</template>
