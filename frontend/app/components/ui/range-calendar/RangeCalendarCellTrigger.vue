<script setup lang="ts">
import { RangeCalendarCellTrigger, type RangeCalendarCellTriggerProps } from 'reka-ui'
import { cn } from '~/lib/utils'

const props = defineProps<RangeCalendarCellTriggerProps & { class?: string }>()
</script>

<template>
  <RangeCalendarCellTrigger
    :class="cn(
      'flex h-8 w-8 items-center justify-center rounded-md p-0 text-sm font-normal text-foreground transition-colors',
      'hover:bg-accent hover:text-accent-foreground',
      'data-[selected]:bg-primary/15 data-[selected]:text-foreground data-[selection-start]:rounded-l-md data-[selection-end]:rounded-r-md',
      'data-[selection-start]:bg-primary data-[selection-start]:text-primary-foreground data-[selection-end]:bg-primary data-[selection-end]:text-primary-foreground',
      'data-[today]:font-semibold data-[today]:text-primary',
      'data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground/40',
      'data-[outside-view]:text-muted-foreground/40',
      props.class
    )"
    v-bind="props"
  />
</template>
