<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — list Ticketing melebur jadi section "Ticketing" di `/services`,
 * lihat `app/components/operations/TicketingListPanel.vue`. Redirect ke anchor `#ticketing` (section
 * bertumpuk, bukan tab). Route detail `/ticketing/[id]` TIDAK terpengaruh. Route lama dipertahankan sebagai
 * redirect murni (termasuk `?projectId=&create=1` quick-create dari Project Detail) supaya bookmark/link
 * lama tidak 404.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/services', query: route.query, hash: '#ticketing' })
</script>

<template>
  <div />
</template>
