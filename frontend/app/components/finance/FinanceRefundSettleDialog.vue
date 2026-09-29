<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import type { RefundDetailDto } from '~/types/api'
import { todayJakarta } from '~/lib/finance/dates'
import { formatMoneyMinor } from '~/lib/money'

/** Pay an approved refund (fully or partly): real money out of a company account, recorded once. */
const props = defineProps<{ open: boolean; refund: RefundDetailDto | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const lookups = useFinanceLookups(() => props.open)
const today = todayJakarta()
const form = reactive({ accountId: null as string | null, amount: '', date: today, recipient: '', reference: '' })
let idempotencyKey = newIdempotencyKey()

watch(() => props.open, (open) => {
  if (!open || !props.refund) { return }
  action.reset()
  idempotencyKey = newIdempotencyKey()
  Object.assign(form, { accountId: lookups.accountOptions.value[0]?.value ?? null, amount: props.refund.outstandingMinor, date: today, recipient: props.refund.party.name, reference: '' })
})
watch(() => lookups.accountOptions.value, (options) => {
  if (props.open && !form.accountId && options.length) { form.accountId = options[0]!.value }
}, { immediate: true })

const account = computed(() => lookups.postableAccounts.value.find(a => a.id === form.accountId) ?? null)
const balanceAfter = computed(() => (account.value?.balance.currentMinor && form.amount ? BigInt(account.value.balance.currentMinor) - BigInt(form.amount) : null))
const tooMuch = computed(() => !!props.refund && !!form.amount && BigInt(form.amount) > BigInt(props.refund.outstandingMinor))

const action = useFinanceAction(() => api.finance.settleRefund(props.refund!.id, {
  bankAccountId: form.accountId!,
  amountMinor: form.amount,
  effectiveDate: form.date,
  recipient: form.recipient.trim() || undefined,
  reference: form.reference.trim() || undefined
}, idempotencyKey))

async function submit () {
  const res = await action.run()
  if (!res) { return }
  const left = BigInt(res.data.outstandingMinor)
  showToast('Refund dibayar', `${formatMoneyMinor(res.data.amountMinor)} keluar dari ${account.value?.code ?? 'rekening'}.${left > 0n ? ` Sisa refund ${formatMoneyMinor(res.data.outstandingMinor)}.` : ' Refund lunas.'}`)
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="`Bayar refund ${refund?.id ?? ''}`"
    :description="`Uang dikembalikan ke ${refund?.party.name ?? 'customer'}. Bisa dibayar sebagian; sisanya tetap tercatat sampai lunas.`"
    submit-label="Catat pembayaran refund"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="!form.accountId || !form.amount || tooMuch || (balanceAfter !== null && balanceAfter < 0n)"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <FinanceField id="rs-amount" label="Nominal dibayar" :error="action.fieldError('amountMinor') ?? (tooMuch ? `Maksimal ${formatMoneyMinor(refund?.outstandingMinor ?? '0')}` : null)">
        <FinanceMoneyInput id="rs-amount" v-model="form.amount" :invalid="tooMuch" />
      </FinanceField>
      <FinanceField id="rs-date" label="Tanggal transfer" :error="action.fieldError('effectiveDate')">
        <FinanceDateInput id="rs-date" v-model="form.date" :min="account?.opening.date ?? undefined" :max="today" />
      </FinanceField>
      <FinanceField id="rs-account" label="Dari rekening" :error="action.fieldError('bankAccountId')">
        <FinanceSelect id="rs-account" v-model="form.accountId" :options="lookups.accountOptions.value" placeholder="Pilih rekening" />
      </FinanceField>
      <FinanceField id="rs-ref" label="No. referensi bank" optional>
        <Input id="rs-ref" v-model="form.reference" class="h-10" maxlength="120" />
      </FinanceField>
      <FinanceField id="rs-recipient" label="Penerima" optional hint="Nama pemilik rekening tujuan." class="sm:col-span-2">
        <Input id="rs-recipient" v-model="form.recipient" class="h-10" maxlength="200" />
      </FinanceField>
    </div>
    <template v-if="balanceAfter !== null" #summary>
      <div class="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span class="text-muted-foreground">Saldo {{ account?.code }} setelah ini</span>
        <FinanceAmount :value="balanceAfter.toString()" class="font-semibold" :class="balanceAfter < 0n && 'text-destructive'" />
      </div>
    </template>
  </FinanceFormDialog>
</template>
