<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Projects melebur jadi section "Projects" di
 * `/client/project-orders`, lihat `app/components/client/ProjectsListPanel.vue`. Redirect ke anchor
 * `#projects` (section bertumpuk, bukan tab). Route detail `/client/project-orders/[id]` TIDAK terpengaruh.
 * Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/client/project-orders', query: route.query, hash: '#projects' })
</script>

<template>
  <div />
</template>
