<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import { todayJakarta } from '~/lib/finance/dates'
import { formatMoneyMinor } from '~/lib/money'

/**
 * A supplier owes money back: a recovery of a cost already recognised (compensation, refund of a cancelled
 * service) or an unused deposit. Recorded as a claim — it is not revenue and moves no money until received.
 */
const props = defineProps<{ open: boolean; projectId?: string | null; salesOrderId?:string }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const lookups = useFinanceLookups(() => props.open)
const today = todayJakarta()
const form = reactive({ vendorId: null as string | null, basis: 'cost-recovery' as 'cost-recovery' | 'deposit-recovery', depositId: null as string | null, amount: '', date: today, reason: '' })
let idempotencyKey = newIdempotencyKey()

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  idempotencyKey = newIdempotencyKey()
  Object.assign(form, { vendorId: null, basis: 'cost-recovery', depositId: null, amount: '', date: today, reason: '' })
})

const deposits = useFinanceQuery(async () => (await api.finance.advances({ type: 'vendor', vendorId: form.vendorId! })).data, {
  watch: [() => form.vendorId, () => form.basis], enabled: () => props.open && form.basis === 'deposit-recovery' && !!form.vendorId
})
const depositOptions = computed(() => (deposits.data.value ?? []).filter(d => BigInt(d.unallocatedMinor) > 0n).map(d => ({
  value: d.transactionId, label: `${d.transactionId} · ${d.effectiveDate}`, hint: `belum terpakai ${formatMoneyMinor(d.unallocatedMinor)}`
})))
watch(() => form.depositId, (id) => {
  const d = deposits.data.value?.find(x => x.transactionId === id)
  if (d) { form.amount = d.unallocatedMinor }
})

const action = useFinanceAction(() => api.finance.createSupplierClaim({
  vendorId: form.vendorId!,
  ...(props.projectId ? { projectId: props.projectId } : {}),
  ...(props.salesOrderId ? { salesOrderId: props.salesOrderId } : {}),
  basis: form.basis,
  ...(form.basis === 'deposit-recovery' ? { sourcePaymentId: form.depositId! } : {}),
  amountMinor: form.amount,
  recognizedOn: form.date,
  reason: form.reason.trim()
}, idempotencyKey))

async function submit () {
  const res = await action.run()
  if (!res) { return }
  showToast('Klaim supplier dicatat', res.data.accountingStatus === 'posted' ? 'Jurnal accounting terbentuk otomatis.' : 'Dana belum diterima; catat penerimaannya saat supplier membayar.')
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    title="Catat klaim ke supplier"
    description="Uang yang wajib dikembalikan supplier. Bukan pendapatan dan belum menambah saldo bank."
    submit-label="Catat klaim"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="!form.vendorId || !form.amount || form.reason.trim().length < 5 || (form.basis === 'deposit-recovery' && !form.depositId)"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid gap-4">
      <FinanceField id="sc-vendor" label="Supplier" :error="action.fieldError('vendorId')">
        <FinanceSelect id="sc-vendor" v-model="form.vendorId" :options="lookups.vendorOptions.value" placeholder="Pilih supplier" />
      </FinanceField>
      <FinanceField id="sc-basis" label="Jenis klaim" :error="action.fieldError('basis')">
        <FinanceSelect
          id="sc-basis"
          :model-value="form.basis"
          :options="[{ value: 'cost-recovery', label: 'Pemulihan biaya (kompensasi/refund jasa)' }, { value: 'deposit-recovery', label: 'Pengembalian deposit yang belum terpakai' }]"
          @update:model-value="v => form.basis = (v ?? 'cost-recovery') as 'cost-recovery' | 'deposit-recovery'"
        />
      </FinanceField>
      <FinanceField
        v-if="form.basis === 'deposit-recovery'"
        id="sc-deposit"
        label="Deposit"
        :error="action.fieldError('sourcePaymentId')"
        :hint="form.vendorId && !depositOptions.length && !deposits.pending.value ? 'Supplier ini tidak punya deposit yang belum terpakai.' : undefined"
      >
        <FinanceSelect id="sc-deposit" v-model="form.depositId" :options="depositOptions" placeholder="Pilih deposit" />
      </FinanceField>
      <div class="grid gap-4 sm:grid-cols-2">
        <FinanceField id="sc-amount" label="Nilai klaim" :error="action.fieldError('amountMinor')">
          <FinanceMoneyInput id="sc-amount" v-model="form.amount" :invalid="!!action.fieldError('amountMinor')" />
        </FinanceField>
        <FinanceField id="sc-date" label="Tanggal disepakati" :error="action.fieldError('recognizedOn')">
          <FinanceDateInput id="sc-date" v-model="form.date" :max="today" />
        </FinanceField>
      </div>
      <FinanceField id="sc-reason" label="Dasar klaim" :error="action.fieldError('reason')" hint="Contoh: kamar tidak tersedia, kompensasi disetujui supplier.">
        <FinanceTextarea id="sc-reason" v-model="form.reason" :rows="2" maxlength="500" />
      </FinanceField>
    </div>
  </FinanceFormDialog>
</template>
