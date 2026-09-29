<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import { todayJakarta } from '~/lib/finance/dates'
import type { AllocationTarget } from '~/lib/finance/types'
import { formatMoneyMinor } from '~/lib/money'

/**
 * Money paid to a vendor: from which account, and which approved vendor invoices it settles. Only approved
 * invoices can be paid; anything not allocated is kept as a vendor deposit.
 */
const props = defineProps<{ open: boolean; vendorId?: string | null; vendorInvoiceId?: string | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const lookups = useFinanceLookups(() => props.open)
const today = todayJakarta()
const form = reactive({ vendorId: null as string | null, accountId: null as string | null, amount: '', date: today, reference: '', memo: '' })
const allocations = ref<Record<string, string>>({})
let idempotencyKey = newIdempotencyKey()

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  idempotencyKey = newIdempotencyKey()
  allocations.value = {}
  Object.assign(form, { vendorId: props.vendorId ?? null, accountId: lookups.accountOptions.value[0]?.value ?? null, amount: '', date: today, reference: '', memo: '' })
})
watch(() => lookups.accountOptions.value, (options) => {
  if (props.open && !form.accountId && options.length) { form.accountId = options[0]!.value }
}, { immediate: true })

const openInvoices = useFinanceQuery(
  async () => (await api.finance.payables({ vendorId: form.vendorId!, view: 'outstanding', limit: 100 })).data,
  { watch: [() => form.vendorId, () => props.open], enabled: () => props.open && !!form.vendorId }
)

const targets = computed<AllocationTarget[]>(() => (form.vendorId ? openInvoices.data.value ?? [] : []).map(inv => ({
  id: inv.id,
  title: inv.vendorInvoiceNumber,
  subtitle: inv.project?.name ?? inv.serviceOrderId ?? 'Tanpa project',
  dueDate: inv.dueDate,
  outstandingMinor: inv.outstandingMinor
})))

watch(targets, (list) => {
  if (!props.open || form.amount || !props.vendorInvoiceId) { return }
  const focus = list.find(t => t.id === props.vendorInvoiceId)
  if (focus) { form.amount = focus.outstandingMinor }
})

const account = computed(() => lookups.postableAccounts.value.find(a => a.id === form.accountId) ?? null)
const balanceAfter = computed(() => account.value?.balance.currentMinor && form.amount
  ? BigInt(account.value.balance.currentMinor) - BigInt(form.amount)
  : null)
const invalidAllocation = computed(() => {
  const total = Object.values(allocations.value).reduce((s, v) => s + BigInt(v || '0'), 0n)
  if (total > BigInt(form.amount || '0')) { return true }
  return targets.value.some(t => BigInt(allocations.value[t.id] || '0') > BigInt(t.outstandingMinor))
})

const action = useFinanceAction(() => api.finance.postVendorPayment({
  bankAccountId: form.accountId!,
  amountMinor: form.amount,
  effectiveDate: form.date,
  vendorId: form.vendorId!,
  reference: form.reference.trim() || undefined,
  memo: form.memo.trim() || undefined,
  allocations: Object.entries(allocations.value).filter(([, v]) => BigInt(v || '0') > 0n).map(([vendorInvoiceId, amountMinor]) => ({ vendorInvoiceId, amountMinor }))
}, idempotencyKey))

async function submit () {
  const result = await action.run()
  if (!result) { return }
  const r = result.data
  const deposit = BigInt(r.unallocatedMinor) > 0n ? ` ${formatMoneyMinor(r.unallocatedMinor)} dicatat sebagai deposit vendor.` : ''
  showToast('Pembayaran vendor dicatat', `${formatMoneyMinor(form.amount)} keluar dari ${account.value?.code ?? 'rekening'}, ${r.allocations.length} invoice terbayar.${deposit}`)
  emit('update:open', false)
}

const fieldAlloc = computed(() => Object.entries(action.error.value?.fieldErrors ?? {}).find(([k]) => k.startsWith('allocations'))?.[1]?.[0] ?? null)
</script>

<template>
  <FinanceFormDialog
    :open="open"
    title="Catat pembayaran ke vendor"
    description="Uang yang sudah keluar dari rekening perusahaan untuk vendor. Hanya invoice vendor yang sudah disetujui yang bisa dibayar."
    submit-label="Catat pembayaran"
    size="lg"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="!form.vendorId || !form.accountId || !form.amount || invalidAllocation || (balanceAfter !== null && balanceAfter < 0n)"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <FinanceField id="vp-vendor" label="Ke vendor" :error="action.fieldError('vendorId')" class="sm:col-span-2">
        <FinanceSelect id="vp-vendor" v-model="form.vendorId" :options="lookups.vendorOptions.value" placeholder="Pilih vendor" />
      </FinanceField>
      <FinanceField id="vp-amount" label="Nominal dibayar" :error="action.fieldError('amountMinor')">
        <FinanceMoneyInput id="vp-amount" v-model="form.amount" :invalid="!!action.fieldError('amountMinor')" />
      </FinanceField>
      <FinanceField id="vp-date" label="Tanggal uang keluar" :error="action.fieldError('effectiveDate')">
        <FinanceDateInput id="vp-date" v-model="form.date" :max="today" />
      </FinanceField>
      <FinanceField id="vp-account" label="Dari rekening" :error="action.fieldError('bankAccountId')">
        <FinanceSelect id="vp-account" v-model="form.accountId" :options="lookups.accountOptions.value" placeholder="Pilih rekening" />
      </FinanceField>
      <FinanceField id="vp-ref" label="No. referensi bank" optional :error="action.fieldError('reference')">
        <Input id="vp-ref" v-model="form.reference" class="h-10" maxlength="120" placeholder="mis. MDR/OUT/0512" />
      </FinanceField>
    </div>

    <FinanceAllocationList
      v-if="form.vendorId"
      v-model="allocations"
      :targets="targets"
      :amount="form.amount"
      :today="today"
      :loading="openInvoices.pending.value && !openInvoices.loaded.value"
      :focus-id="vendorInvoiceId"
      leftover-label="Jadi deposit vendor"
    />
    <p v-if="fieldAlloc" class="text-xs font-medium text-destructive" role="alert">
      {{ fieldAlloc }}
    </p>

    <FinanceField id="vp-memo" label="Catatan" optional>
      <Input id="vp-memo" v-model="form.memo" class="h-10" maxlength="500" />
    </FinanceField>

    <template v-if="balanceAfter !== null" #summary>
      <div class="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span class="text-muted-foreground">Saldo {{ account?.code }} setelah ini</span>
        <FinanceAmount :value="balanceAfter.toString()" class="font-semibold" :class="balanceAfter < 0n && 'text-destructive'" />
      </div>
      <p v-if="balanceAfter < 0n" class="mt-1 text-xs font-medium text-destructive" role="alert">
        Saldo rekening tidak cukup untuk pembayaran ini.
      </p>
    </template>
  </FinanceFormDialog>
</template>
