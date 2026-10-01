<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Leads melebur jadi tab "Leads" di `/sales/pipeline`, lihat
 * `app/components/sales/SalesLeadsPanel.vue`. Redirect ke anchor `#leads` supaya tab yang dituju otomatis
 * terbuka. Route lama dipertahankan sebagai redirect murni (termasuk `?stage=qualified` drill-down dari
 * dashboard) supaya bookmark/link lama tidak 404.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/sales/pipeline', query: route.query, hash: '#leads' })
</script>

<template>
  <div />
</template>
