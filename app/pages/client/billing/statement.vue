<script setup lang="ts">
import { computed } from 'vue'
import { getPartyById, getProjectsByParty, getClientInvoices, getInvoiceOutstandingIdr, getClientFinanceSummary } from '~/data'
import { INVOICE_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'

/**
 * Finance & Billing — Statement of Account (Repair Phase Section 6, Wajib "View statement"). Print-friendly,
 * pola identik `/client/quotations/[id]/preview` — agregasi seluruh Invoice company, TIDAK ADA data baru.
 */
definePageMeta({ layout: false, middleware: 'auth' })
useHead({ title: 'Statement of Account' })

const { canView, clientScopeId } = usePermissions()

const party = computed(() => (clientScopeId.value ? getPartyById(clientScopeId.value) : undefined))
const projects = computed(() => (clientScopeId.value ? getProjectsByParty(clientScopeId.value) : []))
const invoices = computed(() => (clientScopeId.value ? getClientInvoices(clientScopeId.value) : []).sort((a, b) => a.issuedAt.localeCompare(b.issuedAt)))
const summary = computed(() => (clientScopeId.value ? getClientFinanceSummary(clientScopeId.value) : undefined))

function projectName (projectId: string): string {
  return projects.value.find(p => p.id === projectId)?.name ?? projectId
}

function printPage () {
  window.print()
}
</script>

<template>
  <div class="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
    <div class="mx-auto max-w-3xl px-4 print:px-0 print:max-w-none">
      <template v-if="!canView('client-portal')">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <RoleAccessState module-label="Client Portal" />
        </div>
      </template>

      <template v-else>
        <div class="mb-4 flex items-center justify-between print:hidden">
          <NuxtLink to="/client/billing" class="text-sm text-primary hover:underline">
            ← Kembali ke Finance & Billing
          </NuxtLink>
          <Button size="sm" @click="printPage">
            Print / Save as PDF
          </Button>
        </div>

        <div class="rounded-xl border border-border bg-card p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none print:p-0">
          <div class="flex items-start justify-between border-b border-border pb-6 mb-6">
            <div>
              <p class="text-2xl font-bold tracking-tight text-foreground">
                MANOVA
              </p>
              <p class="text-xs text-muted-foreground">
                Travel Agent B2B — Statement of Account (Mock)
              </p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold text-foreground">
                {{ party?.name ?? '—' }}
              </p>
              <p class="text-xs text-muted-foreground">
                Per tanggal {{ formatDate(DEMO_REFERENCE_DATE) }}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-sm">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Total Invoiced
              </p>
              <p class="text-foreground font-medium">
                {{ formatCurrencyIdr(summary?.totalInvoicedIdr ?? 0) }}
              </p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Total Paid
              </p>
              <p class="text-foreground font-medium">
                {{ formatCurrencyIdr(summary?.totalPaidIdr ?? 0) }}
              </p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Outstanding
              </p>
              <p class="text-foreground font-medium">
                {{ formatCurrencyIdr(summary?.outstandingIdr ?? 0) }}
              </p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Overdue
              </p>
              <p class="text-foreground font-medium">
                {{ formatCurrencyIdr(summary?.overdueIdr ?? 0) }}
              </p>
            </div>
          </div>

          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th class="py-2">
                  Invoice
                </th>
                <th class="py-2">
                  Project
                </th>
                <th class="py-2">
                  Terbit
                </th>
                <th class="py-2">
                  Jatuh Tempo
                </th>
                <th class="py-2 text-right">
                  Jumlah
                </th>
                <th class="py-2 text-right">
                  Outstanding
                </th>
                <th class="py-2">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="invoice in invoices" :key="invoice.id" class="border-b border-border/60">
                <td class="py-2">
                  {{ invoice.id }}
                </td>
                <td class="py-2 text-muted-foreground">
                  {{ projectName(invoice.projectId) }}
                </td>
                <td class="py-2 text-muted-foreground">
                  {{ formatDate(invoice.issuedAt) }}
                </td>
                <td class="py-2 text-muted-foreground">
                  {{ formatDate(invoice.dueAt) }}
                </td>
                <td class="py-2 text-right">
                  {{ formatCurrencyIdr(invoice.amountIdr) }}
                </td>
                <td class="py-2 text-right">
                  {{ formatCurrencyIdr(getInvoiceOutstandingIdr(invoice.id)) }}
                </td>
                <td class="py-2">
                  {{ findStatusOption(INVOICE_STATUSES, invoice.status).label }}
                </td>
              </tr>
              <tr v-if="invoices.length === 0">
                <td colspan="7" class="py-4 text-center text-muted-foreground">
                  Belum ada invoice tercatat.
                </td>
              </tr>
            </tbody>
          </table>

          <p class="mt-8 text-center text-[10px] text-muted-foreground">
            Dokumen mock untuk keperluan demo — bukan dokumen finansial resmi.
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<style>
@media print {
  @page { margin: 1.5cm; }
}
</style>
