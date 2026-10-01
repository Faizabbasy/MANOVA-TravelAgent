<script setup lang="ts">
import { RangeCalendarGridRow, type RangeCalendarGridRowProps } from 'reka-ui'
import { cn } from '~/lib/utils'

const props = defineProps<RangeCalendarGridRowProps & { class?: string }>()
</script>

<template>
  <RangeCalendarGridRow :class="cn('flex w-full', props.class)" v-bind="props">
    <slot />
  </RangeCalendarGridRow>
</template>
