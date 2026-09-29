<script setup lang="ts">
/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Client-facing Opportunity view melebur ke
 * `/client/quotations/[id]` (Quotation detail SUDAH lebih lengkap: Approve/Reject/Request Revision + Version
 * history/Compare/Comments/Attachments/Download PDF; kartu "Opportunity" — company/destinasi/tanggal/peta
 * lokasi — dipindahkan ke sana supaya tidak ada fitur yang hilang). Entitas Opportunity DIHAPUS (lihat
 * komentar desain di `app/types/lead.ts`) — ID opportunity lama di URL ini tidak lagi bisa diresolusi ke
 * Quotation/Lead manapun (bukan format ID yang sama), jadi redirect selalu ke Client Portal, bukan lagi
 * lookup per-ID.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
await navigateTo('/client')
</script>

<template>
  <div />
</template>
