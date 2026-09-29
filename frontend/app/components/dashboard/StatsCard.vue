<script setup lang="ts">
import { TrendingUp, TrendingDown } from 'lucide-vue-next'
import type { Component } from 'vue'
import { cn } from '~/lib/utils'

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
}

const props = withDefaults(defineProps<Props>(), {
  iconColor: 'primary',
  size: 'default'
})

/**
 * Refinement UI: bar aksen 4px, blur blob, translate, dan rotasi ikon saat hover dihapus. Empat KPI tile
 * bersebelahan yang semuanya bergaris warna membuat tidak ada satu pun yang menonjol — warna kini hanya
 * pada chip ikon, yang memang membawa arti (hijau = sehat, merah = perlu tindakan).
 */
const iconColorClasses = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive'
}
</script>

<template>
  <div
    :class="cn(
      'group relative rounded-xl border border-border bg-card shadow-[0_1px_2px_0_hsl(224_71%_4%/0.04)] transition-colors duration-150 hover:border-border/80 hover:bg-muted/20',
      props.size === 'lg' ? 'p-5' : 'p-4'
    )"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {{ title }}
        </p>
        <p :class="cn('mt-2 font-semibold tracking-tight text-foreground break-words', props.size === 'lg' ? 'text-[1.75rem] leading-9' : 'text-2xl leading-8')">
          {{ value }}
        </p>

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
      </div>

      <div :class="cn('shrink-0 rounded-lg p-2.5', iconColorClasses[iconColor])">
        <component :is="icon" class="h-4 w-4" />
      </div>
    </div>
  </div>
</template>
