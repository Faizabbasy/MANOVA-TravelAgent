<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Approval Center melebur jadi section "Approvals" di
 * `/client/travel-requests`, lihat `app/components/client/ApprovalsListPanel.vue`. Redirect ke anchor
 * `#approvals` (section bertumpuk, bukan tab). Route detail `/client/approvals/[id]` TIDAK terpengaruh.
 * Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/client/travel-requests', query: route.query, hash: '#approvals' })
</script>

<template>
  <div />
</template>
