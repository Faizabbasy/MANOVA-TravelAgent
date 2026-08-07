<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Feedback & Evaluation melebur jadi section "Feedback" di
 * `/client/reports`, lihat `app/components/client/FeedbackListPanel.vue`. Redirect ke anchor `#feedback`
 * (section bertumpuk, bukan tab). Route detail `/client/feedback/[projectId]` TIDAK terpengaruh. Route
 * lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/client/reports', query: route.query, hash: '#feedback' })
</script>

<template>
  <div />
</template>
