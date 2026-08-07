<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Activity Center melebur jadi section "Activity Center" di
 * `/admin/audit-trail`, lihat `app/components/admin/ActivityCenterPanel.vue`. Redirect ke anchor
 * `#activity-center` (section bertumpuk, bukan tab). Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/admin/audit-trail', query: route.query, hash: '#activity-center' })
</script>

<template>
  <div />
</template>
