<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Reservations melebur jadi section "Reservations" di
 * `/client/project-orders`, lihat `app/components/client/ReservationsListPanel.vue`. Redirect ke anchor
 * `#reservations` (section bertumpuk, bukan tab). Route detail `/client/reservations/[type]/[id]/preview`
 * TIDAK terpengaruh. Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/client/project-orders', query: route.query, hash: '#reservations' })
</script>

<template>
  <div />
</template>
