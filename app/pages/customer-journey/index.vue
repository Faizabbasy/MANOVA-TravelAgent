<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Customer Journey Funnel melebur jadi section "Funnel" di
 * `/sales/pipeline`, lihat `app/components/sales/SalesFunnelPanel.vue`. Halaman gabungan disusun sebagai
 * section bertumpuk (bukan tab) — redirect ke anchor `#funnel` supaya browser scroll otomatis ke section
 * yang dituju. Route lama dipertahankan sebagai redirect murni supaya bookmark/link lama tidak 404.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/sales/pipeline', query: route.query, hash: '#funnel' })
</script>

<template>
  <div />
</template>
