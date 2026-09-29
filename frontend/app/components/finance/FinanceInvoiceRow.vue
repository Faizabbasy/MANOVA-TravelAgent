<script setup lang="ts">
import { CalendarClock, ChevronRight } from 'lucide-vue-next'
import type { CustomerInvoiceDto } from '~/types/api'
import { customerInvoiceTag, INVOICE_TYPE_LABEL } from '~/lib/finance/labels'
import { dueInfo, formatBusinessDate } from '~/lib/finance/dates'

/** One customer invoice in a worklist: who, which invoice, when, how much is left — and a paid-progress bar. */
const props = withDefaults(defineProps<{ invoice: CustomerInvoiceDto; today: string; showParty?: boolean }>(), { showParty: true })
defineEmits<{ open: [] }>()

const tag = computed(() => customerInvoiceTag(props.invoice))
const settled = computed(() => props.invoice.settlement === 'paid' || props.invoice.settlement === 'credited')
const due = computed(() => dueInfo(props.invoice.dueDate, props.today, settled.value || props.invoice.status !== 'issued'))
const pct = computed(() => {
  const total = BigInt(props.invoice.totalMinor)
  if (total === 0n) { return 0 }
  return Number(((BigInt(props.invoice.paidMinor) + BigInt(props.invoice.creditedMinor)) * 100n) / total)
})
</script>

<template>
  <button
    type="button"
    class="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-5"
    @click="$emit('open')"
  >
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <p class="truncate text-sm font-semibold">
          {{ showParty ? invoice.party.name : invoice.project.name }}
        </p>
        <StatusBadge :label="tag.label" :tone="tag.tone" class="max-sm:hidden" />
      </div>
      <p class="truncate text-xs text-muted-foreground">
        <template v-if="showParty">
          {{ invoice.project.name }} ·
        </template>{{ INVOICE_TYPE_LABEL[invoice.invoiceType] }} · {{ invoice.number ?? 'Draft' }}
      </p>
      <p v-if="invoice.status === 'issued' && !settled" class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs sm:hidden">
        <span :class="due.tone === 'destructive' ? 'font-medium text-destructive' : due.tone === 'warning' ? 'font-medium text-warning' : 'text-muted-foreground'">{{ due.label }}</span>
        <StatusBadge :label="tag.label" :tone="tag.tone" />
      </p>
    </div>

    <div class="hidden w-40 shrink-0 text-xs sm:block">
      <p :class="due.tone === 'destructive' ? 'font-medium text-destructive' : due.tone === 'warning' ? 'font-medium text-warning' : 'text-muted-foreground'">
        {{ invoice.status === 'draft' ? (invoice.dueDate ? `Jatuh tempo ${formatBusinessDate(invoice.dueDate, { short: true, today })}` : 'Belum ada jatuh tempo') : due.label }}
      </p>
      <p v-if="invoice.expectedDate && !settled" class="mt-0.5 flex items-center gap-1 text-muted-foreground">
        <CalendarClock class="h-3 w-3" /> Janji {{ formatBusinessDate(invoice.expectedDate, { short: true, today }) }}
      </p>
    </div>

    <div v-if="invoice.status === 'issued'" class="hidden w-28 shrink-0 lg:block" :aria-label="`Terbayar ${pct}%`">
      <div class="h-1.5 overflow-hidden rounded-full bg-muted">
        <div class="h-full rounded-full bg-success" :style="{ width: `${pct}%` }" />
      </div>
      <p class="mt-1 text-[11px] text-muted-foreground">
        {{ pct }}% terbayar
      </p>
    </div>

    <div class="shrink-0 text-right">
      <FinanceAmount
        :value="invoice.status === 'issued' ? invoice.outstandingMinor : invoice.totalMinor"
        :currency="invoice.currency"
        class="block text-sm font-semibold"
        :class="settled && 'text-muted-foreground'"
      />
      <p class="text-[11px] text-muted-foreground">
        {{ invoice.status === 'draft' ? 'total draft' : settled ? 'lunas' : 'sisa' }}
      </p>
    </div>
    <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
  </button>
</template>
