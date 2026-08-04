<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowUpFromLine, AlertTriangle, Building2 } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { getPayables, getPayableAging } from '~/data/finance-ext'
import { SUPPLIER_INVOICE_STATUSES, SUPPLIER_INVOICE_MATCH_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { AgingBucketKey } from '~/types/finance-ext'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Payables (AP) — Finance & ACC' })

const { canView } = usePermissions()
const hasAccess = computed(() => canView('finance-acc'))

/**
 * Hutang vendor (revisi.md #1 — "tambah payable"). Diturunkan dari `SupplierInvoice` yang sudah ada di
 * modul Procurement, sehingga Finance dan Vendor & Partner selalu melihat angka yang sama.
 */
const payables = computed(() => getPayables())
const aging = computed(() => getPayableAging())

const bucketFilter = ref<'all' | AgingBucketKey>('all')
const vendorFilter = ref<'all' | string>('all')

const vendorOptions = computed(() => {
  const seen = new Map<string, string>()
  for (const row of payables.value) { seen.set(row.vendorId, row.vendorName) }
  return [...seen.entries()].map(([id, name]) => ({ id, name }))
})

const filteredRows = computed(() => {
  let result = payables.value
  if (bucketFilter.value !== 'all') { result = result.filter(row => row.bucket === bucketFilter.value) }
  if (vendorFilter.value !== 'all') { result = result.filter(row => row.vendorId === vendorFilter.value) }
  return result
})

const totals = computed(() => ({
  outstanding: payables.value.reduce((sum, row) => sum + row.outstandingIdr, 0),
  overdue: payables.value.filter(row => row.agingDays > 30).reduce((sum, row) => sum + row.outstandingIdr, 0),
  vendors: vendorOptions.value.length,
  scheduled: payables.value.filter(row => row.scheduleDate).length
}))

/** Konsentrasi hutang per vendor — menunjukkan ke siapa eksposur terbesar berada. */
const byVendor = computed(() => vendorOptions.value
  .map(vendor => ({
    ...vendor,
    amountIdr: payables.value.filter(row => row.vendorId === vendor.id).reduce((sum, row) => sum + row.outstandingIdr, 0),
    count: payables.value.filter(row => row.vendorId === vendor.id).length
  }))
  .sort((a, b) => b.amountIdr - a.amountIdr))

const maxVendorAmount = computed(() => Math.max(1, ...byVendor.value.map(row => row.amountIdr)))

const BUCKET_TONE: Record<AgingBucketKey, string> = {
  current: 'success',
  '1-30': 'info',
  '31-60': 'warning',
  '61-90': 'warning',
  '90plus': 'destructive'
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Payables (AP)"
      description="Kewajiban ke vendor beserta umurnya, bersumber dari Supplier Invoice di modul Vendor & Partner."
      :breadcrumb="[{ label: 'Finance & ACC', to: '/finance' }, { label: 'Payables' }]"
    />

    <RoleAccessState v-if="!hasAccess" module-label="modul Finance & ACC" />

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Hutang" :value="formatCurrencyIdr(totals.outstanding)" :icon="ArrowUpFromLine" icon-color="warning" />
        <StatsCard title="Tertunggak > 30 Hari" :value="formatCurrencyIdr(totals.overdue)" :icon="AlertTriangle" :icon-color="totals.overdue ? 'destructive' : 'success'" />
        <StatsCard title="Jumlah Vendor" :value="String(totals.vendors)" :icon="Building2" />
        <StatsCard title="Sudah Dijadwalkan" :value="`${totals.scheduled}/${payables.length}`" :icon="ArrowUpFromLine" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <SectionCard title="Aging Hutang" :description="`Terhadap tanggal acuan ${formatDate(DEMO_REFERENCE_DATE)}.`">
          <ul class="space-y-2">
            <li v-for="bucket in aging" :key="bucket.key" class="flex items-center gap-3">
              <button
                type="button"
                :class="cn(
                  'w-36 shrink-0 text-left text-sm transition-colors',
                  bucketFilter === bucket.key ? 'text-primary font-medium' : 'text-foreground hover:text-primary'
                )"
                @click="bucketFilter = bucketFilter === bucket.key ? 'all' : bucket.key"
              >
                {{ bucket.label }}
              </button>
              <span class="flex-1 text-right text-sm font-medium text-foreground">{{ formatCurrencyIdr(bucket.amountIdr) }}</span>
              <span class="w-16 shrink-0 text-right text-xs text-muted-foreground">{{ bucket.count }} tagihan</span>
            </li>
          </ul>
        </SectionCard>

        <SectionCard title="Konsentrasi per Vendor">
          <ul class="space-y-2.5">
            <li v-for="vendor in byVendor.slice(0, 6)" :key="vendor.id" class="flex items-center gap-3">
              <span class="w-36 shrink-0 text-sm text-foreground truncate" :title="vendor.name">{{ vendor.name }}</span>
              <span class="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <span class="block h-full rounded-full bg-warning" :style="{ width: `${(vendor.amountIdr / maxVendorAmount) * 100}%` }" />
              </span>
              <span class="w-36 shrink-0 text-right text-sm font-medium text-foreground">{{ formatCurrencyIdr(vendor.amountIdr) }}</span>
            </li>
          </ul>
          <EmptyState v-if="!byVendor.length" title="Belum ada hutang vendor" />
        </SectionCard>
      </div>

      <SectionCard>
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 class="text-base font-semibold text-foreground">
            Rincian Hutang
          </h3>
          <select v-model="vendorFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Vendor
            </option>
            <option v-for="vendor in vendorOptions" :key="vendor.id" :value="vendor.id">
              {{ vendor.name }}
            </option>
          </select>
        </div>

        <Table v-if="filteredRows.length">
          <TableHeader>
            <TableRow>
              <TableHead>Tagihan</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Jadwal Bayar</TableHead>
              <TableHead class="text-right">
                Nilai
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Umur</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in filteredRows" :key="row.supplierInvoiceId">
              <TableCell class="text-sm font-medium text-foreground font-mono">
                {{ row.supplierInvoiceId }}
              </TableCell>
              <TableCell>
                <NuxtLink :to="`/vendors/${row.vendorId}`" class="text-sm text-foreground hover:text-primary">
                  {{ row.vendorName }}
                </NuxtLink>
              </TableCell>
              <TableCell>
                <NuxtLink v-if="row.projectId" :to="`/project-orders/${row.projectId}`" class="text-sm text-primary hover:underline">
                  {{ row.projectName }}
                </NuxtLink>
                <span v-else class="text-sm text-muted-foreground">—</span>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ row.scheduleDate ? formatDate(row.scheduleDate) : 'Belum dijadwalkan' }}
              </TableCell>
              <TableCell class="text-right text-sm font-semibold text-foreground">
                {{ formatCurrencyIdr(row.amountIdr) }}
              </TableCell>
              <TableCell>
                <StatusBadge
                  :label="findStatusOption(SUPPLIER_INVOICE_STATUSES, row.status).label"
                  :tone="findStatusOption(SUPPLIER_INVOICE_STATUSES, row.status).tone"
                />
                <StatusBadge
                  v-if="row.matchStatus"
                  :label="findStatusOption(SUPPLIER_INVOICE_MATCH_STATUSES, row.matchStatus).label"
                  :tone="findStatusOption(SUPPLIER_INVOICE_MATCH_STATUSES, row.matchStatus).tone"
                />
              </TableCell>
              <TableCell>
                <StatusBadge
                  :label="row.agingDays > 0 ? `${row.agingDays} hari` : 'Belum jatuh tempo'"
                  :tone="BUCKET_TONE[row.bucket] as never"
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <EmptyState v-else :icon="ArrowUpFromLine" title="Tidak ada hutang" description="Seluruh tagihan vendor sudah terselesaikan untuk filter ini." />
      </SectionCard>
    </template>
  </div>
</template>
