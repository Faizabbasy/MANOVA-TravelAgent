<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Lead Source Recap melebur ke bagian bawah section "Funnel" di
 * `/sales/pipeline`, lihat `app/components/sales/SalesFunnelPanel.vue`. Redirect ke anchor `#funnel`
 * (section bertumpuk, bukan tab) supaya browser scroll otomatis. Route lama dipertahankan sebagai redirect
 * murni supaya bookmark/link lama tidak 404.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/sales/pipeline', query: route.query, hash: '#funnel' })
</script>

<template>
  <div />
</template>
