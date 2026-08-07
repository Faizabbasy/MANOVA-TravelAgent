<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Issues & Support melebur jadi section "Support" di
 * `/client/documents`, lihat `app/components/client/SupportListPanel.vue`. Redirect ke anchor `#support`
 * (section bertumpuk, bukan tab). Route detail `/client/support/[id]` TIDAK terpengaruh. Route lama
 * dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/client/documents', query: route.query, hash: '#support' })
</script>

<template>
  <div />
</template>
