<script setup lang="ts">
import { computed, ref } from 'vue'
import { BookOpen, TrendingUp, Scale } from 'lucide-vue-next'
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
const activeTab = ref<'balances' | 'journal' | 'revenue'>('balances')
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
        </TabsList>

        <TabsContent value="balances" class="pt-4">
          <SectionCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Akun</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead class="text-right">
                    Debit
                  </TableHead>
                  <TableHead class="text-right">
                    Kredit
                  </TableHead>
                  <TableHead class="text-right">
                    Saldo
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in balances" :key="row.account.code">
                  <TableCell class="font-mono text-sm text-muted-foreground">
                    {{ row.account.code }}
                  </TableCell>
                  <TableCell class="text-sm font-medium text-foreground">
                    {{ row.account.name }}
                  </TableCell>
                  <TableCell class="text-sm text-muted-foreground">
                    {{ ACCOUNT_TYPE_LABEL[row.account.type] }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-muted-foreground">
                    {{ formatCurrencyIdr(row.debitIdr) }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-muted-foreground">
                    {{ formatCurrencyIdr(row.creditIdr) }}
                  </TableCell>
                  <TableCell class="text-right text-sm font-semibold" :class="row.balanceIdr >= 0 ? 'text-foreground' : 'text-destructive'">
                    {{ formatCurrencyIdr(row.balanceIdr) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="journal" class="pt-4">
          <SectionCard>
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p class="text-sm text-muted-foreground">
                {{ filteredJournal.length }} entri jurnal
              </p>
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
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Akun</TableHead>
                  <TableHead class="text-right">
                    Debit
                  </TableHead>
                  <TableHead class="text-right">
                    Kredit
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <template v-for="entry in filteredJournal.slice(0, 60)" :key="entry.id">
                  <TableRow v-for="(line, index) in entry.lines" :key="`${entry.id}-${index}`">
                    <TableCell class="text-sm text-muted-foreground">
                      {{ index === 0 ? formatDate(entry.date) : '' }}
                    </TableCell>
                    <TableCell class="text-sm text-foreground">
                      {{ index === 0 ? entry.description : '' }}
                    </TableCell>
                    <TableCell class="text-sm text-muted-foreground">
                      {{ index === 0 ? (entry.projectId ? getProjectById(entry.projectId)?.name ?? entry.projectId : '—') : '' }}
                    </TableCell>
                    <TableCell class="text-sm">
                      <span class="font-mono text-muted-foreground">{{ line.accountCode }}</span>
                      <span class="text-foreground ml-1.5">{{ getLedgerAccount(line.accountCode)?.name }}</span>
                    </TableCell>
                    <TableCell class="text-right text-sm" :class="line.debitIdr ? 'text-foreground' : 'text-muted-foreground'">
                      {{ line.debitIdr ? formatCurrencyIdr(line.debitIdr) : '—' }}
                    </TableCell>
                    <TableCell class="text-right text-sm" :class="line.creditIdr ? 'text-foreground' : 'text-muted-foreground'">
                      {{ line.creditIdr ? formatCurrencyIdr(line.creditIdr) : '—' }}
                    </TableCell>
                  </TableRow>
                </template>
              </TableBody>
            </Table>

            <p v-if="filteredJournal.length > 60" class="text-xs text-muted-foreground mt-3">
              Menampilkan 60 entri terbaru dari {{ filteredJournal.length }}.
            </p>
          </SectionCard>
        </TabsContent>

        <TabsContent value="revenue" class="pt-4">
          <SectionCard title="Revenue Report per Periode">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead class="text-right">
                    Pendapatan
                  </TableHead>
                  <TableHead class="text-right">
                    Diterima
                  </TableHead>
                  <TableHead class="text-right">
                    Biaya Langsung
                  </TableHead>
                  <TableHead class="text-right">
                    Opex
                  </TableHead>
                  <TableHead class="text-right">
                    Laba Kotor
                  </TableHead>
                  <TableHead class="text-right">
                    Laba Bersih
                  </TableHead>
                  <TableHead>Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in revenue" :key="row.period">
                  <TableCell class="text-sm font-medium text-foreground">
                    {{ row.period }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-foreground">
                    {{ formatCurrencyIdr(row.revenueIdr) }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-success">
                    {{ formatCurrencyIdr(row.collectedIdr) }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-muted-foreground">
                    {{ formatCurrencyIdr(row.directCostIdr) }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-muted-foreground">
                    {{ formatCurrencyIdr(row.opexIdr) }}
                  </TableCell>
                  <TableCell class="text-right text-sm" :class="row.grossProfitIdr >= 0 ? 'text-foreground' : 'text-destructive'">
                    {{ formatCurrencyIdr(row.grossProfitIdr) }}
                  </TableCell>
                  <TableCell class="text-right text-sm font-semibold" :class="row.netProfitIdr >= 0 ? 'text-success' : 'text-destructive'">
                    {{ formatCurrencyIdr(row.netProfitIdr) }}
                  </TableCell>
                  <TableCell>
                    <div class="flex items-center gap-2">
                      <span class="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                        <span
                          :class="cn('block h-full rounded-full', row.netProfitIdr >= 0 ? 'bg-success' : 'bg-destructive')"
                          :style="{ width: `${Math.min(100, (Math.abs(row.revenueIdr) / maxRevenue) * 100)}%` }"
                        />
                      </span>
                      <span class="text-xs text-muted-foreground">
                        {{ row.revenueIdr ? formatPercentage((row.netProfitIdr / row.revenueIdr) * 100, 1) : '—' }}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p class="text-xs text-muted-foreground mt-3">
              Laba bersih = pendapatan − biaya langsung vendor − opex periode tersebut. Opex hanya dihitung
              untuk entri berstatus Disetujui atau Dibayar.
            </p>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
