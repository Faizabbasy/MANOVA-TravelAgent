<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <tr :class="cn('border-b border-border/70 transition-colors last:border-0 hover:bg-muted/40 data-[state=selected]:bg-muted', props.class)">
    <slot />
  </tr>
</template>
