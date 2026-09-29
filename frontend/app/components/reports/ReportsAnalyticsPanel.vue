<script setup lang="ts">
import { computed } from 'vue'
import { Users, Building2, Activity } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { getMarketingRoiSummary, getCampaignPerformance, getChannelAcquisition } from '~/data/marketing'
import { getInventorySummary } from '~/data/inventory'
import { getProductivitySummary } from '~/data/hr'
import { formatCurrencyIdr, formatPercentage } from '~/utils/format'

/** Tab "Analytics & Marketing ROI" — Menu Reporting & BI > Reports (Penyederhanaan 7-Role/Menu). Dulu
 * `/reports/analytics`, kini tab dalam satu menu bersama Operasional — logika tidak diubah. */

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
const roi = computed(() => getMarketingRoiSummary())
const campaigns = computed(() => getCampaignPerformance())
const channels = computed(() => getChannelAcquisition().filter(row => row.spendIdr > 0))
const inventory = computed(() => getInventorySummary())
const productivity = computed(() => getProductivitySummary())

const maxCampaignRoas = computed(() => Math.max(1, ...campaigns.value.map(row => row.roas ?? 0)))
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!hasAccess" module-label="modul Reporting & BI" />

    <template v-else>
      <ReportsFinanceSection />

      <SectionCard title="Marketing ROI" description="Satu perhitungan bersama dengan modul Marketing — bukan angka paralel.">
        <div class="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
          <div class="rounded-lg bg-muted/40 px-3 py-2.5">
            <p class="text-xs text-muted-foreground">
              ROI
            </p>
            <p class="text-sm font-semibold mt-0.5" :class="(roi.roiPercent ?? 0) > 0 ? 'text-success' : 'text-destructive'">
              {{ roi.roiPercent !== null ? formatPercentage(roi.roiPercent, 0) : '—' }}
            </p>
          </div>
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
