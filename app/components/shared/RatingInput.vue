<script setup lang="ts">
import { Star } from 'lucide-vue-next'

/** Star rating input 1-5 generik (Repair Phase Section 7 — Insights & Company) — dipakai `/client/feedback` (12 dimensi) dan detail Support Ticket (Section 6, rating tunggal). */
const props = withDefaults(defineProps<{
  modelValue?: number
  readonly?: boolean
}>(), {
  modelValue: undefined,
  readonly: false
})

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function setRating (value: number) {
  if (props.readonly) { return }
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="flex items-center gap-0.5">
    <button
      v-for="star in 5"
      :key="star"
      type="button"
      :disabled="readonly"
      :class="readonly ? 'cursor-default' : 'cursor-pointer'"
      @click="setRating(star)"
    >
      <Star :class="['h-4 w-4', (modelValue ?? 0) >= star ? 'fill-warning text-warning' : 'text-muted-foreground']" />
    </button>
  </div>
</template>
