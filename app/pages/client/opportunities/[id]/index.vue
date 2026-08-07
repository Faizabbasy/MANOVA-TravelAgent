<script setup lang="ts">
import { getQuotationByOpportunity } from '~/data'

/**
 * Redirect (Penyederhanaan 7-Role/Menu) — Client-facing Opportunity view melebur ke
 * `/client/quotations/[id]` (Quotation detail SUDAH lebih lengkap: Approve/Reject/Request Revision + Version
 * history/Compare/Comments/Attachments/Download PDF; kartu "Opportunity" — company/destinasi/tanggal/peta
 * lokasi — dipindahkan ke sana supaya tidak ada fitur yang hilang). Resolusi lewat `getQuotationByOpportunity`
 * karena route lama hanya membawa opportunity id, bukan quotation id. Bila opportunity belum punya quotation
 * (belum sempat diajukan tim kami), arahkan ke Client Portal — tidak ada halaman detail opportunity murni lagi.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const quotation = getQuotationByOpportunity(String(route.params.id))
await navigateTo(quotation ? `/client/quotations/${quotation.id}` : '/client')
</script>

<template>
  <div />
</template>
