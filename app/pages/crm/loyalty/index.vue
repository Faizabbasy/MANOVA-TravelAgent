<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Loyalty Program melebur jadi section "Loyalty Program" di
 * `/crm/engagement`, lihat `app/components/crm/LoyaltyPanel.vue`. Redirect ke anchor `#loyalty` (section
 * bertumpuk, bukan tab). Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/crm/engagement', query: route.query, hash: '#loyalty' })
</script>

<template>
  <div />
</template>
