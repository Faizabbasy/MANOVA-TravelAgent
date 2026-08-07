<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Organization Profile melebur jadi section "Organization Profile"
 * di `/admin`, lihat `app/components/admin/OrganizationProfilePanel.vue`. Redirect ke anchor
 * `#organization` (section bertumpuk, bukan tab). Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/admin', query: route.query, hash: '#organization' })
</script>

<template>
  <div />
</template>
