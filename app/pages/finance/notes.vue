<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Credit/Debit Notes melebur jadi section "Credit & Debit Note" di
 * `/finance/invoices`, lihat `app/components/finance/CreditDebitNotesPanel.vue`. Redirect ke anchor
 * `#notes` (section bertumpuk, bukan tab). Sub-tab internal (`?tab=debit`) di-remap ke `?ntab=` karena
 * `CreditDebitNotesPanel.vue` memakai key itu untuk tab internalnya sendiri.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
const { tab: oldSubTab, ...restQuery } = route.query
await navigateTo({
  path: '/finance/invoices',
  query: { ...restQuery, ...(oldSubTab ? { ntab: oldSubTab } : {}) },
  hash: '#notes'
})
</script>

<template>
  <div />
</template>
