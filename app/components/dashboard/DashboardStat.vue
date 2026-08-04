<script setup lang="ts">
import type { Component } from 'vue'

/**
 * KPI tile — page-local, hanya dipakai `index.vue`.
 *
 * Refinement UI: bar gradien, blur blob, translate, dan rotasi ikon saat hover dihapus agar konsisten
 * dengan `StatsCard.vue` yang sudah ditenangkan. Warna kini hanya pada chip ikon.
 */
withDefaults(defineProps<{
  label: string
  value: string
  icon: Component
  color?: 'blue' | 'rose' | 'violet' | 'teal' | 'amber' | 'cyan'
  subtitle?: string
}>(), { color: 'blue' })

const BADGE_CLASSES: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
  teal: 'bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400'
}
</script>

<template>
  <div class="group relative min-w-0 rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_0_hsl(224_71%_4%/0.04)] transition-colors duration-150 hover:bg-muted/20">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {{ label }}
        </p>
        <p class="mt-2 text-2xl font-semibold leading-8 tracking-tight text-foreground tabular-nums break-words">
          {{ value }}
        </p>
      </div>
      <div class="shrink-0 rounded-lg p-2.5" :class="BADGE_CLASSES[color]">
        <component :is="icon" class="h-4 w-4" />
      </div>
    </div>
    <p v-if="subtitle" class="mt-2 truncate text-xs text-muted-foreground">
      {{ subtitle }}
    </p>
  </div>
</template>
