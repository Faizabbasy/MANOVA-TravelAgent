<script setup lang="ts">
import type { ApiInvoiceType } from '~/types/api'
import { todayJakarta } from '~/lib/finance/dates'
import { INVOICE_TYPE_LABEL } from '~/lib/finance/labels'

/**
 * Plan a billing term for a project (e.g. "DP 30%" on a date). A plan is not a receivable; it becomes one when
 * an invoice is created from it and issued. Keeps "what is still to be billed" honest.
 */
const props = defineProps<{ open: boolean; projectId?: string | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const lookups = useFinanceLookups(() => props.open)
const today = todayJakarta()
const form = reactive({ projectId: null as string | null, label: '', invoiceType: 'dp' as ApiInvoiceType, amount: '', plannedDate: today })

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  Object.assign(form, { projectId: props.projectId ?? null, label: '', invoiceType: 'dp', amount: '', plannedDate: today })
})

const typeOptions = (Object.keys(INVOICE_TYPE_LABEL) as ApiInvoiceType[]).map(t => ({ value: t, label: INVOICE_TYPE_LABEL[t] }))

const action = useFinanceAction(() => api.finance.createScheduleItem({
  projectId: form.projectId!, label: form.label.trim(), invoiceType: form.invoiceType, amountMinor: form.amount, plannedDate: form.plannedDate
}))

async function submit () {
  if (!(await action.run())) { return }
  showToast('Rencana tagihan ditambahkan', `${form.label.trim()} siap ditagih pada tanggal rencananya.`)
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    title="Tambah rencana tagihan"
    description="Termin yang akan ditagih ke customer, mis. DP 30% dan pelunasan. Belum dihitung sebagai tagihan sampai invoice-nya diterbitkan."
    submit-label="Simpan rencana"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="!form.projectId || !form.label.trim() || !form.amount"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <FinanceField id="sch-project" label="Project" :error="action.fieldError('projectId')">
      <FinanceSelect id="sch-project" v-model="form.projectId" :options="lookups.projectOptions.value" placeholder="Pilih project" />
    </FinanceField>
    <div class="grid gap-4 sm:grid-cols-[1fr_11rem]">
      <FinanceField id="sch-label" label="Nama termin" :error="action.fieldError('label')">
        <Input id="sch-label" v-model="form.label" class="h-10" maxlength="120" placeholder="mis. DP 30%" />
      </FinanceField>
      <FinanceField id="sch-type" label="Jenis">
        <FinanceSelect id="sch-type" :model-value="form.invoiceType" :options="typeOptions" @update:model-value="v => v && (form.invoiceType = v as ApiInvoiceType)" />
      </FinanceField>
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <FinanceField id="sch-amount" label="Nominal" :error="action.fieldError('amountMinor')">
        <FinanceMoneyInput id="sch-amount" v-model="form.amount" :invalid="!!action.fieldError('amountMinor')" />
      </FinanceField>
      <FinanceField id="sch-date" label="Rencana ditagih" :error="action.fieldError('plannedDate')">
        <FinanceDateInput id="sch-date" v-model="form.plannedDate" />
      </FinanceField>
    </div>
  </FinanceFormDialog>
</template>
