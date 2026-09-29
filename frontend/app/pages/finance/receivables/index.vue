<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Receivables melebur jadi section "AR Aging" di
 * `/finance/invoices`, lihat `app/components/finance/ReceivablesPanel.vue`. Redirect ke anchor
 * `#receivables` (section bertumpuk, bukan tab). Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/finance/invoices', query: route.query, hash: '#receivables' })
</script>

<template>
  <div />
</template>
