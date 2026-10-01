<script setup lang="ts">
import { computed } from 'vue'
import { TrendingUp, Wallet, FolderKanban, Receipt } from 'lucide-vue-next'
import ReportsAnalyticsPanel from '~/components/reports/ReportsAnalyticsPanel.vue'
import { PROJECTS, getProjectOutstandingIdr } from '~/data'
import { getRevenueByPeriod } from '~/data/finance-ext'
import { PROJECT_STATUSES } from '~/constants/status'
import { formatCurrencyIdr } from '~/utils/format'
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'

/**
 * Leader Dashboard — ringkasan tingkat eksekutif untuk Management/Super Admin, terpisah dari Dashboard
 * utama (`/`, operasional harian lintas-role). Sengaja TIDAK menduplikasi data/kalkulasi — komposisi ulang
 * dari selector yang SUDAH ADA (`getRevenueByPeriod` sumber sama dengan hero panel Dashboard utama,
 * `getProjectOutstandingIdr` sumber sama dengan Outstanding Invoices) ditambah embed penuh
 * `ReportsAnalyticsPanel` (Reporting & BI, TIDAK disalin ulang isinya). Sengaja TIDAK ditambahkan ke
 * `NAV_ITEMS` (sidebar sedang disederhanakan) — route ini tetap hidup dan tergerbang RBAC lewat
 * `HIDDEN_NAV_ROUTES`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Leader Dashboard' })

/**
 * `canView('bi')` — Reporting & BI, bukan `canView('management')` ('management' adalah ROLE id, bukan
 * modul; lihat `SEED_MODULE_LEVELS['management']`, `app/data/rbac.ts`, role Management diberi grant MANAGE
 * atas modul `bi`). Konsisten dengan gate `ReportsAnalyticsPanel` yang di-embed di bawah, dan Super Admin
 * selalu bypass lewat `isSuperAdmin`.
 */
const { canView } = usePermissions()
const hasAccess = computed(() => canView('bi'))

const revenuePeriods = computed(() => getRevenueByPeriod())
const latestPeriod = computed(() => revenuePeriods.value.at(-1))

const activeProjects = computed(() => PROJECTS.filter(project => !['completed', 'cancelled'].includes(project.status)))
const totalOutstandingIdr = computed(() => PROJECTS.reduce((sum, project) => sum + getProjectOutstandingIdr(project.id), 0))

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
      description="Ringkasan tingkat eksekutif — revenue, project pipeline, cash flow, dan Analytics & Marketing ROI dalam satu halaman."
      :breadcrumb="[{ label: 'Leader Dashboard' }]"
    />

    <RoleAccessState v-if="!hasAccess" module-label="modul Management" />

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Pemasukan Bersih (Periode Terbaru)" :value="formatCurrencyIdr(latestPeriod?.revenueIdr ?? 0)" :icon="TrendingUp" icon-color="primary" />
        <StatsCard title="Profit Bersih (Periode Terbaru)" :value="formatCurrencyIdr(latestPeriod?.netProfitIdr ?? 0)" :icon="Wallet" :icon-color="(latestPeriod?.netProfitIdr ?? 0) >= 0 ? 'success' : 'destructive'" />
        <StatsCard title="Project Aktif" :value="String(activeProjects.length)" :icon="FolderKanban" icon-color="primary" />
        <StatsCard title="Total Outstanding Invoice" :value="formatCurrencyIdr(totalOutstandingIdr)" :icon="Receipt" :icon-color="totalOutstandingIdr > 0 ? 'warning' : 'success'" />
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
