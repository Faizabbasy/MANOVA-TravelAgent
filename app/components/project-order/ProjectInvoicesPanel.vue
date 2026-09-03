<script setup lang="ts">
import { computed } from 'vue'
import { CalendarRange, CheckCircle2, Download, Receipt, TrendingUp } from 'lucide-vue-next'
import { getInvoiceMilestoneOutstandingIdr, getInvoiceMilestoneStatus, getInvoiceOutstandingIdr, getPaymentsByInvoice } from '~/data'
import { INVOICE_STATUSES, INVOICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import { isInvoiceOverdue } from '~/utils/attention'
import type { Invoice, InvoiceMilestone } from '~/types/finance'

/**
 * Tab Finance (Project Detail) — "Invoice & Pembayaran". Menggantikan card read-only lama yang cuma berisi
 * link keluar ke `/finance/invoices`: sekarang client bisa langsung buat invoice (opsional bertermin via
 * `Invoice.milestones`) dan Record Payment tanpa pindah modul. Presentational-only (pola sama
 * `ProjectCommercialHero.vue`) — seluruh mutasi (createInvoice/recordPayment) dipicu lewat event ke halaman
 * induk yang membuka Sheet & memanggil mutator, komponen ini tidak menyentuh `~/data` mutator apa pun.
 */
const props = defineProps<{
  invoices: Invoice[]
  canManageFinance: boolean
}>()

const emit = defineEmits<{
  'create-invoice': []
  'record-payment': [invoice: Invoice, milestone?: InvoiceMilestone]
  'download-pdf': [invoice: Invoice]
}>()

const sortedInvoices = computed(() => [...props.invoices].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)))

const totals = computed(() => {
  const invoiced = props.invoices.filter(invoice => invoice.status !== 'void').reduce((sum, invoice) => sum + invoice.amountIdr, 0)
  const outstanding = props.invoices.reduce((sum, invoice) => sum + getInvoiceOutstandingIdr(invoice.id), 0)
  const paid = props.invoices.reduce((sum, invoice) => sum + getPaymentsByInvoice(invoice.id).reduce((s, payment) => s + payment.amountIdr, 0), 0)
  const percent = invoiced > 0 ? Math.round((paid / invoiced) * 100) : 0
  return { invoiced, paid, outstanding, percent }
})

function paymentsForInvoice (invoiceId: string) {
  return getPaymentsByInvoice(invoiceId)
}

/**
 * Ringkasan payment terakhir milestone tertentu (atau invoice flat kalau `milestoneId` kosong), sudah
 * diformat jadi satu baris teks siap tampil — menggantikan card "Riwayat Pembayaran" terpisah. Return
 * string (bukan object Payment) supaya template tidak perlu non-null assertion (`!`, tidak didukung parser
 * template Vue) untuk mengakses field-nya setelah `v-if`.
 */
function lastPaymentSummary (invoiceId: string, milestoneId?: string): string | null {
  const payments = getPaymentsByInvoice(invoiceId).filter(payment => milestoneId ? payment.milestoneId === milestoneId : !payment.milestoneId)
  if (!payments.length) { return null }
  const latest = payments.reduce((a, b) => b.receivedAt > a.receivedAt ? b : a)
  return `Dibayar ${formatCurrencyIdr(latest.amountIdr)} · ${formatDate(latest.receivedAt)}${latest.method ? ` · ${latest.method}` : ''}`
}
</script>

<template>
  <SectionCard compact content-class="space-y-3">
    <template #header>
      <div class="flex items-start gap-2.5">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Receipt class="h-4 w-4" />
        </span>
        <div class="min-w-0">
          <CardTitle class="text-sm font-bold normal-case tracking-normal text-foreground">
            Invoice & Pembayaran
          </CardTitle>
          <CardDescription class="mt-0.5 text-xs">
            Lacak milestone invoice dan status pembayaran project ini.
          </CardDescription>
        </div>
      </div>
    </template>
    <template v-if="canManageFinance" #actions>
      <Button size="sm" @click="emit('create-invoice')">
        + Buat Invoice
      </Button>
    </template>

    <template v-if="invoices.length">
      <div class="rounded-lg border border-primary/20 bg-primary/10 p-3">
        <div class="flex items-center justify-between gap-3">
          <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            <TrendingUp class="h-4 w-4" />Payment Progress
          </span>
          <span class="text-xl font-bold tabular-nums text-primary">{{ totals.percent }}%</span>
        </div>
        <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-primary/15">
          <div class="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" :style="{ width: `${totals.percent}%` }" />
        </div>
        <div class="mt-2.5 grid grid-cols-3 gap-2">
          <div class="min-w-0">
            <p class="text-[11px] text-muted-foreground">
              Total Invoiced
            </p>
            <p class="truncate text-sm font-semibold tabular-nums text-foreground">
              {{ formatCurrencyIdr(totals.invoiced) }}
            </p>
          </div>
          <div class="min-w-0">
            <p class="text-[11px] text-muted-foreground">
              Paid
            </p>
            <p class="truncate text-sm font-semibold tabular-nums text-success">
              {{ formatCurrencyIdr(totals.paid) }}
            </p>
          </div>
          <div class="min-w-0">
            <p class="text-[11px] text-muted-foreground">
              Outstanding
            </p>
            <p class="truncate text-sm font-semibold tabular-nums text-warning">
              {{ formatCurrencyIdr(totals.outstanding) }}
            </p>
          </div>
        </div>
      </div>

      <div class="space-y-2.5">
        <div v-for="invoice in sortedInvoices" :key="invoice.id" class="rounded-lg border border-border p-3">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-sm font-bold text-foreground">
                {{ invoice.id }}
              </p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                <template v-if="invoice.milestones?.length">
                  {{ invoice.milestones.length }} milestone ·
                </template>
                {{ invoice.label }}
              </p>
            </div>
            <div class="shrink-0 text-right">
              <StatusBadge
                :label="findStatusOption(INVOICE_STATUSES, invoice.status).label"
                :tone="isInvoiceOverdue(invoice) ? 'destructive' : findStatusOption(INVOICE_STATUSES, invoice.status).tone"
              />
              <p class="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarRange class="h-3 w-3" />{{ formatDate(invoice.dueAt) }}
              </p>
            </div>
          </div>

          <template v-if="invoice.milestones?.length">
            <div class="mt-2.5 space-y-1 border-t border-border pt-2">
              <div
                v-for="milestone in invoice.milestones"
                :key="milestone.id"
                class="rounded-lg px-2 py-1.5 transition-colors"
                :class="getInvoiceMilestoneStatus(invoice.id, milestone.id) === 'paid' ? 'bg-success/5' : ''"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-2">
                    <CheckCircle2
                      class="h-4 w-4 shrink-0"
                      :class="getInvoiceMilestoneStatus(invoice.id, milestone.id) === 'paid' ? 'text-success' : 'text-muted-foreground/30'"
                    />
                    <span class="truncate text-sm text-foreground">{{ milestone.label }}</span>
                    <span class="shrink-0 text-xs text-muted-foreground">({{ milestone.percent }}%)</span>
                    <StatusBadge
                      :label="findStatusOption(INVOICE_STATUSES, getInvoiceMilestoneStatus(invoice.id, milestone.id)).label"
                      :tone="findStatusOption(INVOICE_STATUSES, getInvoiceMilestoneStatus(invoice.id, milestone.id)).tone"
                    />
                  </div>
                  <div class="flex shrink-0 items-center gap-3">
                    <span class="text-sm font-semibold tabular-nums text-foreground">{{ formatCurrencyIdr(milestone.amountIdr) }}</span>
                    <button
                      v-if="canManageFinance && getInvoiceMilestoneOutstandingIdr(invoice.id, milestone.id) > 0"
                      type="button"
                      class="text-xs font-medium text-primary hover:underline"
                      @click="emit('record-payment', invoice, milestone)"
                    >
                      Record Payment
                    </button>
                  </div>
                </div>
                <p v-if="lastPaymentSummary(invoice.id, milestone.id)" class="ml-6 mt-0.5 text-[11px] text-muted-foreground">
                  {{ lastPaymentSummary(invoice.id, milestone.id) }}
                </p>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="mt-2.5 flex items-center justify-between border-t border-border pt-2">
              <StatusBadge :label="findStatusOption(INVOICE_TYPES, invoice.invoiceType).label" :tone="findStatusOption(INVOICE_TYPES, invoice.invoiceType).tone" />
              <span class="text-sm font-semibold tabular-nums text-foreground">{{ formatCurrencyIdr(invoice.amountIdr) }}</span>
            </div>
            <p v-if="lastPaymentSummary(invoice.id)" class="mt-1 text-[11px] text-muted-foreground">
              {{ lastPaymentSummary(invoice.id) }}
            </p>
          </template>

          <div class="mt-2.5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-2.5">
            <p class="text-xs text-muted-foreground">
              Total: <span class="font-semibold text-foreground">{{ formatCurrencyIdr(invoice.amountIdr) }}</span>
              · Paid: <span class="font-semibold text-success">{{ formatCurrencyIdr(paymentsForInvoice(invoice.id).reduce((sum, payment) => sum + payment.amountIdr, 0)) }}</span>
              · Outstanding: <span class="font-semibold text-warning">{{ formatCurrencyIdr(getInvoiceOutstandingIdr(invoice.id)) }}</span>
            </p>
            <div class="flex shrink-0 items-center gap-2">
              <button type="button" class="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground" @click="emit('download-pdf', invoice)">
                <Download class="h-3.5 w-3.5" />PDF
              </button>
              <Button
                v-if="canManageFinance && !invoice.milestones?.length && getInvoiceOutstandingIdr(invoice.id) > 0"
                size="sm"
                @click="emit('record-payment', invoice)"
              >
                Record Payment
              </Button>
            </div>
          </div>

          <p v-if="invoice.notes" class="mt-2.5 truncate border-t border-border pt-2 text-xs text-muted-foreground">
            Notes: {{ invoice.notes }}
          </p>
        </div>
      </div>
    </template>

    <EmptyState
      v-else
      :icon="Receipt"
      title="Belum ada invoice"
      :description="canManageFinance ? 'Buat invoice pertama langsung dari project ini — tidak perlu pindah ke modul Finance.' : 'Invoice akan muncul di sini setelah diterbitkan.'"
    />
  </SectionCard>
</template>
