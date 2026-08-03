<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'

/**
 * Dashboard header — page-local, used only by index.vue. Gradient welcome banner (rounded card,
 * soft multi-color wash + decorative blurred blobs) so the top of the page doesn't read as empty
 * next to the colorful KPI/card grid below it.
 */
defineProps<{
  roleLabel: string
  greeting: string
  dateLabel: string
  description: string
}>()
</script>

<template>
  <header class="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-violet-500/10 to-cyan-500/10 px-6 py-6 mb-6">
    <div class="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
    <div class="pointer-events-none absolute -bottom-14 left-1/3 h-36 w-36 rounded-full bg-violet-500/20 blur-3xl" />

    <div class="relative flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0 flex items-start gap-3">
        <div class="hidden sm:flex shrink-0 items-center justify-center h-11 w-11 rounded-xl bg-primary/15 text-primary">
          <Sparkles class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <h1 class="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {{ greeting }}
          </h1>
          <p class="mt-1.5 text-sm text-muted-foreground max-w-prose">
            {{ description }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
          {{ roleLabel }}
        </span>
        <span class="inline-flex items-center rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground border border-border">
          {{ dateLabel }}
        </span>
      </div>
    </div>
  </header>
</template>
