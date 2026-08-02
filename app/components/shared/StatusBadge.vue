<script setup lang="ts">
import { cn } from '~/lib/utils'
import type { BadgeTone } from '~/types/common'

const props = defineProps<{
  label: string
  tone?: BadgeTone
}>()

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-chart-5/10 text-chart-5',
  purple: 'bg-chart-4/10 text-chart-4'
}
</script>

<template>
  <Badge variant="secondary" :class="cn(toneClasses[props.tone ?? 'neutral'])">
    {{ label }}
  </Badge>
</template>
