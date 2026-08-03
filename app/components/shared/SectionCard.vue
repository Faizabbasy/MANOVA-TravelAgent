<script setup lang="ts">
import { cn } from '~/lib/utils'

const props = withDefaults(defineProps<{
  title?: string
  description?: string
  /** Bento sizing (Dashboard redesign) — purely additive, default reproduces markup identical to before this prop existed. 'full' = spans the entire grid row (used when a role only has one widget to show). */
  size?: 'default' | 'wide' | 'hero' | 'full'
  /** Accent tone — drives the top accent bar/blob on every card, plus the left border when size === 'hero'. */
  tone?: 'primary' | 'warning' | 'destructive'
}>(), { size: 'default', tone: 'primary' })

const TONE_BAR: Record<string, string> = {
  primary: 'bg-primary',
  warning: 'bg-warning',
  destructive: 'bg-destructive'
}
const TONE_BLOB: Record<string, string> = {
  primary: 'bg-primary',
  warning: 'bg-warning',
  destructive: 'bg-destructive'
}
</script>

<template>
  <Card
    :class="cn(
      'relative overflow-hidden',
      props.size !== 'default' && 'animate-fade-in',
      (props.size === 'wide' || props.size === 'hero') && 'md:col-span-2 xl:col-span-2',
      props.size === 'full' && 'md:col-span-2 xl:col-span-3',
      props.size === 'hero' && 'shadow-none card-shadow-lg border-l-4',
      props.size === 'hero' && props.tone === 'primary' && 'border-l-primary',
      props.size === 'hero' && props.tone === 'warning' && 'border-l-warning',
      props.size === 'hero' && props.tone === 'destructive' && 'border-l-destructive'
    )"
  >
    <div class="absolute inset-x-0 top-0 h-1" :class="TONE_BAR[tone]" />
    <div class="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-[0.06] blur-2xl" :class="TONE_BLOB[tone]" />

    <CardHeader v-if="title" class="relative flex flex-row items-start justify-between gap-3 space-y-0">
      <div>
        <CardTitle :class="cn('text-base', props.size === 'hero' && 'text-lg')">
          {{ title }}
        </CardTitle>
        <CardDescription v-if="description">
          {{ description }}
        </CardDescription>
      </div>
      <div v-if="$slots.actions" class="shrink-0">
        <slot name="actions" />
      </div>
    </CardHeader>
    <CardContent class="relative">
      <slot />
    </CardContent>
  </Card>
</template>
