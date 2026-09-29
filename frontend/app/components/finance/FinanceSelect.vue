<script setup lang="ts">
import { cn } from '~/lib/utils'
import type { FinanceOption } from '~/lib/finance/types'

/** Single select over a small list (accounts, projects, vendors). `null` = nothing chosen. */

const props = withDefaults(defineProps<{
  modelValue: string | null
  options: FinanceOption[]
  placeholder?: string
  id?: string
  invalid?: boolean
  disabled?: boolean
  /** Adds a first option that clears the choice (for optional links like "Tanpa project"). */
  clearLabel?: string
}>(), { placeholder: 'Pilih…', id: undefined, clearLabel: undefined })
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const CLEAR = '__none__'
const selected = computed({
  get: () => props.modelValue ?? (props.clearLabel ? CLEAR : undefined),
  set: (value?: string) => emit('update:modelValue', !value || value === CLEAR ? null : value)
})
</script>

<template>
  <Select v-model="selected" :disabled="disabled">
    <SelectTrigger :id="id" :aria-invalid="invalid || undefined" :class="cn('h-10 bg-background', invalid && 'border-destructive')">
      <SelectValue :placeholder="placeholder" />
    </SelectTrigger>
    <SelectContent class="max-h-72">
      <SelectItem v-if="clearLabel" :value="CLEAR">
        <span class="text-muted-foreground">{{ clearLabel }}</span>
      </SelectItem>
      <SelectItem v-for="option in options" :key="option.value" :value="option.value" :disabled="option.disabled">
        {{ option.label }}<span v-if="option.hint" class="ml-1.5 text-xs text-muted-foreground">{{ option.hint }}</span>
      </SelectItem>
    </SelectContent>
  </Select>
</template>
