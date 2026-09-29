<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDownToLine, AlertTriangle, Wallet, Building2 } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { getReceivables, getReceivableAging, getPayables, getPayableAging } from '~/data/finance-ext'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { AgingBucketKey } from '~/types/finance-ext'

/** Tab "AR Aging" — Menu Finance & ACC > Invoice & Piutang (Penyederhanaan 7-Role/Menu). Dulu
 * `/finance/receivables`, kini tab dalam satu menu bersama Invoice/Credit & Debit Note — logika tidak diubah. */

const { canView } = usePermissions()
const hasAccess = computed(() => canView('finance-acc'))

/**
 * Piutang (revisi.md #1 — "achievable" dibaca sebagai *receivable*). Seluruh baris DITURUNKAN dari
 * `Invoice` + `Payment` yang sudah ada, jadi tidak ada ledger piutang paralel yang bisa menyimpang.
 * Halaman ini juga menampilkan ringkasan hutang (AP) agar posisi kas bersih langsung terbaca.
 */
const receivables = computed(() => getReceivables())
const aging = computed(() => getReceivableAging())
const payables = computed(() => getPayables())
const payableAging = computed(() => getPayableAging())

const bucketFilter = ref<'all' | AgingBucketKey>('all')

const filteredRows = computed(() =>
  (bucketFilter.value === 'all' ? receivables.value : receivables.value.filter(row => row.bucket === bucketFilter.value)))

const totals = computed(() => {
  const receivable = receivables.value.reduce((sum, row) => sum + row.outstandingIdr, 0)
  const payable = payables.value.reduce((sum, row) => sum + row.outstandingIdr, 0)
  return {
    receivable,
    payable,
    net: receivable - payable,
    overdue: receivables.value.filter(row => row.agingDays > 0).reduce((sum, row) => sum + row.outstandingIdr, 0)
  }
})

const BUCKET_TONE: Record<AgingBucketKey, string> = {
  current: 'success',
  '1-30': 'info',
  '31-60': 'warning',
  '61-90': 'warning',
  '90plus': 'destructive'
}

const maxBucketAmount = computed(() => Math.max(1, ...aging.value.map(bucket => bucket.amountIdr)))
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!hasAccess" module-label="modul Finance & ACC" />

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Piutang" :value="formatCurrencyIdr(totals.receivable)" :icon="ArrowDownToLine" icon-color="primary" />
        <StatsCard title="Piutang Jatuh Tempo" :value="formatCurrencyIdr(totals.overdue)" :icon="AlertTriangle" :icon-color="totals.overdue ? 'destructive' : 'success'" />
        <StatsCard title="Total Hutang (AP)" :value="formatCurrencyIdr(totals.payable)" :icon="Building2" icon-color="warning" />
        <StatsCard title="Posisi Bersih" :value="formatCurrencyIdr(totals.net)" :icon="Wallet" :icon-color="totals.net >= 0 ? 'success' : 'destructive'" />
      </div>

      <SectionCard title="Aging Piutang" :description="`Dihitung terhadap tanggal acuan demo ${formatDate(DEMO_REFERENCE_DATE)}.`">
        <ul class="space-y-2.5">
          <li v-for="bucket in aging" :key="bucket.key" class="flex items-center gap-3">
            <button
              type="button"
              :class="cn(
                'w-40 shrink-0 text-left text-sm transition-colors',
                bucketFilter === bucket.key ? 'text-primary font-medium' : 'text-foreground hover:text-primary'
              )"
              @click="bucketFilter = bucketFilter === bucket.key ? 'all' : bucket.key"
            >
              {{ bucket.label }}
              <span class="text-xs text-muted-foreground">({{ bucket.count }})</span>
            </button>
            <span class="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <span
                :class="cn('block h-full rounded-full', {
                  'bg-success': bucket.key === 'current',
                  'bg-chart-5': bucket.key === '1-30',
                  'bg-warning': bucket.key === '31-60' || bucket.key === '61-90',
                  'bg-destructive': bucket.key === '90plus'
                })"
                :style="{ width: `${(bucket.amountIdr / maxBucketAmount) * 100}%` }"
              />
            </span>
            <span class="w-44 shrink-0 text-right text-sm font-medium text-foreground">{{ formatCurrencyIdr(bucket.amountIdr) }}</span>
          </li>
        </ul>
      </SectionCard>

      <SectionCard>
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 class="text-base font-semibold text-foreground">
            Rincian Piutang
          </h3>
          <Button v-if="bucketFilter !== 'all'" variant="outline" size="sm" @click="bucketFilter = 'all'">
            Tampilkan semua
          </Button>
        </div>

        <Table v-if="filteredRows.length">
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Jatuh Tempo</TableHead>
              <TableHead class="text-right">
                Nilai
              </TableHead>
              <TableHead class="text-right">
                Terbayar
              </TableHead>
              <TableHead class="text-right">
                Outstanding
              </TableHead>
              <TableHead>Umur</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in filteredRows" :key="row.invoiceId">
              <TableCell>
                <p class="text-sm font-medium text-foreground">
                  {{ row.label }}
                </p>
                <NuxtLink :to="`/project-orders/${row.projectId}`" class="text-xs text-primary hover:underline">
                  {{ row.projectName }}
                </NuxtLink>
              </TableCell>
              <TableCell class="text-sm text-foreground">
                {{ row.partyName }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ formatDate(row.dueAt) }}
              </TableCell>
              <TableCell class="text-right text-sm text-muted-foreground">
                {{ formatCurrencyIdr(row.amountIdr) }}
              </TableCell>
              <TableCell class="text-right text-sm text-success">
                {{ formatCurrencyIdr(row.paidIdr) }}
              </TableCell>
              <TableCell class="text-right text-sm font-semibold text-foreground">
                {{ formatCurrencyIdr(row.outstandingIdr) }}
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

        <EmptyState v-else :icon="ArrowDownToLine" title="Tidak ada piutang" description="Seluruh invoice sudah lunas untuk filter ini." />
      </SectionCard>

      <SectionCard title="Ringkasan Hutang (AP)" description="Rincian lengkap tersedia di tab Hutang & Opex.">
        <div class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div v-for="bucket in payableAging" :key="bucket.key" class="rounded-lg border border-border px-3 py-2.5">
            <p class="text-xs text-muted-foreground">
              {{ bucket.label }}
            </p>
            <p class="text-sm font-semibold text-foreground mt-0.5">
              {{ formatCurrencyIdr(bucket.amountIdr) }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ bucket.count }} tagihan
            </p>
          </div>
        </div>
        <NuxtLink to="/finance/payables" class="inline-block mt-3 text-xs text-primary hover:underline">
          Buka Hutang & Opex →
        </NuxtLink>
      </SectionCard>
    </template>
  </div>
</template>
