<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Service Order Inbox melebur jadi section "Service Orders" di
 * `/supplier/orders`, lihat `app/components/supplier/ServiceOrderInboxPanel.vue`. Redirect ke anchor
 * `#service-orders` (section bertumpuk, bukan tab). Route detail `/supplier/service-orders/[id]` TIDAK
 * terpengaruh. Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/supplier/orders', query: route.query, hash: '#service-orders' })
</script>

<template>
  <div />
</template>
