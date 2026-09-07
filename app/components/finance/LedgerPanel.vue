<script setup lang="ts">
import { computed, ref } from 'vue'
import { BookOpen, TrendingUp, Scale, Wallet, Landmark } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { LEDGER_ACCOUNTS, getJournalEntries, getLedgerBalances, getRevenueByPeriod, getLedgerAccount } from '~/data/finance-ext'
import { PROJECTS, getProjectById } from '~/data'
import { formatCurrencyIdr, formatDate, formatPercentage } from '~/utils/format'

/** Tab "Jurnal & Saldo" — Menu Finance & ACC > Buku Besar (Penyederhanaan 7-Role/Menu). Dulu
 * `/finance/ledger`, kini tab dalam satu menu bersama Tax & Currency — logika tidak diubah, termasuk
 * sub-tab internalnya sendiri (Saldo Akun/Jurnal/Revenue, plain ref — tidak query-synced, jadi tidak
 * bentrok dengan tab level-atas container). */

const { canView } = usePermissions()
const hasAccess = computed(() => canView('finance-acc'))

/**
 * Buku besar dan laporan pendapatan. Seluruh jurnal DITURUNKAN dari invoice, pembayaran, tagihan vendor,
 * dan opex yang sudah ada — tidak ada entri yang diketik ulang, sehingga buku besar mustahil menyimpang
 * dari transaksi yang mendasarinya.
 */
const activeTab = ref<'balances' | 'journal' | 'revenue' | 'balance-sheet' | 'cashflow'>('balances')
const accountFilter = ref<'all' | string>('all')
/** Filter project (Fase 3.1 — Poros Project Order + Jurnal Finance, Penyederhanaan 7-Role/Menu) — setiap `JournalEntry` kini membawa `projectId`, jadi P&L per project bisa dibaca langsung dari jurnal yang sama, bukan angka statis terpisah. */
const projectFilter = ref<'all' | string>('all')

const balances = computed(() => getLedgerBalances())
const journal = computed(() => getJournalEntries())
const revenue = computed(() => getRevenueByPeriod())

const projectsWithJournalEntries = computed(() => {
  const projectIds = new Set(journal.value.map(entry => entry.projectId).filter((id): id is string => Boolean(id)))
  return PROJECTS.filter(project => projectIds.has(project.id))
})

const filteredJournal = computed(() => journal.value
  .filter(entry => accountFilter.value === 'all' || entry.lines.some(line => line.accountCode === accountFilter.value))
  .filter(entry => projectFilter.value === 'all' || entry.projectId === projectFilter.value))

const trialBalance = computed(() => ({
  debit: balances.value.reduce((sum, row) => sum + row.debitIdr, 0),
  credit: balances.value.reduce((sum, row) => sum + row.creditIdr, 0)
}))

const isBalanced = computed(() => trialBalance.value.debit === trialBalance.value.credit)

const latestRevenue = computed(() => revenue.value.at(-1))
const maxRevenue = computed(() => Math.max(1, ...revenue.value.map(row => Math.abs(row.revenueIdr))))

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  asset: 'Aset',
  liability: 'Kewajiban',
  equity: 'Ekuitas',
  revenue: 'Pendapatan',
  expense: 'Beban'
}
const ACCOUNT_TYPE_TONE: Record<string, 'primary' | 'warning' | 'purple' | 'success' | 'destructive'> = {
  asset: 'primary',
  liability: 'warning',
  equity: 'purple',
  revenue: 'success',
  expense: 'destructive'
}

const { pageSize, currentPage, totalPages, pageItems: paginatedJournal, rangeLabel } = usePagination(filteredJournal, 20)

/**
 * Neraca (Balance Sheet) — SELURUH angka reuse `balances` (`getLedgerBalances()`) di atas apa adanya,
 * dikelompokkan per `LedgerAccount.type`. `LEDGER_ACCOUNTS` belum punya akun bertipe `equity` tersendiri
 * (revisi.md tidak meminta modal disetor/laba ditahan sebagai entitas baru), jadi Ekuitas di sini adalah
 * angka plug standar akuntansi (Aset − Kewajiban) — bukan akun jurnal terpisah, dilabeli jelas sebagai
 * turunan supaya tidak disalahpahami sebagai modal disetor riil.
 */
const balanceSheetAssets = computed(() => balances.value.filter(row => row.account.type === 'asset'))
const balanceSheetLiabilities = computed(() => balances.value.filter(row => row.account.type === 'liability'))
const totalAssetsIdr = computed(() => balanceSheetAssets.value.reduce((sum, row) => sum + row.balanceIdr, 0))
const totalLiabilitiesIdr = computed(() => balanceSheetLiabilities.value.reduce((sum, row) => sum + row.balanceIdr, 0))
const derivedEquityIdr = computed(() => totalAssetsIdr.value - totalLiabilitiesIdr.value)

/**
 * Cashflow — SELURUH angka reuse `revenue` (`getRevenueByPeriod()`) di atas apa adanya. Kas masuk =
 * `collectedIdr` (Payment yang benar-benar diterima), kas keluar = `directCostIdr` (tagihan vendor) +
 * `opexIdr` (Opex disetujui/dibayar). Saldo kas kumulatif murni akumulasi net cash flow lintas periode demo
 * — bukan saldo kas riil awal (tidak ada modal awal yang tercatat di fixture ini).
 */
const cashFlowRows = computed(() => {
  let cumulative = 0
  return revenue.value.map((row) => {
    const cashOutIdr = row.directCostIdr + row.opexIdr
    const netCashFlowIdr = row.collectedIdr - cashOutIdr
    cumulative += netCashFlowIdr
    return { period: row.period, cashInIdr: row.collectedIdr, cashOutIdr, netCashFlowIdr, cumulativeIdr: cumulative }
  })
})
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!hasAccess" module-label="modul Finance & ACC" />

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Debit" :value="formatCurrencyIdr(trialBalance.debit)" :icon="BookOpen" />
        <StatsCard title="Total Kredit" :value="formatCurrencyIdr(trialBalance.credit)" :icon="BookOpen" />
        <StatsCard title="Neraca Saldo" :value="isBalanced ? 'Seimbang' : 'Tidak Seimbang'" :icon="Scale" :icon-color="isBalanced ? 'success' : 'destructive'" />
        <StatsCard
          v-if="latestRevenue"
          title="Laba Bersih Terakhir"
          :value="formatCurrencyIdr(latestRevenue.netProfitIdr)"
          :icon="TrendingUp"
          :icon-color="latestRevenue.netProfitIdr >= 0 ? 'success' : 'destructive'"
        />
      </div>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger value="balances">
            Saldo Akun
          </TabsTrigger>
          <TabsTrigger value="journal">
            Jurnal
          </TabsTrigger>
          <TabsTrigger value="revenue">
            Revenue Report
          </TabsTrigger>
          <TabsTrigger value="balance-sheet">
            Neraca
          </TabsTrigger>
          <TabsTrigger value="cashflow">
            Cashflow
          </TabsTrigger>
        </TabsList>

        <TabsContent value="balances" class="pt-4">
          <SectionCard compact content-class="p-0" titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Saldo Akun" description="Saldo debit/kredit per akun — diturunkan langsung dari jurnal, tidak ada input manual.">
            <div class="overflow-x-auto border-t border-border">
              <Table class="w-full min-w-[720px]">
                <TableHeader>
                  <TableRow class="bg-muted/40 hover:bg-muted/40">
                    <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Kode
                    </TableHead>
                    <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Nama Akun
                    </TableHead>
                    <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Tipe
                    </TableHead>
                    <TableHead class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Debit
                    </TableHead>
                    <TableHead class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Kredit
                    </TableHead>
                    <TableHead class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Saldo
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="row in balances" :key="row.account.code">
                    <TableCell class="px-4 py-3 font-mono text-sm text-muted-foreground">
                      {{ row.account.code }}
                    </TableCell>
                    <TableCell class="px-4 py-3 text-sm font-medium text-foreground">
                      {{ row.account.name }}
                    </TableCell>
                    <TableCell class="px-4 py-3">
                      <StatusBadge :label="ACCOUNT_TYPE_LABEL[row.account.type]" :tone="ACCOUNT_TYPE_TONE[row.account.type]" />
                    </TableCell>
                    <TableCell class="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                      {{ formatCurrencyIdr(row.debitIdr) }}
                    </TableCell>
                    <TableCell class="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                      {{ formatCurrencyIdr(row.creditIdr) }}
                    </TableCell>
                    <TableCell class="px-4 py-3 text-right text-sm font-semibold tabular-nums" :class="row.balanceIdr >= 0 ? 'text-foreground' : 'text-destructive'">
                      {{ formatCurrencyIdr(row.balanceIdr) }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="journal" class="pt-4">
          <SectionCard compact content-class="p-0" titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Jurnal" :description="`${filteredJournal.length} entri jurnal`">
            <template #actions>
              <div class="flex flex-wrap items-center gap-2">
                <select v-model="projectFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="all">
                    Semua Project
                  </option>
                  <option v-for="project in projectsWithJournalEntries" :key="project.id" :value="project.id">
                    {{ project.name }}
                  </option>
                </select>
                <select v-model="accountFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="all">
                    Semua Akun
                  </option>
                  <option v-for="account in LEDGER_ACCOUNTS" :key="account.code" :value="account.code">
                    {{ account.code }} — {{ account.name }}
                  </option>
                </select>
              </div>
            </template>

            <!-- Ditumpuk per-entry (bukan satu table flat) — sebelumnya tiap baris debit/kredit jadi row tabel
                 sendiri dengan Tanggal/Keterangan/Project cuma keisi di baris pertama (sisanya blank), jadi
                 antar-entri jurnal susah dibedakan dan banyak sel kosong bikin pusing dibaca. Sekarang tiap
                 entri jelas jadi satu blok, baris debit/kredit-nya dikelompokkan di dalamnya. -->
            <div v-if="paginatedJournal.length" class="border-t border-border">
              <div class="flex items-center justify-between gap-3 bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Entri Jurnal</span>
                <span class="flex items-center gap-6">
                  <span class="w-28 text-right">Debit</span>
                  <span class="w-28 text-right">Kredit</span>
                </span>
              </div>
              <div class="divide-y divide-border">
                <div v-for="entry in paginatedJournal" :key="entry.id" class="px-4 py-3">
                  <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <div class="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <span class="shrink-0 text-xs tabular-nums text-muted-foreground">{{ formatDate(entry.date) }}</span>
                      <span class="text-sm font-medium text-foreground">{{ entry.description }}</span>
                    </div>
                    <span v-if="entry.projectId" class="shrink-0 text-xs text-muted-foreground">
                      {{ getProjectById(entry.projectId)?.name ?? entry.projectId }}
                    </span>
                  </div>

                  <div class="mt-2 space-y-1 rounded-lg bg-muted/20 p-2.5">
                    <div v-for="(line, index) in entry.lines" :key="index" class="flex items-center justify-between gap-3">
                      <span class="min-w-0 truncate text-sm">
                        <span class="font-mono text-xs text-muted-foreground">{{ line.accountCode }}</span>
                        <span class="ml-1.5 text-foreground">{{ getLedgerAccount(line.accountCode)?.name }}</span>
                      </span>
                      <span class="flex shrink-0 items-center gap-6 text-sm tabular-nums">
                        <span class="w-28 text-right" :class="line.debitIdr ? 'text-foreground' : 'text-muted-foreground/40'">{{ line.debitIdr ? formatCurrencyIdr(line.debitIdr) : '—' }}</span>
                        <span class="w-28 text-right" :class="line.creditIdr ? 'text-foreground' : 'text-muted-foreground/40'">{{ line.creditIdr ? formatCurrencyIdr(line.creditIdr) : '—' }}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <EmptyState v-else title="Tidak ada entri jurnal" description="Tidak ada entri jurnal yang cocok dengan filter." />

            <TablePaginationFooter
              :total="filteredJournal.length"
              item-label="entri"
              :page-size="pageSize"
              :current-page="currentPage"
              :total-pages="totalPages"
              :range-label="rangeLabel"
              @update:page-size="pageSize = $event"
              @update:current-page="currentPage = $event"
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="revenue" class="pt-4">
          <SectionCard compact content-class="p-0" titleClass="text-sm font-bold normal-case tracking-normal text-foreground" title="Revenue Report per Periode">
            <div class="overflow-x-auto border-t border-border">
              <Table class="w-full min-w-[920px]">
                <TableHeader>
                  <TableRow class="bg-muted/40 hover:bg-muted/40">
                    <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Periode
                    </TableHead>
                    <TableHead class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Pendapatan
                    </TableHead>
                    <TableHead class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Diterima
                    </TableHead>
                    <TableHead class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Biaya Langsung
                    </TableHead>
                    <TableHead class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Opex
                    </TableHead>
                    <TableHead class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Laba Kotor
                    </TableHead>
                    <TableHead class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Laba Bersih
                    </TableHead>
                    <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Margin
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="row in revenue" :key="row.period">
                    <TableCell class="px-4 py-3 text-sm font-medium text-foreground">
                      {{ row.period }}
                    </TableCell>
                    <TableCell class="px-4 py-3 text-right text-sm tabular-nums text-foreground">
                      {{ formatCurrencyIdr(row.revenueIdr) }}
                    </TableCell>
                    <TableCell class="px-4 py-3 text-right text-sm tabular-nums text-success">
                      {{ formatCurrencyIdr(row.collectedIdr) }}
                    </TableCell>
                    <TableCell class="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                      {{ formatCurrencyIdr(row.directCostIdr) }}
                    </TableCell>
                    <TableCell class="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                      {{ formatCurrencyIdr(row.opexIdr) }}
                    </TableCell>
                    <TableCell class="px-4 py-3 text-right text-sm tabular-nums" :class="row.grossProfitIdr >= 0 ? 'text-foreground' : 'text-destructive'">
                      {{ formatCurrencyIdr(row.grossProfitIdr) }}
                    </TableCell>
                    <TableCell class="px-4 py-3 text-right text-sm font-semibold tabular-nums" :class="row.netProfitIdr >= 0 ? 'text-success' : 'text-destructive'">
                      {{ formatCurrencyIdr(row.netProfitIdr) }}
                    </TableCell>
                    <TableCell class="px-4 py-3">
                      <div class="flex items-center gap-2">
                        <span class="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                          <span
                            :class="cn('block h-full rounded-full', row.netProfitIdr >= 0 ? 'bg-success' : 'bg-destructive')"
                            :style="{ width: `${Math.min(100, (Math.abs(row.revenueIdr) / maxRevenue) * 100)}%` }"
                          />
                        </span>
                        <span class="text-xs tabular-nums text-muted-foreground">
                          {{ row.revenueIdr ? formatPercentage((row.netProfitIdr / row.revenueIdr) * 100, 1) : '—' }}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <p class="px-4 py-3 text-xs text-muted-foreground border-t border-border">
              Laba bersih = pendapatan − biaya langsung vendor − opex periode tersebut. Opex hanya dihitung
              untuk entri berstatus Disetujui atau Dibayar.
            </p>
          </SectionCard>
        </TabsContent>

        <TabsContent value="balance-sheet" class="pt-4 space-y-4">
          <SectionCard
            compact
            titleClass="text-sm font-bold normal-case tracking-normal text-foreground"
            title="Neraca (Balance Sheet)"
            description="Aset dan Kewajiban reuse saldo akun (tab Saldo Akun) apa adanya. Ekuitas adalah angka plug (Aset − Kewajiban) — Buku Besar ini belum punya akun modal disetor/laba ditahan tersendiri."
          >
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="overflow-hidden rounded-xl border border-border">
                <div class="flex items-center gap-2.5 border-b border-border bg-muted/30 px-4 py-2.5">
                  <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Wallet class="h-3.5 w-3.5" />
                  </div>
                  <p class="text-sm font-semibold text-foreground">
                    Aset
                  </p>
                </div>
                <ul class="divide-y divide-border px-4">
                  <li v-for="row in balanceSheetAssets" :key="row.account.code" class="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span class="text-muted-foreground">{{ row.account.name }}</span>
                    <span class="font-medium tabular-nums text-foreground">{{ formatCurrencyIdr(row.balanceIdr) }}</span>
                  </li>
                </ul>
                <div class="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-2.5 text-sm font-semibold text-foreground">
                  <span>Total Aset</span>
                  <span class="tabular-nums">{{ formatCurrencyIdr(totalAssetsIdr) }}</span>
                </div>
              </div>

              <div class="overflow-hidden rounded-xl border border-border">
                <div class="flex items-center gap-2.5 border-b border-border bg-muted/30 px-4 py-2.5">
                  <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                    <Landmark class="h-3.5 w-3.5" />
                  </div>
                  <p class="text-sm font-semibold text-foreground">
                    Kewajiban & Ekuitas
                  </p>
                </div>
                <ul class="divide-y divide-border px-4">
                  <li v-for="row in balanceSheetLiabilities" :key="row.account.code" class="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span class="text-muted-foreground">{{ row.account.name }}</span>
                    <span class="font-medium tabular-nums text-foreground">{{ formatCurrencyIdr(row.balanceIdr) }}</span>
                  </li>
                  <li class="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span class="text-muted-foreground">Ekuitas (Laba Ditahan, turunan)</span>
                    <span class="font-medium tabular-nums" :class="derivedEquityIdr >= 0 ? 'text-foreground' : 'text-destructive'">{{ formatCurrencyIdr(derivedEquityIdr) }}</span>
                  </li>
                </ul>
                <div class="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-2.5 text-sm font-semibold text-foreground">
                  <span>Total Kewajiban & Ekuitas</span>
                  <span class="tabular-nums">{{ formatCurrencyIdr(totalLiabilitiesIdr + derivedEquityIdr) }}</span>
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="cashflow" class="pt-4">
          <SectionCard
            compact
            content-class="p-0"
            titleClass="text-sm font-bold normal-case tracking-normal text-foreground"
            title="Cashflow per Periode"
            description="Kas masuk = Payment yang benar-benar diterima (sama dengan kolom Diterima di Revenue Report). Kas keluar = tagihan vendor + Opex disetujui/dibayar pada periode yang sama. Saldo kumulatif murni akumulasi net cash flow demo, bukan saldo kas awal riil."
          >
            <div class="overflow-x-auto border-t border-border">
              <Table class="w-full min-w-[640px]">
                <TableHeader>
                  <TableRow class="bg-muted/40 hover:bg-muted/40">
                    <TableHead class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Periode
                    </TableHead>
                    <TableHead class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Kas Masuk
                    </TableHead>
                    <TableHead class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Kas Keluar
                    </TableHead>
                    <TableHead class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Net Cash Flow
                    </TableHead>
                    <TableHead class="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Saldo Kumulatif
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="row in cashFlowRows" :key="row.period">
                    <TableCell class="px-4 py-3 text-sm font-medium text-foreground">
                      {{ row.period }}
                    </TableCell>
                    <TableCell class="px-4 py-3 text-right text-sm tabular-nums text-success">
                      {{ formatCurrencyIdr(row.cashInIdr) }}
                    </TableCell>
                    <TableCell class="px-4 py-3 text-right text-sm tabular-nums text-destructive">
                      {{ formatCurrencyIdr(row.cashOutIdr) }}
                    </TableCell>
                    <TableCell class="px-4 py-3 text-right text-sm font-semibold tabular-nums" :class="row.netCashFlowIdr >= 0 ? 'text-success' : 'text-destructive'">
                      {{ formatCurrencyIdr(row.netCashFlowIdr) }}
                    </TableCell>
                    <TableCell class="px-4 py-3 text-right text-sm font-semibold tabular-nums" :class="row.cumulativeIdr >= 0 ? 'text-foreground' : 'text-destructive'">
                      {{ formatCurrencyIdr(row.cumulativeIdr) }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
