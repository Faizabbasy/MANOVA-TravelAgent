<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — dipindah ke `/project-orders/[id]/run-sheet-preview.vue`.
 * Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: `/project-orders/${route.params.id}/run-sheet-preview`, query: route.query })
</script>

<template>
  <div />
</template>
