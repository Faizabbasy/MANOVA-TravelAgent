<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import { formatNumber } from '~/utils/format'
import { buildSparkline } from '~/utils/sparkline'
import { useCountUp } from '~/composables/useCountUp'

/**
 * Signature element Dashboard — satu kartu hero besar (Pemasukan Bersih, gradien primary solid + sparkline)
 * diikuti grid 2x2 kartu ringkas (Profit/Pengeluaran/Piutang/Hutang). Layout diambil dari referensi visual
 * eksternal yang diminta user (hero + grid ringkas), palet warna TETAP dari token aplikasi
 * (--primary/--success/--destructive, plus amber/violet yang sudah dipakai `DashboardCashFlowSection`) —
 * bukan warna baru.
 */
export interface HeroMetric {
  key: string
  label: string
  valueIdr: number
  icon: Component
  /** Nilai historis kronologis (periode lama → baru), dipakai untuk sparkline. Elemen terakhir = valueIdr. */
  series: number[]
  trend?: { direction: 'up' | 'down'; percentLabel: string }
}

export interface HeroSecondaryMetric {
  key: string
  label: string
  valueIdr: number
  icon: Component
  trend?: { direction: 'up' | 'down'; percentLabel: string }
  accent: 'emerald' | 'rose' | 'amber' | 'violet'
}

const props = defineProps<{
  primary: HeroMetric
  metrics: HeroSecondaryMetric[]
  periodLabel?: string
}>()

/** Toggle "sensitive value" — angka pemasukan disembunyikan di balik bullet, pola sama aplikasi finance
 * mobile umumnya (mis. saat layar dilihat orang lain). Murni tampilan, tidak menyimpan preferensi. */
const isHidden = ref(false)

const ACCENT_BG: Record<HeroSecondaryMetric['accent'], string> = {
  emerald: 'bg-success/10',
  rose: 'bg-destructive/10',
  amber: 'bg-amber-500/10',
  violet: 'bg-violet-500/10'
}

const ACCENT_ICON: Record<HeroSecondaryMetric['accent'], string> = {
  emerald: 'bg-success/15 text-success',
  rose: 'bg-destructive/15 text-destructive',
  amber: 'bg-amber-500/15 text-amber-600',
  violet: 'bg-violet-500/15 text-violet-600'
}

const ACCENT_CHIP: Record<HeroSecondaryMetric['accent'], string> = {
  emerald: 'bg-success/15 text-success',
  rose: 'bg-destructive/15 text-destructive',
  amber: 'bg-amber-500/15 text-amber-600',
  violet: 'bg-violet-500/15 text-violet-600'
}

const primaryDisplay = useCountUp(props.primary.valueIdr)
const secondaryDisplay = props.metrics.map((metric, index) => useCountUp(metric.valueIdr, 150 + index * 90))
const sparkline = computed(() => buildSparkline(props.primary.series))
</script>

<template>
  <div>
    <div v-if="periodLabel" class="mb-3 flex items-center gap-2 px-0.5">
      <span class="relative flex h-1.5 w-1.5">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
        <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
      </span>
      <span class="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Ringkasan Keuangan — {{ periodLabel }}
      </span>
    </div>

    <div
      class="hero-metric relative overflow-hidden rounded-2xl p-5 text-primary-foreground shadow-lg shadow-primary/25 sm:p-6"
      style="background-image: linear-gradient(135deg, hsl(241 98% 64%), hsl(248 92% 44%));"
    >
      <div class="relative flex items-start justify-between gap-4">
        <div class="min-w-0">
          <button
            type="button"
            class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground/80"
            :aria-label="isHidden ? 'Tampilkan nominal' : 'Sembunyikan nominal'"
            @click="isHidden = !isHidden"
          >
            {{ primary.label }}
            <component :is="isHidden ? EyeOff : Eye" class="h-3.5 w-3.5 opacity-80" />
          </button>
          <p class="mt-2 flex items-baseline gap-1.5 tabular-nums">
            <span class="text-lg font-medium text-primary-foreground/80">Rp</span>
            <span class="text-3xl font-bold leading-none sm:text-4xl">{{ isHidden ? '••••••••' : formatNumber(primaryDisplay.value) }}</span>
          </p>
          <div v-if="primary.trend" class="mt-3 flex flex-wrap items-center gap-2">
            <span class="inline-flex w-fit items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
              <svg v-if="primary.trend.direction === 'up'" viewBox="0 0 12 12" class="h-2.5 w-2.5 fill-current" aria-hidden="true"><path d="M6 2 L11 9 L1 9 Z" /></svg>
              <svg v-else viewBox="0 0 12 12" class="h-2.5 w-2.5 fill-current" aria-hidden="true"><path d="M6 10 L1 3 L11 3 Z" /></svg>
              {{ primary.trend.percentLabel }}
            </span>
            <span class="text-xs text-primary-foreground/70">dari periode sebelumnya</span>
          </div>
        </div>

        <svg v-if="sparkline" viewBox="0 0 100 32" preserveAspectRatio="none" class="spark h-12 w-20 shrink-0 sm:h-16 sm:w-36" aria-hidden="true">
          <defs>
            <linearGradient id="hero-spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="white" stop-opacity="0.35" />
              <stop offset="100%" stop-color="white" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path :d="sparkline.area" fill="url(#hero-spark-fill)" stroke="none" />
          <path :d="sparkline.line" fill="none" stroke="white" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" class="spark-line" />
          <circle :cx="sparkline.last.x" :cy="sparkline.last.y" r="2.4" fill="white" />
        </svg>
      </div>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-3">
      <div
        v-for="(metric, index) in metrics"
        :key="metric.key"
        class="secondary-metric rounded-2xl p-4"
        :class="ACCENT_BG[metric.accent]"
        :style="{ animationDelay: `${index * 90}ms` }"
      >
        <div class="flex items-center gap-2">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" :class="ACCENT_ICON[metric.accent]">
            <component :is="metric.icon" class="h-4 w-4" />
          </span>
          <span class="min-w-0 truncate text-xs font-medium text-muted-foreground">{{ metric.label }}</span>
        </div>
        <p class="mt-2 flex items-baseline gap-1 tabular-nums text-foreground">
          <span class="text-[13px] font-medium text-muted-foreground">Rp</span>
          <span class="text-base font-bold leading-none sm:text-lg">{{ formatNumber(secondaryDisplay[index].value) }}</span>
        </p>
        <span v-if="metric.trend" class="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold" :class="ACCENT_CHIP[metric.accent]">
          <svg v-if="metric.trend.direction === 'up'" viewBox="0 0 12 12" class="h-2 w-2 fill-current" aria-hidden="true"><path d="M6 2 L11 9 L1 9 Z" /></svg>
          <svg v-else viewBox="0 0 12 12" class="h-2 w-2 fill-current" aria-hidden="true"><path d="M6 10 L1 3 L11 3 Z" /></svg>
          {{ metric.trend.percentLabel }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero-metric {
  animation: hero-metric-in 0.5s ease-out backwards;
}

.secondary-metric {
  animation: hero-metric-in 0.5s ease-out backwards;
}

@keyframes hero-metric-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.spark-line {
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  animation: spark-draw 1.1s 0.4s ease-out forwards;
}

@keyframes spark-draw {
  to { stroke-dashoffset: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-metric, .secondary-metric { animation: none; }
  .spark-line { animation: none; stroke-dashoffset: 0; }
}
</style>
