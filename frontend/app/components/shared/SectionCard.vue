<script setup lang="ts">
import { cn } from '~/lib/utils'

const props = withDefaults(defineProps<{
  title?: string
  description?: string
  /** Bento sizing (Dashboard redesign) — mengatur span kolom pada grid dashboard. */
  size?: 'default' | 'wide' | 'hero' | 'full'
  /**
   * Aksen warna. Sejak refinement UI, aksen HANYA dirender bila `accent` di-set eksplisit atau
   * `size === 'hero'` — sebelumnya setiap card mendapat bar 4px + blur blob, sehingga tidak ada satu pun
   * card yang menonjol dan halaman terasa penuh warna tanpa makna. Warna kini disimpan untuk hal yang
   * benar-benar berarti (status, blocker, peringatan).
   */
  tone?: 'primary' | 'warning' | 'destructive' | 'success'
  accent?: boolean
  /** Menghilangkan padding konten — untuk card yang isinya tabel penuh-lebar. */
  flush?: boolean
}>(), { size: 'default', tone: 'primary', accent: false, flush: false })

const ACCENT_BORDER: Record<string, string> = {
  primary: 'border-l-primary',
  warning: 'border-l-warning',
  destructive: 'border-l-destructive',
  success: 'border-l-success'
}

const showAccent = props.accent || props.size === 'hero'
</script>

<template>
  <Card
    :class="cn(
      'relative',
      props.size !== 'default' && 'animate-fade-in',
      (props.size === 'wide' || props.size === 'hero') && 'md:col-span-2 xl:col-span-2',
      props.size === 'full' && 'md:col-span-2 xl:col-span-3',
      showAccent && `border-l-4 ${ACCENT_BORDER[props.tone]}`
    )"
  >
    <CardHeader v-if="title || $slots.header" class="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
      <div class="min-w-0">
        <slot name="header">
          <CardTitle :class="cn('text-[0.9375rem] leading-6', props.size === 'hero' && 'text-lg')">
            {{ title }}
          </CardTitle>
          <CardDescription v-if="description" class="mt-1 leading-relaxed">
            {{ description }}
          </CardDescription>
        </slot>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </CardHeader>

    <CardContent :class="cn(props.flush ? 'p-0' : 'p-5', (title || $slots.header) && (props.flush ? 'pt-0' : 'pt-0'))">
      <slot />
    </CardContent>
  </Card>
</template>
