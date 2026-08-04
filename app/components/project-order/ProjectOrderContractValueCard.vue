<script setup lang="ts">
import { computed } from 'vue'
import { Landmark } from 'lucide-vue-next'
import { formatCurrencyIdr, formatPercentage } from '~/utils/format'
import type { Project } from '~/types/project'

const props = defineProps<{
  project: Project
  canViewFinancials: boolean
  /** Margin internal digerbangi terpisah dari nilai kontrak — nilai kontrak boleh dilihat lebih luas. */
  canViewMargin: boolean
}>()

const marginIdr = computed(() => props.project.quotationAmountIdr - props.project.actualCostIdr)
const marginPercent = computed(() => (props.project.quotationAmountIdr === 0
  ? 0
  : (marginIdr.value / props.project.quotationAmountIdr) * 100))
const varianceIdr = computed(() => props.project.budgetIdr - props.project.actualCostIdr)
</script>

<template>
  <SectionCard>
    <div class="flex items-center gap-2 mb-4">
      <Landmark class="h-4 w-4 text-muted-foreground" />
      <h3 class="text-base font-semibold text-foreground">
        Contract Value
      </h3>
    </div>

    <template v-if="canViewFinancials">
      <div class="flex items-baseline justify-between gap-3">
        <span class="text-sm text-muted-foreground">Nilai Kontrak</span>
        <span class="text-xl font-bold text-primary">{{ formatCurrencyIdr(project.quotationAmountIdr) }}</span>
      </div>

      <div class="mt-4 space-y-2.5">
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-sm text-muted-foreground">Budget</span>
          <span class="text-sm font-medium text-foreground">{{ formatCurrencyIdr(project.budgetIdr) }}</span>
        </div>
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-sm text-muted-foreground">Actual Cost</span>
          <span class="text-sm font-medium" :class="project.actualCostIdr > project.budgetIdr ? 'text-destructive' : 'text-foreground'">
            {{ formatCurrencyIdr(project.actualCostIdr) }}
          </span>
        </div>
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-sm text-muted-foreground">Variance</span>
          <span class="text-sm font-medium" :class="varianceIdr >= 0 ? 'text-success' : 'text-destructive'">
            {{ formatCurrencyIdr(varianceIdr) }}
          </span>
        </div>

        <template v-if="canViewMargin">
          <Separator />
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-sm text-muted-foreground">Margin</span>
            <span class="text-sm font-semibold" :class="marginIdr >= 0 ? 'text-success' : 'text-destructive'">
              {{ formatCurrencyIdr(marginIdr) }}
              <span class="text-xs font-normal text-muted-foreground">({{ formatPercentage(marginPercent, 1) }})</span>
            </span>
          </div>
        </template>
      </div>
    </template>

    <EmptyState v-else title="Data finansial disembunyikan" description="Role Anda tidak memiliki visibilitas nilai kontrak." />
  </SectionCard>
</template>
