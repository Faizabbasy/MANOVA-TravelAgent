<script setup lang="ts">
import { Activity, Lock, TrendingUp, Wallet } from 'lucide-vue-next'
import { PROJECTS, getPartyById } from '~/data'
import { formatMoneyMinor } from '~/lib/money'
import { formatPercentage } from '~/utils/format'

/**
 * Finance part of Reports (Phase 7): revenue and profitability per month, cost per trip and vendor spend —
 * all from the server (GET /finance/reports/monthly and /finance/overview), the same definitions as a
 * project's profitability. Finance and Super Admin only; Admin sees a one-line explanation instead.
 */
const api = useApi()
const session = useServerSession()
const canSee = computed(() => session.can('finance.view-project-finance'))
const sessionReady = computed(() => session.state.value.status === 'ready')

const report = useFinanceQuery(async () => (await api.finance.monthlyReport({ months: '6' })).data, { enabled: () => canSee.value })
const overview = useFinanceOverview()

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`

const months = computed(() => [...(report.data.value?.months ?? [])].reverse())
const latest = computed(() => report.data.value?.months.at(-1) ?? null)
const maxBar = computed(() => Math.max(1, ...months.value.flatMap(m => [Math.abs(Number(m.revenueMinor)), Number(m.costMinor)])))

/** Per project: revenue (billed net of credit notes) against actual cost; margin only where revenue exists. */
const trips = computed(() => (overview.full.value?.projects ?? [])
  .filter(p => p.costMinor !== '0' || p.revenueMinor !== '0')
  .map((p) => {
    const project = PROJECTS.find(x => x.id === p.projectId)
    const revenue = Number(p.revenueMinor)
    const cost = Number(p.costMinor)
    return {
      id: p.projectId,
      name: project?.name ?? p.projectId,
      partyName: project ? getPartyById(project.partyId)?.name ?? '—' : '—',
      travelers: project?.travelerCount ?? 0,
      costMinor: p.costMinor,
      costPerTraveler: project?.travelerCount ? String(Math.round(cost / project.travelerCount)) : null,
      marginMinor: String(revenue - cost),
      marginPercent: revenue > 0 ? ((revenue - cost) / revenue) * 100 : null,
      cancelled: p.cancelled
    }
  })
  .sort((a, b) => (b.marginPercent ?? -Infinity) - (a.marginPercent ?? -Infinity)))
const averageMargin = computed(() => {
  const withMargin = trips.value.filter(t => t.marginPercent !== null)
  return withMargin.length ? withMargin.reduce((s, t) => s + t.marginPercent!, 0) / withMargin.length : null
})
const maxVendor = computed(() => Math.max(1, ...(report.data.value?.vendors ?? []).map(v => Number(v.approvedMinor))))
</script>

<template>
  <div v-if="sessionReady && !canSee" class="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
    <Lock class="h-4 w-4 shrink-0" />
    Angka keuangan (revenue, laba, margin, belanja vendor) hanya untuk Finance dan Super Admin. Status pembayaran per project ada di halaman project.
  </div>

  <div v-else-if="canSee" class="space-y-5">
    <FinanceErrorState v-if="report.error.value && !report.data.value" :error="report.error.value" compact @retry="report.refresh" />

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatsCard :title="latest ? `Revenue ${monthLabel(latest.month)}` : 'Revenue bulan ini'" :value="latest ? formatMoneyMinor(latest.revenueMinor) : '…'" :icon="TrendingUp" icon-color="primary" />
      <StatsCard
        :title="latest ? `Laba bersih ${monthLabel(latest.month)}` : 'Laba bersih'"
        :value="latest ? formatMoneyMinor(latest.netMinor) : '…'"
        :icon="Wallet"
        :icon-color="latest && latest.netMinor.startsWith('-') ? 'destructive' : 'success'"
      />
      <StatsCard
        title="Margin rata-rata trip"
        :value="averageMargin === null ? '—' : formatPercentage(averageMargin, 1)"
        :subtitle="`${trips.filter(t => t.marginPercent !== null).length} project yang sudah ditagih`"
        :icon="Activity"
        :icon-color="(averageMargin ?? 0) >= 20 ? 'success' : 'warning'"
      />
    </div>

    <SectionCard title="Revenue & Profitabilitas per Bulan" description="Akrual: pendapatan saat invoice terbit (dikurangi credit note), biaya saat invoice vendor disetujui atau pengeluaran dibayar. Uang yang benar-benar masuk/keluar ada di Mutasi Rekening.">
      <div v-if="!report.data.value" class="space-y-2">
        <div v-for="i in 4" :key="i" class="h-8 animate-pulse rounded bg-muted" />
      </div>
      <ul v-else class="space-y-3">
        <li v-for="m in months" :key="m.month">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="w-32 shrink-0 text-sm font-medium text-foreground">{{ monthLabel(m.month) }}</span>
            <span class="relative h-6 min-w-[8rem] flex-1 overflow-hidden rounded-lg bg-muted" aria-hidden="true">
              <span class="block h-full bg-primary/70" :style="{ width: `${(Math.max(0, Number(m.revenueMinor)) / maxBar) * 100}%` }" />
              <span class="absolute left-0 top-[70%] block h-[30%] bg-destructive/60" :style="{ width: `${(Number(m.costMinor) / maxBar) * 100}%` }" />
            </span>
            <span class="w-36 shrink-0 text-right text-sm tabular-nums text-foreground">{{ formatMoneyMinor(m.revenueMinor) }}</span>
            <span class="w-36 shrink-0 text-right text-sm font-semibold tabular-nums" :class="m.netMinor.startsWith('-') ? 'text-destructive' : 'text-success'">{{ formatMoneyMinor(m.netMinor) }}</span>
          </div>
          <p class="mt-0.5 text-xs text-muted-foreground sm:ml-36">
            Invoice {{ formatMoneyMinor(m.invoicedMinor) }} − credit note {{ formatMoneyMinor(m.creditedMinor) }} · biaya vendor {{ formatMoneyMinor(m.vendorCostMinor) }} · pengeluaran {{ formatMoneyMinor(m.expenseMinor) }}
          </p>
        </li>
      </ul>
      <p class="mt-3 text-xs text-muted-foreground">
        Batang atas = pendapatan, batang bawah = biaya. Kolom kanan: pendapatan, lalu laba bersih.
      </p>
    </SectionCard>

    <div class="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
      <SectionCard title="Cost per Trip" description="Biaya aktual per project dan per traveler, dengan margin terhadap pendapatan yang sudah ditagih.">
        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead class="text-right">
                  Biaya
                </TableHead>
                <TableHead class="text-right">
                  Per traveler
                </TableHead>
                <TableHead class="text-right">
                  Margin
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in trips" :key="row.id">
                <TableCell>
                  <NuxtLink :to="`/project-orders/${row.id}`" class="text-sm font-medium text-foreground hover:text-primary">
                    {{ row.name }}
                  </NuxtLink>
                  <p class="text-xs text-muted-foreground">
                    {{ row.partyName }} · {{ row.travelers }} pax<template v-if="row.cancelled">
                      · dibatalkan
                    </template>
                  </p>
                </TableCell>
                <TableCell class="whitespace-nowrap text-right text-sm tabular-nums text-foreground">
                  {{ formatMoneyMinor(row.costMinor) }}
                </TableCell>
                <TableCell class="whitespace-nowrap text-right text-sm tabular-nums text-muted-foreground">
                  {{ row.costPerTraveler ? formatMoneyMinor(row.costPerTraveler) : '—' }}
                </TableCell>
                <TableCell class="whitespace-nowrap text-right">
                  <span v-if="row.marginPercent === null" class="text-sm text-muted-foreground" title="Belum ada pendapatan yang ditagih">—</span>
                  <template v-else>
                    <span class="text-sm font-semibold" :class="row.marginPercent >= 20 ? 'text-success' : row.marginPercent >= 0 ? 'text-warning' : 'text-destructive'">{{ formatPercentage(row.marginPercent, 1) }}</span>
                    <p class="text-xs tabular-nums text-muted-foreground">
                      {{ formatMoneyMinor(row.marginMinor) }}
                    </p>
                  </template>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <EmptyState v-if="overview.full.value && !trips.length" title="Belum ada biaya atau tagihan tercatat" />
      </SectionCard>

      <SectionCard title="Vendor Performance" description="Invoice vendor yang disetujui per vendor, dan jumlah project yang dilayani.">
        <ul v-if="report.data.value?.vendors.length" class="space-y-2.5">
          <li v-for="row in report.data.value.vendors.slice(0, 8)" :key="row.vendor.id" class="flex items-center gap-3">
            <NuxtLink :to="`/vendors/${row.vendor.id}`" class="w-40 shrink-0 truncate text-sm text-foreground hover:text-primary" :title="row.vendor.name">
              {{ row.vendor.name }}
            </NuxtLink>
            <span class="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <span class="block h-full rounded-full bg-warning" :style="{ width: `${(Number(row.approvedMinor) / maxVendor) * 100}%` }" />
            </span>
            <span class="w-36 shrink-0 text-right text-sm tabular-nums text-foreground">{{ formatMoneyMinor(row.approvedMinor) }}</span>
            <span class="w-20 shrink-0 text-right text-xs text-muted-foreground">{{ row.projectCount }} project</span>
          </li>
        </ul>
        <EmptyState v-else-if="report.data.value" title="Belum ada invoice vendor yang disetujui" />
      </SectionCard>
    </div>
  </div>
</template>
