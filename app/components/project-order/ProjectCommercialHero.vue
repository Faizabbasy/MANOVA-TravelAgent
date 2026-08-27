<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { BadgeTone } from '~/types/common'

/**
 * Ringkasan komersial tab Overview Project Order — sengaja mengikuti densitas `SectionCard`/`StatsCard`
 * compact yang dipakai seluruh card lain di halaman ini (p-4, angka `text-xl`, tanpa gradient wash/count-up),
 * BUKAN gaya hero besar `DashboardHeroPanel` (itu untuk Dashboard utama yang memang lapang). Ditaruh sebagai
 * separuh lebar (grid 2 kolom, lihat pemanggil) di bawah 4 stat card ringkas Overview, bukan full-width di
 * paling atas. Yang membedakan dari sekadar StatsCard berjajar: composition bar tipis di bawah angka
 * mengubah Paid/Outstanding/Belum-ditagih jadi proporsi visual dari total Quotation, bukan 4 kotak angka
 * lepas. Murni presentational — seluruh derivasi angka (invoice issued/next payment) sudah dihitung di
 * halaman induk.
 */
export interface CommercialNextPayment {
  invoiceLabel: string
  /** Sisa tagihan invoice ini (`getInvoiceOutstandingIdr`), BUKAN `amountIdr` mentah invoice. */
  amountIdr: number
  dueAt: string
  tone: 'overdue' | 'due-soon' | 'scheduled'
}

const props = defineProps<{
  quotationAmountIdr: number
  invoiceIssuedIdr: number
  paidIdr: number
  outstandingIdr: number
  nextPayment: CommercialNextPayment | null
  hasAnyInvoice: boolean
}>()

const NEXT_PAYMENT_TONE: Record<CommercialNextPayment['tone'], { badge: BadgeTone, label: string, ring: string }> = {
  overdue: { badge: 'destructive', label: 'Terlambat', ring: 'bg-destructive/10 text-destructive' },
  'due-soon': { badge: 'warning', label: 'Segera Jatuh Tempo', ring: 'bg-warning/10 text-warning' },
  scheduled: { badge: 'primary', label: 'Terjadwal', ring: 'bg-primary/10 text-primary' }
}

const invoicedPercentOfQuotation = computed(() => props.quotationAmountIdr > 0 ? Math.round((props.invoiceIssuedIdr / props.quotationAmountIdr) * 100) : 0)
const isOverInvoiced = computed(() => props.quotationAmountIdr > 0 && props.invoiceIssuedIdr > props.quotationAmountIdr)

/** Lebar segmen composition bar, dihitung dari quotation (bukan dari invoiceIssued) supaya bar selalu merepresentasikan "porsi dari total kontrak". Diclamp bertahap supaya total gabungan tidak pernah melebihi 100%. */
const barSegments = computed(() => {
  const quotation = props.quotationAmountIdr
  if (quotation <= 0) { return { paidPercent: 0, outstandingPercent: 0, remainderPercent: 0 } }
  const paidPercent = Math.min(100, (props.paidIdr / quotation) * 100)
  const outstandingPercent = Math.min(100 - paidPercent, (props.outstandingIdr / quotation) * 100)
  const remainderPercent = Math.max(0, 100 - paidPercent - outstandingPercent)
  return { paidPercent, outstandingPercent, remainderPercent }
})

const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const barRevealed = ref(prefersReducedMotion)
onMounted(() => {
  if (prefersReducedMotion) { return }
  requestAnimationFrame(() => { barRevealed.value = true })
})
</script>

<template>
  <SectionCard compact title="Ringkasan Komersial" description="Nilai kontrak, invoice, dan pembayaran project ini.">
    <template v-if="nextPayment" #actions>
      <StatusBadge :label="NEXT_PAYMENT_TONE[nextPayment.tone].label" :tone="NEXT_PAYMENT_TONE[nextPayment.tone].badge" />
    </template>

    <p class="text-xl font-bold leading-none tabular-nums text-foreground">
      {{ formatCurrencyIdr(quotationAmountIdr) }}
    </p>
    <p class="mt-1 text-xs text-muted-foreground">
      Nilai Project
      <template v-if="quotationAmountIdr > 0">
        · {{ formatCurrencyIdr(invoiceIssuedIdr) }} ditagih ({{ invoicedPercentOfQuotation }}%)
      </template>
    </p>

    <template v-if="quotationAmountIdr > 0">
      <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div class="flex h-full w-full">
          <div class="h-full bg-success transition-[width] duration-700 ease-out" :style="{ width: `${barRevealed ? barSegments.paidPercent : 0}%` }" />
          <div class="h-full bg-warning transition-[width] duration-700 ease-out" :style="{ width: `${barRevealed ? barSegments.outstandingPercent : 0}%` }" />
          <div class="h-full bg-muted-foreground/20 transition-[width] duration-700 ease-out" :style="{ width: `${barRevealed ? barSegments.remainderPercent : 0}%` }" />
        </div>
      </div>

      <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span class="inline-flex items-center gap-1">
          <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
          Terbayar <span class="font-semibold text-foreground">{{ formatCurrencyIdr(paidIdr) }}</span>
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
          Outstanding <span class="font-semibold text-foreground">{{ formatCurrencyIdr(outstandingIdr) }}</span>
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/20" />
          Belum Ditagih <span class="font-semibold text-foreground">{{ formatCurrencyIdr(Math.max(quotationAmountIdr - invoiceIssuedIdr, 0)) }}</span>
        </span>
      </div>

      <p v-if="isOverInvoiced" class="mt-1 flex items-center gap-1 text-[11px] text-warning">
        <AlertTriangle class="h-3 w-3 shrink-0" />
        Invoice terbit melebihi nilai quotation.
      </p>
    </template>
    <p v-else class="mt-2 text-xs text-muted-foreground">
      Nilai quotation belum ditentukan.
    </p>

    <p class="mt-2 truncate border-t border-border pt-2 text-xs text-muted-foreground">
      <template v-if="nextPayment">
        Next Payment: <span class="font-medium text-foreground">{{ nextPayment.invoiceLabel }}</span>
        <span class="font-semibold text-foreground"> {{ formatCurrencyIdr(nextPayment.amountIdr) }}</span>
        · jatuh tempo {{ formatDate(nextPayment.dueAt) }}
      </template>
      <template v-else-if="hasAnyInvoice">
        Semua invoice sudah lunas — tidak ada pembayaran mendatang.
      </template>
      <template v-else>
        Belum ada invoice yang diterbitkan untuk project ini.
      </template>
    </p>
  </SectionCard>
</template>
