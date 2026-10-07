<script setup lang="ts">
import { getUserById } from '~/data'
import { QUOTATION_APPROVAL_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { QuotationVersionSummary } from '~/types/quotation'

/**
 * Riwayat versi quotation (S6a) — tiap versi tersimpan utuh di server dan terkunci begitu diajukan; revisi
 * membuat versi baru. Tampil hanya bila ada lebih dari satu versi.
 */
const props = defineProps<{ versions: QuotationVersionSummary[] }>()

const rows = computed(() => [...props.versions].sort((a, b) => b.version - a.version))

function statusOf (status: QuotationVersionSummary['status']) {
  return status === 'superseded' ? { label: 'Digantikan', tone: 'neutral' as const } : findStatusOption(QUOTATION_APPROVAL_STATUSES, status)
}

function userName (id?: string) {
  return id ? (getUserById(id)?.name ?? id) : undefined
}
</script>

<template>
  <div v-if="rows.length > 1" class="space-y-1.5">
    <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      Riwayat Versi
    </p>
    <ul class="divide-y divide-border rounded-lg border border-border">
      <li v-for="row in rows" :key="row.version" class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
        <span class="font-medium text-foreground">v{{ row.version }} · {{ formatCurrencyIdr(row.amountIdr) }}</span>
        <span class="text-muted-foreground">
          {{ formatDate(row.createdAt) }}<template v-if="row.decidedBy"> · {{ userName(row.decidedBy) }}</template>
        </span>
        <StatusBadge :label="statusOf(row.status).label" :tone="statusOf(row.status).tone" />
        <p v-if="row.decisionNote" class="w-full text-muted-foreground">
          Catatan: {{ row.decisionNote }}
        </p>
      </li>
    </ul>
  </div>
</template>
