<script setup lang="ts">
import { cn } from '~/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-vue-next'
import type { Component } from 'vue'

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
}

const props = withDefaults(defineProps<Props>(), {
  iconColor: 'primary'
})

const iconColorClasses = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
}
</script>

<template>
  <div class="bg-card rounded-xl p-6 card-shadow animate-fade-in">
    <div class="flex items-start justify-between">
      <div class="space-y-3 min-w-0">
        <p class="text-sm font-medium text-muted-foreground">{{ title }}</p>
        <div class="space-y-1">
          <p class="text-2xl font-bold text-foreground break-words">{{ value }}</p>
          <div v-if="change" class="flex items-center gap-1.5">
            <TrendingUp v-if="change.trend === 'up'" class="h-3.5 w-3.5 text-success" />
            <TrendingDown v-else class="h-3.5 w-3.5 text-destructive" />
            <span :class="cn(
              'text-xs font-medium',
              change.trend === 'up' ? 'text-success' : 'text-destructive'
            )">
              {{ change.value }}
            </span>
            <span class="text-xs text-muted-foreground">vs last period</span>
          </div>
          <p v-if="subtitle" class="text-xs text-muted-foreground">{{ subtitle }}</p>
        </div>
      </div>
      <div :class="cn('p-3 rounded-xl', iconColorClasses[iconColor])">
        <component :is="icon" class="h-5 w-5" />
      </div>
    </div>
  </div>
</template>
