<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import { newIdempotencyKey } from '~/lib/api/client'
import { todayJakarta } from '~/lib/finance/dates'
import { formatMoneyMinor } from '~/lib/money'
import type { TransferFeeQuote } from '~/types/api'

/**
 * Move money between two company accounts. One action, two legs (out + in) plus an optional bank fee — company
 * cash only drops by the fee. The preview shows both balances after the transfer before anything is posted.
 * The fee follows the direction's rule (the server quotes it); leaving the field empty applies that rule, and a
 * typed fee is kept as the bank's actual charge.
 */
const props = defineProps<{ open: boolean; fromAccountId?: string | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const lookups = useFinanceLookups(() => props.open)
const today = todayJakarta()
const form = reactive({ from: null as string | null, to: null as string | null, amount: '', fee: '', date: today, memo: '' })
let idempotencyKey = newIdempotencyKey()

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  idempotencyKey = newIdempotencyKey() // one key per intent: a retry of this submission never posts twice
  Object.assign(form, { from: props.fromAccountId ?? null, to: null, amount: '', fee: '', date: today, memo: '' })
})

const accounts = computed(() => lookups.postableAccounts.value)
const fromAccount = computed(() => accounts.value.find(a => a.id === form.from) ?? null)
const toAccount = computed(() => accounts.value.find(a => a.id === form.to) ?? null)
/** Both accounts must already have their books open on the transfer date. */
const minDate = computed(() => [fromAccount.value?.opening.date, toAccount.value?.opening.date].filter((d): d is string => !!d).sort().pop())
const toOptions = computed(() => lookups.accountOptions.value.filter(o => o.value !== form.from))

// Quote for this direction, amount and date (debounced; stale answers are dropped).
const quote = ref<TransferFeeQuote | null>(null)
let quoteSeq = 0
let quoteTimer: ReturnType<typeof setTimeout> | undefined
watch(() => [props.open, form.from, form.to, form.amount, form.date] as const, ([open, from, to, amount, date]) => {
  clearTimeout(quoteTimer)
  const seq = ++quoteSeq
  quote.value = null
  if (!open || !from || !to || !amount || amount === '0' || !date) { return }
  quoteTimer = setTimeout(async () => {
    try {
      const q = await api.finance.quoteTransferFee({ fromAccountId: from, toAccountId: to, amountMinor: amount, effectiveDate: date })
      if (seq === quoteSeq) { quote.value = q.data }
    } catch { /* the transfer itself still validates; the hint just stays generic */ }
  }, 300)
})
onBeforeUnmount(() => clearTimeout(quoteTimer))

const feeHint = computed(() => {
  const q = quote.value
  if (!q) { return 'Dipotong dari rekening asal.' }
  if (!q.rule) { return `Belum ada aturan biaya untuk arah ${fromAccount.value?.code} → ${toAccount.value?.code}. Isi bila bank memotong biaya.` }
  const rule = q.rule.feeType === 'fixed' ? 'biaya tetap' : `${(q.rule.percentBasisPoints! / 100).toLocaleString('id-ID')}%`
  return `Aturan ${fromAccount.value?.code} → ${toAccount.value?.code} (${rule}): ${formatMoneyMinor(q.feeMinor)}. Kosongkan untuk memakai aturan; isi bila bank memotong berbeda.`
})
/** The fee the server will post: the typed one, else the rule's quote. */
const effectiveFee = computed(() => form.fee !== '' ? form.fee : (quote.value?.feeMinor ?? '0'))

const preview = computed(() => {
  if (!fromAccount.value?.balance.currentMinor || !form.amount) { return null }
  const amount = BigInt(form.amount)
  const fee = BigInt(effectiveFee.value)
  const fromAfter = BigInt(fromAccount.value.balance.currentMinor) - amount - fee
  const toAfter = toAccount.value?.balance.currentMinor ? BigInt(toAccount.value.balance.currentMinor) + amount : null
  return { fromAfter, toAfter, shortfall: fromAfter < 0n }
})

const action = useFinanceAction(() => api.finance.postTransfer({
  fromAccountId: form.from!,
  toAccountId: form.to!,
  amountMinor: form.amount,
  feeMinor: form.fee || undefined,
  effectiveDate: form.date,
  memo: form.memo.trim() || undefined
}, idempotencyKey))

async function submit () {
  const done = await action.run()
  if (!done) { return }
  showToast('Transfer dicatat', `${formatMoneyMinor(form.amount)} dari ${fromAccount.value?.code} ke ${toAccount.value?.code}.`)
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    title="Transfer antar rekening"
    description="Memindahkan uang antar rekening perusahaan. Total kas tidak berubah, kecuali sebesar biaya transfer."
    submit-label="Catat transfer"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="!form.from || !form.to || !form.amount"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <FinanceField id="tr-from" label="Dari rekening" :error="action.fieldError('fromAccountId')">
        <FinanceSelect id="tr-from" v-model="form.from" :options="lookups.accountOptions.value" placeholder="Pilih rekening asal" />
      </FinanceField>
      <ArrowRight class="mx-auto mb-3 hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden="true" />
      <FinanceField id="tr-to" label="Ke rekening" :error="action.fieldError('toAccountId')">
        <FinanceSelect id="tr-to" v-model="form.to" :options="toOptions" placeholder="Pilih rekening tujuan" :disabled="!form.from" />
      </FinanceField>
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <FinanceField id="tr-amount" label="Nominal transfer" :error="action.fieldError('amountMinor')">
        <FinanceMoneyInput id="tr-amount" v-model="form.amount" :invalid="!!action.fieldError('amountMinor')" />
      </FinanceField>
      <FinanceField id="tr-fee" label="Biaya transfer" optional :error="action.fieldError('feeMinor')" :hint="feeHint">
        <FinanceMoneyInput id="tr-fee" v-model="form.fee" :placeholder="quote?.rule ? Number(quote.feeMinor).toLocaleString('id-ID') : '0'" />
      </FinanceField>
      <FinanceField id="tr-date" label="Tanggal transfer" :error="action.fieldError('effectiveDate')">
        <FinanceDateInput id="tr-date" v-model="form.date" :min="minDate" :max="today" />
      </FinanceField>
      <FinanceField id="tr-memo" label="Keterangan" optional>
        <Input id="tr-memo" v-model="form.memo" class="h-10" maxlength="500" placeholder="mis. Top up rekening vendor" />
      </FinanceField>
    </div>

    <template v-if="preview" #summary>
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Saldo setelah transfer
      </p>
      <dl class="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <div class="flex items-baseline justify-between gap-3 sm:block">
          <dt class="text-muted-foreground">
            {{ fromAccount?.code }}
          </dt>
          <dd :class="preview.shortfall ? 'font-semibold text-destructive' : 'font-semibold'">
            <FinanceAmount :value="preview.fromAfter.toString()" />
          </dd>
        </div>
        <div v-if="preview.toAfter !== null" class="flex items-baseline justify-between gap-3 sm:block">
          <dt class="text-muted-foreground">
            {{ toAccount?.code }}
          </dt>
          <dd class="font-semibold">
            <FinanceAmount :value="preview.toAfter.toString()" />
          </dd>
        </div>
      </dl>
      <p class="mt-2 text-xs text-muted-foreground">
        {{ `Biaya transfer ${formatMoneyMinor(effectiveFee)}${form.fee === '' && quote?.rule ? ' sesuai aturan' : ''}.` }}
      </p>
      <p v-if="preview.shortfall" class="mt-2 text-xs font-medium text-destructive" role="alert">
        Saldo {{ fromAccount?.code }} tidak cukup untuk transfer dan biayanya.
      </p>
    </template>
  </FinanceFormDialog>
</template>
