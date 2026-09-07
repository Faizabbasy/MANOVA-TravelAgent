<script setup lang="ts">
import PaymentsPanel from '~/components/finance/PaymentsPanel.vue'
import ReconciliationPanel from '~/components/finance/ReconciliationPanel.vue'

/**
 * Finance & ACC > Pembayaran & Rekonsiliasi (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi
 * saling ngalir") — satu menu menampung Payments (dulu halaman ini sendiri) dan Reconciliation (dulu
 * `/finance/reconciliation`). Konten tiap section dipindah apa adanya ke `app/components/finance/*Panel.vue`.
 * Disusun sebagai section bertumpuk dalam satu halaman scroll (BUKAN `<Tabs>`) — tiap section punya `id`
 * untuk deep-link `#section`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Pembayaran & Rekonsiliasi' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Pembayaran & Rekonsiliasi"
      description="Riwayat payment klien dan worklist rekonsiliasi Supplier Invoice — dalam satu menu."
      :breadcrumb="[{ label: 'Finance & ACC', to: '/finance' }, { label: 'Pembayaran & Rekonsiliasi' }]"
    />

    <section id="payments" class="scroll-mt-20">
      <PaymentsPanel />
    </section>

    <section id="reconciliation" class="scroll-mt-20">
      <ReconciliationPanel />
    </section>
  </div>
</template>
