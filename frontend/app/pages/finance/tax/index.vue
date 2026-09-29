<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Tax & Multi Currency melebur jadi section "Tax & Currency" di
 * `/finance/ledger`, lihat `app/components/finance/TaxCurrencyPanel.vue`. Redirect ke anchor `#tax`
 * (section bertumpuk, bukan tab). Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/finance/ledger', query: route.query, hash: '#tax' })
</script>

<template>
  <div />
</template>
