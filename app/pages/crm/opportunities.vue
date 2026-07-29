<script setup lang="ts">
import { computed } from 'vue'
import { OPPORTUNITIES, getPartyById, getQuotationByOpportunity } from '~/data'
import { OPPORTUNITY_STAGES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Opportunities' })

const { canView } = usePermissions()

const rows = computed(() => OPPORTUNITIES.map(opportunity => ({
  opportunity,
  party: getPartyById(opportunity.partyId),
  quotation: getQuotationByOpportunity(opportunity.id),
  stage: findStatusOption(OPPORTUNITY_STAGES, opportunity.stage),
})))
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Opportunities"
      description="Daftar opportunity lintas seluruh party, dikelompokkan per stage."
      :breadcrumb="[{ label: 'CRM', to: '/crm' }, { label: 'Opportunities' }]"
    />

    <RoleAccessState v-if="!canView('crm')" module-label="modul CRM" />

    <SectionCard v-else>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Opportunity</TableHead>
            <TableHead>Party</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Nilai Quotation</TableHead>
            <TableHead>Dibuat</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="row in rows" :key="row.opportunity.id">
            <TableCell class="font-medium text-foreground">{{ row.opportunity.title }}</TableCell>
            <TableCell>{{ row.party?.name ?? '—' }}</TableCell>
            <TableCell><StatusBadge :label="row.stage.label" :tone="row.stage.tone" /></TableCell>
            <TableCell>{{ row.quotation ? formatCurrencyIdr(row.quotation.amountIdr) : '—' }}</TableCell>
            <TableCell class="text-muted-foreground">{{ formatDate(row.opportunity.createdAt) }}</TableCell>
          </TableRow>
          <TableEmpty v-if="rows.length === 0" :colspan="5">Belum ada opportunity.</TableEmpty>
        </TableBody>
      </Table>
    </SectionCard>
  </div>
</template>
