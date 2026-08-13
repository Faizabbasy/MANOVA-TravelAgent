<script setup lang="ts">
import { computed, type Component } from 'vue'
import { formatNumber } from '~/utils/format'
import { buildSparkline } from '~/utils/sparkline'
import { useCountUp } from '~/composables/useCountUp'

/**
 * Signature element Dashboard — dua kartu untuk Pemasukan Bersih & Profit (dua angka paling penting di
 * halaman ini, sengaja dipisah dari grid KPI biasa dengan gap sendiri supaya tetap paling dominan/pinned).
 *
 * Latar gradasi lembut per-warna (biru untuk Pemasukan Bersih, hijau untuk Profit) — bukan solid-block
 * penuh (generik) atau putih polos (kurang "wow"), melainkan sapuan gradien halus + badge ikon kecil di
 * pojok, senada palet aplikasi (`--primary`/`--success`/`--destructive`). Angka tabular (font aplikasi
 * biasa), sparkline dari data historis ASLI di tiap metrik.
 */
export interface HeroMetric {
  key: string
  label: string
  valueIdr: number
  icon: Component
  /** Nilai historis kronologis (periode lama → baru), dipakai untuk sparkline. Elemen terakhir = valueIdr. */
  series: number[]
  trend?: { direction: 'up' | 'down'; percentLabel: string }
  accent: 'blue' | 'emerald' | 'rose'
}

const props = defineProps<{
  metrics: HeroMetric[]
  periodLabel?: string
}>()

const ACCENT_BG: Record<HeroMetric['accent'], string> = {
  blue: 'bg-gradient-to-br from-primary/[0.16] via-primary/[0.05] to-transparent',
  emerald: 'bg-gradient-to-br from-success/[0.16] via-success/[0.05] to-transparent',
  rose: 'bg-gradient-to-br from-destructive/[0.16] via-destructive/[0.05] to-transparent'
}

const ACCENT_BORDER: Record<HeroMetric['accent'], string> = {
  blue: 'border-primary/[0.14]',
  emerald: 'border-success/[0.14]',
  rose: 'border-destructive/[0.14]'
}

const ACCENT_SHADOW: Record<HeroMetric['accent'], string> = {
  blue: 'hover:shadow-[0_16px_36px_-16px_hsl(var(--primary)/0.4)]',
  emerald: 'hover:shadow-[0_16px_36px_-16px_hsl(var(--success)/0.4)]',
  rose: 'hover:shadow-[0_16px_36px_-16px_hsl(var(--destructive)/0.4)]'
}

const ACCENT_BADGE: Record<HeroMetric['accent'], string> = {
  blue: 'bg-primary text-primary-foreground',
  emerald: 'bg-success text-success-foreground',
  rose: 'bg-destructive text-destructive-foreground'
}

const ACCENT_STROKE: Record<HeroMetric['accent'], string> = {
  blue: 'hsl(var(--primary))',
  emerald: 'hsl(var(--success))',
  rose: 'hsl(var(--destructive))'
}

const ACCENT_CHIP: Record<HeroMetric['accent'], string> = {
  blue: 'bg-primary/10 text-primary',
  emerald: 'bg-success/10 text-success',
  rose: 'bg-destructive/10 text-destructive'
}

const displayValues = props.metrics.map((metric, index) => useCountUp(metric.valueIdr, index * 200))
const sparklines = computed(() => props.metrics.map(metric => buildSparkline(metric.series)))
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

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div
        v-for="(metric, index) in metrics"
        :key="metric.key"
        class="hero-metric group relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 sm:p-6"
        :class="[ACCENT_BG[metric.accent], ACCENT_BORDER[metric.accent], ACCENT_SHADOW[metric.accent]]"
        :style="{ animationDelay: `${index * 120}ms` }"
      >
        <div class="relative flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {{ metric.label }}
            </p>
            <p class="mt-2 flex items-baseline gap-1.5 tabular-nums text-foreground">
              <span class="text-base font-medium text-muted-foreground sm:text-lg">Rp</span>
              <span class="text-3xl font-semibold leading-none sm:text-4xl">{{ formatNumber(displayValues[index].value) }}</span>
            </p>
          </div>
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm" :class="ACCENT_BADGE[metric.accent]">
            <component :is="metric.icon" class="h-4 w-4" />
          </div>
        </div>

        <div class="relative mt-4 flex items-end justify-between gap-4">
          <div v-if="metric.trend" class="flex flex-col gap-1">
            <span
              class="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
              :class="ACCENT_CHIP[metric.accent]"
              :aria-label="`${metric.trend.direction === 'up' ? 'Naik' : 'Turun'} ${metric.trend.percentLabel} dari periode sebelumnya`"
            >
              <svg v-if="metric.trend.direction === 'up'" viewBox="0 0 12 12" class="h-2.5 w-2.5 fill-current" aria-hidden="true"><path d="M6 2 L11 9 L1 9 Z" /></svg>
              <svg v-else viewBox="0 0 12 12" class="h-2.5 w-2.5 fill-current" aria-hidden="true"><path d="M6 10 L1 3 L11 3 Z" /></svg>
              {{ metric.trend.percentLabel }}
            </span>
            <span class="text-[11px] text-muted-foreground">dari periode sebelumnya</span>
          </div>

          <svg
            v-if="sparklines[index]"
            viewBox="0 0 100 32"
            preserveAspectRatio="none"
            class="spark h-8 w-24 shrink-0 sm:w-28"
            aria-hidden="true"
          >
            <defs>
              <linearGradient :id="`spark-fill-${metric.key}`" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="ACCENT_STROKE[metric.accent]" stop-opacity="0.3" />
                <stop offset="100%" :stop-color="ACCENT_STROKE[metric.accent]" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path :d="sparklines[index]?.area" :fill="`url(#spark-fill-${metric.key})`" stroke="none" />
            <path
              :d="sparklines[index]?.line"
              fill="none"
              :stroke="ACCENT_STROKE[metric.accent]"
              stroke-width="2"
              vector-effect="non-scaling-stroke"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="spark-line"
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
  </div>
</template>

<style scoped>
.hero-metric {
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
  .hero-metric { animation: none; }
  .spark-line { animation: none; stroke-dashoffset: 0; }
}
</style>
