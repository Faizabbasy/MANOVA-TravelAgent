<script setup lang="ts">
import MyProductsPanel from '~/components/supplier/MyProductsPanel.vue'
import MyCommoditiesPanel from '~/components/supplier/MyCommoditiesPanel.vue'

/**
 * Vendor Portal > Katalog (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling ngalir") —
 * satu menu menampung Produk/Layanan Saya (dulu halaman ini sendiri) dan Komoditas Saya (dulu
 * `/supplier/commodities`). Konten tiap section dipindah apa adanya ke `app/components/supplier/*Panel.vue`.
 * Disusun sebagai section bertumpuk dalam satu halaman scroll (BUKAN `<Tabs>`) — tiap section punya `id`
 * untuk deep-link `#section`. Route detail `/supplier/commodities/[id]` TIDAK berubah.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Katalog' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Katalog"
      description="Produk/layanan dan komoditas milik Anda — dalam satu menu."
      :breadcrumb="[{ label: 'Katalog' }]"
    />

    <section id="products" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Produk/Layanan
      </h2>
      <MyProductsPanel />
    </section>

    <Separator />

    <section id="commodities" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Komoditas
      </h2>
      <MyCommoditiesPanel />
    </section>
  </div>
</template>
