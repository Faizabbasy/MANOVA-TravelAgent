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
  blue: 'bg-blue-500 text-white',
  rose: 'bg-rose-500 text-white',
  violet: 'bg-violet-500 text-white',
  teal: 'bg-teal-500 text-white',
  amber: 'bg-amber-500 text-white',
  cyan: 'bg-cyan-500 text-white'
}
</script>

<template>
  <section
    class="group relative flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card shadow-[0_1px_2px_0_hsl(224_71%_4%/0.04)] transition-shadow duration-150 hover:shadow-md"
    :class="[
      size === 'wide' && 'md:col-span-2',
      size === 'full' && 'md:col-span-2 xl:col-span-3'
    ]"
  >
    <header v-if="title" class="flex items-start justify-between gap-3 p-5 pb-3">
      <div class="flex items-start gap-3 min-w-0">
        <div v-if="icon" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" :class="BADGE_CLASSES[color]">
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
