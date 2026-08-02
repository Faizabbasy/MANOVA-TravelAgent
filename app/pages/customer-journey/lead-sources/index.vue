<script setup lang="ts">
import { computed } from 'vue'
import { Users, Target, TrendingUp } from 'lucide-vue-next'
import { LEADS, getOpportunityById } from '~/data'
import { LEAD_SOURCES, findStatusOption } from '~/constants/status'
import { formatPercentage } from '~/utils/format'
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Lead Source Recap' })

const { canView } = usePermissions()
const { currentRole } = useCurrentUser()
/** Sales dibatasi ke Lead saja pada Customer Journey (docs Prompt 19-10) — Lead Source Recap adalah agregat lintas-source milik Super Admin Dashboard, bukan scope Sales. Narrow exception. */
const hasAccess = computed(() => canView('crm') && currentRole.value !== 'sales')

/**
 * Rekap per source (Prompt 19 — Change Request, Super Admin Dashboard). Reuse fixture `LEADS` yang sama
 * — bukan dataset terpisah. "Won opportunities" ditelusuri lewat `Lead.opportunityId` → `Opportunity.stage`.
 */
const recapRows = computed(() => LEAD_SOURCES.map((source) => {
  const leads = LEADS.filter(lead => lead.source === source.value)
  const qualified = leads.filter(lead => lead.stage === 'qualified')
  const opportunitiesCreated = leads.filter(lead => lead.opportunityId)
  const won = opportunitiesCreated.filter(lead => lead.opportunityId && getOpportunityById(lead.opportunityId)?.stage === 'won')
  return {
    source,
    totalLeads: leads.length,
    qualifiedLeads: qualified.length,
    opportunitiesCreated: opportunitiesCreated.length,
    wonOpportunities: won.length,
    conversionRatePct: leads.length === 0 ? 0 : (won.length / leads.length) * 100
  }
}).filter(row => row.totalLeads > 0))

const totalLeads = computed(() => LEADS.length)
const totalQualified = computed(() => LEADS.filter(lead => lead.stage === 'qualified').length)
const totalOpportunities = computed(() => LEADS.filter(lead => lead.opportunityId).length)
const totalWon = computed(() => LEADS.filter(lead => lead.opportunityId && getOpportunityById(lead.opportunityId)?.stage === 'won').length)

/**
 * Section 24 regression fix: `Array.prototype.sort` mutates in place. Sorting `recapRows.value` directly
 * mutated the SAME array instance cached by the `recapRows` computed (used unsorted by "Detail per Sumber"
 * table below) as a side effect of this unrelated computed — silently reordering that table depending on
 * Vue's evaluation order. Copy before sorting so `recapRows` stays in its own declared `LEAD_SOURCES` order.
 */
const sourceBreakdown = computed<StatusBreakdownItem[]>(() =>
  [...recapRows.value]
    .sort((a, b) => b.totalLeads - a.totalLeads)
    .map(row => ({ key: row.source.value, label: row.source.label, tone: row.source.tone, count: row.totalLeads }))
)
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Lead Source Recap"
      description="Performa sumber lead lintas Website/Instagram/TikTok/WhatsApp/Referral/Event/Email/Sales Outreach/Lainnya."
      :breadcrumb="[{ label: 'Customer Journey', to: '/customer-journey' }, { label: 'Lead Source Recap' }]"
    />

    <RoleAccessState v-if="!hasAccess" module-label="modul Customer Journey" />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Leads" :value="String(totalLeads)" :icon="Users" />
        <StatsCard title="Qualified Leads" :value="String(totalQualified)" :icon="Users" icon-color="success" />
        <StatsCard title="Opportunities Created" :value="String(totalOpportunities)" :icon="Target" />
        <StatsCard title="Won Opportunities" :value="String(totalWon)" :icon="TrendingUp" icon-color="success" />
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
              <TableHead>Opportunities Created</TableHead>
              <TableHead>Won</TableHead>
              <TableHead>Conversion Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in recapRows" :key="row.source.value">
              <TableCell>
                <StatusBadge :label="findStatusOption(LEAD_SOURCES, row.source.value).label" :tone="findStatusOption(LEAD_SOURCES, row.source.value).tone" />
              </TableCell>
              <TableCell>{{ row.totalLeads }}</TableCell>
              <TableCell>{{ row.qualifiedLeads }}</TableCell>
              <TableCell>{{ row.opportunitiesCreated }}</TableCell>
              <TableCell>{{ row.wonOpportunities }}</TableCell>
              <TableCell>{{ formatPercentage(row.conversionRatePct) }}</TableCell>
            </TableRow>
            <TableEmpty v-if="recapRows.length === 0" :colspan="6">
              Belum ada data lead.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
