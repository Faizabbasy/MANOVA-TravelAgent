<script setup lang="ts">
import { cn } from '~/lib/utils'

/**
 * Rupiah amount input. The model is the exact minor-unit string the API expects ("30000000"), never a float;
 * the field shows thousands separators while typing ("30.000.000"). IDR has no minor unit, so digits = rupiah.
 */
defineOptions({ inheritAttrs: false })

const props = defineProps<{ modelValue: string; invalid?: boolean; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const MAX_DIGITS = 16 // ceiling is Rp 1.000.000.000.000.000 (server-enforced)

const display = computed(() => {
  if (!props.modelValue) { return '' }
  return props.modelValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
})

function onInput (event: Event) {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_DIGITS)
  emit('update:modelValue', digits)
  // Keep the caret at the end after re-grouping (typing is left-to-right for amounts).
  nextTick(() => { input.value = display.value })
}
</script>

<template>
  <div class="relative">
    <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">Rp</span>
    <input
      v-bind="$attrs"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      :value="display"
      :aria-invalid="invalid || undefined"
      :class="cn(
        'flex h-10 w-full rounded-md border border-input bg-background py-1 pl-10 pr-3 text-right text-[15px] font-medium tabular-nums shadow-sm transition-colors placeholder:text-muted-foreground placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-destructive focus-visible:ring-destructive/30'
      )"
      :placeholder="placeholder ?? '0'"
      @input="onInput"
    >
  </div>
</template>
