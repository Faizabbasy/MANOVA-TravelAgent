<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next'
import { ATTENTION_SEVERITIES, findStatusOption } from '~/constants/status'
import type { BadgeTone } from '~/types/common'

const props = withDefaults(defineProps<{
  severity?: 'low' | 'medium' | 'high'
  label?: string
}>(), {
  severity: 'medium'
})

const toneTextClasses: Record<BadgeTone, string> = {
  neutral: 'text-muted-foreground',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  info: 'text-chart-5',
  purple: 'text-chart-4'
}

const option = computed(() => findStatusOption(ATTENTION_SEVERITIES, props.severity))
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <AlertTriangle :class="['h-3.5 w-3.5', toneTextClasses[option.tone]]" />
    <StatusBadge :label="label ?? `Perlu Perhatian (${option.label})`" :tone="option.tone" />
  </span>
</template>
