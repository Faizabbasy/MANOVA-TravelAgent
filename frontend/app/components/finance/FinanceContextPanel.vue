<script setup lang="ts">
import { ArrowRight, CircleDollarSign } from 'lucide-vue-next'
import type { ApiBookingType, BookingFinanceSummaryDto, PartyFinanceSummaryDto, VendorFinanceSummaryDto } from '~/types/api'
import { PAYMENT_STATUS_TONE } from '~/lib/finance/labels'
import { formatBusinessDate, todayJakarta } from '~/lib/finance/dates'

/**
 * Finance context for a booking, vendor or customer page — from the same API as the Finance screens, so there
 * is never a second set of numbers. Finance/Super Admin get figures and the invoice lists (with their panels);
 * other roles get the status only (ADR-007 #3). Hidden quietly if the server is unreachable.
 */
type Subject =
  | { type: 'booking'; bookingType: ApiBookingType; id: string }
  | { type: 'vendor'; id: string }
  | { type: 'party'; id: string }
const props = defineProps<{ subject: Subject; title?: string }>()

const api = useApi()
const session = useServerSession()
const today = todayJakarta()

const summary = useFinanceQuery<BookingFinanceSummaryDto | VendorFinanceSummaryDto | PartyFinanceSummaryDto>(async () => {
  const s = props.subject
  if (s.type === 'booking') { return (await api.finance.bookingSummary(s.bookingType, s.id)).data }
  if (s.type === 'vendor') { return (await api.finance.vendorSummary(s.id)).data }
  return (await api.finance.partySummary(s.id)).data
}, { watch: [() => JSON.stringify(props.subject)] })

const data = computed(() => summary.data.value)
const hidden = computed(() => ['offline', 'signed-out'].includes(session.state.value.status) || !!summary.error.value?.isNotFound || !!summary.error.value?.isForbidden)
const booking = computed(() => (props.subject.type === 'booking' && data.value?.view === 'full' ? data.value as Extract<BookingFinanceSummaryDto, { view: 'full' }> : null))
const vendor = computed(() => (props.subject.type === 'vendor' ? data.value as VendorFinanceSummaryDto | null : null))
const party = computed(() => (props.subject.type === 'party' && data.value?.view === 'full' ? data.value as Extract<PartyFinanceSummaryDto, { view: 'full' }> : null))
const paymentStatus = computed(() => (props.subject.type !== 'vendor' && data.value && 'paymentStatus' in data.value ? data.value : null))

const customerInvoices = computed(() => (booking.value?.invoices ?? party.value?.invoices ?? []).filter(i => i.status !== 'void').slice(0, 8))
const vendorInvoices = computed(() => {
  const list = booking.value?.vendorInvoices ?? (vendor.value?.view === 'full' ? vendor.value.invoices : [])
  return list.filter(i => i.status !== 'void' && i.status !== 'rejected').slice(0, 8)
})
const moreLink = computed(() => {
  const s = props.subject
  if (s.type === 'vendor') { return `/finance/payables?tab=all&vendorId=${s.id}` }
  if (s.type === 'party') { return `/finance/receivables?partyId=${s.id}` }
  return null
})

const selectedInvoice = ref<string | null>(null)
const selectedVendorInvoice = ref<string | null>(null)
</script>

<template>
  <ClientOnly>
    <SectionCard v-if="!hidden" :title="title ?? 'Tagihan & pembayaran'" description="Data langsung dari Finance.">
      <template v-if="moreLink && session.can('finance.view-cash')" #actions>
        <NuxtLink :to="moreLink" class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Buka di Finance <ArrowRight class="h-3.5 w-3.5" />
        </NuxtLink>
      </template>

      <div v-if="!data && !summary.error.value" class="space-y-2">
        <div class="h-6 w-48 animate-pulse rounded bg-muted" />
        <div class="h-16 animate-pulse rounded-lg bg-muted" />
      </div>
      <FinanceErrorState v-else-if="summary.error.value" :error="summary.error.value" compact @retry="summary.refresh" />

      <div v-else-if="data" class="space-y-4">
        <!-- Status line (everyone) -->
        <div v-if="paymentStatus" class="flex flex-wrap items-center gap-2 text-sm">
          <CircleDollarSign class="h-4 w-4 text-muted-foreground" />
          <StatusBadge :label="paymentStatus.label" :tone="PAYMENT_STATUS_TONE[paymentStatus.paymentStatus]" dot />
          <span v-if="paymentStatus.nextDueDate && paymentStatus.paymentStatus !== 'paid'" class="text-xs text-muted-foreground">Jatuh tempo berikutnya {{ formatBusinessDate(paymentStatus.nextDueDate, { short: true, today }) }}</span>
        </div>
        <dl v-if="vendor" class="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt class="text-xs text-muted-foreground">
              Perlu direview
            </dt>
            <dd class="font-semibold tabular-nums">
              {{ vendor.pendingReviewCount }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Menunggu dibayar
            </dt>
            <dd class="font-semibold tabular-nums">
              {{ vendor.awaitingPaymentCount }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Terlambat
            </dt>
            <dd class="font-semibold tabular-nums" :class="vendor.overdueCount && 'text-destructive'">
              {{ vendor.overdueCount }}
            </dd>
          </div>
        </dl>

        <!-- Figures (Finance / Super Admin only; the server decides) -->
        <dl v-if="booking" class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt class="text-xs text-muted-foreground">
              Harga jual
            </dt>
            <dd><FinanceAmount :value="booking.sellAmountMinor" unavailable-label="Belum diisi" class="font-semibold" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Ditagih
            </dt>
            <dd><FinanceAmount :value="booking.receivable.invoicedMinor" class="font-semibold" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Diterima
            </dt>
            <dd><FinanceAmount :value="booking.receivable.receivedMinor" class="font-semibold text-success" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Biaya vendor
            </dt>
            <dd><FinanceAmount :value="booking.payable.approvedMinor" class="font-semibold" /></dd>
          </div>
        </dl>
        <dl v-else-if="vendor?.view === 'full'" class="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm sm:grid-cols-4">
          <div>
            <dt class="text-xs text-muted-foreground">
              Sisa utang
            </dt>
            <dd><FinanceAmount :value="vendor.payable.outstandingMinor" class="font-semibold" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Terlambat
            </dt>
            <dd><FinanceAmount :value="vendor.payable.overdueMinor" class="font-semibold" :class="vendor.payable.overdueMinor !== '0' && 'text-destructive'" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Sudah dibayar
            </dt>
            <dd><FinanceAmount :value="vendor.payable.paidMinor" class="font-semibold" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Deposit belum dipakai
            </dt>
            <dd><FinanceAmount :value="vendor.depositUnallocatedMinor" class="font-semibold" /></dd>
          </div>
        </dl>
        <dl v-else-if="party" class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt class="text-xs text-muted-foreground">
              Total ditagih
            </dt>
            <dd><FinanceAmount :value="party.receivable.invoicedMinor" class="font-semibold" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Sudah dibayar
            </dt>
            <dd><FinanceAmount :value="party.receivable.receivedMinor" class="font-semibold text-success" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Sisa tagihan
            </dt>
            <dd>
              <FinanceAmount :value="party.receivable.outstandingMinor" class="font-semibold" />
              <span v-if="party.receivable.overdueMinor !== '0'" class="block text-xs font-medium text-destructive"><FinanceAmount :value="party.receivable.overdueMinor" /> terlambat</span>
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Uang muka
            </dt>
            <dd><FinanceAmount :value="party.advanceUnallocatedMinor" class="font-semibold" /></dd>
          </div>
        </dl>
        <p v-else-if="data.view === 'status'" class="text-xs text-muted-foreground">
          Rincian nominal hanya untuk tim Finance.
        </p>

        <div v-if="customerInvoices.length" class="divide-y divide-border overflow-hidden rounded-lg border border-border">
          <FinanceInvoiceRow
            v-for="inv in customerInvoices"
            :key="inv.id"
            :invoice="inv"
            :today="today"
            :show-party="subject.type !== 'party'"
            @open="selectedInvoice = inv.id"
          />
        </div>
        <div v-if="vendorInvoices.length" class="divide-y divide-border overflow-hidden rounded-lg border border-border">
          <FinanceVendorInvoiceRow
            v-for="inv in vendorInvoices"
            :key="inv.id"
            :invoice="inv"
            :today="today"
            :show-vendor="subject.type !== 'vendor'"
            @open="selectedVendorInvoice = inv.id"
          />
        </div>
        <p v-if="data.view === 'full' && !customerInvoices.length && !vendorInvoices.length" class="text-sm text-muted-foreground">
          Belum ada invoice terkait.
        </p>
      </div>

      <FinanceInvoiceSheet v-model:invoice-id="selectedInvoice" />
      <FinanceVendorInvoiceSheet v-model:invoice-id="selectedVendorInvoice" />
    </SectionCard>
  </ClientOnly>
</template>
