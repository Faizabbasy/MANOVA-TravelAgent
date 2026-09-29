<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
import type { VendorInvoiceDto } from '~/types/api'
import { vendorInvoiceTag } from '~/lib/finance/labels'
import { dueInfo, formatBusinessDate } from '~/lib/finance/dates'

/** One vendor invoice in a worklist: vendor, invoice number, when it is due, how much is left. */
const props = withDefaults(defineProps<{ invoice: VendorInvoiceDto; today: string; showVendor?: boolean }>(), { showVendor: true })
defineEmits<{ open: [] }>()

const tag = computed(() => vendorInvoiceTag(props.invoice))
const payable = computed(() => props.invoice.status === 'approved')
const settled = computed(() => props.invoice.settlement === 'paid')
const due = computed(() => dueInfo(props.invoice.dueDate, props.today, !payable.value || settled.value))
const amount = computed(() => (payable.value ? props.invoice.outstandingMinor : props.invoice.totalMinor))
const dueClass = computed(() => due.value.tone === 'destructive' ? 'font-medium text-destructive' : due.value.tone === 'warning' ? 'font-medium text-warning' : 'text-muted-foreground')
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
          {{ showVendor ? invoice.vendor.name : invoice.vendorInvoiceNumber }}
        </p>
        <StatusBadge :label="tag.label" :tone="tag.tone" class="max-sm:hidden" />
      </div>
      <p class="truncate text-xs text-muted-foreground">
        <template v-if="showVendor">
          {{ invoice.vendorInvoiceNumber }} ·
        </template>{{ invoice.project?.name ?? 'Tanpa project' }}
      </p>
      <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs sm:hidden">
        <span v-if="payable && !settled" :class="dueClass">{{ due.label }}</span>
        <StatusBadge :label="tag.label" :tone="tag.tone" />
      </p>
    </div>
    <div class="hidden w-36 shrink-0 text-xs sm:block">
      <p v-if="payable && !settled" :class="dueClass">
        {{ due.label }}
      </p>
      <p v-else class="text-muted-foreground">
        Jatuh tempo {{ formatBusinessDate(invoice.dueDate, { short: true, today }) }}
      </p>
    </div>
    <div class="shrink-0 text-right">
      <FinanceAmount :value="amount" :currency="invoice.currency" class="block text-sm font-semibold" :class="(settled || !payable) && 'text-muted-foreground'" />
      <p class="text-[11px] text-muted-foreground">
        {{ !payable ? 'total' : settled ? 'lunas' : 'sisa' }}
      </p>
    </div>
    <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
  </button>
</template>
