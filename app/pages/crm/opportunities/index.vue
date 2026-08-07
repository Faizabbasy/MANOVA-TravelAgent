<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Opportunities melebur jadi section "Opportunities" di
 * `/sales/pipeline`, lihat `app/components/sales/SalesOpportunitiesPanel.vue`. Redirect ke anchor
 * `#opportunities` (section bertumpuk, bukan tab) supaya browser scroll otomatis. Route lama dipertahankan
 * sebagai redirect murni (termasuk `?stage=won` drill-down) supaya bookmark/link lama tidak 404. Route
 * detail `/crm/opportunities/[id]` TIDAK ikut pindah/redirect — tetap di tempatnya.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/sales/pipeline', query: route.query, hash: '#opportunities' })
</script>

<template>
  <div />
</template>
