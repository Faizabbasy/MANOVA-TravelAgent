<script setup lang="ts">
import LedgerPanel from '~/components/finance/LedgerPanel.vue'
import TaxCurrencyPanel from '~/components/finance/TaxCurrencyPanel.vue'

/**
 * Finance & ACC > Buku Besar (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling ngalir")
 * — satu menu menampung General Ledger (dulu halaman ini sendiri, dengan sub-tab internal Saldo Akun/
 * Jurnal/Revenue yang TIDAK berubah) dan Tax & Multi Currency (dulu `/finance/tax`). Konten tiap section
 * dipindah apa adanya ke `app/components/finance/*Panel.vue`. Disusun sebagai section bertumpuk dalam satu
 * halaman scroll (BUKAN `<Tabs>`) — tiap section punya `id` untuk deep-link `#section`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Buku Besar' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Buku Besar"
      description="General ledger, jurnal, revenue report, dan tax/multi currency — dalam satu menu."
      :breadcrumb="[{ label: 'Finance & ACC', to: '/finance' }, { label: 'Buku Besar' }]"
    />

    <section id="ledger" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        General Ledger
      </h2>
      <LedgerPanel />
    </section>

    <Separator />

    <section id="tax" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Tax & Currency
      </h2>
      <TaxCurrencyPanel />
    </section>
  </div>
</template>
