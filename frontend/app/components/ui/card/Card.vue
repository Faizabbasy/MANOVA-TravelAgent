<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    :class="
      cn(
        'rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_0_hsl(224_71%_4%/0.04)]',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
