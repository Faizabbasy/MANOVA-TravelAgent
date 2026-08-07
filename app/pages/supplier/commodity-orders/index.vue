<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Vendor Orders/Sold Commodities melebur jadi section "Vendor
 * Orders" di `/supplier/orders`, lihat `app/components/supplier/VendorOrdersPanel.vue`. Redirect ke anchor
 * `#vendor-orders` (section bertumpuk, bukan tab). Route detail `/supplier/commodity-orders/[id]` TIDAK
 * terpengaruh. Route lama dipertahankan sebagai redirect murni.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/supplier/orders', query: route.query, hash: '#vendor-orders' })
</script>

<template>
  <div />
</template>
