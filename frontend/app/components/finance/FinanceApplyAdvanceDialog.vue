<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import type { AdvanceDto } from '~/types/api'
import { formatBusinessDate, todayJakarta } from '~/lib/finance/dates'
import { INVOICE_TYPE_LABEL } from '~/lib/finance/labels'
import type { AllocationTarget } from '~/lib/finance/types'
import { formatMoneyMinor } from '~/lib/money'
import { collectPages } from '~/lib/finance/paging'

/**
 * Apply money already received (customer advance) or already paid (vendor deposit) to open invoices. No money
 * moves — the account balance stays the same; only what the invoices still owe goes down.
 */
const props = defineProps<{ open: boolean; advance: AdvanceDto | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const today = todayJakarta()
const allocations = ref<Record<string, string>>({})
let idempotencyKey = newIdempotencyKey()
const isCustomer = computed(() => props.advance?.kind === 'customer_receipt')

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  allocations.value = {}
  idempotencyKey = newIdempotencyKey()
})

const targetsQuery = useFinanceQuery(async (): Promise<AllocationTarget[]> => {
  const a = props.advance!
  if (a.kind === 'customer_receipt') {
    const list = await collectPages(cursor => api.finance.receivables({ partyId: a.party!.id, settlement: 'outstanding', limit: 100, cursor }))
    return list.map(inv => ({ id: inv.id, title: inv.number ?? inv.id, subtitle: `${INVOICE_TYPE_LABEL[inv.invoiceType]} · ${inv.project.name}`, dueDate: inv.dueDate, outstandingMinor: inv.outstandingMinor }))
  }
  const list = await collectPages(cursor => api.finance.payables({ vendorId: a.vendor!.id, view: 'outstanding', limit: 100, cursor }))
  return list.map(inv => ({ id: inv.id, title: inv.vendorInvoiceNumber, subtitle: inv.project?.name ?? 'Tanpa project', dueDate: inv.dueDate, outstandingMinor: inv.outstandingMinor }))
}, { watch: [() => props.open, () => props.advance?.transactionId], enabled: () => props.open && !!props.advance })

const targets = computed(() => (props.open ? targetsQuery.data.value ?? [] : []))
const entries = computed(() => Object.entries(allocations.value).filter(([, v]) => BigInt(v || '0') > 0n))
const invalid = computed(() => {
  const total = entries.value.reduce((s, [, v]) => s + BigInt(v), 0n)
  return !entries.value.length || total > BigInt(props.advance?.unallocatedMinor ?? '0') ||
    targets.value.some(t => BigInt(allocations.value[t.id] || '0') > BigInt(t.outstandingMinor))
})

const action = useFinanceAction((): Promise<unknown> => {
  const a = props.advance!
  if (a.kind === 'customer_receipt') {
    return api.finance.allocateReceipt(a.transactionId, entries.value.map(([invoiceId, amountMinor]) => ({ invoiceId, amountMinor })), idempotencyKey)
  }
  return api.finance.allocateVendorPayment(a.transactionId, entries.value.map(([vendorInvoiceId, amountMinor]) => ({ vendorInvoiceId, amountMinor })), idempotencyKey)
})

async function submit () {
  if (!(await action.run())) { return }
  const total = entries.value.reduce((s, [, v]) => s + BigInt(v), 0n)
  showToast(isCustomer.value ? 'Uang muka dipakai' : 'Deposit dipakai', `${formatMoneyMinor(total.toString())} dialokasikan ke ${entries.value.length} tagihan.`)
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="isCustomer ? 'Pakai uang muka customer' : 'Pakai deposit vendor'"
    :description="isCustomer ? 'Uang muka yang sudah diterima dipakai untuk melunasi invoice. Saldo rekening tidak berubah.' : 'Deposit yang sudah dibayar dipakai untuk melunasi invoice vendor. Saldo rekening tidak berubah.'"
    submit-label="Alokasikan"
    size="lg"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="invalid"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div v-if="advance" class="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div class="min-w-0">
        <p class="truncate text-sm font-medium">
          {{ advance.party?.name ?? advance.vendor?.name }}
        </p>
        <p class="text-xs text-muted-foreground">
          Diterima {{ formatBusinessDate(advance.effectiveDate) }} · {{ advance.account.code }}
        </p>
      </div>
      <div class="text-right">
        <p class="text-xs text-muted-foreground">
          Tersedia
        </p>
        <FinanceAmount :value="advance.unallocatedMinor" class="font-semibold" />
      </div>
    </div>
    <FinanceAllocationList
      v-if="advance"
      v-model="allocations"
      :targets="targets"
      :amount="advance.unallocatedMinor"
      :today="today"
      :loading="targetsQuery.pending.value && !targetsQuery.loaded.value"
      :leftover-label="isCustomer ? 'Tetap sebagai uang muka' : 'Tetap sebagai deposit'"
    />
  </FinanceFormDialog>
</template>
