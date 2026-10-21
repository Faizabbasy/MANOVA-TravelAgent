<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import { todayJakarta } from '~/lib/finance/dates'
import { formatMoneyMinor } from '~/lib/money'

/**
 * "Bayar Gaji": the net salaries of an approved payroll leave one bank account on one date. This is the only way
 * a payroll becomes paid; it settles the salary payable booked at approval, never a second expense.
 */
const props = defineProps<{ open: boolean; period: string; netMinor: string; pending: boolean; error: string | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; submit: [input: { bankAccountId: string; effectiveDate: string; idempotencyKey: string }] }>()

const lookups = useFinanceLookups(() => props.open)
const today = todayJakarta()
const form = reactive({ accountId: null as string | null, date: today })
let idempotencyKey = newIdempotencyKey()

watch(() => props.open, (open) => {
  if (!open) { return }
  idempotencyKey = newIdempotencyKey()
  Object.assign(form, { accountId: lookups.accountOptions.value[0]?.value ?? null, date: today })
})
watch(() => lookups.accountOptions.value, (options) => {
  if (props.open && !form.accountId && options.length) { form.accountId = options[0]!.value }
}, { immediate: true })

const account = computed(() => lookups.postableAccounts.value.find(a => a.id === form.accountId) ?? null)
const short = computed(() => !!account.value?.balance.currentMinor && BigInt(account.value.balance.currentMinor) < BigInt(props.netMinor))
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="`Bayar gaji ${period}`"
    :description="`Total gaji bersih ${formatMoneyMinor(netMinor)} keluar dari rekening yang dipilih. Status dibayar hanya tercatat dari pembayaran ini.`"
    submit-label="Bayar gaji"
    :pending="pending"
    :submit-disabled="!form.accountId || !form.date"
    @update:open="emit('update:open', $event)"
    @submit="emit('submit', { bankAccountId: form.accountId!, effectiveDate: form.date, idempotencyKey })"
  >
    <div class="grid gap-4">
      <FinanceField id="pp-account" label="Dari rekening">
        <FinanceSelect id="pp-account" v-model="form.accountId" :options="lookups.accountOptions.value" />
        <p v-if="short" class="mt-1 text-xs font-medium text-warning">
          Saldo rekening tercatat kurang dari total gaji bersih.
        </p>
      </FinanceField>
      <FinanceField id="pp-date" label="Tanggal transfer">
        <FinanceDateInput id="pp-date" v-model="form.date" :max="today" />
      </FinanceField>
      <p v-if="error" class="text-sm font-medium text-destructive" role="alert">
        {{ error }}
      </p>
    </div>
  </FinanceFormDialog>
</template>
