<script setup lang="ts">
import { computed } from 'vue'
import { FileText, ExternalLink } from 'lucide-vue-next'
import { getOpportunityById, getQuotationByOpportunity } from '~/data'
import { QUOTATION_APPROVAL_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { Project } from '~/types/project'

const props = defineProps<{
  project: Project
  canViewFinancials: boolean
}>()

const opportunity = computed(() => (props.project.opportunityId ? getOpportunityById(props.project.opportunityId) : undefined))
const quotation = computed(() => (opportunity.value ? getQuotationByOpportunity(opportunity.value.id) : undefined))

/** `approvalStatus` opsional — quotation draft belum pernah diajukan ke Management. */
const approvalOption = computed(() => (quotation.value?.approvalStatus
  ? findStatusOption(QUOTATION_APPROVAL_STATUSES, quotation.value.approvalStatus)
  : undefined))
</script>

<template>
  <SectionCard>
    <div class="flex items-center gap-2 mb-4">
      <FileText class="h-4 w-4 text-muted-foreground" />
      <h3 class="text-base font-semibold text-foreground">
        Quotation
      </h3>
    </div>

    <template v-if="quotation">
      <div class="space-y-2.5">
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-sm text-muted-foreground">Nomor</span>
          <span class="text-sm font-medium text-foreground">{{ quotation.id }}</span>
        </div>
        <div v-if="canViewFinancials" class="flex items-baseline justify-between gap-3">
          <span class="text-sm text-muted-foreground">Nilai</span>
          <span class="text-sm font-semibold text-foreground">{{ formatCurrencyIdr(quotation.amountIdr) }}</span>
        </div>
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-sm text-muted-foreground">Status Approval</span>
          <StatusBadge
            v-if="approvalOption"
            :label="approvalOption.label"
            :tone="approvalOption.tone"
          />
          <span v-else class="text-sm text-muted-foreground">Belum diajukan</span>
        </div>
        <div v-if="quotation.validUntil" class="flex items-baseline justify-between gap-3">
          <span class="text-sm text-muted-foreground">Berlaku Sampai</span>
          <span class="text-sm text-foreground">{{ formatDate(quotation.validUntil) }}</span>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 mt-4">
        <NuxtLink :to="`/crm/opportunities/${opportunity!.id}`">
          <Button variant="outline" size="sm">
            Buka Opportunity
          </Button>
        </NuxtLink>
        <NuxtLink :to="`/crm/opportunities/${opportunity!.id}/quotation-preview`" target="_blank">
          <Button size="sm">
            <ExternalLink class="h-3.5 w-3.5 mr-1.5" />
            Lihat Quotation
          </Button>
        </NuxtLink>
      </div>
    </template>

    <EmptyState
      v-else
      :icon="FileText"
      title="Belum ada quotation tertaut"
      description="Quotation dibuat dari Opportunity di modul Sales, lalu otomatis tertaut saat Opportunity dimenangkan."
    >
      <NuxtLink to="/sales/pipeline#opportunities">
        <Button size="sm">
          Buka Opportunities
        </Button>
      </NuxtLink>
    </EmptyState>
  </SectionCard>
</template>
