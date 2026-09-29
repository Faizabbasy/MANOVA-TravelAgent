<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Search, Wallet, AlertTriangle, FileText, Printer } from 'lucide-vue-next'
import { getProjectsByParty, getClientInvoices, getInvoiceOutstandingIdr, getClientFinanceSummary, runPaymentVerificationMock } from '~/data'
import { INVOICE_STATUSES, INVOICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import { isInvoiceOverdue, isInvoiceDueSoon } from '~/utils/attention'
import type { Invoice, InvoiceStatus } from '~/types/finance'

/**
 * Finance & Billing — Index (Repair Phase Section 6 — Finance & Collaboration, Master Prompt bagian A).
 * "Mock verification" (Flow 4) dipicu lazy di sini (`onMounted`) untuk seluruh invoice `waiting-verification`
 * milik company — bukan cascade instan di `submitPaymentProof`, agar status itu benar-benar sempat terlihat
 * Client (lihat komentar `runPaymentVerificationMock`, `app/data/index.ts`).
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Finance & Billing' })

const { canView, clientScopeId } = usePermissions()

const projects = computed(() => (clientScopeId.value ? getProjectsByParty(clientScopeId.value) : []))
const invoices = computed(() => (clientScopeId.value ? getClientInvoices(clientScopeId.value) : []))
const summary = computed(() => (clientScopeId.value ? getClientFinanceSummary(clientScopeId.value) : undefined))

onMounted(() => {
  invoices.value.filter(invoice => invoice.status === 'waiting-verification').forEach(invoice => runPaymentVerificationMock(invoice.id))
})

function projectName (projectId: string): string {
  return projects.value.find(p => p.id === projectId)?.name ?? projectId
}

const search = ref('')
const statusFilter = ref<'all' | InvoiceStatus>('all')
const projectFilter = ref('all')

const rows = computed(() => {
  let result = invoices.value
  if (statusFilter.value !== 'all') { result = result.filter(invoice => invoice.status === statusFilter.value) }
  if (projectFilter.value !== 'all') { result = result.filter(invoice => invoice.projectId === projectFilter.value) }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    result = result.filter(invoice => invoice.label.toLowerCase().includes(q) || invoice.id.toLowerCase().includes(q) || projectName(invoice.projectId).toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
})

function statusTone (invoice: Invoice) {
  if (isInvoiceOverdue(invoice)) { return 'destructive' }
  return findStatusOption(INVOICE_STATUSES, invoice.status).tone
}
function statusLabel (invoice: Invoice) {
  if (isInvoiceOverdue(invoice)) { return `Overdue — ${findStatusOption(INVOICE_STATUSES, invoice.status).label}` }
  if (isInvoiceDueSoon(invoice)) { return `Segera Jatuh Tempo — ${findStatusOption(INVOICE_STATUSES, invoice.status).label}` }
  return findStatusOption(INVOICE_STATUSES, invoice.status).label
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Finance & Billing"
      description="Ringkasan finansial dan seluruh invoice lintas Project Order Anda."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Finance & Billing' }]"
    >
      <template #actions>
        <NuxtLink to="/client/billing/statement" target="_blank">
          <Button size="sm" variant="outline">
            <Printer class="h-4 w-4 mr-1.5" />Statement of Account
          </Button>
        </NuxtLink>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard title="Total Nilai Project" :value="formatCurrencyIdr(summary?.totalProjectValueIdr ?? 0)" :icon="Wallet" />
        <StatsCard title="Total Invoiced" :value="formatCurrencyIdr(summary?.totalInvoicedIdr ?? 0)" :icon="FileText" />
        <StatsCard title="Total Paid" :value="formatCurrencyIdr(summary?.totalPaidIdr ?? 0)" :icon="Wallet" icon-color="success" />
        <StatsCard title="Outstanding" :value="formatCurrencyIdr(summary?.outstandingIdr ?? 0)" :icon="AlertTriangle" icon-color="warning" />
        <StatsCard title="Overdue" :value="formatCurrencyIdr(summary?.overdueIdr ?? 0)" :icon="AlertTriangle" icon-color="destructive" />
        <StatsCard title="Jatuh Tempo Berikutnya" :value="summary?.nextDueDate ? formatDate(summary.nextDueDate) : '—'" :icon="Wallet" />
      </div>

      <SectionCard>
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4 flex-wrap">
          <div class="relative flex-1 max-w-sm w-full">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="search" placeholder="Cari invoice atau project..." class="pl-9" />
          </div>
          <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Status
            </option>
            <option v-for="option in INVOICE_STATUSES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <select v-model="projectFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Project
            </option>
            <option v-for="project in projects" :key="project.id" :value="project.id">
              {{ project.name }}
            </option>
          </select>
        </div>

        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="invoice in rows" :key="invoice.id">
                <TableCell class="font-medium text-foreground">
                  <NuxtLink :to="`/client/billing/invoices/${invoice.id}`" class="text-primary hover:underline">
                    {{ invoice.label }}
                  </NuxtLink>
                  <p class="text-xs text-muted-foreground">
                    {{ invoice.id }}
                  </p>
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ projectName(invoice.projectId) }}
                </TableCell>
                <TableCell><StatusBadge :label="findStatusOption(INVOICE_TYPES, invoice.invoiceType).label" :tone="findStatusOption(INVOICE_TYPES, invoice.invoiceType).tone" /></TableCell>
                <TableCell>{{ formatCurrencyIdr(invoice.amountIdr) }}</TableCell>
                <TableCell>{{ formatCurrencyIdr(getInvoiceOutstandingIdr(invoice.id)) }}</TableCell>
                <TableCell class="text-muted-foreground">
                  {{ formatDate(invoice.dueAt) }}
                </TableCell>
                <TableCell><StatusBadge :label="statusLabel(invoice)" :tone="statusTone(invoice)" /></TableCell>
              </TableRow>
              <TableEmpty v-if="rows.length === 0" :colspan="7">
                <EmptyState :icon="FileText" :title="invoices.length ? 'Tidak ada invoice yang cocok' : 'Belum ada invoice'" :description="invoices.length ? 'Coba ubah kata kunci pencarian atau filter.' : 'Invoice akan tampil di sini setelah tim kami menerbitkannya.'" />
              </TableEmpty>
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </template>
  </div>
</template>
