<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import { todayJakarta } from '~/lib/finance/dates'
import {
  ACCOUNTING_STATUS_NOTE, WHOLE_SOURCE, buildFulfillmentInput, exceedsContractRight, fulfillmentConsequence, fulfillmentPrefill,
  fulfillmentSources, needsVendorChoice
} from '~/lib/finance/fulfillment'
import { formatMoneyMinor } from '~/lib/money'
import type { FulfillmentOverviewDto, FulfillmentSide } from '~/types/api'

/**
 * "Jasa diberikan" (customer) or "Jasa supplier diterima" (supplier): one business fact, prefilled from the
 * project's bookings and service orders. The server derives revenue/cost and journals; the owner never picks
 * debit/credit accounts. Recording a fact moves no money and does not mark anything paid.
 */
const props = defineProps<{ open: boolean; side: FulfillmentSide; projectId?: string; salesOrderId?:string; overview: FulfillmentOverviewDto | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const lookups = useFinanceLookups(() => props.open && props.side === 'supplier')
const today = todayJakarta()
const form = reactive({ source: WHOLE_SOURCE as string | null, vendorId: null as string | null, amount: '', date: today, basis: 'actual' as 'actual' | 'estimate', isFinal: false, evidence: '' })
let idempotencyKey = newIdempotencyKey()

const customer = computed(() => props.side === 'customer')
const sources = computed(() => fulfillmentSources(props.overview, props.side))

/** Prefill the amount from the chosen source; the owner confirms or corrects it. */
function prefill () {
  if (!props.overview) { return }
  const next = fulfillmentPrefill(props.overview, props.side, form.source)
  form.amount = next.amountMinor
  if (next.vendorId) { form.vendorId = next.vendorId }
}

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  idempotencyKey = newIdempotencyKey()
  Object.assign(form, { source: WHOLE_SOURCE, vendorId: null, amount: '', date: today, basis: 'actual', isFinal: false, evidence: '' })
  prefill()
})
watch(() => form.source, () => { if (props.open) { prefill() } })

const overRight = computed(() => exceedsContractRight(props.overview, props.side, form.amount))
const needsVendor = computed(() => needsVendorChoice(props.side, form.source))
const consequence = computed(() => fulfillmentConsequence(props.side, form.basis))

const action = useFinanceAction(() => api.finance.recordFulfillment(buildFulfillmentInput(props.side, props.projectId, {
  source: form.source, vendorId: form.vendorId, amountMinor: form.amount, date: form.date, basis: form.basis, isFinal: form.isFinal, evidence: form.evidence
}, props.salesOrderId), idempotencyKey))

async function submit () {
  const res = await action.run()
  if (!res) { return }
  showToast(customer.value ? 'Jasa diberikan dicatat' : 'Jasa supplier diterima dicatat', ACCOUNTING_STATUS_NOTE[res.data.accountingStatus] ?? '')
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="customer ? 'Jasa diberikan ke customer' : 'Jasa supplier diterima'"
    :description="consequence"
    submit-label="Catat"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="!form.amount || !form.date || form.evidence.trim().length < 5 || overRight || (needsVendor && !form.vendorId) || !overview"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid gap-4">
      <FinanceField id="ff-source" :label="customer ? 'Bagian yang diberikan' : 'Sumber biaya'" :error="action.fieldError('booking') ?? action.fieldError('serviceOrderId')">
        <FinanceSelect id="ff-source" v-model="form.source" :options="sources" />
      </FinanceField>
      <FinanceField v-if="needsVendor" id="ff-vendor" label="Supplier" :error="action.fieldError('vendorId')">
        <FinanceSelect id="ff-vendor" v-model="form.vendorId" :options="lookups.vendorOptions.value" placeholder="Pilih supplier" />
      </FinanceField>
      <div class="grid gap-4 sm:grid-cols-2">
        <FinanceField
          id="ff-amount"
          :label="customer ? 'Nilai jasa diberikan' : 'Nilai biaya'"
          :error="action.fieldError('amountMinor')"
          :hint="customer && overview ? `Sisa hak kontrak ${formatMoneyMinor(overview.contract.remainingMinor)}.` : undefined"
        >
          <FinanceMoneyInput id="ff-amount" v-model="form.amount" :invalid="overRight || !!action.fieldError('amountMinor')" />
          <p v-if="overRight" class="mt-1 text-xs font-medium text-destructive" role="alert">
            Melebihi hak kontrak yang belum dipenuhi. Catat perubahan kontrak/tagihan dulu.
          </p>
        </FinanceField>
        <FinanceField id="ff-date" label="Tanggal jasa" :error="action.fieldError('fulfilledOn')">
          <FinanceDateInput id="ff-date" v-model="form.date" :max="today" />
        </FinanceField>
      </div>
      <template v-if="!customer">
        <FinanceField id="ff-basis" label="Dasar nilai" :error="action.fieldError('basis')">
          <FinanceSelect
            id="ff-basis"
            :model-value="form.basis"
            :options="[{ value: 'actual', label: 'Nilai aktual / sesuai SO' }, { value: 'estimate', label: 'Estimasi, invoice belum datang' }]"
            @update:model-value="v => form.basis = (v ?? 'actual') as 'actual' | 'estimate'"
          />
        </FinanceField>
        <label class="flex items-start gap-2 text-sm">
          <Checkbox id="ff-final" v-model="form.isFinal" class="mt-0.5" />
          <span>Jasa supplier ini sudah selesai seluruhnya. Selisih invoice nanti menjadi koreksi biaya.</span>
        </label>
      </template>
      <FinanceField id="ff-evidence" label="Bukti / keterangan" :error="action.fieldError('evidence')" hint="Contoh: manifest keberangkatan, tiket terbit, BAST hotel.">
        <FinanceTextarea id="ff-evidence" v-model="form.evidence" :rows="2" maxlength="500" />
      </FinanceField>
    </div>
  </FinanceFormDialog>
</template>
