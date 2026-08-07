<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Review & Feedback melebur jadi section "Review & Feedback" di
 * `/crm/engagement`, lihat `app/components/crm/FeedbackPanel.vue`. Redirect ke anchor `#feedback` (section
 * bertumpuk, bukan tab). Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/crm/engagement', query: route.query, hash: '#feedback' })
</script>

<template>
  <div />
</template>
