<script setup lang="ts">
import { computed, useId } from 'vue'
import { TrendingUp, TrendingDown } from 'lucide-vue-next'
import type { Component } from 'vue'
import { cn } from '~/lib/utils'
import { buildSparkline, buildDecorativeSeries } from '~/utils/sparkline'

interface Props {
  title: string
  value: string
  change?: {
    value: string
    trend: 'up' | 'down'
  }
  icon: Component
  iconColor?: 'primary' | 'success' | 'warning' | 'destructive'
  subtitle?: string
  size?: 'default' | 'lg'
  /** Progres opsional (0-100) — dipakai untuk pill persen (kanan atas, header berpindah ke layout
   * icon+title) dan warna panah kecil di samping value, untuk metrik "terkumpul dari target" (mis.
   * pendapatan terkumpul vs nilai quotation). Dihilangkan (bukan default 0) supaya card tanpa progres
   * tidak menampilkan indikator kosong. */
  progressPercent?: number
  /** Bar progres tambahan opsional di paling bawah card (mis. "75% dari budget digunakan") — beda dari
   * `progressPercent` (yang jadi pill+panah di header): dipakai saat satu card butuh dua angka progres
   * berbeda maknanya sekaligus (pill = tren, bar bawah = pemakaian budget). */
  footerProgress?: { label: string; percent: number }
}

const props = withDefaults(defineProps<Props>(), {
  iconColor: 'primary',
  size: 'default'
})

/**
 * Refinement UI: bar aksen 4px, blur blob, translate, dan rotasi ikon saat hover dihapus. Empat KPI tile
 * bersebelahan yang semuanya bergaris warna membuat tidak ada satu pun yang menonjol — warna kini hanya
 * pada chip ikon, yang memang membawa arti (hijau = sehat, merah = perlu tindakan).
 *
 * Judul & sparkline (baru) IKUT dicat warna tone-nya, bukan cuma chip ikon — satu card jadi terasa satu
 * kesatuan visual per-metrik (pola sama `DashboardHeroPanel`), bukan judul abu-abu generik di semua card.
 */
const iconColorClasses = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive'
}

const TONE_TEXT: Record<string, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive'
}

const TONE_STROKE: Record<string, string> = {
  primary: 'hsl(var(--primary))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  destructive: 'hsl(var(--destructive))'
}

const spark = computed(() => (
  props.progressPercent !== undefined
    ? buildSparkline(buildDecorativeSeries(props.title, props.iconColor === 'destructive' ? 'down' : 'up'))
    : null
))
/** ID unik per instance (bukan derivasi dari `title`) — `title` sering mengandung spasi ("Actual Cost"),
 * yang membuat `url(#spark-fill-Actual Cost)` terpotong di karakter spasi dan gagal menemukan gradasinya,
 * sehingga area di bawah garis jatuh ke fill hitam bawaan SVG. */
const sparkGradientId = `spark-fill-${useId()}`
</script>

<template>
  <div
    :class="cn(
      'group relative overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_0_hsl(224_71%_4%/0.04)] transition-colors duration-150 hover:border-border/80 hover:bg-muted/20',
      props.size === 'lg' ? 'p-5' : 'p-4'
    )"
  >
    <div v-if="progressPercent !== undefined" class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <div :class="cn('shrink-0 rounded-lg p-2', iconColorClasses[iconColor])">
          <component :is="icon" class="h-4 w-4" />
        </div>
        <p class="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {{ title }}
        </p>
      </div>
      <span :class="cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', iconColorClasses[iconColor])">
        {{ Math.round(progressPercent) }}%
        <component :is="iconColor === 'destructive' ? TrendingDown : TrendingUp" class="h-3 w-3" />
      </span>
    </div>
    <div v-else class="flex items-start justify-between gap-3">
      <p class="min-w-0 flex-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {{ title }}
      </p>
      <div :class="cn('shrink-0 rounded-lg p-2.5', iconColorClasses[iconColor])">
        <component :is="icon" class="h-4 w-4" />
      </div>
    </div>

    <div class="mt-2 flex items-center gap-1.5">
      <p :class="cn('font-semibold tracking-tight text-foreground break-words', props.size === 'lg' ? 'text-[1.75rem] leading-9' : 'text-2xl leading-8')">
        {{ value }}
      </p>
      <component
        v-if="progressPercent !== undefined"
        :is="iconColor === 'destructive' ? TrendingDown : TrendingUp"
        class="h-4 w-4 shrink-0"
        :class="TONE_TEXT[iconColor]"
      />
    </div>

    <div v-if="change" class="mt-1.5 flex items-center gap-1.5">
      <TrendingUp v-if="change.trend === 'up'" class="h-3.5 w-3.5 text-success" />
      <TrendingDown v-else class="h-3.5 w-3.5 text-destructive" />
      <span :class="cn('text-xs font-medium', change.trend === 'up' ? 'text-success' : 'text-destructive')">
        {{ change.value }}
      </span>
      <span class="text-xs text-muted-foreground">vs periode lalu</span>
    </div>
    <p v-if="subtitle" class="mt-1.5 text-xs text-muted-foreground">
      {{ subtitle }}
    </p>

    <svg v-if="spark" viewBox="0 0 100 32" preserveAspectRatio="none" class="spark mt-3 h-9 w-full" aria-hidden="true">
      <defs>
        <linearGradient :id="sparkGradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="TONE_STROKE[iconColor]" stop-opacity="0.28" />
          <stop offset="100%" :stop-color="TONE_STROKE[iconColor]" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path :d="spark.area" :fill="`url(#${sparkGradientId})`" stroke="none" />
      <path
        :d="spark.line"
        fill="none"
        :stroke="TONE_STROKE[iconColor]"
        stroke-width="2"
        vector-effect="non-scaling-stroke"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle :cx="spark.last.x" :cy="spark.last.y" r="2.2" :fill="TONE_STROKE[iconColor]" />
    </svg>

    <div v-if="footerProgress" class="mt-3 flex items-center gap-2">
      <span class="shrink-0 text-[11px] text-muted-foreground">{{ footerProgress.label }}</span>
      <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          class="h-full rounded-full transition-all"
          :class="iconColorClasses[iconColor].split(' ')[1].replace('text-', 'bg-')"
          :style="{ width: `${Math.min(100, Math.max(0, footerProgress.percent))}%` }"
        />
      </div>
    </div>
  </div>
</template>
