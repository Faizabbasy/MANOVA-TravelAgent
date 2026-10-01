<script setup lang="ts">
import { RangeCalendarHeadCell, type RangeCalendarHeadCellProps } from 'reka-ui'
import { cn } from '~/lib/utils'

const props = defineProps<RangeCalendarHeadCellProps & { class?: string }>()
</script>

<template>
  <RangeCalendarHeadCell :class="cn('w-8 flex-1 text-[0.75rem] font-medium text-muted-foreground', props.class)" v-bind="props">
    <slot />
  </RangeCalendarHeadCell>
</template>
