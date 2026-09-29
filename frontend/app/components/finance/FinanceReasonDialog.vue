<script setup lang="ts">
import type { ApiError } from '~/lib/api/errors'

/**
 * Confirmation that needs a written reason (void, dispute, promised date, …). The reason goes to the audit
 * trail. Optionally asks for a date or an amount too. The parent runs the command and passes its state.
 */
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description: string
  confirmLabel: string
  reasonLabel?: string
  reasonPlaceholder?: string
  tone?: 'default' | 'destructive'
  pending?: boolean
  error?: ApiError | null
  /** Ask for a date (e.g. promised payment date). */
  dateLabel?: string
  dateMin?: string
  dateMax?: string
  initialDate?: string | null
  /** The date may be cleared (e.g. remove a promised date). */
  dateOptional?: boolean
  /** Ask for an amount (e.g. credit note). */
  amountLabel?: string
  amountHint?: string
}>(), {
  reasonLabel: 'Alasan',
  reasonPlaceholder: undefined,
  tone: 'default',
  pending: false,
  error: null,
  dateLabel: undefined,
  dateMin: undefined,
  dateMax: undefined,
  initialDate: null,
  dateOptional: false,
  amountLabel: undefined,
  amountHint: undefined
})
const emit = defineEmits<{ 'update:open': [value: boolean]; confirm: [value: { reason: string; date: string | null; amount: string }] }>()

const reason = ref('')
const date = ref('')
const amount = ref('')

watch(() => props.open, (open) => {
  if (!open) { return }
  reason.value = ''
  date.value = props.initialDate ?? ''
  amount.value = ''
}, { immediate: true })

const fieldError = (name: string) => props.error?.fieldError(name) ?? null
const disabled = computed(() =>
  reason.value.trim().length < 5 ||
  (!!props.dateLabel && !props.dateOptional && !date.value) ||
  (!!props.amountLabel && !amount.value))
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="title"
    :description="description"
    :submit-label="confirmLabel"
    :tone="tone"
    :pending="pending"
    :error="error"
    :submit-disabled="disabled"
    @update:open="emit('update:open', $event)"
    @submit="emit('confirm', { reason: reason.trim(), date: date || null, amount })"
  >
    <slot />
    <FinanceField v-if="amountLabel" id="reason-amount" :label="amountLabel" :hint="amountHint" :error="fieldError('amountMinor')">
      <FinanceMoneyInput id="reason-amount" v-model="amount" :invalid="!!fieldError('amountMinor')" />
    </FinanceField>
    <FinanceField v-if="dateLabel" id="reason-date" :label="dateLabel" :optional="dateOptional" :error="fieldError('expectedDate') ?? fieldError('date')">
      <FinanceDateInput id="reason-date" v-model="date" :min="dateMin" :max="dateMax" />
    </FinanceField>
    <FinanceField id="reason-text" :label="reasonLabel" :error="fieldError('reason')" hint="Minimal 5 karakter. Tersimpan di jejak audit.">
      <FinanceTextarea id="reason-text" v-model="reason" :rows="2" :placeholder="reasonPlaceholder" maxlength="500" />
    </FinanceField>
  </FinanceFormDialog>
</template>
