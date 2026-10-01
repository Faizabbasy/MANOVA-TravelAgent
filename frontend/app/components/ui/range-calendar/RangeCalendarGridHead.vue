<script setup lang="ts">
import { RangeCalendarGridHead, type RangeCalendarGridHeadProps } from 'reka-ui'

const props = defineProps<RangeCalendarGridHeadProps>()
</script>

<template>
  <RangeCalendarGridHead v-bind="props">
    <slot />
  </RangeCalendarGridHead>
</template>
