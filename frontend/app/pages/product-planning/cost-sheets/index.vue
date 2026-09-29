<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Cost Sheets melebur jadi section "Cost Sheets" di
 * `/product-planning`, lihat `app/components/sales/CostSheetsPanel.vue`. Redirect ke anchor `#cost-sheets`
 * (section bertumpuk, bukan tab). Route detail `/product-planning/cost-sheets/[id]` TIDAK terpengaruh.
 * Query deep-link (`productId`/`leadId`/`create`) diteruskan apa adanya.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/product-planning', query: route.query, hash: '#cost-sheets' })
</script>

<template>
  <div />
</template>
