<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Notifications melebur jadi section "Notifications" di `/client`,
 * lihat `app/components/client/NotificationsPanel.vue`. Redirect ke anchor `#notifications` (section
 * bertumpuk, bukan tab). Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/client', query: route.query, hash: '#notifications' })
</script>

<template>
  <div />
</template>
