<script setup lang="ts">
import type { Component } from 'vue'

/**
 * KPI tile — page-local, used only by index.vue (Dashboard card redesign). Colorful icon badge +
 * large numeral + decorative color blob, modeled on the reference screenshot. Not a variant of the
 * shared StatsCard.vue (used across 20+ other pages) — kept isolated so this restyle can't regress
 * other pages.
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
const BLOB_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
  teal: 'bg-teal-500',
  amber: 'bg-amber-500',
  cyan: 'bg-cyan-500'
}
const BAR_CLASSES: Record<string, string> = {
  blue: 'from-blue-400 to-blue-600',
  rose: 'from-rose-400 to-rose-600',
  violet: 'from-violet-400 to-violet-600',
  teal: 'from-teal-400 to-teal-600',
  amber: 'from-amber-400 to-amber-600',
  cyan: 'from-cyan-400 to-cyan-600'
}
</script>

<template>
  <div class="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg min-w-0">
    <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r" :class="BAR_CLASSES[color]" />
    <div class="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full opacity-[0.12] blur-2xl transition-opacity duration-200 group-hover:opacity-25" :class="BLOB_CLASSES[color]" />

    <div class="relative flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-medium text-muted-foreground truncate">
          {{ label }}
        </p>
        <p class="mt-2 text-2xl font-bold text-foreground tabular-nums break-words">
          {{ value }}
        </p>
      </div>
      <div class="shrink-0 rounded-xl p-2.5 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3" :class="BADGE_CLASSES[color]">
        <component :is="icon" class="h-5 w-5" />
      </div>
    </div>
    <p v-if="subtitle" class="relative mt-2 text-xs text-muted-foreground truncate">
      {{ subtitle }}
    </p>
  </div>
</template>
