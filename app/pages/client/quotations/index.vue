<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Quotations & Proposals melebur jadi section "Quotations" di
 * `/client/travel-requests`, lihat `app/components/client/QuotationsListPanel.vue`. Redirect ke anchor
 * `#quotations` (section bertumpuk, bukan tab). Route detail `/client/quotations/[id]` dan `/[id]/preview`
 * TIDAK terpengaruh. Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/client/travel-requests', query: route.query, hash: '#quotations' })
</script>

<template>
  <div />
</template>
