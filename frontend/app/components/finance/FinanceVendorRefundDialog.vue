<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import { todayJakarta } from '~/lib/finance/dates'
import { formatMoneyMinor } from '~/lib/money'
import type { SupplierClaimDto } from '~/types/api'

/** Money actually received back from a supplier, settling a recorded claim. Never revenue, never a second cost reversal. */
const props = defineProps<{ open: boolean; claim: SupplierClaimDto | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const lookups = useFinanceLookups(() => props.open)
const today = todayJakarta()
const form = reactive({ accountId: null as string | null, amount: '', date: today, reference: '' })
let idempotencyKey = newIdempotencyKey()

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  idempotencyKey = newIdempotencyKey()
  Object.assign(form, { accountId: lookups.accountOptions.value[0]?.value ?? null, amount: props.claim?.outstandingMinor ?? '', date: today, reference: '' })
})
watch(() => lookups.accountOptions.value, (options) => {
  if (props.open && !form.accountId && options.length) { form.accountId = options[0]!.value }
}, { immediate: true })

const over = computed(() => !!form.amount && !!props.claim && BigInt(form.amount) > BigInt(props.claim.outstandingMinor))
const action = useFinanceAction(() => api.finance.postVendorRefund({
  bankAccountId: form.accountId!, claimId: props.claim!.id, amountMinor: form.amount, effectiveDate: form.date, reference: form.reference.trim() || undefined
}, idempotencyKey))

async function submit () {
  const res = await action.run()
  if (!res) { return }
  showToast('Pengembalian supplier diterima', `Sisa klaim ${formatMoneyMinor(res.data.outstandingMinor)}.`)
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    title="Terima pengembalian supplier"
    :description="claim ? `${claim.vendorName} · sisa klaim ${formatMoneyMinor(claim.outstandingMinor)}. Melunasi klaim, bukan pendapatan.` : undefined"
    submit-label="Catat penerimaan"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="!claim || !form.accountId || !form.amount || over"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid gap-4">
      <FinanceField id="vr-account" label="Masuk ke rekening" :error="action.fieldError('bankAccountId')">
        <FinanceSelect id="vr-account" v-model="form.accountId" :options="lookups.accountOptions.value" />
      </FinanceField>
      <div class="grid gap-4 sm:grid-cols-2">
        <FinanceField id="vr-amount" label="Nominal diterima" :error="action.fieldError('amountMinor')">
          <FinanceMoneyInput id="vr-amount" v-model="form.amount" :invalid="over || !!action.fieldError('amountMinor')" />
          <p v-if="over" class="mt-1 text-xs font-medium text-destructive" role="alert">
            Melebihi sisa klaim.
          </p>
        </FinanceField>
        <FinanceField id="vr-date" label="Tanggal masuk" :error="action.fieldError('effectiveDate')">
          <FinanceDateInput id="vr-date" v-model="form.date" :max="today" />
        </FinanceField>
      </div>
      <FinanceField id="vr-ref" label="Referensi bank" optional :error="action.fieldError('reference')">
        <Input id="vr-ref" v-model="form.reference" maxlength="120" />
      </FinanceField>
    </div>
  </FinanceFormDialog>
</template>
