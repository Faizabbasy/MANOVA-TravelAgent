<script setup lang="ts">
import VendorDirectoryPanel from '~/components/vendor/VendorDirectoryPanel.vue'
import VendorPerformancePanel from '~/components/vendor/VendorPerformancePanel.vue'

/**
 * Vendor & Partner > Data Vendor (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling
 * ngalir") — satu menu menampung Direktori Vendor (dulu halaman ini sendiri) dan Rating & Performance
 * (dulu `/procurement/performance`). Konten tiap section dipindah apa adanya ke
 * `app/components/vendor/*Panel.vue`. Disusun sebagai section bertumpuk dalam satu halaman scroll (BUKAN
 * `<Tabs>`) — tiap section punya `id` untuk deep-link `#section`. Route detail `/vendors/[id]` TIDAK berubah.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Data Vendor' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Data Vendor"
      description="Direktori vendor dan rating/performance procurement — dalam satu menu."
      :breadcrumb="[{ label: 'Data Vendor' }]"
    />

    <section id="directory" class="space-y-4 scroll-mt-20">
      <VendorDirectoryPanel />
    </section>

    <Separator />

    <section id="performance" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Rating & Performance
      </h2>
      <VendorPerformancePanel />
    </section>
  </div>
</template>
