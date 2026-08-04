<script setup lang="ts">
import { cn } from '~/lib/utils'
import type { BadgeTone } from '~/types/common'

const props = withDefaults(defineProps<{
  label: string
  tone?: BadgeTone
  /** `dot` menambah titik warna kecil — membantu membedakan status saat beberapa badge berdempetan. */
  dot?: boolean
}>(), { dot: false })

/**
 * Refinement UI: sebelumnya memakai `Badge variant="secondary"` dengan `font-semibold` dan tanpa border,
 * sehingga di dalam tabel padat ia terbaca seperti tombol yang bisa diklik. Kini bobot medium + border
 * tipis senada warnanya — terbaca sebagai label status, dan `whitespace-nowrap` mencegah label dua kata
 * seperti "Belum Mulai" terpotong menjadi dua baris di kolom sempit.
 */
const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground border-border',
  primary: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/25',
  destructive: 'bg-destructive/10 text-destructive border-destructive/20',
  info: 'bg-chart-5/10 text-chart-5 border-chart-5/20',
  purple: 'bg-chart-4/10 text-chart-4 border-chart-4/20'
}

const dotClasses: Record<BadgeTone, string> = {
  neutral: 'bg-muted-foreground',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  info: 'bg-chart-5',
  purple: 'bg-chart-4'
}
</script>

<template>
  <span
    :class="cn(
      'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium leading-5',
      toneClasses[props.tone ?? 'neutral']
    )"
  >
    <span v-if="props.dot" :class="cn('h-1.5 w-1.5 rounded-full', dotClasses[props.tone ?? 'neutral'])" />
    {{ label }}
  </span>
</template>
