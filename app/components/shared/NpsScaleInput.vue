<script setup lang="ts">
import { cn } from '~/lib/utils'

/**
 * Skala NPS 0-10 klasik ("seberapa mungkin merekomendasikan") — dipakai untuk `Feedback.recommendationScore`,
 * yang memang skala 0-10 di data & di perhitungan NPS internal (`/crm/feedback`), bukan skala 1-5 seperti
 * dimensi rating lain. Sengaja komponen terpisah dari `RatingInput` karena beda makna: ini bukan "kepuasan
 * per-dimensi", tapi indikator promoter/passive/detractor.
 */
const props = withDefaults(defineProps<{
  modelValue?: number
  readonly?: boolean
}>(), {
  modelValue: undefined,
  readonly: false
})

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function setScore (value: number) {
  if (props.readonly) { return }
  emit('update:modelValue', value)
}

function toneClass (value: number, selected: boolean): string {
  if (!selected) { return 'border-border bg-card text-muted-foreground hover:border-foreground/30' }
  if (value <= 6) { return 'border-destructive bg-destructive/10 text-destructive' }
  if (value <= 8) { return 'border-warning bg-warning/10 text-warning' }
  return 'border-success bg-success/10 text-success'
}
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex items-center gap-1">
      <button
        v-for="score in 11"
        :key="score - 1"
        type="button"
        :disabled="readonly"
        :class="cn(
          'h-8 w-8 shrink-0 rounded-md border text-xs font-medium transition-colors',
          readonly ? 'cursor-default' : 'cursor-pointer',
          toneClass(score - 1, modelValue === score - 1)
        )"
        @click="setScore(score - 1)"
      >
        {{ score - 1 }}
      </button>
    </div>
    <div class="flex items-center justify-between text-xs text-muted-foreground">
      <span>Tidak mungkin</span>
      <span>Sangat mungkin</span>
    </div>
  </div>
</template>
