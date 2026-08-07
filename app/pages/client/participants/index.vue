<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Participants melebur jadi section "Participants" di
 * `/client/project-orders`, lihat `app/components/client/ParticipantsListPanel.vue`. Redirect ke anchor
 * `#participants` (section bertumpuk, bukan tab). Route detail `/client/participants/[id]` TIDAK
 * terpengaruh. Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/client/project-orders', query: route.query, hash: '#participants' })
</script>

<template>
  <div />
</template>
