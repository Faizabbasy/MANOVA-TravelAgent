<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Prospects melebur ke `/customer-journey/customers` (kini
 * "Database Customer") dengan filter `?status=prospect`; aksi "Tambah Prospect" ikut dipindah ke sana.
 * Route lama dipertahankan sebagai redirect murni supaya bookmark/link lama tidak 404.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/customer-journey/customers', query: { ...route.query, status: 'prospect' } })
</script>

<template>
  <div />
</template>
