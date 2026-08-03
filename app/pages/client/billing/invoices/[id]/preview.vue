<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getProjectById, getPartyById, getPaymentsByInvoice, getInvoiceOutstandingIdr, INVOICES } from '~/data'
import { INVOICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'

/**
 * Finance & Billing — Tax Invoice / Receipt Print Preview (Repair Phase Section 6, Wajib "Download tax
 * invoice"/"Download receipt"). Satu dokumen mock mencakup keduanya (breakdown invoice = tax invoice,
 * riwayat pembayaran = receipt) — bukan generator dokumen ganda, pola identik `/client/quotations/[id]/preview`.
 */
definePageMeta({ layout: false, middleware: 'auth' })

const route = useRoute()
const { canView, clientScopeId } = usePermissions()

const invoice = computed(() => INVOICES.find(item => item.id === String(route.params.id)))
const project = computed(() => (invoice.value ? getProjectById(invoice.value.projectId) : undefined))
const isOwnCompany = computed(() => Boolean(project.value && clientScopeId.value && project.value.partyId === clientScopeId.value))
const party = computed(() => (project.value ? getPartyById(project.value.partyId) : undefined))
const payments = computed(() => (invoice.value ? getPaymentsByInvoice(invoice.value.id) : []))
const outstanding = computed(() => (invoice.value ? getInvoiceOutstandingIdr(invoice.value.id) : 0))

useHead({ title: computed(() => invoice.value ? `${invoice.value.id} — Tax Invoice / Receipt` : 'Invoice Tidak Ditemukan') })

function printPage () {
  window.print()
}
</script>

<template>
  <div class="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
    <div class="mx-auto max-w-3xl px-4 print:px-0 print:max-w-none">
      <template v-if="!invoice || !project || !isOwnCompany">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <EmptyState :icon="FileX" title="Invoice tidak ditemukan" description="Invoice ini tidak ada atau bukan milik company Anda.">
            <NuxtLink to="/client/billing">
              <Button>Kembali</Button>
            </NuxtLink>
          </EmptyState>
        </div>
      </template>

      <template v-else-if="!canView('client-portal')">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <RoleAccessState module-label="Client Portal" />
        </div>
      </template>

      <template v-else>
        <div class="mb-4 flex items-center justify-between print:hidden">
          <NuxtLink :to="`/client/billing/invoices/${invoice.id}`" class="text-sm text-primary hover:underline">
            ← Kembali ke Invoice
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
                Travel Agent B2B — Tax Invoice &amp; Receipt (Mock)
              </p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold text-foreground">
                TAX INVOICE
              </p>
              <p class="text-sm text-muted-foreground">
                {{ invoice.id }}
              </p>
              <p class="text-xs text-muted-foreground">
                Diterbitkan {{ formatDate(invoice.issuedAt) }}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Bill To
              </p>
              <p class="text-sm font-medium text-foreground">
                {{ party?.name ?? '—' }}
              </p>
              <p v-if="party?.city" class="text-sm text-muted-foreground">
                {{ party.city }}
              </p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Project Order
              </p>
              <p class="text-sm text-foreground">
                {{ project.name }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ project.destination }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ findStatusOption(INVOICE_TYPES, invoice.invoiceType).label }}
              </p>
            </div>
          </div>

          <div class="flex justify-end mb-6">
            <div class="w-64 space-y-1.5 text-sm">
              <div class="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{{ formatCurrencyIdr(invoice.amountIdr) }}</span>
              </div>
              <div class="flex justify-between border-t border-border pt-1.5 text-base font-semibold text-foreground">
                <span>Total ({{ invoice.currency }})</span><span>{{ formatCurrencyIdr(invoice.amountIdr) }}</span>
              </div>
              <div class="flex justify-between text-muted-foreground">
                <span>Outstanding</span><span>{{ formatCurrencyIdr(outstanding) }}</span>
              </div>
            </div>
          </div>

          <div class="border-t border-border pt-4">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Receipt — Riwayat Pembayaran
            </p>
            <table v-if="payments.length" class="w-full text-sm">
              <thead>
                <tr class="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th class="py-2">
                    Tanggal
                  </th>
                  <th class="py-2">
                    Metode
                  </th>
                  <th class="py-2 text-right">
                    Jumlah
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="payment in payments" :key="payment.id" class="border-b border-border/60">
                  <td class="py-2">
                    {{ formatDate(payment.receivedAt) }}
                  </td>
                  <td class="py-2 text-muted-foreground">
                    {{ payment.method ?? '—' }}
                  </td>
                  <td class="py-2 text-right">
                    {{ formatCurrencyIdr(payment.amountIdr) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else class="text-sm text-muted-foreground">
              Belum ada pembayaran tercatat untuk invoice ini.
            </p>
          </div>

          <p class="mt-8 text-center text-[10px] text-muted-foreground">
            Dokumen mock untuk keperluan demo — bukan dokumen pajak/legal yang sah.
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
