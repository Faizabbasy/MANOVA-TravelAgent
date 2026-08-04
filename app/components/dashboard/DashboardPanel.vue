<script setup lang="ts">
import type { Component } from 'vue'
import { cn } from '~/lib/utils'

/**
 * Section card — page-local, hanya dipakai `index.vue`.
 *
 * Refinement UI: bar aksen gradien dan blur blob dihapus. Dengan belasan panel dalam satu grid, setiap
 * panel bergaris warna membuat dashboard terbaca seperti kumpulan iklan — identitas warna kini cukup
 * dibawa chip ikon di sebelah judul.
 */
withDefaults(defineProps<{
  title?: string
  description?: string
  icon?: Component
  color?: 'blue' | 'rose' | 'violet' | 'teal' | 'amber' | 'cyan'
  size?: 'default' | 'wide' | 'full'
}>(), { color: 'blue', size: 'default' })

const BADGE_CLASSES: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 ring-blue-100 dark:ring-blue-500/10',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 ring-rose-100 dark:ring-rose-500/10',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400 ring-violet-100 dark:ring-violet-500/10',
  teal: 'bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400 ring-teal-100 dark:ring-teal-500/10',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 ring-amber-100 dark:ring-amber-500/10',
  cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400 ring-cyan-100 dark:ring-cyan-500/10'
}
</script>

<template>
  <section
    class="group relative flex h-full min-w-0 flex-col rounded-xl border border-border bg-card shadow-[0_1px_2px_0_hsl(224_71%_4%/0.04)]"
    :class="[
      size === 'wide' && 'md:col-span-2',
      size === 'full' && 'md:col-span-2 xl:col-span-3'
    ]"
  >
    <header v-if="title" class="flex items-start justify-between gap-3 p-5 pb-3">
      <div class="flex items-start gap-3 min-w-0">
        <div v-if="icon" class="shrink-0 rounded-lg p-2" :class="BADGE_CLASSES[color]">
          <component :is="icon" class="h-4 w-4" />
        </div>
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-foreground">
            {{ title }}
          </h3>
          <p v-if="description" class="text-xs text-muted-foreground mt-0.5">
            {{ description }}
          </p>
        </div>
      </div>
      <div v-if="$slots.actions" class="shrink-0">
        <slot name="actions" />
      </div>
    </header>
    <div :class="cn('min-w-0 flex-1 px-5 pb-5', !title && 'pt-5')">
      <slot />
    </div>
  </section>
</template>
