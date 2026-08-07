<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Quotations & Approval Queue melebur jadi section "Quotation" di
 * `/sales/pipeline`, lihat `app/components/sales/SalesQuotationsPanel.vue`. Redirect ke anchor `#quotations`
 * (section bertumpuk, bukan tab) supaya browser scroll otomatis. Sub-tab internal (`?tab=all&status=approved`)
 * di-remap ke `?qtab=` karena `SalesQuotationsPanel.vue` memakai key itu untuk tab internalnya sendiri.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
const { tab: oldSubTab, ...restQuery } = route.query
await navigateTo({
  path: '/sales/pipeline',
  query: { ...restQuery, ...(oldSubTab ? { qtab: oldSubTab } : {}) },
  hash: '#quotations'
})
</script>

<template>
  <div />
</template>
