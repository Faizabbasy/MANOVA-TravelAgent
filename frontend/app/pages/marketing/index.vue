<script setup lang="ts">
import { computed, ref } from 'vue'
import { Megaphone, Filter, Target, Users, Trophy, TrendingUp } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import {
  CAMPAIGNS,
  CAMPAIGN_STATUSES,
  CAMPAIGN_OBJECTIVES,
  PROMO_CODES,
  PROMO_STATUSES,
  getCampaignPerformance,
  getCampaignSpend,
  getPromoResults,
  getConversionFunnel,
  getChannelAcquisition,
  getCustomerLifetimeValues,
  getMarketingRoiSummary
} from '~/data/marketing'
import { LEAD_SOURCES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatNumber, formatPercentage, formatDate } from '~/utils/format'
import type { LeadSource } from '~/types/lead'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Marketing & Analysis' })

const { canView } = usePermissions()
const hasAccess = computed(() => canView('marketing'))

const activeTab = ref<'campaigns' | 'promos' | 'funnel' | 'cac' | 'ltv'>('campaigns')
const funnelChannel = ref<'all' | LeadSource>('all')

const performance = computed(() => getCampaignPerformance())
const roi = computed(() => getMarketingRoiSummary())
const funnel = computed(() => getConversionFunnel(funnelChannel.value === 'all' ? undefined : funnelChannel.value))
const acquisition = computed(() => getChannelAcquisition())
const ltvs = computed(() => getCustomerLifetimeValues())

const stats = computed(() => ({
  running: CAMPAIGNS.filter(campaign => campaign.status === 'running').length,
  spend: roi.value.totalSpendIdr,
  revenue: roi.value.attributedRevenueIdr,
  roas: roi.value.roas
}))

const maxFunnelCount = computed(() => Math.max(1, ...funnel.value.map(stage => stage.count)))
const maxLtv = computed(() => Math.max(1, ...ltvs.value.map(row => row.totalRevenueIdr)))
const repeatRate = computed(() => (ltvs.value.length
  ? (ltvs.value.filter(row => row.isRepeatCustomer).length / ltvs.value.length) * 100
  : 0))
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Marketing & Analysis"
      description="Campaign tracking, promo & voucher dengan uji varian, conversion funnel, CAC per channel, dan customer lifetime value."
      :breadcrumb="[{ label: 'Marketing & Analysis' }]"
    />

    <RoleAccessState v-if="!hasAccess" module-label="modul Marketing & Analysis" />

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Campaign Berjalan" :value="String(stats.running)" :icon="Megaphone" icon-color="primary" />
        <StatsCard title="Total Belanja" :value="formatCurrencyIdr(stats.spend)" :icon="TrendingUp" icon-color="warning" />
        <StatsCard title="Revenue Teratribusi" :value="formatCurrencyIdr(stats.revenue)" :icon="TrendingUp" icon-color="success" />
        <StatsCard
          title="ROAS"
          :value="stats.roas ? `${stats.roas.toFixed(2)}×` : '—'"
          :icon="Trophy"
          :icon-color="(stats.roas ?? 0) >= 3 ? 'success' : 'warning'"
        />
      </div>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger value="campaigns">
            Campaign Tracking
          </TabsTrigger>
          <TabsTrigger value="promos">
            Promo & Voucher (A/B)
          </TabsTrigger>
          <TabsTrigger value="funnel">
            Conversion Funnel
          </TabsTrigger>
          <TabsTrigger value="cac">
            CAC per Channel
          </TabsTrigger>
          <TabsTrigger value="ltv">
            Customer LTV
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" class="pt-4 space-y-4">
          <SectionCard description="Lead diatribusikan otomatis ke campaign lewat kecocokan channel dan rentang tanggal — bukan angka yang diketik manual.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Budget Terpakai</TableHead>
                  <TableHead class="text-center">
                    Lead
                  </TableHead>
                  <TableHead class="text-center">
                    Won
                  </TableHead>
                  <TableHead class="text-right">
                    Cost / Lead
                  </TableHead>
                  <TableHead class="text-right">
                    ROAS
                  </TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in performance" :key="row.campaign.id">
                  <TableCell>
                    <p class="text-sm font-medium text-foreground">
                      {{ row.campaign.name }}
                    </p>
                    <div class="flex flex-wrap items-center gap-1.5 mt-1">
                      <StatusBadge
                        :label="findStatusOption(CAMPAIGN_OBJECTIVES, row.campaign.objective).label"
                        :tone="findStatusOption(CAMPAIGN_OBJECTIVES, row.campaign.objective).tone"
                      />
                      <span
                        v-for="channel in row.campaign.channels"
                        :key="channel"
                        class="text-[11px] text-muted-foreground"
                      >{{ findStatusOption(LEAD_SOURCES, channel).label }}</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-xs text-muted-foreground">
                    {{ formatDate(row.campaign.startDate) }} –<br>{{ formatDate(row.campaign.endDate) }}
                  </TableCell>
                  <TableCell>
                    <div class="flex items-center gap-2">
                      <span class="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                        <span
                          :class="cn('block h-full rounded-full', row.budgetUsedPercent > 90 ? 'bg-destructive' : 'bg-primary')"
                          :style="{ width: `${Math.min(100, row.budgetUsedPercent)}%` }"
                        />
                      </span>
                      <span class="text-xs text-muted-foreground">{{ row.budgetUsedPercent }}%</span>
                    </div>
                    <p class="text-xs text-muted-foreground mt-0.5">
                      {{ formatCurrencyIdr(row.campaign.spendIdr) }} / {{ formatCurrencyIdr(row.campaign.budgetIdr) }}
                    </p>
                  </TableCell>
                  <TableCell class="text-center text-sm text-foreground">
                    {{ row.leads }}
                    <span class="block text-xs text-muted-foreground">{{ row.qualifiedLeads }} qualified</span>
                  </TableCell>
                  <TableCell class="text-center text-sm font-medium text-foreground">
                    {{ row.wonOpportunities }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-foreground">
                    {{ row.costPerLeadIdr ? formatCurrencyIdr(row.costPerLeadIdr) : '—' }}
                  </TableCell>
                  <TableCell class="text-right text-sm font-semibold" :class="(row.roas ?? 0) >= 3 ? 'text-success' : 'text-warning'">
                    {{ row.roas ? `${row.roas.toFixed(2)}×` : '—' }}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(CAMPAIGN_STATUSES, row.campaign.status).label"
                      :tone="findStatusOption(CAMPAIGN_STATUSES, row.campaign.status).tone"
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </SectionCard>

          <SectionCard title="Belanja per Channel">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div v-for="campaign in CAMPAIGNS.filter(item => getCampaignSpend(item.id).length)" :key="campaign.id" class="rounded-lg border border-border p-3">
                <p class="text-sm font-medium text-foreground mb-2">
                  {{ campaign.name }}
                </p>
                <ul class="space-y-1.5">
                  <li v-for="spend in getCampaignSpend(campaign.id)" :key="spend.id" class="flex items-center gap-3 text-xs">
                    <span class="w-24 shrink-0 text-muted-foreground">{{ findStatusOption(LEAD_SOURCES, spend.channel).label }}</span>
                    <span class="flex-1 text-foreground">{{ formatCurrencyIdr(spend.spendIdr) }}</span>
                    <span class="text-muted-foreground">{{ formatNumber(spend.clicks) }} klik</span>
                    <span class="w-16 text-right text-muted-foreground">
                      {{ spend.impressions ? formatPercentage((spend.clicks / spend.impressions) * 100, 2) : '—' }} CTR
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="promos" class="pt-4 space-y-4">
          <SectionCard
            v-for="promo in PROMO_CODES"
            :key="promo.id"
            :title="`${promo.name} · ${promo.code}`"
            :description="promo.note"
          >
            <div class="flex flex-wrap items-center gap-2 mb-4">
              <StatusBadge
                :label="findStatusOption(PROMO_STATUSES, promo.status).label"
                :tone="findStatusOption(PROMO_STATUSES, promo.status).tone"
              />
              <span class="text-xs text-muted-foreground">
                {{ formatDate(promo.startDate) }} – {{ formatDate(promo.endDate) }}
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="variant in getPromoResults(promo.id)"
                :key="variant.key"
                :class="cn(
                  'rounded-lg border p-4',
                  variant.isWinner ? 'border-success/50 bg-success/5' : 'border-border'
                )"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm font-semibold text-foreground">Varian {{ variant.key }} — {{ variant.label }}</span>
                  <StatusBadge v-if="variant.isWinner" label="Pemenang" tone="success" />
                </div>

                <div class="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <p class="text-xs text-muted-foreground">
                      Dikirim
                    </p>
                    <p class="text-sm font-medium text-foreground">
                      {{ formatNumber(variant.sentCount) }}
                    </p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">
                      Ditebus
                    </p>
                    <p class="text-sm font-medium text-foreground">
                      {{ formatNumber(variant.redeemedCount) }}
                    </p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">
                      Redemption Rate
                    </p>
                    <p class="text-sm font-medium text-foreground">
                      {{ formatPercentage(variant.redemptionRatePercent, 1) }}
                    </p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">
                      Revenue / Pengiriman
                    </p>
                    <p class="text-sm font-semibold" :class="variant.isWinner ? 'text-success' : 'text-foreground'">
                      {{ formatCurrencyIdr(variant.revenuePerSentIdr) }}
                    </p>
                  </div>
                </div>

                <div class="mt-3">
                  <span class="block h-1.5 rounded-full bg-muted overflow-hidden">
                    <span
                      :class="cn('block h-full rounded-full', variant.isWinner ? 'bg-success' : 'bg-primary')"
                      :style="{ width: `${Math.min(100, variant.redemptionRatePercent * 5)}%` }"
                    />
                  </span>
                  <p class="text-xs text-muted-foreground mt-1.5">
                    Total revenue {{ formatCurrencyIdr(variant.revenueIdr) }}
                  </p>
                </div>
              </div>
            </div>

            <p class="text-[11px] text-muted-foreground mt-3">
              Pemenang ditentukan oleh revenue per pengiriman, bukan redemption rate — diskon besar bisa
              menang jumlah penebusan tapi kalah nilai bersih.
            </p>
          </SectionCard>
        </TabsContent>

        <TabsContent value="funnel" class="pt-4 space-y-4">
          <select v-model="funnelChannel" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Channel
            </option>
            <option v-for="source in LEAD_SOURCES" :key="source.value" :value="source.value">
              {{ source.label }}
            </option>
          </select>

          <SectionCard description="Diturunkan langsung dari Lead → Opportunity → Quotation → Project. Persentase drop-off menunjukkan di tahap mana calon pelanggan paling banyak hilang.">
            <ul class="space-y-3">
              <li v-for="(stage, index) in funnel" :key="stage.key">
                <div class="flex items-center gap-3">
                  <span class="w-40 shrink-0 text-sm text-foreground">{{ stage.label }}</span>
                  <span class="flex-1 h-7 rounded-lg bg-muted overflow-hidden relative">
                    <span
                      class="block h-full rounded-lg bg-primary/80"
                      :style="{ width: `${(stage.count / maxFunnelCount) * 100}%` }"
                    />
                    <span class="absolute inset-y-0 left-2 flex items-center text-xs font-medium text-foreground">
                      {{ stage.count }}
                    </span>
                  </span>
                  <span class="w-20 shrink-0 text-right text-sm text-foreground">
                    {{ formatPercentage(stage.conversionPercent, 0) }}
                  </span>
                </div>
                <p v-if="index > 0 && stage.dropOffPercent > 0" class="ml-40 pl-3 text-xs text-destructive mt-0.5">
                  Drop-off {{ formatPercentage(stage.dropOffPercent, 0) }} dari tahap sebelumnya
                </p>
              </li>
            </ul>
          </SectionCard>
        </TabsContent>

        <TabsContent value="cac" class="pt-4">
          <SectionCard description="CAC = belanja campaign pada channel tersebut ÷ jumlah klien baru yang berasal darinya.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead class="text-center">
                    Lead
                  </TableHead>
                  <TableHead class="text-center">
                    Qualified
                  </TableHead>
                  <TableHead class="text-center">
                    Won
                  </TableHead>
                  <TableHead class="text-right">
                    Belanja
                  </TableHead>
                  <TableHead class="text-right">
                    Cost / Lead
                  </TableHead>
                  <TableHead class="text-right">
                    CAC
                  </TableHead>
                  <TableHead>Konversi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in acquisition" :key="row.channel">
                  <TableCell class="text-sm font-medium text-foreground">
                    {{ row.channelLabel }}
                  </TableCell>
                  <TableCell class="text-center text-sm text-foreground">
                    {{ row.leads }}
                  </TableCell>
                  <TableCell class="text-center text-sm text-muted-foreground">
                    {{ row.qualifiedLeads }}
                  </TableCell>
                  <TableCell class="text-center text-sm text-foreground">
                    {{ row.wonOpportunities }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-muted-foreground">
                    {{ row.spendIdr ? formatCurrencyIdr(row.spendIdr) : '—' }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-foreground">
                    {{ row.costPerLeadIdr ? formatCurrencyIdr(row.costPerLeadIdr) : '—' }}
                  </TableCell>
                  <TableCell class="text-right text-sm font-semibold text-foreground">
                    {{ row.cacIdr ? formatCurrencyIdr(row.cacIdr) : '—' }}
                  </TableCell>
                  <TableCell>
                    <div class="flex items-center gap-2">
                      <span class="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
                        <span
                          :class="cn('block h-full rounded-full', row.conversionPercent >= 20 ? 'bg-success' : row.conversionPercent > 0 ? 'bg-warning' : 'bg-muted')"
                          :style="{ width: `${Math.min(100, row.conversionPercent * 2)}%` }"
                        />
                      </span>
                      <span class="text-xs text-muted-foreground">{{ formatPercentage(row.conversionPercent, 1) }}</span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="ltv" class="pt-4 space-y-4">
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="Rata-rata LTV" :value="formatCurrencyIdr(roi.averageLtvIdr)" :icon="Users" icon-color="success" />
            <StatsCard title="Rata-rata CAC" :value="roi.averageCacIdr ? formatCurrencyIdr(roi.averageCacIdr) : '—'" :icon="Target" icon-color="warning" />
            <StatsCard
              title="Rasio LTV : CAC"
              :value="roi.ltvToCacRatio ? `${roi.ltvToCacRatio.toFixed(1)}×` : '—'"
              :icon="Trophy"
              :icon-color="(roi.ltvToCacRatio ?? 0) >= 3 ? 'success' : 'warning'"
            />
            <StatsCard title="Repeat Rate" :value="formatPercentage(repeatRate)" :icon="Filter" :icon-color="repeatRate >= 40 ? 'success' : 'warning'" />
          </div>

          <SectionCard description="Revenue dihitung dari invoice yang benar-benar lunas, bukan nilai kontrak yang belum tertagih.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Channel Akuisisi</TableHead>
                  <TableHead class="text-center">
                    Project
                  </TableHead>
                  <TableHead class="text-right">
                    Rata-rata Nilai
                  </TableHead>
                  <TableHead class="text-right">
                    Total Revenue (LTV)
                  </TableHead>
                  <TableHead>Kontribusi</TableHead>
                  <TableHead>Tipe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in ltvs" :key="row.partyId">
                  <TableCell>
                    <NuxtLink :to="`/crm/parties/${row.partyId}`" class="text-sm font-medium text-foreground hover:text-primary">
                      {{ row.partyName }}
                    </NuxtLink>
                    <p class="text-xs text-muted-foreground">
                      {{ row.tenureMonths }} bulan sebagai klien
                    </p>
                  </TableCell>
                  <TableCell class="text-sm text-muted-foreground">
                    {{ row.acquisitionChannel ? findStatusOption(LEAD_SOURCES, row.acquisitionChannel).label : '—' }}
                  </TableCell>
                  <TableCell class="text-center text-sm text-foreground">
                    {{ row.projectCount }}
                  </TableCell>
                  <TableCell class="text-right text-sm text-muted-foreground">
                    {{ formatCurrencyIdr(row.averageProjectValueIdr) }}
                  </TableCell>
                  <TableCell class="text-right text-sm font-semibold text-foreground">
                    {{ formatCurrencyIdr(row.totalRevenueIdr) }}
                  </TableCell>
                  <TableCell>
                    <span class="block h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                      <span class="block h-full rounded-full bg-success" :style="{ width: `${(row.totalRevenueIdr / maxLtv) * 100}%` }" />
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="row.isRepeatCustomer ? 'Repeat' : 'Sekali'"
                      :tone="row.isRepeatCustomer ? 'success' : 'neutral'"
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
