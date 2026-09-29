<script setup lang="ts">
import { ref } from 'vue'
import { Star } from 'lucide-vue-next'

/** Star rating input 1-5 generik (Repair Phase Section 7 — Insights & Company) — dipakai `/client/feedback` (12 dimensi) dan detail Support Ticket (Section 6, rating tunggal). */
const props = withDefaults(defineProps<{
  modelValue?: number
  readonly?: boolean
  /** Star lebih besar untuk konteks hero/ringkasan — default tetap ukuran padat untuk baris dalam list. */
  size?: 'default' | 'lg'
}>(), {
  modelValue: undefined,
  readonly: false,
  size: 'default'
})

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const hoverValue = ref<number | undefined>()

function setRating (value: number) {
  if (props.readonly) { return }
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="flex items-center gap-0.5" @mouseleave="hoverValue = undefined">
    <button
      v-for="star in 5"
      :key="star"
      type="button"
      :disabled="readonly"
      :class="readonly ? 'cursor-default' : 'cursor-pointer'"
      @click="setRating(star)"
      @mouseenter="!readonly && (hoverValue = star)"
    >
      <Star
        :class="[
          size === 'lg' ? 'h-6 w-6' : 'h-4 w-4',
          'transition-colors',
          (hoverValue ?? modelValue ?? 0) >= star ? 'fill-warning text-warning' : 'text-muted-foreground'
        ]"
      />
    </button>
  </div>
</template>
