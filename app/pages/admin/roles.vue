<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Roles and Permissions melebur jadi section "Roles and
 * Permissions" di `/admin/users`, lihat `app/components/admin/RolesPermissionsPanel.vue`. Redirect ke
 * anchor `#roles` (section bertumpuk, bukan tab). Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/admin/users', query: route.query, hash: '#roles' })
</script>

<template>
  <div />
</template>
