<script setup lang="ts">
import type { Component } from 'vue'

/**
 * KPI tile — page-local, hanya dipakai `index.vue`.
 *
 * Ikon lingkaran solid + angka besar di bawahnya (bukan label/value sejajar dengan ikon di kanan) —
 * komposisi lebih tegas dan tidak generik dibanding pola "label kiri, ikon kanan" sebelumnya.
 */
withDefaults(defineProps<{
  label: string
  value: string
  icon: Component
  color?: 'blue' | 'rose' | 'violet' | 'teal' | 'amber' | 'cyan'
  subtitle?: string
}>(), { color: 'blue' })

const BADGE_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500 text-white',
  rose: 'bg-rose-500 text-white',
  violet: 'bg-violet-500 text-white',
  teal: 'bg-teal-500 text-white',
  amber: 'bg-amber-500 text-white',
  cyan: 'bg-cyan-500 text-white'
}
</script>

<template>
  <div class="group relative min-w-0 rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_0_hsl(224_71%_4%/0.04)] transition-colors duration-150 hover:bg-muted/20">
    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" :class="BADGE_CLASSES[color]">
      <component :is="icon" class="h-5 w-5" />
    </div>
    <p class="mt-3 truncate text-xs font-medium text-muted-foreground">
      {{ label }}
    </p>
    <p class="mt-1 text-2xl font-bold leading-8 tracking-tight text-foreground tabular-nums break-words">
      {{ value }}
    </p>
    <p v-if="subtitle" class="mt-1.5 truncate text-xs text-muted-foreground">
      {{ subtitle }}
    </p>
  </div>
</template>
