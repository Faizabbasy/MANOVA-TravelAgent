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
  /** Bento sizing (Dashboard redesign) — purely additive, default reproduces markup identical to before this prop existed. */
  size?: 'default' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  iconColor: 'primary',
  size: 'default'
})

const iconColorClasses = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive'
}
const barColorClasses = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive'
}
</script>

<template>
  <div
    :class="cn(
      'group relative overflow-hidden bg-card rounded-2xl border border-border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg animate-fade-in',
      props.size === 'lg' ? 'p-7' : 'p-6'
    )"
  >
    <div class="absolute inset-x-0 top-0 h-1" :class="barColorClasses[iconColor]" />
    <div class="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-[0.1] blur-2xl transition-opacity duration-200 group-hover:opacity-20" :class="barColorClasses[iconColor]" />

    <div class="relative flex items-start justify-between">
      <div class="space-y-3 min-w-0">
        <p class="text-sm font-medium text-muted-foreground">
          {{ title }}
        </p>
        <div class="space-y-1">
          <p :class="cn('font-bold text-foreground break-words', props.size === 'lg' ? 'text-3xl' : 'text-2xl')">
            {{ value }}
          </p>
          <div v-if="change" class="flex items-center gap-1.5">
            <TrendingUp v-if="change.trend === 'up'" class="h-3.5 w-3.5 text-success" />
            <TrendingDown v-else class="h-3.5 w-3.5 text-destructive" />
            <span
              :class="cn(
                'text-xs font-medium',
                change.trend === 'up' ? 'text-success' : 'text-destructive'
              )"
            >
              {{ change.value }}
            </span>
            <span class="text-xs text-muted-foreground">vs last period</span>
          </div>
          <p v-if="subtitle" class="text-xs text-muted-foreground">
            {{ subtitle }}
          </p>
        </div>
      </div>
      <div :class="cn('p-3 rounded-xl transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3', iconColorClasses[iconColor])">
        <component :is="icon" class="h-5 w-5" />
      </div>
    </div>
  </div>
</template>
