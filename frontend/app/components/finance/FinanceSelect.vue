<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { SelectItem as RekaSelectItem, SelectItemIndicator, SelectItemText } from 'reka-ui'
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
      <!-- Only the label is the item text (shown in the trigger); the hint appears in the list only. -->
      <RekaSelectItem
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
        class="relative flex w-full cursor-default select-none items-center justify-between gap-3 rounded-sm py-2 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
      >
        <span class="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
          <SelectItemIndicator><Check class="h-4 w-4" /></SelectItemIndicator>
        </span>
        <SelectItemText>{{ option.label }}</SelectItemText>
        <span v-if="option.hint" class="shrink-0 text-xs tabular-nums text-muted-foreground">{{ option.hint }}</span>
      </RekaSelectItem>
    </SelectContent>
  </Select>
</template>
