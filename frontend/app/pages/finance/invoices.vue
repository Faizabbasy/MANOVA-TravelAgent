<script setup lang="ts">
import InvoiceListPanel from '~/components/finance/InvoiceListPanel.vue'
import ReceivablesPanel from '~/components/finance/ReceivablesPanel.vue'
import CreditDebitNotesPanel from '~/components/finance/CreditDebitNotesPanel.vue'

/**
 * Finance & ACC > Invoice & Piutang (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling
 * ngalir") — satu menu menampung Invoice (dulu halaman ini sendiri), AR Aging (dulu `/finance/receivables`),
 * dan Credit & Debit Note (dulu `/finance/notes`). Konten tiap section dipindah apa adanya ke
 * `app/components/finance/*Panel.vue`. Disusun sebagai section bertumpuk dalam satu halaman scroll (BUKAN
 * `<Tabs>`) — tiap section punya `id` untuk deep-link `#section`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Invoice & Piutang' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Invoice & Piutang"
      description="Invoice, aging piutang (AR), dan Credit/Debit Note — dalam satu menu."
      :breadcrumb="[{ label: 'Finance & ACC', to: '/finance' }, { label: 'Invoice & Piutang' }]"
    />

    <section id="invoice" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Invoice
      </h2>
      <InvoiceListPanel />
    </section>

    <Separator />

    <section id="receivables" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        AR Aging
      </h2>
      <ReceivablesPanel />
    </section>

    <Separator />

    <section id="notes" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Credit & Debit Note
      </h2>
      <CreditDebitNotesPanel />
    </section>
  </div>
</template>
