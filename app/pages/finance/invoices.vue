<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, FileX } from 'lucide-vue-next'
import { INVOICES, getProjectById, getPaymentsByInvoice, getInvoiceOutstandingIdr } from '~/data'
import { INVOICE_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import { isInvoiceOverdue, invoiceAgingDays } from '~/utils/attention'
import type { Invoice } from '~/types/finance'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Invoices' })

const { canView } = usePermissions()

const searchQuery = ref('')
const statusFilter = ref('all')

function projectName(projectId: string) {
  return getProjectById(projectId)?.name ?? projectId
}

function agingLabel(invoice: Invoice) {
  if (invoice.status === 'paid') return 'Lunas'
  const days = invoiceAgingDays(invoice)
  if (days < 0) return `${Math.abs(days)} hari overdue`
  if (days === 0) return 'Jatuh tempo hari ini'
  return `Jatuh tempo dalam ${days} hari`
}

const rows = computed(() => {
  let result = INVOICES.map(invoice => ({ invoice, projectLabel: projectName(invoice.projectId) }))

  if (statusFilter.value !== 'all') {
    result = result.filter(row => row.invoice.status === statusFilter.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row => row.invoice.label.toLowerCase().includes(q) || row.projectLabel.toLowerCase().includes(q))
  }
  return result
})

const isDetailOpen = ref(false)
const selectedInvoice = ref<Invoice | null>(null)
const selectedPayments = computed(() => selectedInvoice.value ? getPaymentsByInvoice(selectedInvoice.value.id) : [])
const selectedOutstanding = computed(() => selectedInvoice.value ? getInvoiceOutstandingIdr(selectedInvoice.value.id) : 0)

function openDetail(invoice: Invoice) {
  selectedInvoice.value = invoice
  isDetailOpen.value = true
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Invoices"
      description="Daftar invoice lintas-project, termasuk status outstanding dan aging."
      :breadcrumb="[{ label: 'Finance', to: '/finance' }, { label: 'Invoices' }]"
    />

    <RoleAccessState v-if="!canView('finance')" module-label="modul Finance" />

    <template v-else>
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari invoice atau project..." class="pl-9" />
        </div>
        <select
          v-model="statusFilter"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="all">Semua Status</option>
          <option v-for="status in INVOICE_STATUSES" :key="status.value" :value="status.value">{{ status.label }}</option>
        </select>
      </div>

      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Jatuh Tempo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aging</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.invoice.id" class="cursor-pointer hover:bg-muted/50" @click="openDetail(row.invoice)">
              <TableCell class="font-medium text-foreground">{{ row.invoice.label }}</TableCell>
              <TableCell class="text-muted-foreground">{{ row.projectLabel }}</TableCell>
              <TableCell>{{ formatCurrencyIdr(row.invoice.amountIdr) }}</TableCell>
              <TableCell class="text-muted-foreground">{{ formatDate(row.invoice.dueAt) }}</TableCell>
              <TableCell>
                <StatusBadge
                  :label="findStatusOption(INVOICE_STATUSES, row.invoice.status).label"
                  :tone="findStatusOption(INVOICE_STATUSES, row.invoice.status).tone"
                />
              </TableCell>
              <TableCell :class="isInvoiceOverdue(row.invoice) ? 'text-destructive' : 'text-muted-foreground'">{{ agingLabel(row.invoice) }}</TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="6">
              {{ searchQuery || statusFilter !== 'all' ? 'Tidak ada invoice yang cocok dengan filter.' : 'Belum ada invoice.' }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>

    <Dialog v-model:open="isDetailOpen">
      <DialogContent class="max-w-md">
        <template v-if="selectedInvoice">
          <DialogHeader>
            <DialogTitle>{{ selectedInvoice.label }}</DialogTitle>
            <DialogDescription>{{ projectName(selectedInvoice.projectId) }}</DialogDescription>
          </DialogHeader>
          <DetailMetadataList :items="[
            { label: 'Jumlah', value: formatCurrencyIdr(selectedInvoice.amountIdr) },
            { label: 'Diterbitkan', value: formatDate(selectedInvoice.issuedAt) },
            { label: 'Jatuh Tempo', value: formatDate(selectedInvoice.dueAt) },
            { label: 'Outstanding', value: formatCurrencyIdr(selectedOutstanding) },
            { label: 'Aging', value: agingLabel(selectedInvoice) },
          ]" />
          <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2">Riwayat Pembayaran</p>
          <ul v-if="selectedPayments.length" class="divide-y divide-border">
            <li v-for="payment in selectedPayments" :key="payment.id" class="py-2 flex items-center justify-between gap-3">
              <span class="text-sm text-foreground">{{ formatCurrencyIdr(payment.amountIdr) }}</span>
              <span class="text-xs text-muted-foreground">{{ formatDate(payment.receivedAt) }}</span>
            </li>
          </ul>
          <EmptyState v-else :icon="FileX" title="Belum ada payment tercatat" />
        </template>
      </DialogContent>
    </Dialog>
  </div>
</template>
