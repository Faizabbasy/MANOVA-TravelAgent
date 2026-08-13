<script setup lang="ts">
import { computed, type Component } from 'vue'
import { formatNumber } from '~/utils/format'
import { buildSparkline } from '~/utils/sparkline'
import { useCountUp } from '~/composables/useCountUp'

/**
 * Monthly Cash Flow — section baru (referensi eksplisit dari pengguna): chart Income/Expense bulanan lebar
 * di kiri, 4 kartu kecil bertumpuk di kanan (reuse Pemasukan Bersih & Profit yang sudah ada di
 * `DashboardHeroPanel` + 2 KPI lain yang sudah ada di halaman ini — bukan angka baru).
 *
 * Kartu tanpa `series` (Outstanding Invoices, Active Projects — tidak ada histori bulanan di data model)
 * sengaja tidak menampilkan sparkline palsu; hanya kartu dengan histori data ASLI (Pemasukan Bersih/Profit)
 * yang menggambar sparkline.
 */
export interface CashFlowSideMetric {
  key: string
  label: string
  value: number
  icon: Component
  accent: 'blue' | 'emerald' | 'rose' | 'amber' | 'violet'
  isCurrency?: boolean
  series?: number[]
}

const props = defineProps<{
  labels: string[]
  income: number[]
  expense: number[]
  sideMetrics: CashFlowSideMetric[]
}>()

const ACCENT_BG: Record<CashFlowSideMetric['accent'], string> = {
  blue: 'bg-gradient-to-br from-primary/[0.16] via-primary/[0.05] to-transparent',
  emerald: 'bg-gradient-to-br from-success/[0.16] via-success/[0.05] to-transparent',
  rose: 'bg-gradient-to-br from-destructive/[0.16] via-destructive/[0.05] to-transparent',
  amber: 'bg-gradient-to-br from-amber-500/[0.16] via-amber-500/[0.05] to-transparent',
  violet: 'bg-gradient-to-br from-violet-500/[0.16] via-violet-500/[0.05] to-transparent'
}

const ACCENT_BORDER: Record<CashFlowSideMetric['accent'], string> = {
  blue: 'border-primary/[0.14]',
  emerald: 'border-success/[0.14]',
  rose: 'border-destructive/[0.14]',
  amber: 'border-amber-500/[0.14]',
  violet: 'border-violet-500/[0.14]'
}

const ACCENT_BADGE: Record<CashFlowSideMetric['accent'], string> = {
  blue: 'bg-primary text-primary-foreground',
  emerald: 'bg-success text-success-foreground',
  rose: 'bg-destructive text-destructive-foreground',
  amber: 'bg-amber-500 text-white',
  violet: 'bg-violet-500 text-white'
}

const ACCENT_STROKE: Record<CashFlowSideMetric['accent'], string> = {
  blue: 'hsl(var(--primary))',
  emerald: 'hsl(var(--success))',
  rose: 'hsl(var(--destructive))',
  amber: '#f59e0b',
  violet: '#8b5cf6'
}

const displayValues = props.sideMetrics.map((metric, index) => useCountUp(metric.value, index * 90))
const sparklines = computed(() => props.sideMetrics.map(metric => (metric.series ? buildSparkline(metric.series) : null)))
</script>

<template>
  <div class="flex flex-col gap-4 lg:flex-row">
    <div class="min-w-0 flex-1 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 class="text-base font-semibold text-foreground">
          Monthly Cash Flow
        </h3>
        <div class="flex items-center gap-3 text-xs text-muted-foreground">
          <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-primary" />Income</span>
          <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-destructive" />Expense</span>
        </div>
      </div>
      <MonthlyCashFlowChart :labels="labels" :income="income" :expense="expense" />
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-72 lg:shrink-0 lg:grid-cols-1">
      <div
        v-for="(metric, index) in sideMetrics"
        :key="metric.key"
        class="cash-side-card group relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5"
        :class="[ACCENT_BG[metric.accent], ACCENT_BORDER[metric.accent]]"
        :style="{ animationDelay: `${index * 90}ms` }"
      >
        <div class="relative flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="flex items-baseline gap-1 tabular-nums text-foreground">
              <span v-if="metric.isCurrency" class="text-xs font-medium text-muted-foreground">Rp</span>
              <span class="text-lg font-semibold leading-none">{{ formatNumber(displayValues[index].value) }}</span>
            </p>
            <p class="mt-1 truncate text-xs text-muted-foreground">
              {{ metric.label }}
            </p>
          </div>
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm" :class="ACCENT_BADGE[metric.accent]">
            <component :is="metric.icon" class="h-3.5 w-3.5" />
          </div>
        </div>

        <svg
          v-if="sparklines[index]"
          viewBox="0 0 100 32"
          preserveAspectRatio="none"
          class="relative mt-2 h-6 w-full"
          aria-hidden="true"
        >
          <path
            :d="sparklines[index]?.line"
            fill="none"
            :stroke="ACCENT_STROKE[metric.accent]"
            stroke-width="2"
            vector-effect="non-scaling-stroke"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle
            :cx="sparklines[index]?.last.x"
            :cy="sparklines[index]?.last.y"
            r="2.2"
            :fill="ACCENT_STROKE[metric.accent]"
          />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cash-side-card {
  animation: cash-side-in 0.5s ease-out backwards;
}

@keyframes cash-side-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .cash-side-card { animation: none; }
}
</style>
