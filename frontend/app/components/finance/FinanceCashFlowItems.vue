<script setup lang="ts">
import { ArrowDownLeft, ArrowUpRight } from 'lucide-vue-next'
import type { CashFlowItem } from '~/types/api'
import { CERTAINTY, SOURCE_LABEL } from '~/lib/finance/cashflow'
import { formatBusinessDate } from '~/lib/finance/dates'

/** The invoices and refunds behind one period (or a warning): who, why this date, how much. */
defineProps<{ items: CashFlowItem[]; today: string }>()
const emit = defineEmits<{ open: [item: CashFlowItem] }>()

const tone: Record<string, string> = {
  success: 'bg-success/10 text-success',
  info: 'bg-primary/10 text-primary',
  destructive: 'bg-destructive/10 text-destructive'
}

function dateNote (item: CashFlowItem, today: string): string {
  if (item.source === 'refund') { return 'Disetujui, belum dibayar — dihitung segera' }
  const due = `jatuh tempo ${formatBusinessDate(item.dueDate, { short: true, today })}`
  if (item.certainty === 'overdue') { return `Terlambat, ${due} · dihitung di periode pertama` }
  if (item.certainty === 'expected') { return `Perkiraan ${formatBusinessDate(item.expectedDate, { short: true, today })} · ${due}` }
  return `Jatuh tempo ${formatBusinessDate(item.dueDate, { short: true, today })}`
}
</script>

<template>
  <ul class="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
    <li v-for="item in items" :key="`${item.source}-${item.id}`">
      <button type="button" class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40" @click="emit('open', item)">
        <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full" :class="item.direction === 'in' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'" aria-hidden="true">
          <ArrowDownLeft v-if="item.direction === 'in'" class="h-3.5 w-3.5" />
          <ArrowUpRight v-else class="h-3.5 w-3.5" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span class="truncate text-sm font-medium">{{ item.counterparty }}</span>
            <span v-if="item.source !== 'refund'" class="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium" :class="tone[CERTAINTY[item.certainty].tone]" :title="CERTAINTY[item.certainty].hint">{{ CERTAINTY[item.certainty].label }}</span>
            <span v-if="item.disputed" class="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[11px] font-medium text-warning">Sengketa</span>
          </span>
          <span class="block text-xs text-muted-foreground sm:truncate">
            {{ SOURCE_LABEL[item.source] }} {{ item.reference }}<template v-if="item.project"> · {{ item.project.name }}</template> · {{ dateNote(item, today) }}
          </span>
        </span>
        <FinanceAmount :value="item.amountMinor" :direction="item.direction" :subdued="!item.counted" class="shrink-0 whitespace-nowrap text-sm font-semibold" />
      </button>
    </li>
  </ul>
</template>
