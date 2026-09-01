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

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Leads" :value="String(sourceTotalLeads)" :icon="Users" />
        <StatsCard title="Qualified Leads" :value="String(sourceTotalQualified)" :icon="Users" icon-color="success" />
        <StatsCard title="Deals Created" :value="String(sourceTotalDeals)" :icon="Target" />
        <StatsCard title="Won" :value="String(sourceTotalWon)" :icon="Target" icon-color="success" />
      </div>

      <SectionCard title="Distribusi Lead per Sumber">
        <StatusBreakdownList :items="sourceBreakdown" empty-label="Belum ada lead" />
      </SectionCard>

      <SectionCard title="Detail per Sumber">
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
            <TableRow v-for="row in sourceRecapRows" :key="row.source.value">
              <TableCell>
                <StatusBadge :label="findStatusOption(LEAD_SOURCES, row.source.value).label" :tone="findStatusOption(LEAD_SOURCES, row.source.value).tone" />
              </TableCell>
              <TableCell>{{ row.totalLeads }}</TableCell>
              <TableCell>{{ row.qualifiedLeads }}</TableCell>
              <TableCell>{{ row.dealsCreated }}</TableCell>
              <TableCell>{{ row.won }}</TableCell>
              <TableCell>{{ formatPercentage(row.conversionRatePct) }}</TableCell>
            </TableRow>
            <TableEmpty v-if="sourceRecapRows.length === 0" :colspan="6">
              Belum ada data lead.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
