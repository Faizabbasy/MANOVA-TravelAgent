<script setup lang="ts">
import ProductTemplatesPanel from '~/components/sales/ProductTemplatesPanel.vue'

/**
 * Sales > Produk & Costing (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling ngalir") —
 * satu menu menampung Product Templates (dulu halaman ini sendiri) dan Cost Sheets (dulu
 * `/product-planning/cost-sheets`). Konten tiap section dipindah apa adanya ke
 * `app/components/sales/*Panel.vue`. Disusun sebagai section bertumpuk dalam satu halaman scroll (BUKAN
 * `<Tabs>`) — tiap section punya `id` untuk deep-link `#section`. Route detail (`/product-planning/[id]`,
 * `/product-planning/cost-sheets/[id]`) TIDAK berubah. Deep-link `?productId=`/`?opportunityId=`/`?create=1`
 * dari Product Template Detail dan Opportunity Detail tetap bekerja lewat section Cost Sheets.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Produk & Costing' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Produk & Costing"
      description="Katalog Product/Package Template dan Cost Sheet — dalam satu menu."
      :breadcrumb="[{ label: 'Produk & Costing' }]"
    />

    <section id="templates" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Product Templates
      </h2>
      <ProductTemplatesPanel />
    </section>
  </div>
</template>
