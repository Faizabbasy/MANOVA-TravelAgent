<script setup lang="ts">
import { RangeCalendarGrid, type RangeCalendarGridProps } from 'reka-ui'
import { cn } from '~/lib/utils'

const props = defineProps<RangeCalendarGridProps & { class?: string }>()
</script>

<template>
  <RangeCalendarGrid :class="cn('w-full border-collapse select-none', props.class)" v-bind="props">
    <slot />
  </RangeCalendarGrid>
</template>
