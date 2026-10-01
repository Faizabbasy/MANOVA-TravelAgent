<script setup lang="ts">
import { RangeCalendarCell, type RangeCalendarCellProps } from 'reka-ui'
import { cn } from '~/lib/utils'

const props = defineProps<RangeCalendarCellProps & { class?: string }>()
</script>

<template>
  <RangeCalendarCell :class="cn('relative w-full h-8 p-0 text-center text-sm', props.class)" v-bind="props">
    <slot />
  </RangeCalendarCell>
</template>
