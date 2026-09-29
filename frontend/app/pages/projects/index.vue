<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Project Workspace (dulu duplikat `/projects`, 3.040 baris)
 * digabung penuh ke `/project-orders/[id]` (stepper 6-step + seluruh 8 tab lama), list-nya digantikan
 * `/project-orders`. Route lama dipertahankan sebagai redirect murni supaya bookmark/link lama tidak 404.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/project-orders', query: route.query })
</script>

<template>
  <div />
</template>
