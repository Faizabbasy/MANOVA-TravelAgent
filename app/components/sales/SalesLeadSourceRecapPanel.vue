<script setup lang="ts">
import { computed } from 'vue'
import { Users, Target } from 'lucide-vue-next'
import { LEADS } from '~/data'
import { LEAD_SOURCES, findStatusOption } from '~/constants/status'
import { formatPercentage } from '~/utils/format'
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'

/**
 * Tab "Rekap Sumber Lead" — Menu Sales > Pipeline (dulu `/customer-journey/lead-sources`, sempat menempel
 * di dalam tab Funnel). Reuse fixture `LEADS` yang sama, TIDAK ter-scope AE (agregat lintas seluruh sumber,
 * bukan portfolio pribadi), konsisten perilaku halaman asal.
 */
const { canView } = usePermissions()

const sourceRecapRows = computed(() => LEAD_SOURCES.map((source) => {
  const leads = LEADS.filter(lead => lead.source === source.value)
  const qualified = leads.filter(lead => lead.stage === 'qualified')
  const dealsCreated = leads.filter(lead => lead.quotationId || lead.salesOrderId)
  const won = leads.filter(lead => lead.projectId || lead.salesOrderId)
  return {
    source,
    totalLeads: leads.length,
    qualifiedLeads: qualified.length,
    dealsCreated: dealsCreated.length,
    won: won.length,
    conversionRatePct: leads.length === 0 ? 0 : (won.length / leads.length) * 100
  }
}).filter(row => row.totalLeads > 0))

const sourceTotalLeads = computed(() => LEADS.length)
const sourceTotalQualified = computed(() => LEADS.filter(lead => lead.stage === 'qualified').length)
const sourceTotalDeals = computed(() => LEADS.filter(lead => lead.quotationId || lead.salesOrderId).length)
const sourceTotalWon = computed(() => LEADS.filter(lead => lead.projectId || lead.salesOrderId).length)

/** Copy sebelum sort — `sourceRecapRows` dipakai juga oleh tabel "Detail per Sumber" tanpa urutan berubah (sort in-place pernah jadi bug, Section 24). */
const sourceBreakdown = computed<StatusBreakdownItem[]>(() =>
  [...sourceRecapRows.value]
    .sort((a, b) => b.totalLeads - a.totalLeads)
    .map(row => ({ key: row.source.value, label: row.source.label, tone: row.source.tone, count: row.totalLeads }))
)
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('crm')" module-label="modul Sales" />

    <template v-else>
      <p class="text-xs text-muted-foreground">
        Performa sumber lead lintas Website/Instagram/TikTok/WhatsApp/Referral/Event/Email/Sales Outreach/Lainnya — agregat seluruh Sales, tidak ter-scope portfolio.
      </p>

      <!-- Mobile — 4 angka tunggal ringkas jadi grid 2-kolom compact (bukan ditumpuk 1 kolom penuh). Desktop tidak diubah. -->
      <div class="grid grid-cols-2 gap-2.5 sm:hidden">
        <StatsCard size="sm" title="Total Leads" :value="String(sourceTotalLeads)" :icon="Users" />
        <StatsCard size="sm" title="Qualified Leads" :value="String(sourceTotalQualified)" :icon="Users" icon-color="success" />
        <StatsCard size="sm" title="Deals Created" :value="String(sourceTotalDeals)" :icon="Target" />
        <StatsCard size="sm" title="Won" :value="String(sourceTotalWon)" :icon="Target" icon-color="success" />
      </div>

      <div class="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Leads" :value="String(sourceTotalLeads)" :icon="Users" />
        <StatsCard title="Qualified Leads" :value="String(sourceTotalQualified)" :icon="Users" icon-color="success" />
        <StatsCard title="Deals Created" :value="String(sourceTotalDeals)" :icon="Target" />
        <StatsCard title="Won" :value="String(sourceTotalWon)" :icon="Target" icon-color="success" />
      </div>

      <SectionCard title="Distribusi Lead per Sumber">
        <StatusBreakdownList :items="sourceBreakdown" empty-label="Belum ada lead" />
      </SectionCard>

      <SectionCard title="Detail per Sumber">
        <ResponsiveDataView :items="sourceRecapRows" :get-key="row => row.source.value">
          <template #desktop="{ items }">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sumber</TableHead>
                  <TableHead>Total Leads</TableHead>
                  <TableHead>Qualified</TableHead>
                  <TableHead>Deals Created</TableHead>
                  <TableHead>Won</TableHead>
                  <TableHead>Conversion Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in items" :key="row.source.value">
                  <TableCell>
                    <StatusBadge :label="findStatusOption(LEAD_SOURCES, row.source.value).label" :tone="findStatusOption(LEAD_SOURCES, row.source.value).tone" />
                  </TableCell>
                  <TableCell>{{ row.totalLeads }}</TableCell>
                  <TableCell>{{ row.qualifiedLeads }}</TableCell>
                  <TableCell>{{ row.dealsCreated }}</TableCell>
                  <TableCell>{{ row.won }}</TableCell>
                  <TableCell>{{ formatPercentage(row.conversionRatePct) }}</TableCell>
                </TableRow>
                <TableEmpty v-if="items.length === 0" :colspan="6">
                  Belum ada data lead.
                </TableEmpty>
              </TableBody>
            </Table>
          </template>

          <template #mobile-card="{ item: row }">
            <div class="rounded-xl border border-border bg-card p-4">
              <div class="flex items-start justify-between gap-2">
                <StatusBadge :label="findStatusOption(LEAD_SOURCES, row.source.value).label" :tone="findStatusOption(LEAD_SOURCES, row.source.value).tone" />
                <span class="text-xs font-medium text-foreground">{{ formatPercentage(row.conversionRatePct) }}</span>
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p class="text-muted-foreground">
                    Total Leads
                  </p>
                  <p class="text-foreground">
                    {{ row.totalLeads }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Qualified
                  </p>
                  <p class="text-foreground">
                    {{ row.qualifiedLeads }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Deals Created
                  </p>
                  <p class="text-foreground">
                    {{ row.dealsCreated }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Won
                  </p>
                  <p class="text-foreground">
                    {{ row.won }}
                  </p>
                </div>
              </div>
            </div>
          </template>
        </ResponsiveDataView>
      </SectionCard>
    </template>
  </div>
</template>
