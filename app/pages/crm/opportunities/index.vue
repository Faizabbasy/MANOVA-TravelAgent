<script setup lang="ts">
/**
 * Redirect — entitas Opportunity dihapus (lihat komentar desain di `app/types/lead.ts`); daftar deal kini
 * hidup sebagai section "Leads" di `/sales/pipeline`, lihat `app/components/sales/SalesLeadsPanel.vue`.
 * Redirect ke anchor `#leads` (section bertumpuk, bukan tab) supaya browser scroll otomatis. Route lama
 * dipertahankan sebagai redirect murni supaya bookmark/link lama tidak 404. Route detail
 * `/crm/opportunities/[id]` sudah dipindah ke `/crm/leads/[id]` (tidak ada redirect per-ID — Opportunity ID
 * lama tidak lagi bisa diresolusi ke Lead manapun).
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
const route = useRoute()
await navigateTo({ path: '/sales/pipeline', query: route.query, hash: '#leads' })
</script>

<template>
  <div />
</template>
