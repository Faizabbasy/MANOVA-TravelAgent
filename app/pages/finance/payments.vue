<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search } from 'lucide-vue-next'
import { PAYMENTS, INVOICES, getProjectById } from '~/data'
import { formatCurrencyIdr, formatDate } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Payments' })

const { canView } = usePermissions()

const searchQuery = ref('')

function invoiceOf(invoiceId: string) {
  return INVOICES.find(invoice => invoice.id === invoiceId)
}

function projectNameOfInvoice(invoiceId: string) {
  const invoice = invoiceOf(invoiceId)
  return invoice ? (getProjectById(invoice.projectId)?.name ?? invoice.projectId) : '—'
}

const rows = computed(() => {
  let result = PAYMENTS.map(payment => ({
    payment,
    invoiceLabel: invoiceOf(payment.invoiceId)?.label ?? payment.invoiceId,
    projectLabel: projectNameOfInvoice(payment.invoiceId),
  }))

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row => row.invoiceLabel.toLowerCase().includes(q) || row.projectLabel.toLowerCase().includes(q))
  }
  return result
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Payments"
      description="Riwayat payment lintas-project."
      :breadcrumb="[{ label: 'Finance', to: '/finance' }, { label: 'Payments' }]"
    />

    <RoleAccessState v-if="!canView('finance')" module-label="modul Finance" />

    <template v-else>
      <div class="relative max-w-sm w-full">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Cari invoice atau project..." class="pl-9" />
      </div>

      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Diterima</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.payment.id">
              <TableCell class="font-medium text-foreground">{{ row.invoiceLabel }}</TableCell>
              <TableCell class="text-muted-foreground">{{ row.projectLabel }}</TableCell>
              <TableCell>{{ formatCurrencyIdr(row.payment.amountIdr) }}</TableCell>
              <TableCell class="text-muted-foreground">{{ formatDate(row.payment.receivedAt) }}</TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="4">
              {{ searchQuery ? 'Tidak ada payment yang cocok dengan pencarian.' : 'Belum ada payment.' }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
