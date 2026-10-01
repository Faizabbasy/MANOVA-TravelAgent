<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import type { ApiExpenseCategory } from '~/types/api'
import { todayJakarta } from '~/lib/finance/dates'
import { CATEGORY_LABEL } from '~/lib/finance/labels'
import { formatMoneyMinor } from '~/lib/money'

/**
 * Money in or out that is not an invoice payment: operating expenses (rent, salaries, ads…) and other income
 * (commissions, interest). Expenses may be linked to a project so they count in its profitability.
 * From a project's Pengeluaran tab the project is fixed (`projectId`) and the categories are narrowed.
 */
const props = defineProps<{ open: boolean; kind: 'expense' | 'other_income'; projectId?: string; categories?: ApiExpenseCategory[] }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const lookups = useFinanceLookups(() => props.open)
const today = todayJakarta()
const isExpense = computed(() => props.kind === 'expense')
const form = reactive({
  accountId: null as string | null,
  amount: '',
  date: today,
  category: null as string | null,
  counterparty: '',
  projectId: null as string | null,
  reference: '',
  memo: ''
})
let idempotencyKey = newIdempotencyKey()

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  idempotencyKey = newIdempotencyKey()
  Object.assign(form, { accountId: lookups.accountOptions.value[0]?.value ?? null, amount: '', date: today, category: null, counterparty: '', projectId: props.projectId ?? null, reference: '', memo: '' })
})
watch(() => lookups.accountOptions.value, (options) => {
  if (props.open && !form.accountId && options.length) { form.accountId = options[0]!.value }
}, { immediate: true })

const categoryOptions = computed(() => (props.categories ?? (Object.keys(CATEGORY_LABEL) as ApiExpenseCategory[])).map(c => ({ value: c, label: CATEGORY_LABEL[c] })))
const account = computed(() => lookups.postableAccounts.value.find(a => a.id === form.accountId) ?? null)
const balanceAfter = computed(() => {
  if (!account.value?.balance.currentMinor || !form.amount) { return null }
  const balance = BigInt(account.value.balance.currentMinor)
  return isExpense.value ? balance - BigInt(form.amount) : balance + BigInt(form.amount)
})

const action = useFinanceAction(() => api.finance.postTransaction({
  bankAccountId: form.accountId!,
  kind: props.kind,
  amountMinor: form.amount,
  effectiveDate: form.date,
  category: isExpense.value ? (form.category as ApiExpenseCategory) : undefined,
  counterparty: form.counterparty.trim() || undefined,
  projectId: form.projectId ?? undefined,
  reference: form.reference.trim() || undefined,
  memo: form.memo.trim() || undefined
}, idempotencyKey))

async function submit () {
  const done = await action.run()
  if (!done) { return }
  showToast(isExpense.value ? 'Pengeluaran dicatat' : 'Pemasukan dicatat',
    `${formatMoneyMinor(form.amount)} ${isExpense.value ? 'keluar dari' : 'masuk ke'} ${account.value?.code ?? 'rekening'}.`)
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="isExpense ? 'Catat pengeluaran' : 'Catat pemasukan lain'"
    :description="isExpense ? 'Biaya operasional yang sudah dibayar: sewa, gaji, iklan, software, dan sejenisnya. Pembayaran invoice vendor dicatat lewat “Pembayaran vendor”.' : 'Uang masuk yang bukan pembayaran invoice customer, mis. komisi maskapai atau bunga bank.'"
    :submit-label="isExpense ? 'Catat pengeluaran' : 'Catat pemasukan'"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="!form.accountId || !form.amount || (isExpense && !form.category) || (balanceAfter !== null && balanceAfter < 0n)"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <FinanceField v-if="isExpense" id="mt-category" label="Kategori" :error="action.fieldError('category')" class="sm:col-span-2">
        <FinanceSelect id="mt-category" v-model="form.category" :options="categoryOptions" placeholder="Pilih kategori pengeluaran" />
      </FinanceField>
      <FinanceField id="mt-amount" label="Nominal" :error="action.fieldError('amountMinor')">
        <FinanceMoneyInput id="mt-amount" v-model="form.amount" :invalid="!!action.fieldError('amountMinor')" />
      </FinanceField>
      <FinanceField id="mt-date" label="Tanggal" :error="action.fieldError('effectiveDate')">
        <FinanceDateInput id="mt-date" v-model="form.date" :min="account?.opening.date ?? undefined" :max="today" />
      </FinanceField>
      <FinanceField id="mt-account" :label="isExpense ? 'Dari rekening' : 'Masuk ke rekening'" :error="action.fieldError('bankAccountId')">
        <FinanceSelect id="mt-account" v-model="form.accountId" :options="lookups.accountOptions.value" placeholder="Pilih rekening" />
      </FinanceField>
      <FinanceField id="mt-counterparty" :label="isExpense ? 'Dibayar ke' : 'Diterima dari'" optional :error="action.fieldError('counterparty')">
        <Input id="mt-counterparty" v-model="form.counterparty" class="h-10" maxlength="200" :placeholder="isExpense ? 'mis. PT Graha Perkantoran' : 'mis. Korean Air'" />
      </FinanceField>
      <FinanceField
        v-if="isExpense && !projectId"
        id="mt-project"
        label="Untuk project"
        optional
        hint="Biaya project ikut dihitung di profitabilitas project."
        class="sm:col-span-2"
      >
        <FinanceSelect id="mt-project" v-model="form.projectId" :options="lookups.projectOptions.value" clear-label="Biaya umum (tanpa project)" placeholder="Biaya umum (tanpa project)" />
      </FinanceField>
      <FinanceField id="mt-ref" label="No. referensi" optional :error="action.fieldError('reference')">
        <Input id="mt-ref" v-model="form.reference" class="h-10" maxlength="120" />
      </FinanceField>
      <FinanceField id="mt-memo" label="Keterangan" optional>
        <Input id="mt-memo" v-model="form.memo" class="h-10" maxlength="500" placeholder="mis. Sewa kantor Oktober" />
      </FinanceField>
    </div>

    <template v-if="balanceAfter !== null" #summary>
      <div class="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span class="text-muted-foreground">Saldo {{ account?.code }} setelah ini</span>
        <FinanceAmount :value="balanceAfter.toString()" class="font-semibold" :class="balanceAfter < 0n && 'text-destructive'" />
      </div>
      <p v-if="balanceAfter < 0n" class="mt-1 text-xs font-medium text-destructive" role="alert">
        Saldo rekening tidak cukup.
      </p>
    </template>
  </FinanceFormDialog>
</template>
