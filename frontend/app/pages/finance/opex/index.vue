<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Opex melebur jadi section "Opex" di `/finance/payables`, lihat
 * `app/components/finance/OpexPanel.vue`. Redirect ke anchor `#opex` (section bertumpuk, bukan tab). Route
 * lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/finance/payables', query: route.query, hash: '#opex' })
</script>

<template>
  <div />
</template>
