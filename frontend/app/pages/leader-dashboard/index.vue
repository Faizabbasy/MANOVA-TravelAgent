<script setup lang="ts">
import { computed } from 'vue'
import { TrendingUp, Wallet, FolderKanban, Receipt } from 'lucide-vue-next'
import ReportsAnalyticsPanel from '~/components/reports/ReportsAnalyticsPanel.vue'
import { PROJECTS } from '~/data'
import { PROJECT_STATUSES } from '~/constants/status'
import { formatMoneyMinor } from '~/lib/money'
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'

/**
 * Leader Dashboard — ringkasan tingkat eksekutif, terpisah dari Dashboard utama (`/`). Angka keuangan dari
 * server: pemasukan & profit bulan berjalan (laporan bulanan akrual) dan total piutang (ringkasan Finance) —
 * hanya untuk Finance/Super Admin; Admin melihat pipeline project dan analytics saja. Embed penuh
 * `ReportsAnalyticsPanel` (Reporting & BI, TIDAK disalin ulang isinya). Sengaja TIDAK ditambahkan ke
 * `NAV_ITEMS` — route ini tetap hidup dan tergerbang RBAC lewat `HIDDEN_NAV_ROUTES`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Leader Dashboard' })

/** `canView('bi')` — Reporting & BI, konsisten dengan gate `ReportsAnalyticsPanel` yang di-embed di bawah. */
const { canView } = usePermissions()
const hasAccess = computed(() => canView('bi'))

const api = useApi()
const session = useServerSession()
const canSeeMoney = computed(() => session.can('finance.view-project-finance'))
const overview = useFinanceOverview()
const thisMonth = useFinanceQuery(
  async () => (await api.finance.monthlyReport({ months: '1' })).data.months[0] ?? null,
  { enabled: () => canSeeMoney.value }
)

const activeProjects = computed(() => PROJECTS.filter(project => !['completed', 'cancelled'].includes(project.status)))

const projectPipeline = computed<StatusBreakdownItem[]>(() => {
  const byStatus = new Map<string, number>()
  for (const project of PROJECTS) {
    byStatus.set(project.status, (byStatus.get(project.status) ?? 0) + 1)
  }
  return PROJECT_STATUSES
    .filter(status => byStatus.has(status.value))
    .sort((a, b) => a.order - b.order)
    .map(status => ({ key: status.value, label: status.label, tone: status.tone, count: byStatus.get(status.value)! }))
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Leader Dashboard"
      description="Ringkasan tingkat eksekutif — revenue, project pipeline, dan Analytics & Marketing ROI dalam satu halaman."
      :breadcrumb="[{ label: 'Leader Dashboard' }]"
    />

    <RoleAccessState v-if="!hasAccess" module-label="modul Management" />

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <template v-if="canSeeMoney">
          <StatsCard title="Pemasukan Bersih (Bulan Ini)" :value="thisMonth.data.value ? formatMoneyMinor(thisMonth.data.value.revenueMinor) : '—'" :icon="TrendingUp" icon-color="primary" />
          <StatsCard
            title="Profit Bersih (Bulan Ini)"
            :value="thisMonth.data.value ? formatMoneyMinor(thisMonth.data.value.netMinor) : '—'"
            :icon="Wallet"
            :icon-color="thisMonth.data.value?.netMinor.startsWith('-') ? 'destructive' : 'success'"
          />
        </template>
        <StatsCard title="Project Aktif" :value="String(activeProjects.length)" :icon="FolderKanban" icon-color="primary" />
        <StatsCard
          v-if="canSeeMoney"
          title="Total Outstanding Invoice"
          :value="overview.full.value ? formatMoneyMinor(overview.full.value.receivables.outstandingMinor) : '—'"
          :icon="Receipt"
          :icon-color="overview.full.value?.receivables.outstandingMinor === '0' ? 'success' : 'warning'"
        />
      </div>

      <SectionCard title="Project Pipeline" description="Seluruh Project Order dikelompokkan per status — sumber sama dengan Dashboard utama.">
        <StatusBreakdownList :items="projectPipeline" empty-label="Belum ada Project Order" />
      </SectionCard>

      <section id="analytics" class="space-y-4 scroll-mt-4">
        <h2 class="text-lg font-semibold text-foreground">
          Analytics & Marketing ROI
        </h2>
        <ReportsAnalyticsPanel />
      </section>
    </template>
  </div>
</template>
