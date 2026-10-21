<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import { todayJakarta } from '~/lib/finance/dates'
import { CATEGORY_LABEL } from '~/lib/finance/labels'
import { exceedsStaffLimit, STAFF_ACTION, staffActionLimit, type StaffAction } from '~/lib/finance/staff-funds'
import { formatMoneyMinor } from '~/lib/money'
import type { ApiExpenseCategory, StaffFundsDto } from '~/types/api'

/**
 * One form for the four kasbon actions. The owner states what happened (who, how much, which receipt); the server
 * books cash and cost. No account or debit/credit choice.
 */
const props = defineProps<{ open: boolean; action: StaffAction; employeeId: string | null; funds: StaffFundsDto | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const lookups = useFinanceLookups(() => props.open)
const today = todayJakarta()
const employees = useFinanceQuery(async () => (await api.core.listEmployees()).data, {
  enabled: () => props.open, watch: [() => props.open]
})
const COMPANY = ['office', 'marketing', 'technology', 'travel', 'professional', 'bank_fee', 'tax', 'other'] as const
const form = reactive({
  employeeId: null as string | null,
  accountId: null as string | null,
  projectId: null as string | null,
  category: 'office' as string,
  amount: '',
  date: today,
  evidenceRef: '',
  description: ''
})
let idempotencyKey = newIdempotencyKey()

watch(() => props.open, (open) => {
  if (!open) { return }
  command.reset()
  idempotencyKey = newIdempotencyKey()
  const row = props.funds?.employees.find(e => e.employeeId === props.employeeId)
  const limit = staffActionLimit(props.action, row)
  Object.assign(form, {
    employeeId: props.employeeId,
    accountId: lookups.accountOptions.value[0]?.value ?? null,
    projectId: null,
    category: 'office',
    amount: limit && BigInt(limit) > 0n ? limit : '',
    date: today,
    evidenceRef: '',
    description: ''
  })
})
watch(() => lookups.accountOptions.value, (options) => {
  if (props.open && !form.accountId && options.length) { form.accountId = options[0]!.value }
}, { immediate: true })

const kind = computed(() => props.action)
const isClaim = computed(() => props.action === 'expense_claim')
const row = computed(() => props.funds?.employees.find(e => e.employeeId === form.employeeId))
const limit = computed(() => staffActionLimit(props.action, row.value))
const over = computed(() => exceedsStaffLimit(props.action, row.value, form.amount))
const employeeOptions = computed(() => (employees.data.value ?? []).filter(e => e.status !== 'resigned' || props.action !== 'employee_advance')
  .map(e => ({ value: e.id, label: e.name, hint: e.position })))
const categoryOptions = COMPANY.map(c => ({ value: c, label: CATEGORY_LABEL[c as ApiExpenseCategory] }))

/** Both commands answer with the employee's new net position, which is all the toast needs. */
const command = useFinanceAction(async (): Promise<string> => {
  if (isClaim.value) {
    return (await api.finance.recordExpenseClaim({
      employeeId: form.employeeId!,
      ...(form.projectId ? { projectId: form.projectId } : {}),
      category: form.projectId ? 'trip' : form.category,
      amountMinor: form.amount,
      spentOn: form.date,
      evidenceRef: form.evidenceRef.trim(),
      description: form.description.trim()
    }, idempotencyKey)).data.netMinor
  }
  return (await api.finance.postStaffCash(props.action as Exclude<StaffAction, 'expense_claim'>, {
    bankAccountId: form.accountId!,
    employeeId: form.employeeId!,
    ...(form.projectId ? { projectId: form.projectId } : {}),
    amountMinor: form.amount,
    effectiveDate: form.date,
    memo: form.description.trim() || undefined
  }, idempotencyKey)).data.netMinor
})

async function submit () {
  const netMinor = await command.run()
  if (netMinor === undefined) { return }
  const net = BigInt(netMinor)
  showToast(STAFF_ACTION[props.action].title, net > 0n
    ? `Masih dipegang karyawan ${formatMoneyMinor(net.toString())}.`
    : net < 0n ? `Perusahaan berutang reimbursement ${formatMoneyMinor((-net).toString())}.` : 'Uang jalan karyawan ini sudah selesai.')
  emit('update:open', false)
}
const disabled = computed(() => !form.employeeId || !form.amount || !form.date || over.value ||
  (isClaim.value ? form.evidenceRef.trim().length < 3 || form.description.trim().length < 3 : !form.accountId))
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="STAFF_ACTION[kind].title"
    :description="STAFF_ACTION[kind].consequence"
    :submit-label="STAFF_ACTION[kind].submit"
    :pending="command.pending.value"
    :error="command.error.value"
    :submit-disabled="disabled"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid gap-4">
      <FinanceField id="sa-employee" label="Karyawan" :error="command.fieldError('employeeId')">
        <FinanceSelect id="sa-employee" v-model="form.employeeId" :options="employeeOptions" placeholder="Pilih karyawan" />
      </FinanceField>
      <FinanceField v-if="!isClaim" id="sa-account" :label="kind === 'employee_advance_return' ? 'Masuk ke rekening' : 'Dari rekening'" :error="command.fieldError('bankAccountId')">
        <FinanceSelect id="sa-account" v-model="form.accountId" :options="lookups.accountOptions.value" />
      </FinanceField>
      <FinanceField
        v-if="kind === 'employee_advance' || isClaim"
        id="sa-project"
        label="Project"
        optional
        :error="command.fieldError('projectId')"
        :hint="isClaim ? 'Isi bila biaya perjalanan project; kosongkan untuk biaya kantor.' : undefined"
      >
        <FinanceSelect id="sa-project" v-model="form.projectId" :options="lookups.projectOptions.value" clear-label="Tanpa project" />
      </FinanceField>
      <FinanceField v-if="isClaim && !form.projectId" id="sa-category" label="Jenis biaya kantor" :error="command.fieldError('category')">
        <FinanceSelect id="sa-category" v-model="form.category" :options="categoryOptions" />
      </FinanceField>
      <div class="grid gap-4 sm:grid-cols-2">
        <FinanceField id="sa-amount" label="Nominal" :error="command.fieldError('amountMinor')" :hint="limit !== null ? `Maksimal ${formatMoneyMinor(limit)}.` : undefined">
          <FinanceMoneyInput id="sa-amount" v-model="form.amount" :invalid="over || !!command.fieldError('amountMinor')" />
        </FinanceField>
        <FinanceField id="sa-date" :label="isClaim ? 'Tanggal pengeluaran' : 'Tanggal'" :error="command.fieldError(isClaim ? 'spentOn' : 'effectiveDate')">
          <FinanceDateInput id="sa-date" v-model="form.date" :max="today" />
        </FinanceField>
      </div>
      <FinanceField v-if="isClaim" id="sa-evidence" label="Nomor / identitas bukti" :error="command.fieldError('evidenceRef')" hint="Bukti yang sama tidak bisa dipertanggungjawabkan dua kali.">
        <Input id="sa-evidence" v-model="form.evidenceRef" maxlength="120" />
      </FinanceField>
      <FinanceField id="sa-desc" :label="isClaim ? 'Untuk apa' : 'Catatan'" :optional="!isClaim" :error="command.fieldError('description')">
        <FinanceTextarea id="sa-desc" v-model="form.description" :rows="2" maxlength="500" />
      </FinanceField>
    </div>
  </FinanceFormDialog>
</template>
