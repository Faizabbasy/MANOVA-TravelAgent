<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — list Komoditas Saya melebur jadi section "Komoditas" di
 * `/supplier/products`, lihat `app/components/supplier/MyCommoditiesPanel.vue`. Redirect ke anchor
 * `#commodities` (section bertumpuk, bukan tab). Route detail `/supplier/commodities/[id]` TIDAK
 * terpengaruh. Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/supplier/products', query: route.query, hash: '#commodities' })
</script>

<template>
  <div />
</template>
