<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertTriangle, CircleCheck, ClipboardList, FileClock, FileText, Info, Wallet } from 'lucide-vue-next'
import { formatMoneyMinor } from '~/lib/money'
import { formatBusinessDate } from '~/lib/finance/dates'
import type { HeroNextPayment, ProjectHeroFigures } from '~/lib/finance/project-hero'
import type { BadgeTone } from '~/types/common'

/**
 * Ringkasan komersial tab Overview Project Order (desain V2): panel kontrak vs ditagih + ring progres,
 * composition bar, 3 kolom Terbayar/Outstanding/Belum Ditagih, lalu banner pembayaran berikutnya.
 * Semua angka datang dari ringkasan project di server (`heroFigures`). Admin hanya melihat label status
 * pembayaran — tanpa nominal — sesuai aturan server.
 */
const props = defineProps<{ figures: ProjectHeroFigures }>()

const NEXT_PAYMENT_TONE: Record<HeroNextPayment['tone'], { badge: BadgeTone, label: string, banner: string, text: string }> = {
  overdue: { badge: 'destructive', label: 'Terlambat', banner: 'bg-destructive/10', text: 'text-destructive' },
  'due-soon': { badge: 'warning', label: 'Segera Jatuh Tempo', banner: 'bg-warning/10', text: 'text-warning' },
  scheduled: { badge: 'primary', label: 'Terjadwal', banner: 'bg-primary/10', text: 'text-primary' }
}

const full = computed(() => (props.figures.kind === 'full' ? props.figures : null))
const nextPayment = computed(() => full.value?.nextPayment ?? null)

/** Ring "Ditagih" — circumference lingkaran r=30, stroke di-offset dari persentase invoice/kontrak. */
const RING_RADIUS = 30
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const ringOffset = computed(() => {
  const percent = Math.min(100, Math.max(0, full.value?.percent.invoiced ?? 0))
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

    <p v-if="figures.kind === 'unavailable'" class="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground" role="status">
      <Info class="h-4 w-4 shrink-0" /> Data keuangan belum tersedia.
    </p>

    <div v-else-if="figures.kind === 'status'" class="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs" :class="figures.hasOverdue ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'">
      <component :is="figures.hasOverdue ? AlertTriangle : CircleCheck" class="h-4 w-4 shrink-0" />
      <span>Status pembayaran: <span class="font-semibold">{{ figures.paymentLabel }}</span>. Nominal dikelola tim Finance.</span>
    </div>

    <template v-else-if="full">
      <div class="rounded-xl border border-border">
        <template v-if="full.contractMinor !== null">
          <div class="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            <div class="min-w-0">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Nilai Kontrak (Project)
              </p>
              <p class="mt-1.5 text-xl font-bold leading-none tabular-nums text-foreground [overflow-wrap:anywhere]">
                {{ formatMoneyMinor(full.contractMinor) }}
              </p>
            </div>

            <div class="flex items-center justify-between gap-3 border-t border-border pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
              <div class="min-w-0">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Ditagih ({{ full.percent.invoiced }}%)
                </p>
                <p class="mt-1.5 text-lg font-bold leading-none tabular-nums text-success [overflow-wrap:anywhere]">
                  {{ formatMoneyMinor(full.invoicedMinor) }}
                </p>
              </div>
              <div class="relative flex h-16 w-16 shrink-0 items-center justify-center">
                <svg viewBox="0 0 72 72" class="h-16 w-16 -rotate-90" aria-hidden="true">
                  <circle
                    cx="36"
                    cy="36"
                    r="30"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="6"
                    class="text-muted"
                  />
                  <circle
                    cx="36"
                    cy="36"
                    r="30"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="6"
                    stroke-linecap="round"
                    class="text-success transition-[stroke-dashoffset] duration-700 ease-out"
                    :stroke-dasharray="RING_CIRCUMFERENCE"
                    :stroke-dashoffset="barRevealed ? ringOffset : RING_CIRCUMFERENCE"
                  />
                </svg>
                <span class="absolute text-xs font-bold tabular-nums text-foreground">{{ full.percent.invoiced }}%</span>
              </div>
            </div>
          </div>

          <div class="px-4">
            <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div class="flex h-full w-full">
                <div class="h-full bg-success transition-[width] duration-700 ease-out" :style="{ width: `${barRevealed ? full.percent.paid : 0}%` }" />
                <div class="h-full bg-warning transition-[width] duration-700 ease-out" :style="{ width: `${barRevealed ? full.percent.outstanding : 0}%` }" />
                <div class="h-full bg-muted-foreground/20 transition-[width] duration-700 ease-out" :style="{ width: `${barRevealed ? full.percent.remainder : 0}%` }" />
              </div>
            </div>
          </div>

          <p v-if="full.overInvoiced" class="flex items-center gap-1 px-4 pt-3 text-[11px] text-warning">
            <AlertTriangle class="h-3 w-3 shrink-0" />
            Invoice terbit melebihi nilai kontrak.
          </p>

          <div class="mt-3 grid grid-cols-1 divide-y divide-border border-t border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div class="p-3">
              <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />Terbayar
              </span>
              <div class="mt-2 flex items-center justify-between gap-2">
                <p class="text-base font-bold tabular-nums text-foreground [overflow-wrap:anywhere]">
                  {{ formatMoneyMinor(full.receivedMinor) }}
                </p>
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                  <Wallet class="h-3.5 w-3.5" />
                </span>
              </div>
              <span class="mt-2 inline-flex items-center gap-1 rounded-lg bg-success/10 px-2 py-1 text-[11px] text-foreground">
                <span class="font-semibold text-success">{{ full.percent.paid }}%</span> dari nilai kontrak
              </span>
            </div>

            <div class="p-3">
              <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />Outstanding
              </span>
              <div class="mt-2 flex items-center justify-between gap-2">
                <p class="text-base font-bold tabular-nums text-foreground [overflow-wrap:anywhere]">
                  {{ formatMoneyMinor(full.outstandingMinor) }}
                </p>
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                  <FileClock class="h-3.5 w-3.5" />
                </span>
              </div>
              <span class="mt-2 inline-flex items-center gap-1 rounded-lg bg-warning/10 px-2 py-1 text-[11px] text-foreground">
                <span class="font-semibold text-warning">{{ full.percent.outstanding }}%</span> dari nilai kontrak
              </span>
            </div>

            <div class="p-3">
              <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />Belum Ditagih
              </span>
              <div class="mt-2 flex items-center justify-between gap-2">
                <p class="text-base font-bold tabular-nums text-foreground [overflow-wrap:anywhere]">
                  {{ full.uninvoicedMinor === null ? '—' : formatMoneyMinor(full.uninvoicedMinor) }}
                </p>
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <FileText class="h-3.5 w-3.5" />
                </span>
              </div>
              <span class="mt-2 inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] text-foreground">
                <span class="font-semibold text-muted-foreground">{{ full.percent.remainder }}%</span> dari nilai kontrak
              </span>
            </div>
          </div>
        </template>
        <p v-else class="p-4 text-xs text-muted-foreground">
          Nilai kontrak belum ditentukan.
        </p>
      </div>

      <div
        class="mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
        :class="nextPayment ? NEXT_PAYMENT_TONE[nextPayment.tone].banner : (full.hasAnyInvoice ? 'bg-success/10' : 'bg-muted')"
      >
        <CircleCheck v-if="!nextPayment" class="h-4 w-4 shrink-0" :class="full.hasAnyInvoice ? 'text-success' : 'text-muted-foreground'" />
        <AlertTriangle v-else class="h-4 w-4 shrink-0" :class="NEXT_PAYMENT_TONE[nextPayment.tone].text" />
        <p class="min-w-0 truncate" :class="nextPayment ? NEXT_PAYMENT_TONE[nextPayment.tone].text : 'text-muted-foreground'">
          <template v-if="nextPayment">
            Next Payment: <span class="font-medium">{{ nextPayment.invoiceLabel }}</span>
            <span class="font-semibold"> {{ formatMoneyMinor(nextPayment.amountMinor) }}</span>
            · jatuh tempo {{ formatBusinessDate(nextPayment.dueDate) }}
          </template>
          <template v-else-if="full.hasAnyInvoice">
            Tidak ada tagihan terbuka — semua invoice sudah lunas.
          </template>
          <template v-else>
            Belum ada invoice yang diterbitkan untuk project ini.
          </template>
        </p>
      </div>
    </template>
  </SectionCard>
</template>
