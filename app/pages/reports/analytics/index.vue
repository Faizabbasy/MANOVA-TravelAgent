<script setup lang="ts">
import { computed } from 'vue'
import { TrendingUp, Wallet, Users, Building2, Target, Activity } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { PROJECTS, getPartyById, getVendorById, getInvoicesByProject, getPaymentsByInvoice, getSupplierInvoicesByProject } from '~/data'
import { getRevenueByPeriod, getOpexTotalIdr } from '~/data/finance-ext'
import { getMarketingRoiSummary, getCampaignPerformance, getChannelAcquisition } from '~/data/marketing'
import { getInventorySummary } from '~/data/inventory'
import { getProductivitySummary } from '~/data/hr'
import { formatCurrencyIdr, formatPercentage, formatNumber } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Analytics & Marketing ROI — Reporting & BI' })

const { canView } = usePermissions()
const hasAccess = computed(() => canView('bi'))

/**
 * Reporting & BI (Revisi 9-Modul, modul 9) — Dashboard real-time, Revenue, Cost/Trip, Vendor Performance,
 * dan Marketing ROI.
 *
 * Seluruh angka MEMANGGIL selector modul asalnya (`finance-ext`, `marketing`, `hr`, `inventory`), tidak
 * menghitung ulang. Ini yang menjamin laporan BI tidak pernah bercerita berbeda dari modul sumbernya —
 * masalah klasik pada dashboard yang menyalin logika perhitungan.
 */
const revenue = computed(() => getRevenueByPeriod())
const roi = computed(() => getMarketingRoiSummary())
const campaigns = computed(() => getCampaignPerformance())
const channels = computed(() => getChannelAcquisition().filter(row => row.spendIdr > 0))
const inventory = computed(() => getInventorySummary())
const productivity = computed(() => getProductivitySummary())

const latestPeriod = computed(() => revenue.value.at(-1))
const maxRevenue = computed(() => Math.max(1, ...revenue.value.map(row => row.revenueIdr)))

/** Cost per trip — biaya nyata per project, dibandingkan nilai kontraknya. */
const costPerTrip = computed(() => PROJECTS.map((project) => {
  const invoices = getInvoicesByProject(project.id)
  const collectedIdr = invoices.reduce((sum, invoice) =>
    sum + getPaymentsByInvoice(invoice.id).reduce((total, payment) => total + payment.amountIdr, 0), 0)
  const vendorCostIdr = getSupplierInvoicesByProject(project.id).reduce((sum, invoice) => sum + invoice.amountIdr, 0)
  const costIdr = Math.max(project.actualCostIdr, vendorCostIdr)
  const marginIdr = project.quotationAmountIdr - costIdr

  return {
    project,
    partyName: getPartyById(project.partyId)?.name ?? '—',
    costIdr,
    collectedIdr,
    costPerTravelerIdr: project.travelerCount ? Math.round(costIdr / project.travelerCount) : 0,
    marginIdr,
    marginPercent: project.quotationAmountIdr ? (marginIdr / project.quotationAmountIdr) * 100 : 0
  }
}).sort((a, b) => b.marginPercent - a.marginPercent))

const averageMargin = computed(() => (costPerTrip.value.length
  ? costPerTrip.value.reduce((sum, row) => sum + row.marginPercent, 0) / costPerTrip.value.length
  : 0))

/** Performa vendor — nilai belanja dan jumlah project yang ia layani. */
const vendorPerformance = computed(() => {
  const totals = new Map<string, { amountIdr: number; projects: Set<string> }>()
  for (const project of PROJECTS) {
    for (const invoice of getSupplierInvoicesByProject(project.id)) {
      const entry = totals.get(invoice.vendorId) ?? { amountIdr: 0, projects: new Set<string>() }
      entry.amountIdr += invoice.amountIdr
      entry.projects.add(project.id)
      totals.set(invoice.vendorId, entry)
    }
  }
  return [...totals.entries()]
    .map(([vendorId, entry]) => ({
      vendorId,
      vendorName: getVendorById(vendorId)?.name ?? vendorId,
      amountIdr: entry.amountIdr,
      projectCount: entry.projects.size
    }))
    .sort((a, b) => b.amountIdr - a.amountIdr)
})

const maxVendorSpend = computed(() => Math.max(1, ...vendorPerformance.value.map(row => row.amountIdr)))
const maxCampaignRoas = computed(() => Math.max(1, ...campaigns.value.map(row => row.roas ?? 0)))
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Analytics & Marketing ROI"
      description="Dashboard lintas modul: revenue, cost per trip, performa vendor, dan return on marketing spend."
      :breadcrumb="[{ label: 'Reporting & BI', to: '/reports' }, { label: 'Analytics' }]"
    />

    <RoleAccessState v-if="!hasAccess" module-label="modul Reporting & BI" />

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          v-if="latestPeriod"
          title="Revenue Periode Terakhir"
          :value="formatCurrencyIdr(latestPeriod.revenueIdr)"
          :icon="TrendingUp"
          icon-color="primary"
        />
        <StatsCard
          v-if="latestPeriod"
          title="Laba Bersih"
          :value="formatCurrencyIdr(latestPeriod.netProfitIdr)"
          :icon="Wallet"
          :icon-color="latestPeriod.netProfitIdr >= 0 ? 'success' : 'destructive'"
        />
        <StatsCard
          title="Marketing ROI"
          :value="roi.roiPercent !== null ? formatPercentage(roi.roiPercent, 0) : '—'"
          :icon="Target"
          :icon-color="(roi.roiPercent ?? 0) > 0 ? 'success' : 'destructive'"
        />
        <StatsCard
          title="Margin Rata-rata Trip"
          :value="formatPercentage(averageMargin, 1)"
          :icon="Activity"
          :icon-color="averageMargin >= 20 ? 'success' : 'warning'"
        />
      </div>

      <SectionCard title="Revenue & Profitabilitas per Periode">
        <ul class="space-y-3">
          <li v-for="row in revenue" :key="row.period">
            <div class="flex items-center gap-3">
              <span class="w-20 shrink-0 text-sm font-medium text-foreground">{{ row.period }}</span>
              <span class="flex-1 h-6 rounded-lg bg-muted overflow-hidden relative">
                <span class="block h-full bg-primary/70" :style="{ width: `${(row.revenueIdr / maxRevenue) * 100}%` }" />
                <span
                  class="absolute inset-y-0 block bg-destructive/60"
                  :style="{ left: '0%', width: `${((row.directCostIdr + row.opexIdr) / maxRevenue) * 100}%`, height: '30%', top: '70%' }"
                />
              </span>
              <span class="w-40 shrink-0 text-right text-sm text-foreground">{{ formatCurrencyIdr(row.revenueIdr) }}</span>
              <span
                class="w-40 shrink-0 text-right text-sm font-semibold"
                :class="row.netProfitIdr >= 0 ? 'text-success' : 'text-destructive'"
              >{{ formatCurrencyIdr(row.netProfitIdr) }}</span>
            </div>
            <p class="ml-24 text-xs text-muted-foreground mt-0.5">
              Biaya langsung {{ formatCurrencyIdr(row.directCostIdr) }} · Opex {{ formatCurrencyIdr(row.opexIdr) }} ·
              Diterima {{ formatCurrencyIdr(row.collectedIdr) }}
            </p>
          </li>
        </ul>
        <p class="text-xs text-muted-foreground mt-3">
          Batang atas = pendapatan, batang bawah = total biaya (langsung + opex). Angka opex bersumber dari
          modul Finance &amp; ACC, bukan dihitung ulang di sini.
        </p>
      </SectionCard>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <SectionCard title="Cost per Trip" description="Biaya nyata per project dan per traveler, beserta marginnya.">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead class="text-right">
                  Biaya
                </TableHead>
                <TableHead class="text-right">
                  Per Traveler
                </TableHead>
                <TableHead class="text-right">
                  Margin
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in costPerTrip" :key="row.project.id">
                <TableCell>
                  <NuxtLink :to="`/project-orders/${row.project.id}`" class="text-sm font-medium text-foreground hover:text-primary">
                    {{ row.project.name }}
                  </NuxtLink>
                  <p class="text-xs text-muted-foreground">
                    {{ row.partyName }} · {{ row.project.travelerCount }} pax
                  </p>
                </TableCell>
                <TableCell class="text-right text-sm text-foreground">
                  {{ formatCurrencyIdr(row.costIdr) }}
                </TableCell>
                <TableCell class="text-right text-sm text-muted-foreground">
                  {{ formatCurrencyIdr(row.costPerTravelerIdr) }}
                </TableCell>
                <TableCell class="text-right">
                  <span
                    class="text-sm font-semibold"
                    :class="row.marginPercent >= 20 ? 'text-success' : row.marginPercent >= 0 ? 'text-warning' : 'text-destructive'"
                  >{{ formatPercentage(row.marginPercent, 1) }}</span>
                  <p class="text-xs text-muted-foreground">
                    {{ formatCurrencyIdr(row.marginIdr) }}
                  </p>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard title="Vendor Performance" description="Konsentrasi belanja dan cakupan project per vendor.">
          <ul class="space-y-2.5">
            <li v-for="row in vendorPerformance.slice(0, 8)" :key="row.vendorId" class="flex items-center gap-3">
              <NuxtLink :to="`/vendors/${row.vendorId}`" class="w-40 shrink-0 text-sm text-foreground hover:text-primary truncate" :title="row.vendorName">
                {{ row.vendorName }}
              </NuxtLink>
              <span class="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <span class="block h-full rounded-full bg-warning" :style="{ width: `${(row.amountIdr / maxVendorSpend) * 100}%` }" />
              </span>
              <span class="w-36 shrink-0 text-right text-sm text-foreground">{{ formatCurrencyIdr(row.amountIdr) }}</span>
              <span class="w-20 shrink-0 text-right text-xs text-muted-foreground">{{ row.projectCount }} project</span>
            </li>
          </ul>
          <EmptyState v-if="!vendorPerformance.length" title="Belum ada belanja vendor tercatat" />
        </SectionCard>
      </div>

      <SectionCard title="Marketing ROI" description="Satu perhitungan bersama dengan modul Marketing — bukan angka paralel.">
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <div class="rounded-lg bg-muted/40 px-3 py-2.5">
            <p class="text-xs text-muted-foreground">
              Total Belanja
            </p>
            <p class="text-sm font-semibold text-foreground mt-0.5">
              {{ formatCurrencyIdr(roi.totalSpendIdr) }}
            </p>
          </div>
          <div class="rounded-lg bg-muted/40 px-3 py-2.5">
            <p class="text-xs text-muted-foreground">
              Revenue Teratribusi
            </p>
            <p class="text-sm font-semibold text-success mt-0.5">
              {{ formatCurrencyIdr(roi.attributedRevenueIdr) }}
            </p>
          </div>
          <div class="rounded-lg bg-muted/40 px-3 py-2.5">
            <p class="text-xs text-muted-foreground">
              ROAS
            </p>
            <p class="text-sm font-semibold text-foreground mt-0.5">
              {{ roi.roas ? `${roi.roas.toFixed(2)}×` : '—' }}
            </p>
          </div>
          <div class="rounded-lg bg-muted/40 px-3 py-2.5">
            <p class="text-xs text-muted-foreground">
              Rata-rata CAC
            </p>
            <p class="text-sm font-semibold text-foreground mt-0.5">
              {{ roi.averageCacIdr ? formatCurrencyIdr(roi.averageCacIdr) : '—' }}
            </p>
          </div>
          <div class="rounded-lg bg-muted/40 px-3 py-2.5">
            <p class="text-xs text-muted-foreground">
              LTV : CAC
            </p>
            <p
              class="text-sm font-semibold mt-0.5"
              :class="(roi.ltvToCacRatio ?? 0) >= 3 ? 'text-success' : 'text-warning'"
            >
              {{ roi.ltvToCacRatio ? `${roi.ltvToCacRatio.toFixed(1)}×` : '—' }}
            </p>
          </div>
        </div>

        <ul class="space-y-2.5">
          <li v-for="row in campaigns.filter(item => item.campaign.spendIdr > 0)" :key="row.campaign.id" class="flex items-center gap-3">
            <span class="w-52 shrink-0 text-sm text-foreground truncate" :title="row.campaign.name">{{ row.campaign.name }}</span>
            <span class="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <span
                :class="cn('block h-full rounded-full', (row.roas ?? 0) >= 3 ? 'bg-success' : 'bg-warning')"
                :style="{ width: `${((row.roas ?? 0) / maxCampaignRoas) * 100}%` }"
              />
            </span>
            <span class="w-16 shrink-0 text-right text-sm font-medium text-foreground">
              {{ row.roas ? `${row.roas.toFixed(1)}×` : '—' }}
            </span>
            <span class="w-36 shrink-0 text-right text-xs text-muted-foreground">{{ formatCurrencyIdr(row.revenueIdr) }}</span>
          </li>
        </ul>
      </SectionCard>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <SectionCard title="Akuisisi per Channel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead class="text-center">
                  Lead
                </TableHead>
                <TableHead class="text-right">
                  Belanja
                </TableHead>
                <TableHead class="text-right">
                  CAC
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in channels" :key="row.channel">
                <TableCell class="text-sm text-foreground">
                  {{ row.channelLabel }}
                </TableCell>
                <TableCell class="text-center text-sm text-foreground">
                  {{ row.leads }}
                </TableCell>
                <TableCell class="text-right text-sm text-muted-foreground">
                  {{ formatCurrencyIdr(row.spendIdr) }}
                </TableCell>
                <TableCell class="text-right text-sm font-medium text-foreground">
                  {{ row.cacIdr ? formatCurrencyIdr(row.cacIdr) : '—' }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard title="Operasional & Sumber Daya">
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-lg bg-muted/40 px-3 py-2.5">
              <div class="flex items-center gap-1.5 text-muted-foreground">
                <Building2 class="h-3.5 w-3.5" />
                <span class="text-xs">Aset Dipakai</span>
              </div>
              <p class="text-sm font-semibold text-foreground mt-0.5">
                {{ inventory.inUse }} / {{ inventory.total }}
              </p>
            </div>
            <div class="rounded-lg bg-muted/40 px-3 py-2.5">
              <div class="flex items-center gap-1.5 text-muted-foreground">
                <Activity class="h-3.5 w-3.5" />
                <span class="text-xs">Maintenance Terlewat</span>
              </div>
              <p class="text-sm font-semibold mt-0.5" :class="inventory.overdueMaintenance ? 'text-destructive' : 'text-foreground'">
                {{ inventory.overdueMaintenance }}
              </p>
            </div>
          </div>

          <Separator class="my-4" />

          <p class="text-xs font-medium text-muted-foreground mb-2">
            Kontributor Revenue Teratas
          </p>
          <ul class="space-y-1.5">
            <li v-for="row in productivity.slice(0, 5)" :key="row.employeeId" class="flex items-center gap-3">
              <Users class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span class="flex-1 text-sm text-foreground truncate">{{ row.employeeName }}</span>
              <span class="text-xs text-muted-foreground">{{ row.projectsOwned }} project</span>
              <span class="w-36 text-right text-sm text-foreground">{{ formatCurrencyIdr(row.revenueHandledIdr) }}</span>
            </li>
          </ul>
        </SectionCard>
      </div>
    </template>
  </div>
</template>
