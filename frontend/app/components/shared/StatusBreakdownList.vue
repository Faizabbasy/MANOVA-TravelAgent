<script setup lang="ts">
import type { BadgeTone } from '~/types/common'

/**
 * Breakdown-by-status/stage generik (Section 06/Dashboard) — dipakai untuk Opportunity Pipeline,
 * Active Projects by Status, dan Service Readiness. Diekstrak sebagai shared component karena pola
 * "kelompokkan berdasarkan status, tampilkan count + proporsi" berulang di 3+ widget dan kemungkinan
 * dipakai lagi di Section 16 (Reports — Sales Pipeline).
 */
export interface StatusBreakdownItem {
  key: string
  label: string
  tone: BadgeTone
  count: number
  /** Label sekunder opsional, mis. total nilai Rupiah per stage. */
  secondaryLabel?: string
}

const props = defineProps<{
  items: StatusBreakdownItem[]
  emptyLabel?: string
}>()

const barToneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-muted-foreground/50',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  info: 'bg-chart-5',
  purple: 'bg-chart-4'
}

const maxCount = computed(() => Math.max(1, ...props.items.map(item => item.count)))
const total = computed(() => props.items.reduce((sum, item) => sum + item.count, 0))
</script>

<template>
  <EmptyState v-if="total === 0" :title="emptyLabel ?? 'Belum ada data'" />
  <ul v-else class="space-y-3">
    <li v-for="item in items" :key="item.key">
      <div class="flex items-center justify-between gap-2 text-sm">
        <span class="text-foreground">{{ item.label }}</span>
        <span class="text-muted-foreground shrink-0">
          {{ item.count }}<template v-if="item.secondaryLabel"> · {{ item.secondaryLabel }}</template>
        </span>
      </div>
      <div class="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          class="h-full rounded-full"
          :class="barToneClasses[item.tone]"
          :style="{ width: `${(item.count / maxCount) * 100}%` }"
        />
      </div>
    </li>
  </ul>
</template>
