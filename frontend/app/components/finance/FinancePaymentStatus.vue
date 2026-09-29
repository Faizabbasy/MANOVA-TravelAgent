<script setup lang="ts">
import { AlertCircle, CircleDollarSign } from 'lucide-vue-next'
import type { ApiBookingType, PaymentStatusView } from '~/types/api'
import { PAYMENT_STATUS_TONE } from '~/lib/finance/labels'
import { formatBusinessDate, todayJakarta } from '~/lib/finance/dates'

/**
 * Payment status of a project, booking or customer — the one finance fact Admin may see (ADR-007 #3): a label,
 * whether something is overdue, and the next due date. Never an amount; Finance sees the same line plus the
 * full panel elsewhere. Quietly hidden when the server session is unavailable (the host page still works).
 */
const props = defineProps<{
  subject: { type: 'project'; id: string } | { type: 'booking'; bookingType: ApiBookingType; id: string } | { type: 'party'; id: string }
  compact?: boolean
}>()

const api = useApi()
const session = useServerSession()
const today = todayJakarta()

const status = useFinanceQuery<PaymentStatusView>(async () => {
  const s = props.subject
  const res = s.type === 'project'
    ? await api.finance.projectSummary(s.id)
    : s.type === 'booking' ? await api.finance.bookingSummary(s.bookingType, s.id) : await api.finance.partySummary(s.id)
  return res.data
}, { watch: [() => JSON.stringify(props.subject)] })

const hidden = computed(() => session.state.value.status === 'offline' || session.state.value.status === 'signed-out' || (status.error.value?.isNotFound ?? false) || (status.error.value?.isForbidden ?? false))
</script>

<template>
  <ClientOnly>
    <div v-if="!hidden" class="flex flex-wrap items-center gap-x-3 gap-y-1.5" :class="compact ? 'text-xs' : 'text-sm'" aria-live="polite">
      <span class="flex items-center gap-1.5 text-muted-foreground">
        <CircleDollarSign class="h-4 w-4" /> Status bayar
      </span>
      <span v-if="!status.data.value && !status.error.value" class="h-5 w-24 animate-pulse rounded bg-muted" />
      <span v-else-if="status.error.value" class="flex items-center gap-1 text-xs text-muted-foreground">
        <AlertCircle class="h-3.5 w-3.5" /> Belum bisa dimuat
        <button type="button" class="font-medium text-primary hover:underline" @click="status.refresh">Coba lagi</button>
      </span>
      <template v-else-if="status.data.value">
        <StatusBadge :label="status.data.value.label" :tone="PAYMENT_STATUS_TONE[status.data.value.paymentStatus]" dot />
        <span v-if="status.data.value.nextDueDate && status.data.value.paymentStatus !== 'paid'" class="text-xs text-muted-foreground">
          Jatuh tempo berikutnya {{ formatBusinessDate(status.data.value.nextDueDate, { short: true, today }) }}
        </span>
        <span v-if="status.data.value.openInvoiceCount" class="text-xs text-muted-foreground">· {{ status.data.value.openInvoiceCount }} tagihan terbuka</span>
      </template>
    </div>
  </ClientOnly>
</template>
