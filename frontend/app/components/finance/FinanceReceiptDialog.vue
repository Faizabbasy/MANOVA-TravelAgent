<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import { todayJakarta } from '~/lib/finance/dates'
import { INVOICE_TYPE_LABEL } from '~/lib/finance/labels'
import type { AllocationTarget } from '~/lib/finance/types'
import { formatMoneyMinor } from '~/lib/money'

/**
 * Money received from a customer: which account it landed in, and which invoices it pays. What is not
 * allocated becomes the customer's advance (uang muka) and can be applied to an invoice later.
 */
const props = defineProps<{ open: boolean; partyId?: string | null; invoiceId?: string | null; projectId?: string | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const lookups = useFinanceLookups(() => props.open)
const today = todayJakarta()
const form = reactive({ partyId: null as string | null, accountId: null as string | null, amount: '', date: today, projectId: null as string | null, reference: '', memo: '' })
const allocations = ref<Record<string, string>>({})
let idempotencyKey = newIdempotencyKey()

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  idempotencyKey = newIdempotencyKey()
  allocations.value = {}
  Object.assign(form, { partyId: props.partyId ?? null, accountId: lookups.accountOptions.value[0]?.value ?? null, amount: '', date: today, projectId: props.projectId ?? null, reference: '', memo: '' })
})

// Default the account when there is exactly one sensible choice.
watch(() => lookups.accountOptions.value, (options) => {
  if (props.open && !form.accountId && options.length) { form.accountId = options[0]!.value }
}, { immediate: true })

const openInvoices = useFinanceQuery(
  async () => (await api.finance.receivables({ partyId: form.partyId!, settlement: 'outstanding', limit: 100 })).data,
  { watch: [() => form.partyId, () => props.open], enabled: () => props.open && !!form.partyId }
)

const targets = computed<AllocationTarget[]>(() => (form.partyId ? openInvoices.data.value ?? [] : []).map(inv => ({
  id: inv.id,
  title: inv.number ?? inv.id,
  subtitle: `${INVOICE_TYPE_LABEL[inv.invoiceType]} · ${inv.project.name}`,
  dueDate: inv.dueDate,
  outstandingMinor: inv.outstandingMinor
})))

// Prefill the amount with what the focused invoice still owes.
watch(targets, (list) => {
  if (!props.open || form.amount || !props.invoiceId) { return }
  const focus = list.find(t => t.id === props.invoiceId)
  if (focus) { form.amount = focus.outstandingMinor }
})

const account = computed(() => lookups.postableAccounts.value.find(a => a.id === form.accountId) ?? null)
const balanceAfter = computed(() => account.value?.balance.currentMinor && form.amount
  ? (BigInt(account.value.balance.currentMinor) + BigInt(form.amount)).toString()
  : null)
const allocatedTotal = computed(() => Object.values(allocations.value).reduce((s, v) => s + BigInt(v || '0'), 0n))
const invalidAllocation = computed(() => {
  if (allocatedTotal.value > BigInt(form.amount || '0')) { return true }
  return targets.value.some(t => BigInt(allocations.value[t.id] || '0') > BigInt(t.outstandingMinor))
})

const action = useFinanceAction(() => api.finance.postReceipt({
  bankAccountId: form.accountId!,
  amountMinor: form.amount,
  effectiveDate: form.date,
  partyId: form.partyId!,
  projectId: form.projectId ?? undefined,
  reference: form.reference.trim() || undefined,
  memo: form.memo.trim() || undefined,
  allocations: Object.entries(allocations.value).filter(([, v]) => BigInt(v || '0') > 0n).map(([invoiceId, amountMinor]) => ({ invoiceId, amountMinor }))
}, idempotencyKey))

async function submit () {
  const result = await action.run()
  if (!result) { return }
  const r = result.data
  const advance = BigInt(r.unallocatedMinor) > 0n ? ` ${formatMoneyMinor(r.unallocatedMinor)} dicatat sebagai uang muka.` : ''
  showToast('Pembayaran customer dicatat', `${formatMoneyMinor(form.amount)} masuk ke ${account.value?.code ?? 'rekening'}, ${r.allocations.length} tagihan terbayar.${advance}`)
  emit('update:open', false)
}

const fieldAlloc = computed(() => Object.entries(action.error.value?.fieldErrors ?? {}).find(([k]) => k.startsWith('allocations'))?.[1]?.[0] ?? null)
</script>

<template>
  <FinanceFormDialog
    :open="open"
    title="Catat pembayaran dari customer"
    description="Uang yang sudah masuk ke rekening perusahaan. Pilih tagihan yang dibayar; sisanya disimpan sebagai uang muka customer."
    submit-label="Catat pembayaran"
    size="lg"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="!form.partyId || !form.accountId || !form.amount || invalidAllocation"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <FinanceField id="rc-party" label="Dari customer" :error="action.fieldError('partyId')" class="sm:col-span-2">
        <FinanceSelect id="rc-party" v-model="form.partyId" :options="lookups.partyOptions.value" placeholder="Pilih customer" />
      </FinanceField>
      <FinanceField id="rc-amount" label="Nominal diterima" :error="action.fieldError('amountMinor')">
        <FinanceMoneyInput id="rc-amount" v-model="form.amount" :invalid="!!action.fieldError('amountMinor')" />
      </FinanceField>
      <FinanceField id="rc-date" label="Tanggal uang masuk" :error="action.fieldError('effectiveDate')">
        <FinanceDateInput id="rc-date" v-model="form.date" :max="today" />
      </FinanceField>
      <FinanceField id="rc-account" label="Masuk ke rekening" :error="action.fieldError('bankAccountId')">
        <FinanceSelect id="rc-account" v-model="form.accountId" :options="lookups.accountOptions.value" placeholder="Pilih rekening" />
      </FinanceField>
      <FinanceField id="rc-ref" label="No. referensi bank" optional :error="action.fieldError('reference')">
        <Input id="rc-ref" v-model="form.reference" class="h-10" maxlength="120" placeholder="mis. BCA/TRF/1024" />
      </FinanceField>
    </div>

    <FinanceAllocationList
      v-if="form.partyId"
      v-model="allocations"
      :targets="targets"
      :amount="form.amount"
      :today="today"
      :loading="openInvoices.pending.value && !openInvoices.loaded.value"
      :focus-id="invoiceId"
      leftover-label="Jadi uang muka customer"
    />
    <p v-if="fieldAlloc" class="text-xs font-medium text-destructive" role="alert">
      {{ fieldAlloc }}
    </p>

    <details class="group rounded-lg border border-border px-3 py-2 text-sm">
      <summary class="cursor-pointer select-none text-[13px] font-medium text-muted-foreground group-open:text-foreground">
        Project & catatan (opsional)
      </summary>
      <div class="mt-3 grid gap-4 pb-1 sm:grid-cols-2">
        <FinanceField id="rc-project" label="Untuk project" optional hint="Membantu melacak uang muka per project.">
          <FinanceSelect id="rc-project" v-model="form.projectId" :options="lookups.projectsOfParty(form.partyId)" clear-label="Tanpa project" placeholder="Tanpa project" />
        </FinanceField>
        <FinanceField id="rc-memo" label="Catatan" optional>
          <Input id="rc-memo" v-model="form.memo" class="h-10" maxlength="500" />
        </FinanceField>
      </div>
    </details>

    <template v-if="balanceAfter" #summary>
      <div class="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span class="text-muted-foreground">Saldo {{ account?.code }} setelah ini</span>
        <FinanceAmount :value="balanceAfter" class="font-semibold" />
      </div>
    </template>
  </FinanceFormDialog>
</template>
