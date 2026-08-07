<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Follow-up Otomatis melebur jadi section "Follow-up Otomatis" di
 * `/crm/engagement`, lihat `app/components/crm/FollowUpPanel.vue`. Redirect ke anchor `#follow-ups`
 * (section bertumpuk, bukan tab). Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/crm/engagement', query: route.query, hash: '#follow-ups' })
</script>

<template>
  <div />
</template>
