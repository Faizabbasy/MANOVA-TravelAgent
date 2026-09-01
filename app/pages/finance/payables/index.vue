<script setup lang="ts">
import PayablesPanel from '~/components/finance/PayablesPanel.vue'
import OpexPanel from '~/components/finance/OpexPanel.vue'
import PurchasesPanel from '~/components/finance/PurchasesPanel.vue'

/**
 * Finance & ACC > Hutang & Opex (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling
 * ngalir") — satu menu menampung Payables/AP Aging (dulu halaman ini sendiri), Opex (dulu
 * `/finance/opex`), dan Purchases (pembelian barang/jasa non-vendor-service, baru). Konten tiap section
 * dipindah apa adanya ke `app/components/finance/*Panel.vue`. Disusun sebagai section bertumpuk dalam satu
 * halaman scroll (BUKAN `<Tabs>`) — tiap section punya `id` untuk deep-link `#section`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Hutang & Opex' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Hutang & Opex"
      description="Kewajiban ke vendor (AP) dan biaya operasional perusahaan — dalam satu menu."
      :breadcrumb="[{ label: 'Finance & ACC', to: '/finance' }, { label: 'Hutang & Opex' }]"
    />

    <section id="payables" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        AP Aging
      </h2>
      <PayablesPanel />
    </section>

    <Separator />

    <section id="opex" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Opex
      </h2>
      <OpexPanel />
    </section>

    <Separator />

    <section id="purchases" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Purchases
      </h2>
      <PurchasesPanel />
    </section>
  </div>
</template>
