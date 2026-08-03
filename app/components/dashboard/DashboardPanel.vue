<script setup lang="ts">
import type { Component } from 'vue'
import { cn } from '~/lib/utils'

/**
 * Section card — page-local, used only by index.vue (Dashboard card redesign). White rounded card +
 * colored icon tag, top accent bar, and a soft decorative color blob so the panel grid doesn't read
 * flat. Deliberately NOT a variant of the shared SectionCard.vue (used across 100+ other pages) —
 * kept isolated to this page.
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
  <section
    class="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow duration-200 hover:shadow-md flex flex-col min-w-0 h-full"
    :class="[
      size === 'wide' && 'md:col-span-2',
      size === 'full' && 'md:col-span-2 xl:col-span-3'
    ]"
  >
    <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r" :class="BAR_CLASSES[color]" />
    <div class="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-[0.07] blur-2xl transition-opacity duration-200 group-hover:opacity-[0.14]" :class="BLOB_CLASSES[color]" />

    <header v-if="title" class="relative flex items-start justify-between gap-3 p-5 pb-4">
      <div class="flex items-start gap-3 min-w-0">
        <div v-if="icon" class="shrink-0 rounded-lg p-2 ring-4" :class="BADGE_CLASSES[color]">
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
    <div :class="cn('relative px-5 pb-5 flex-1 min-w-0', !title && 'pt-5')">
      <slot />
    </div>
  </section>
</template>
