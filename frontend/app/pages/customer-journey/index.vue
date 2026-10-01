<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Customer Journey Funnel melebur jadi tab "Funnel" di
 * `/sales/pipeline`, lihat `app/components/sales/SalesFunnelPanel.vue`. Redirect ke anchor `#funnel`
 * supaya tab yang dituju otomatis terbuka. Route lama dipertahankan sebagai redirect murni supaya
 * bookmark/link lama tidak 404.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/sales/pipeline', query: route.query, hash: '#funnel' })
</script>

<template>
  <div />
</template>
