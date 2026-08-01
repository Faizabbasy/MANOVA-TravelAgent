<script setup lang="ts">
import { computed } from 'vue'
import { Receipt, Wallet, AlertTriangle, FileStack, GitCompareArrows, CheckCircle2 } from 'lucide-vue-next'
import { getOutstandingInvoices, INVOICES, PROJECTS, getSupplierInvoiceReconciliationQueue, evaluateFinanceClosureGate } from '~/data'
import { isInvoiceOverdue } from '~/utils/attention'
import { formatCurrencyIdr, formatNumber } from '~/utils/format'

/**
 * Finance overview (Section 15 lama — shell; Section 20 — D-077, menambah link Notes/Reconciliation dan
 * agregat "Financial Closure Readiness" lintas-project berdasarkan `evaluateFinanceClosureGate`).
 */

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Finance' })

const { canView, canViewFinancials } = usePermissions()

const outstanding = computed(() => getOutstandingInvoices())
const outstandingTotal = computed(() => outstanding.value.reduce((sum, invoice) => sum + invoice.amountIdr, 0))
const overdueCount = computed(() => INVOICES.filter(invoice => isInvoiceOverdue(invoice)).length)
const reconciliationQueueCount = computed(() => getSupplierInvoiceReconciliationQueue().length)

/** Financial closure readiness (Section 20, Wajib) — agregat lintas-project, hanya project yang belum `financeSettled`. */
const closureReadiness = computed(() => PROJECTS
  .filter(project => !project.closureChecklist?.financeSettled)
  .map(project => ({ project, gate: evaluateFinanceClosureGate(project.id) })))
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Finance"
      description="Ringkasan invoice dan pembayaran lintas-project."
      :breadcrumb="[{ label: 'Finance' }]"
    />

    <RoleAccessState v-if="!canView('finance')" module-label="modul Finance" />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Invoice Outstanding" :value="formatNumber(outstanding.length)" :icon="Receipt" />
        <StatsCard
          v-if="canViewFinancials"
          title="Total Outstanding"
          :value="formatCurrencyIdr(outstandingTotal)"
          :icon="Wallet"
          icon-color="warning"
        />
        <StatsCard title="Invoice Overdue" :value="formatNumber(overdueCount)" :icon="AlertTriangle" icon-color="destructive" />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <NuxtLink to="/finance/invoices" class="block">
          <SectionCard title="Invoices" description="Lihat seluruh invoice lintas-project">
            <p class="text-sm text-muted-foreground">Buka daftar invoice →</p>
          </SectionCard>
        </NuxtLink>
        <NuxtLink to="/finance/payments" class="block">
          <SectionCard title="Payments" description="Lihat seluruh payment lintas-project">
            <p class="text-sm text-muted-foreground">Buka daftar payment →</p>
          </SectionCard>
        </NuxtLink>
        <NuxtLink to="/finance/notes" class="block">
          <SectionCard title="Credit/Debit Notes" description="Lihat seluruh Credit/Debit Note lintas-project">
            <p class="text-sm text-muted-foreground"><FileStack class="inline h-3.5 w-3.5 mr-1" />Buka daftar notes →</p>
          </SectionCard>
        </NuxtLink>
        <NuxtLink to="/finance/reconciliation" class="block">
          <SectionCard title="Reconciliation" :description="`${reconciliationQueueCount} Supplier Invoice perlu ditriase`">
            <p class="text-sm text-muted-foreground"><GitCompareArrows class="inline h-3.5 w-3.5 mr-1" />Buka workspace →</p>
          </SectionCard>
        </NuxtLink>
      </div>

      <SectionCard v-if="canViewFinancials" title="Financial Closure Readiness" description="Project yang belum Close Finance — blocker AR/AP/Refund harus tuntas sebelum ditutup.">
        <ul v-if="closureReadiness.length" class="divide-y divide-border">
          <li v-for="row in closureReadiness" :key="row.project.id" class="py-3">
            <div class="flex items-center justify-between gap-3">
              <NuxtLink :to="`/projects/${row.project.id}?tab=finance`" class="text-sm font-medium text-foreground hover:underline">{{ row.project.name }}</NuxtLink>
              <StatusBadge
                :label="row.gate.ready ? 'Siap Ditutup' : `${row.gate.blockers.length} Blocker`"
                :tone="row.gate.ready ? 'success' : 'warning'"
              />
            </div>
            <ul v-if="!row.gate.ready" class="mt-1 list-disc list-inside text-xs text-muted-foreground">
              <li v-for="(blocker, index) in row.gate.blockers" :key="index">{{ blocker }}</li>
            </ul>
            <p v-else class="mt-1 text-xs text-success flex items-center gap-1"><CheckCircle2 class="h-3.5 w-3.5" />Tidak ada blocker — dapat ditutup dari tab Finance Project Detail.</p>
          </li>
        </ul>
        <EmptyState v-else title="Seluruh project sudah Close Finance" description="Tidak ada project aktif yang finance-nya belum diselesaikan." />
      </SectionCard>
    </template>
  </div>
</template>
