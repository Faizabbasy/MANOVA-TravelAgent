<script setup lang="ts">
import { computed } from 'vue'
import { Receipt, ArrowRight } from 'lucide-vue-next'
import { getInvoicesByProject, getPaymentsByInvoice, getProjectOutstandingIdr } from '~/data'
import { INVOICE_STATUSES, INVOICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import { isInvoiceOverdue, invoiceAgingDays } from '~/utils/attention'

const props = defineProps<{
  projectId: string
  canViewFinancials: boolean
}>()

const invoices = computed(() => getInvoicesByProject(props.projectId))

const rows = computed(() => invoices.value.map((invoice) => {
  const paidIdr = getPaymentsByInvoice(invoice.id).reduce((sum, payment) => sum + payment.amountIdr, 0)
  return {
    invoice,
    paidIdr,
    overdue: isInvoiceOverdue(invoice),
    agingDays: invoiceAgingDays(invoice)
  }
}))

const totals = computed(() => ({
  invoiced: rows.value.reduce((sum, row) => sum + row.invoice.amountIdr, 0),
  paid: rows.value.reduce((sum, row) => sum + row.paidIdr, 0),
  outstanding: getProjectOutstandingIdr(props.projectId)
}))
</script>

<template>
  <SectionCard>
    <div class="flex items-center gap-2 mb-1">
      <Receipt class="h-4 w-4 text-muted-foreground" />
      <h3 class="text-base font-semibold text-foreground">
        Invoices & Payments
      </h3>
    </div>
    <p class="text-xs text-muted-foreground mb-4">
      Termin invoice dan status pembayarannya.
    </p>

    <template v-if="!canViewFinancials">
      <EmptyState title="Data finansial disembunyikan" description="Role Anda tidak memiliki visibilitas nilai finansial project." />
    </template>

    <template v-else-if="rows.length">
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div>
          <p class="text-xs text-muted-foreground">
            Total Invoice
          </p>
          <p class="text-sm font-semibold text-foreground">
            {{ formatCurrencyIdr(totals.invoiced) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">
            Terbayar
          </p>
          <p class="text-sm font-semibold text-success">
            {{ formatCurrencyIdr(totals.paid) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">
            Outstanding
          </p>
          <p class="text-sm font-semibold" :class="totals.outstanding > 0 ? 'text-destructive' : 'text-foreground'">
            {{ formatCurrencyIdr(totals.outstanding) }}
          </p>
        </div>
      </div>

      <ul class="divide-y divide-border">
        <li v-for="row in rows" :key="row.invoice.id" class="py-2.5">
          <div class="flex items-start gap-2">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-sm font-medium text-foreground">{{ row.invoice.label }}</span>
                <StatusBadge
                  :label="findStatusOption(INVOICE_TYPES, row.invoice.invoiceType).label"
                  :tone="findStatusOption(INVOICE_TYPES, row.invoice.invoiceType).tone"
                />
              </div>
              <p class="text-xs text-muted-foreground mt-0.5">
                Jatuh tempo {{ formatDate(row.invoice.dueAt) }}
                <span v-if="row.overdue" class="text-destructive font-medium">· telat {{ row.agingDays }} hari</span>
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-semibold text-foreground">
                {{ formatCurrencyIdr(row.invoice.amountIdr) }}
              </p>
              <StatusBadge
                :label="findStatusOption(INVOICE_STATUSES, row.invoice.status).label"
                :tone="row.overdue ? 'destructive' : findStatusOption(INVOICE_STATUSES, row.invoice.status).tone"
              />
            </div>
          </div>
        </li>
      </ul>

      <NuxtLink to="/finance/invoices" class="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
        Kelola di modul Finance
        <ArrowRight class="h-3 w-3" />
      </NuxtLink>
    </template>

    <EmptyState
      v-else
      :icon="Receipt"
      title="Belum ada invoice"
      description="Invoice DP terbit setelah Project Order dikonfirmasi."
    />
  </SectionCard>
</template>
