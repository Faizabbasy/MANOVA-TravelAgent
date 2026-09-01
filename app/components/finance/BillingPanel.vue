<script setup lang="ts">
import { computed } from 'vue'
import { Receipt } from 'lucide-vue-next'
import { PARTIES, getProjectsByParty, getClientInvoices, getClientFinanceSummary } from '~/data'
import { formatCurrencyIdr } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'

/**
 * Section "Billing" — Menu Finance & ACC > Invoice & Piutang. Ringkasan billing per customer company (B2B):
 * total invoice yang diterbitkan bulan ini dan status pembayaran ringkas. SELURUH angka reuse
 * `getClientFinanceSummary`/`getClientInvoices`/`getProjectsByParty` (`app/data/index.ts`) apa adanya —
 * TIDAK ada kalkulasi paralel. Bulan berjalan diambil dari `DEMO_REFERENCE_DATE` (bukan `Date.now()`) agar
 * konsisten dengan seluruh angka demo lain di app ini.
 */

const { canView } = usePermissions()
const hasAccess = computed(() => canView('finance-acc'))

const currentMonthKey = DEMO_REFERENCE_DATE.slice(0, 7) // 'YYYY-MM'

interface BillingRow {
  partyId: string
  partyName: string
  invoicesThisMonthCount: number
  invoicesThisMonthIdr: number
  outstandingIdr: number
  overdueIdr: number
}

const rows = computed<BillingRow[]>(() => PARTIES
  .filter(party => party.partyType !== 'individual' && getProjectsByParty(party.id).length > 0)
  .map((party) => {
    const invoices = getClientInvoices(party.id)
    const invoicesThisMonth = invoices.filter(invoice => invoice.issuedAt.startsWith(currentMonthKey))
    const summary = getClientFinanceSummary(party.id)
    return {
      partyId: party.id,
      partyName: party.name,
      invoicesThisMonthCount: invoicesThisMonth.length,
      invoicesThisMonthIdr: invoicesThisMonth.reduce((sum, invoice) => sum + invoice.amountIdr, 0),
      outstandingIdr: summary.outstandingIdr,
      overdueIdr: summary.overdueIdr
    }
  })
  .sort((a, b) => b.invoicesThisMonthIdr - a.invoicesThisMonthIdr))

function paymentStatus (row: BillingRow): { label: string, tone: 'success' | 'warning' | 'destructive' } {
  if (row.overdueIdr > 0) { return { label: 'Ada Tunggakan', tone: 'destructive' } }
  if (row.outstandingIdr > 0) { return { label: 'Belum Lunas', tone: 'warning' } }
  return { label: 'Lunas', tone: 'success' }
}

const totalThisMonthIdr = computed(() => rows.value.reduce((sum, row) => sum + row.invoicesThisMonthIdr, 0))
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!hasAccess" module-label="modul Finance & ACC" />

    <template v-else>
      <SectionCard
        :description="`Invoice diterbitkan bulan berjalan (${currentMonthKey}) per customer company. Total ${formatCurrencyIdr(totalThisMonthIdr)} — angka sama persis dengan Invoice dan AR Aging di atas, hanya direkap per customer.`"
      >
        <Table v-if="rows.length">
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead class="text-center">
                Invoice Bulan Ini
              </TableHead>
              <TableHead class="text-right">
                Nilai Invoice Bulan Ini
              </TableHead>
              <TableHead class="text-right">
                Outstanding
              </TableHead>
              <TableHead>Status Pembayaran</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.partyId">
              <TableCell>
                <NuxtLink :to="`/customer-journey/customers/${row.partyId}`" class="text-sm font-medium text-foreground hover:text-primary">
                  {{ row.partyName }}
                </NuxtLink>
              </TableCell>
              <TableCell class="text-center text-sm text-foreground">
                {{ row.invoicesThisMonthCount }}
              </TableCell>
              <TableCell class="text-right text-sm text-foreground">
                {{ formatCurrencyIdr(row.invoicesThisMonthIdr) }}
              </TableCell>
              <TableCell class="text-right text-sm text-muted-foreground">
                {{ formatCurrencyIdr(row.outstandingIdr) }}
              </TableCell>
              <TableCell>
                <StatusBadge :label="paymentStatus(row).label" :tone="paymentStatus(row).tone" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <EmptyState v-else :icon="Receipt" title="Belum ada data billing" description="Belum ada customer company dengan Project Order." />
      </SectionCard>
    </template>
  </div>
</template>
