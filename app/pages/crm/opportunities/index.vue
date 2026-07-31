<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Search } from 'lucide-vue-next'
import { OPPORTUNITIES, QUOTATIONS, PARTIES, getPartyById, getQuotationByOpportunity } from '~/data'
import { OPPORTUNITY_STAGES, SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateRange } from '~/utils/format'
import type { StatusBreakdownItem } from '~/components/shared/StatusBreakdownList.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Opportunities' })

const route = useRoute()
const { canView } = usePermissions()

const searchQuery = ref('')
/** Drill-down (Section 07, Customer Journey Funnel) — `?stage=won` dari `/customer-journey` deep-link langsung ke Opportunity Won. */
const stageFilter = ref((route.query.stage as string) || 'all')
const partyFilter = ref('all')

/** Pipeline visualization (Section 08) — dikelompokkan per stage, seluruh party (tidak terpengaruh filter di bawah). */
const pipelineBreakdown = computed<StatusBreakdownItem[]>(() => {
  const byStage = new Map<string, { count: number; value: number }>()
  for (const opp of OPPORTUNITIES) {
    const quotation = QUOTATIONS.find(q => q.opportunityId === opp.id)
    const entry = byStage.get(opp.stage) ?? { count: 0, value: 0 }
    entry.count += 1
    entry.value += quotation?.amountIdr ?? opp.estimatedValueIdr
    byStage.set(opp.stage, entry)
  }
  return OPPORTUNITY_STAGES
    .filter(stage => byStage.has(stage.value))
    .sort((a, b) => a.order - b.order)
    .map((stage) => {
      const entry = byStage.get(stage.value)!
      return { key: stage.value, label: stage.label, tone: stage.tone, count: entry.count, secondaryLabel: formatCurrencyIdr(entry.value) }
    })
})

const rows = computed(() => {
  let result = OPPORTUNITIES.map(opportunity => ({
    opportunity,
    party: getPartyById(opportunity.partyId),
    quotation: getQuotationByOpportunity(opportunity.id),
    stage: findStatusOption(OPPORTUNITY_STAGES, opportunity.stage),
  }))

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row => row.opportunity.title.toLowerCase().includes(q) || row.party?.name.toLowerCase().includes(q))
  }
  if (stageFilter.value !== 'all') {
    result = result.filter(row => row.opportunity.stage === stageFilter.value)
  }
  if (partyFilter.value !== 'all') {
    result = result.filter(row => row.opportunity.partyId === partyFilter.value)
  }

  return [...result].sort((a, b) => b.opportunity.createdAt.localeCompare(a.opportunity.createdAt))
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Opportunities"
      description="Daftar opportunity lintas seluruh party, dikelompokkan per stage."
      :breadcrumb="[{ label: 'CRM', to: '/crm' }, { label: 'Opportunities' }]"
    />

    <RoleAccessState v-if="!canView('crm')" module-label="modul CRM" />

    <template v-else>
      <SectionCard title="Opportunity Pipeline">
        <StatusBreakdownList :items="pipelineBreakdown" empty-label="Belum ada opportunity" />
      </SectionCard>

      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari opportunity atau party..." class="pl-9" />
        </div>
        <select
          v-model="stageFilter"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="all">Semua Stage</option>
          <option v-for="stage in OPPORTUNITY_STAGES" :key="stage.value" :value="stage.value">{{ stage.label }}</option>
        </select>
        <select
          v-model="partyFilter"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="all">Semua Party</option>
          <option v-for="party in PARTIES" :key="party.id" :value="party.id">{{ party.name }}</option>
        </select>
      </div>

      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Opportunity</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Destinasi</TableHead>
              <TableHead>Nilai</TableHead>
              <TableHead>Layanan</TableHead>
              <TableHead>Dibuat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in rows"
              :key="row.opportunity.id"
              class="cursor-pointer hover:bg-muted/50"
              @click="navigateTo(`/crm/opportunities/${row.opportunity.id}`)"
            >
              <TableCell class="font-medium text-foreground">{{ row.opportunity.title }}</TableCell>
              <TableCell class="text-muted-foreground">{{ row.party?.name ?? '—' }}</TableCell>
              <TableCell><StatusBadge :label="row.stage.label" :tone="row.stage.tone" /></TableCell>
              <TableCell class="text-muted-foreground">{{ row.opportunity.destination }}</TableCell>
              <TableCell>{{ formatCurrencyIdr(row.quotation ? row.quotation.amountIdr : row.opportunity.estimatedValueIdr) }}</TableCell>
              <TableCell>
                <div class="flex flex-wrap gap-1">
                  <StatusBadge
                    v-for="type in SERVICE_TYPES.filter(t => row.opportunity.serviceScope.includes(t.value))"
                    :key="type.value"
                    :label="type.label"
                    :tone="type.tone"
                  />
                </div>
              </TableCell>
              <TableCell class="text-muted-foreground">{{ formatDate(row.opportunity.createdAt) }}</TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="7">
              {{ searchQuery || stageFilter !== 'all' || partyFilter !== 'all' ? 'Tidak ada opportunity yang cocok dengan filter.' : 'Belum ada opportunity.' }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
