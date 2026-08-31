<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertTriangle, CircleCheck, ClipboardList, FileClock, FileText, Wallet } from 'lucide-vue-next'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { BadgeTone } from '~/types/common'

/**
 * Ringkasan komersial tab Overview Project Order — redesign (permintaan client) supaya terasa jadi "hero"
 * ringkasan komersial sendiri: panel kontrak vs ditagih + ring progres di kanan, composition bar tebal,
 * lalu 3 kolom Terbayar/Outstanding/Belum Ditagih dengan ikon + pill persentase, ditutup banner status
 * pembayaran berwarna. Tetap pakai token warna & font tema yang sama (success/warning/muted), tidak ada
 * palet baru. Murni presentational — seluruh derivasi angka (invoice issued/next payment) sudah dihitung
 * di halaman induk.
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

const NEXT_PAYMENT_TONE: Record<CommercialNextPayment['tone'], { badge: BadgeTone, label: string, banner: string, text: string }> = {
  overdue: { badge: 'destructive', label: 'Terlambat', banner: 'bg-destructive/10', text: 'text-destructive' },
  'due-soon': { badge: 'warning', label: 'Segera Jatuh Tempo', banner: 'bg-warning/10', text: 'text-warning' },
  scheduled: { badge: 'primary', label: 'Terjadwal', banner: 'bg-primary/10', text: 'text-primary' }
}

const invoicedPercentOfQuotation = computed(() => props.quotationAmountIdr > 0 ? Math.round((props.invoiceIssuedIdr / props.quotationAmountIdr) * 100) : 0)
const isOverInvoiced = computed(() => props.quotationAmountIdr > 0 && props.invoiceIssuedIdr > props.quotationAmountIdr)

/** Lebar segmen composition bar & pill %, dihitung dari quotation (bukan dari invoiceIssued) supaya selalu merepresentasikan "porsi dari total kontrak". Diclamp bertahap supaya total gabungan tidak pernah melebihi 100%. */
const barSegments = computed(() => {
  const quotation = props.quotationAmountIdr
  if (quotation <= 0) { return { paidPercent: 0, outstandingPercent: 0, remainderPercent: 0 } }
  const paidPercent = Math.min(100, (props.paidIdr / quotation) * 100)
  const outstandingPercent = Math.min(100 - paidPercent, (props.outstandingIdr / quotation) * 100)
  const remainderPercent = Math.max(0, 100 - paidPercent - outstandingPercent)
  return { paidPercent, outstandingPercent, remainderPercent }
})
const remainderIdr = computed(() => Math.max(props.quotationAmountIdr - props.invoiceIssuedIdr, 0))

/** Ring "Ditagih" — circumference lingkaran r=30 (2*PI*30 ≈ 188.5), stroke di-offset dari persentase invoice/quotation. */
const RING_RADIUS = 30
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const ringOffset = computed(() => {
  const percent = Math.min(100, Math.max(0, invoicedPercentOfQuotation.value))
  return RING_CIRCUMFERENCE * (1 - percent / 100)
})

const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const barRevealed = ref(prefersReducedMotion)
onMounted(() => {
  if (prefersReducedMotion) { return }
  requestAnimationFrame(() => { barRevealed.value = true })
})
</script>

<template>
  <SectionCard compact content-class="p-4">
    <template #header>
      <div class="flex items-start gap-3">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-success/10 text-success">
          <ClipboardList class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <CardTitle class="text-sm font-bold uppercase tracking-wide text-foreground">
            Ringkasan Komersial
          </CardTitle>
          <CardDescription class="mt-0.5 text-xs">
            Nilai kontrak, invoice, dan pembayaran project ini.
          </CardDescription>
        </div>
      </div>
    </template>
    <template v-if="nextPayment" #actions>
      <StatusBadge :label="NEXT_PAYMENT_TONE[nextPayment.tone].label" :tone="NEXT_PAYMENT_TONE[nextPayment.tone].badge" />
    </template>

    <div class="rounded-xl border border-border">
      <template v-if="quotationAmountIdr > 0">
        <div class="grid grid-cols-2 gap-3 p-4">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Nilai Kontrak (Project)
            </p>
            <p class="mt-1.5 truncate text-xl font-bold leading-none tabular-nums text-foreground">
              {{ formatCurrencyIdr(quotationAmountIdr) }}
            </p>
          </div>

          <div class="flex items-center justify-between gap-3 border-l border-border pl-3">
            <div class="min-w-0">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Ditagih ({{ invoicedPercentOfQuotation }}%)
              </p>
              <p class="mt-1.5 truncate text-lg font-bold leading-none tabular-nums text-success">
                {{ formatCurrencyIdr(invoiceIssuedIdr) }}
              </p>
            </div>
            <div class="relative flex h-16 w-16 shrink-0 items-center justify-center">
              <svg viewBox="0 0 72 72" class="h-16 w-16 -rotate-90">
                <circle cx="36" cy="36" r="30" fill="none" stroke="currentColor" stroke-width="6" class="text-muted" />
                <circle
                  cx="36" cy="36" r="30" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"
                  class="text-success transition-[stroke-dashoffset] duration-700 ease-out"
                  :stroke-dasharray="RING_CIRCUMFERENCE"
                  :stroke-dashoffset="barRevealed ? ringOffset : RING_CIRCUMFERENCE"
                />
              </svg>
              <span class="absolute text-xs font-bold tabular-nums text-foreground">{{ invoicedPercentOfQuotation }}%</span>
            </div>
          </div>
        </div>

        <div class="px-4">
          <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div class="flex h-full w-full">
              <div class="h-full bg-success transition-[width] duration-700 ease-out" :style="{ width: `${barRevealed ? barSegments.paidPercent : 0}%` }" />
              <div class="h-full bg-warning transition-[width] duration-700 ease-out" :style="{ width: `${barRevealed ? barSegments.outstandingPercent : 0}%` }" />
              <div class="h-full bg-muted-foreground/20 transition-[width] duration-700 ease-out" :style="{ width: `${barRevealed ? barSegments.remainderPercent : 0}%` }" />
            </div>
          </div>
        </div>

        <p v-if="isOverInvoiced" class="flex items-center gap-1 px-4 pt-3 text-[11px] text-warning">
          <AlertTriangle class="h-3 w-3 shrink-0" />
          Invoice terbit melebihi nilai quotation.
        </p>

        <div class="mt-3 grid grid-cols-3 divide-x divide-border border-t border-border">
          <div class="p-3">
            <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />Terbayar
            </span>
            <div class="mt-2 flex items-center justify-between gap-2">
              <p class="truncate text-base font-bold tabular-nums text-foreground">
                {{ formatCurrencyIdr(paidIdr) }}
              </p>
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                <Wallet class="h-3.5 w-3.5" />
              </span>
            </div>
            <span class="mt-2 inline-flex items-center gap-1 rounded-lg bg-success/10 px-2 py-1 text-[11px] text-foreground">
              <span class="font-semibold text-success">{{ Math.round(barSegments.paidPercent) }}%</span> dari nilai kontrak
            </span>
          </div>

          <div class="p-3">
            <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />Outstanding
            </span>
            <div class="mt-2 flex items-center justify-between gap-2">
              <p class="truncate text-base font-bold tabular-nums text-foreground">
                {{ formatCurrencyIdr(outstandingIdr) }}
              </p>
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <FileClock class="h-3.5 w-3.5" />
              </span>
            </div>
            <span class="mt-2 inline-flex items-center gap-1 rounded-lg bg-warning/10 px-2 py-1 text-[11px] text-foreground">
              <span class="font-semibold text-warning">{{ Math.round(barSegments.outstandingPercent) }}%</span> dari nilai kontrak
            </span>
          </div>

          <div class="p-3">
            <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />Belum Ditagih
            </span>
            <div class="mt-2 flex items-center justify-between gap-2">
              <p class="truncate text-base font-bold tabular-nums text-foreground">
                {{ formatCurrencyIdr(remainderIdr) }}
              </p>
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileText class="h-3.5 w-3.5" />
              </span>
            </div>
            <span class="mt-2 inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] text-foreground">
              <span class="font-semibold text-muted-foreground">{{ Math.round(barSegments.remainderPercent) }}%</span> dari nilai kontrak
            </span>
          </div>
        </div>
      </template>
      <p v-else class="p-4 text-xs text-muted-foreground">
        Nilai quotation belum ditentukan.
      </p>
    </div>

    <div
      class="mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
      :class="nextPayment ? NEXT_PAYMENT_TONE[nextPayment.tone].banner : (hasAnyInvoice ? 'bg-success/10' : 'bg-muted')"
    >
      <CircleCheck
        v-if="!nextPayment"
        class="h-4 w-4 shrink-0"
        :class="hasAnyInvoice ? 'text-success' : 'text-muted-foreground'"
      />
      <AlertTriangle v-else class="h-4 w-4 shrink-0" :class="NEXT_PAYMENT_TONE[nextPayment.tone].text" />
      <p class="min-w-0 truncate" :class="nextPayment ? NEXT_PAYMENT_TONE[nextPayment.tone].text : 'text-muted-foreground'">
        <template v-if="nextPayment">
          Next Payment: <span class="font-medium">{{ nextPayment.invoiceLabel }}</span>
          <span class="font-semibold"> {{ formatCurrencyIdr(nextPayment.amountIdr) }}</span>
          · jatuh tempo {{ formatDate(nextPayment.dueAt) }}
        </template>
        <template v-else-if="hasAnyInvoice">
          Semua invoice sudah lunas — tidak ada pembayaran mendatang.
        </template>
        <template v-else>
          Belum ada invoice yang diterbitkan untuk project ini.
        </template>
      </p>
    </div>
  </SectionCard>
</template>
