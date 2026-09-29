<script setup lang="ts">
import { cn } from '~/lib/utils'

/** Native date picker (keyboard + mobile friendly); the model is the API's `YYYY-MM-DD`. */
defineOptions({ inheritAttrs: false })
defineProps<{ modelValue: string; invalid?: boolean; min?: string; max?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <input
    v-bind="$attrs"
    type="date"
    :value="modelValue"
    :min="min"
    :max="max"
    :aria-invalid="invalid || undefined"
    :class="cn(
      'flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm tabular-nums shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50',
      invalid && 'border-destructive focus-visible:ring-destructive/30'
    )"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  >
</template>
