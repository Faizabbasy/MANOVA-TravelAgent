<script setup lang="ts">
import type { VendorInvoiceDetailDto } from '~/types/api'
import { shiftDate, todayJakarta } from '~/lib/finance/dates'

/**
 * Record an invoice received from a vendor (or correct one still under review). Recording it does not make it
 * payable: it must be reviewed and approved first, so a wrong or duplicate invoice is never paid.
 */
const props = defineProps<{ open: boolean; invoice?: VendorInvoiceDetailDto | null; vendorId?: string | null; projectId?: string | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [invoice: VendorInvoiceDetailDto] }>()

const api = useApi()
const { showToast } = useToast()
const lookups = useFinanceLookups(() => props.open && !props.invoice)
const today = todayJakarta()
const isEdit = computed(() => !!props.invoice)
const form = reactive({ vendorId: null as string | null, number: '', invoiceDate: today, dueDate: '', amount: '', projectId: null as string | null, notes: '' })

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  const inv = props.invoice
  Object.assign(form, {
    vendorId: inv?.vendor.id ?? props.vendorId ?? null,
    number: inv?.vendorInvoiceNumber ?? '',
    invoiceDate: inv?.invoiceDate ?? today,
    dueDate: inv?.dueDate ?? shiftDate(today, 14),
    amount: inv?.totalMinor ?? '',
    projectId: inv?.project?.id ?? props.projectId ?? null,
    notes: inv?.notes ?? ''
  })
})

const action = useFinanceAction(async () => {
  if (props.invoice) {
    return (await api.finance.updateVendorInvoice(props.invoice.id, {
      vendorInvoiceNumber: form.number.trim(), invoiceDate: form.invoiceDate, dueDate: form.dueDate, totalMinor: form.amount, notes: form.notes.trim()
    })).data
  }
  return (await api.finance.createVendorInvoice({
    vendorId: form.vendorId!,
    vendorInvoiceNumber: form.number.trim(),
    invoiceDate: form.invoiceDate,
    dueDate: form.dueDate,
    totalMinor: form.amount,
    projectId: form.projectId ?? undefined,
    notes: form.notes.trim() || undefined
  })).data
})

async function submit () {
  const saved = await action.run()
  if (!saved) { return }
  showToast(isEdit.value ? 'Invoice vendor diperbarui' : 'Invoice vendor dicatat', isEdit.value ? `${saved.vendorInvoiceNumber} sudah disimpan.` : `${saved.vendorInvoiceNumber} menunggu review sebelum bisa dibayar.`)
  emit('saved', saved)
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="isEdit ? `Ubah invoice ${invoice?.vendorInvoiceNumber}` : 'Catat invoice dari vendor'"
    description="Salin dari invoice yang dikirim vendor. Setelah dicatat, invoice direview dan disetujui dulu sebelum bisa dibayar."
    :submit-label="isEdit ? 'Simpan perubahan' : 'Catat invoice'"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="!form.vendorId || !form.number.trim() || !form.amount || !form.dueDate"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <FinanceField id="vi-vendor" label="Vendor" :error="action.fieldError('vendorId')">
      <FinanceSelect v-if="!isEdit" id="vi-vendor" v-model="form.vendorId" :options="lookups.vendorOptions.value" placeholder="Pilih vendor" />
      <p v-else class="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-sm">
        {{ invoice?.vendor.name }}
      </p>
    </FinanceField>
    <div class="grid gap-4 sm:grid-cols-2">
      <FinanceField id="vi-number" label="Nomor invoice vendor" :error="action.fieldError('vendorInvoiceNumber')">
        <Input id="vi-number" v-model="form.number" class="h-10" maxlength="80" placeholder="mis. ABC/INV/0912" />
      </FinanceField>
      <FinanceField id="vi-amount" label="Total tagihan" :error="action.fieldError('totalMinor')">
        <FinanceMoneyInput id="vi-amount" v-model="form.amount" :invalid="!!action.fieldError('totalMinor')" />
      </FinanceField>
      <FinanceField id="vi-date" label="Tanggal invoice" :error="action.fieldError('invoiceDate')">
        <FinanceDateInput id="vi-date" v-model="form.invoiceDate" :max="today" />
      </FinanceField>
      <FinanceField id="vi-due" label="Jatuh tempo" :error="action.fieldError('dueDate')">
        <FinanceDateInput id="vi-due" v-model="form.dueDate" :min="form.invoiceDate" />
      </FinanceField>
    </div>
    <FinanceField
      v-if="!isEdit"
      id="vi-project"
      label="Untuk project"
      optional
      hint="Biaya vendor ikut dihitung di profitabilitas project."
      :error="action.fieldError('projectId')"
    >
      <FinanceSelect id="vi-project" v-model="form.projectId" :options="lookups.projectOptions.value" clear-label="Tanpa project" placeholder="Tanpa project" />
    </FinanceField>
    <FinanceField id="vi-notes" label="Catatan" optional>
      <FinanceTextarea id="vi-notes" v-model="form.notes" :rows="2" maxlength="1000" />
    </FinanceField>
  </FinanceFormDialog>
</template>
