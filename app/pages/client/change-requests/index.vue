<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Change Requests melebur jadi section "Change Requests" di
 * `/client/project-orders`, lihat `app/components/client/ChangeRequestsListPanel.vue`. Redirect ke anchor
 * `#change-requests` (section bertumpuk, bukan tab). Route detail `/client/change-requests/[id]` TIDAK
 * terpengaruh. Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/client/project-orders', query: route.query, hash: '#change-requests' })
</script>

<template>
  <div />
</template>
