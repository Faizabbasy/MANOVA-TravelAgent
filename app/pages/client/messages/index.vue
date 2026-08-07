<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Messages & Activities melebur jadi section "Messages" di
 * `/client/documents`, lihat `app/components/client/MessagesListPanel.vue`. Redirect ke anchor `#messages`
 * (section bertumpuk, bukan tab). Route detail `/client/messages/[projectId]` TIDAK terpengaruh. Route
 * lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/client/documents', query: route.query, hash: '#messages' })
</script>

<template>
  <div />
</template>
