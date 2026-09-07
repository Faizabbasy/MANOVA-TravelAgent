<script setup lang="ts">
import { computed } from 'vue'
import { Receipt, Wallet, AlertTriangle, HandCoins } from 'lucide-vue-next'
import InvoiceListPanel from '~/components/finance/InvoiceListPanel.vue'
import ReceivablesPanel from '~/components/finance/ReceivablesPanel.vue'
import CreditDebitNotesPanel from '~/components/finance/CreditDebitNotesPanel.vue'
import BillingPanel from '~/components/finance/BillingPanel.vue'
import { getOutstandingInvoices, INVOICES } from '~/data'
import { getPayables } from '~/data/finance-ext'
import { isInvoiceOverdue } from '~/utils/attention'
import { formatCurrencyIdr, formatNumber } from '~/utils/format'

/**
 * Finance & ACC > Invoice & Piutang (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling
 * ngalir") — satu menu menampung Invoice (dulu halaman ini sendiri), AR Aging (dulu `/finance/receivables`),
 * Credit & Debit Note (dulu `/finance/notes`), dan Billing (rekap invoice per customer — dulu hanya ada di
 * Client Portal, sekarang ada juga versi internal di sini). Konten tiap section dipindah apa adanya ke
 * `app/components/finance/*Panel.vue`. Disusun sebagai section bertumpuk dalam satu halaman scroll (BUKAN
 * `<Tabs>`) — tiap section punya `id` untuk deep-link `#section`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Invoice & Piutang' })

/** Stat ringkas atas halaman — angka sama persis dengan yang dipakai `InvoiceListPanel`/`ReceivablesPanel`
 * di bawahnya (bukan hitungan paralel), cuma ditonjolkan di atas supaya langsung terlihat tanpa scroll. */
const outstanding = computed(() => getOutstandingInvoices())
const outstandingTotal = computed(() => outstanding.value.reduce((sum, invoice) => sum + invoice.amountIdr, 0))
const overdueCount = computed(() => INVOICES.filter(invoice => isInvoiceOverdue(invoice)).length)
const payablesTotal = computed(() => getPayables().reduce((sum, row) => sum + row.outstandingIdr, 0))

type StatsCardTone = 'primary' | 'success' | 'warning' | 'destructive'
interface StatTile { key: string; label: string; value: string; icon: typeof Receipt; tone: StatsCardTone; to: string }

/** Pakai `StatsCard` (komponen yang sama dipakai di seluruh dashboard/halaman lain), dibungkus `NuxtLink`
 * supaya tetap klik-able jump ke section terkait. */
const statTiles = computed<StatTile[]>(() => [
  { key: 'invoice-outstanding', label: 'Invoice Outstanding', value: formatNumber(outstanding.value.length), icon: Receipt, tone: 'primary', to: '#invoice' },
  { key: 'total-outstanding', label: 'Total Outstanding', value: formatCurrencyIdr(outstandingTotal.value), icon: Wallet, tone: 'success', to: '#receivables' },
  { key: 'invoice-overdue', label: 'Invoice Overdue', value: formatNumber(overdueCount.value), icon: AlertTriangle, tone: 'destructive', to: '#invoice' },
  { key: 'total-hutang', label: 'Total Hutang (AP)', value: formatCurrencyIdr(payablesTotal.value), icon: HandCoins, tone: 'warning', to: '/finance/payables#payables' }
])
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Invoice & Piutang"
      description="Invoice, aging piutang (AR), dan Credit/Debit Note — dalam satu menu."
      :breadcrumb="[{ label: 'Finance & ACC', to: '/finance' }, { label: 'Invoice & Piutang' }]"
    />

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <NuxtLink v-for="tile in statTiles" :key="tile.key" :to="tile.to" class="block">
        <StatsCard :title="tile.label" :value="tile.value" :icon="tile.icon" :icon-color="tile.tone" />
      </NuxtLink>
    </div>

    <section id="invoice" class="space-y-4 scroll-mt-20">
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

    <Separator />

    <section id="billing" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Billing
      </h2>
      <BillingPanel />
    </section>
  </div>
</template>
