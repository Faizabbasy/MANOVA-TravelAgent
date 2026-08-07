<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Analytics & Marketing ROI melebur jadi section "Analytics &
 * Marketing ROI" di `/reports`, lihat `app/components/reports/ReportsAnalyticsPanel.vue`. Redirect ke
 * anchor `#analytics` (section bertumpuk, bukan tab). Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/reports', query: route.query, hash: '#analytics' })
</script>

<template>
  <div />
</template>
