<script setup lang="ts">
import { computed } from 'vue'
import { Calculator } from 'lucide-vue-next'
import { formatCurrencyIdr } from '~/utils/format'

/**
 * Tab Finance (Project Detail) — pengganti card "Riwayat Pembayaran" terpisah (fungsinya sudah pindah ke
 * baris milestone `ProjectInvoicesPanel`). Gaya visual mengikuti referensi client (grup baris berlabel →
 * subtotal → Grand Total), tapi kontennya dipetakan ke angka yang benar-benar ada di Manova — Nilai Kontrak
 * → Ditagih → Dibayar → Outstanding — bukan Equipment/PPN/Ocean Freight (tidak ada model pajak/logistik di
 * app ini). Presentational-only, seluruh angka sudah computed di halaman induk (sama sumbernya dengan
 * Payment Progress banner di `ProjectInvoicesPanel`, jadi selalu konsisten satu sama lain).
 */
const props = defineProps<{
  quotationAmountIdr: number
  invoiceIssuedIdr: number
  collectedIdr: number
  outstandingIdr: number
}>()

const unbilledIdr = computed(() => Math.max(props.quotationAmountIdr - props.invoiceIssuedIdr, 0))
const isFullyPaid = computed(() => props.outstandingIdr <= 0 && props.quotationAmountIdr > 0)
</script>

<template>
  <SectionCard compact content-class="space-y-4">
    <template #header>
      <div class="flex items-start gap-3">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Calculator class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <CardTitle class="text-sm font-bold uppercase tracking-wide text-foreground">
            Rincian Harga
          </CardTitle>
          <CardDescription class="mt-0.5 text-xs">
            Breakdown nilai kontrak dan status penagihan project ini.
          </CardDescription>
        </div>
      </div>
    </template>

    <template v-if="quotationAmountIdr > 0">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Nilai Kontrak
        </p>
        <div class="mt-1.5 flex items-center justify-between text-sm">
          <span class="text-foreground">Nilai Kontrak Project</span>
          <span class="font-medium tabular-nums text-foreground">{{ formatCurrencyIdr(quotationAmountIdr) }}</span>
        </div>
      </div>

      <div class="border-t border-border pt-3">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Penagihan
        </p>
        <div class="mt-1.5 space-y-1.5 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-foreground">Total Ditagih</span>
            <span class="font-medium tabular-nums text-foreground">{{ formatCurrencyIdr(invoiceIssuedIdr) }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-foreground">Belum Ditagih</span>
            <span class="font-medium tabular-nums text-foreground">{{ formatCurrencyIdr(unbilledIdr) }}</span>
          </div>
        </div>
      </div>

      <div class="border-t border-border pt-3">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Pembayaran
        </p>
        <div class="mt-1.5 flex items-center justify-between text-sm">
          <span class="text-foreground">Sudah Dibayar</span>
          <span class="font-medium tabular-nums text-success">{{ formatCurrencyIdr(collectedIdr) }}</span>
        </div>
      </div>

      <div class="flex items-center justify-between border-t border-border pt-3">
        <span class="text-sm font-bold text-foreground">{{ isFullyPaid ? 'Lunas' : 'Outstanding' }}</span>
        <span class="text-lg font-bold tabular-nums" :class="isFullyPaid ? 'text-success' : 'text-warning'">
          {{ formatCurrencyIdr(outstandingIdr) }}
        </span>
      </div>
    </template>

    <EmptyState
      v-else
      :icon="Calculator"
      title="Nilai kontrak belum ditentukan"
      description="Breakdown harga muncul setelah nilai kontrak project diisi."
    />
  </SectionCard>
</template>
