<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search } from 'lucide-vue-next'
import { PAYMENTS, INVOICES, getProjectById } from '~/data'
import { formatCurrencyIdr, formatDate } from '~/utils/format'

/** Tab "Payments" — Menu Finance & ACC > Pembayaran & Rekonsiliasi (Penyederhanaan 7-Role/Menu). Dulu
 * `/finance/payments`, kini tab dalam satu menu bersama Reconciliation — logika tidak diubah. */

const { canView } = usePermissions()

const searchQuery = ref('')

function invoiceOf (invoiceId: string) {
  return INVOICES.find(invoice => invoice.id === invoiceId)
}

function projectNameOfInvoice (invoiceId: string) {
  const invoice = invoiceOf(invoiceId)
  return invoice ? (getProjectById(invoice.projectId)?.name ?? invoice.projectId) : '—'
}

const rows = computed(() => {
  let result = [...PAYMENTS].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).map(payment => ({
    payment,
    invoiceLabel: invoiceOf(payment.invoiceId)?.label ?? payment.invoiceId,
    projectLabel: projectNameOfInvoice(payment.invoiceId)
  }))

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row => row.invoiceLabel.toLowerCase().includes(q) || row.projectLabel.toLowerCase().includes(q))
  }
  return result
})

const { pageSize, currentPage, totalPages, pageItems: paginatedRows, rangeLabel } = usePagination(rows)
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('finance')" module-label="modul Finance & ACC" />

    <template v-else>
      <SectionCard compact content-class="p-0" titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Payments">
        <template #actions>
          <div class="relative max-w-sm w-full">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Cari invoice atau project..." class="pl-9" />
          </div>
        </template>

        <div class="overflow-x-auto border-t border-border">
          <Table class="w-full min-w-[640px]">
            <TableHeader>
              <TableRow class="bg-muted/40 hover:bg-muted/40">
                <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Invoice
                </TableHead>
                <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Project
                </TableHead>
                <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Jumlah
                </TableHead>
                <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Diterima
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in paginatedRows" :key="row.payment.id">
                <TableCell class="px-4 py-3 font-medium text-foreground">
                  {{ row.invoiceLabel }}
                </TableCell>
                <TableCell class="px-4 py-3 text-muted-foreground">
                  {{ row.projectLabel }}
                </TableCell>
                <TableCell class="px-4 py-3 tabular-nums">
                  {{ formatCurrencyIdr(row.payment.amountIdr) }}
                </TableCell>
                <TableCell class="px-4 py-3 text-muted-foreground">
                  {{ formatDate(row.payment.receivedAt) }}
                </TableCell>
              </TableRow>
              <TableEmpty v-if="rows.length === 0" :colspan="4">
                {{ searchQuery ? 'Tidak ada payment yang cocok dengan pencarian.' : 'Belum ada payment.' }}
              </TableEmpty>
            </TableBody>
          </Table>
        </div>

        <TablePaginationFooter
          :total="rows.length"
          :item-label="rows.length === 1 ? 'payment' : 'payments'"
          :page-size="pageSize"
          :current-page="currentPage"
          :total-pages="totalPages"
          :range-label="rangeLabel"
          @update:page-size="pageSize = $event"
          @update:current-page="currentPage = $event"
        />
      </SectionCard>
    </template>
  </div>
</template>
