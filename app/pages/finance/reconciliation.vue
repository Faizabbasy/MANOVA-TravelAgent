<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Reconciliation melebur jadi section "Reconciliation" di
 * `/finance/payments`, lihat `app/components/finance/ReconciliationPanel.vue`. Redirect ke anchor
 * `#reconciliation` (section bertumpuk, bukan tab). Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/finance/payments', query: route.query, hash: '#reconciliation' })
</script>

<template>
  <div />
</template>
