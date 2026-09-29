<script setup lang="ts">
import { CalendarRange, CheckCircle2, FilePlus2, Lock, ReceiptText } from 'lucide-vue-next'
import type { ProjectFinanceSummaryDto } from '~/types/api'
import { PAYMENT_STATUS_TONE } from '~/lib/finance/labels'
import { todayJakarta } from '~/lib/finance/dates'

/**
 * Finance of one project, from the same endpoints as the Finance screens (no second source): contract vs
 * billed vs received, what is still to bill, vendor costs, accrual profitability, and both invoice lists
 * with their panels. Also decides whether the project's finance can be closed, from server data only.
 */
const props = defineProps<{ projectId: string; settled?: boolean; canClose?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const api = useApi()
const session = useServerSession()
const today = todayJakarta()

const summary = useFinanceQuery<ProjectFinanceSummaryDto>(async () => (await api.finance.projectSummary(props.projectId)).data, { watch: [() => props.projectId] })
const plans = useFinanceQuery(async () => (await api.finance.listBillingSchedule({ projectId: props.projectId, status: 'planned' })).data, {
  watch: [() => props.projectId], enabled: () => session.can('finance.view-cash')
})
const full = computed(() => (summary.data.value?.view === 'full' ? summary.data.value : null))

const openInvoices = computed(() => (full.value?.invoices ?? []).filter(i => i.status !== 'void'))
const vendorInvoices = computed(() => (full.value?.vendorInvoices ?? []).filter(i => i.status !== 'void' && i.status !== 'rejected'))
const marginPct = computed(() => full.value?.profitability.marginBasisPoints == null ? null : (full.value.profitability.marginBasisPoints / 100).toLocaleString('id-ID', { maximumFractionDigits: 1 }))

/**
 * What still blocks closing this project's finance (server figures). Refund requests are still checked by
 * the host page until refunds move to the API (Phase 5).
 */
const blockers = computed<string[]>(() => {
  const f = full.value
  if (!f) { return [] }
  const out: string[] = []
  const open = f.invoices.filter(i => i.status === 'issued' && BigInt(i.outstandingMinor) > 0n).length
  if (open) { out.push(`${open} invoice customer masih punya sisa tagihan.`) }
  if (f.receivable.draftCount) { out.push(`${f.receivable.draftCount} draft invoice belum diterbitkan atau dihapus.`) }
  if (BigInt(f.receivable.scheduledNotInvoicedMinor) > 0n) { out.push('Masih ada rencana tagihan yang belum ditagih atau dibatalkan.') }
  if (f.payable.pendingReviewCount) { out.push(`${f.payable.pendingReviewCount} invoice vendor belum direview.`) }
  if (BigInt(f.payable.outstandingMinor) > 0n) { out.push('Masih ada utang vendor yang belum dibayar.') }
  return out
})
defineExpose({ blockers })

const selectedInvoice = ref<string | null>(null)
const selectedVendorInvoice = ref<string | null>(null)
const showCreate = ref(false)
const showSchedule = ref(false)
const showVendorCreate = ref(false)
</script>

<template>
  <div class="space-y-5">
    <FinanceErrorState v-if="summary.error.value && !summary.data.value" :error="summary.error.value" compact @retry="summary.refresh" />
    <div v-else-if="!summary.data.value" class="space-y-3">
      <div class="h-24 animate-pulse rounded-xl bg-muted" />
      <div class="h-48 animate-pulse rounded-xl bg-muted" />
    </div>

    <!-- Status only (roles without full finance access) -->
    <SectionCard v-else-if="!full" title="Status pembayaran">
      <div class="flex flex-wrap items-center gap-3">
        <StatusBadge :label="summary.data.value.label" :tone="PAYMENT_STATUS_TONE[summary.data.value.paymentStatus]" dot />
        <span class="text-sm text-muted-foreground">Rincian nominal hanya untuk tim Finance.</span>
      </div>
    </SectionCard>

    <template v-else>
      <!-- Receivable summary -->
      <section class="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <h3 class="text-[15px] font-semibold">
              Tagihan ke customer
            </h3>
            <StatusBadge :label="full.label" :tone="PAYMENT_STATUS_TONE[full.paymentStatus]" dot />
          </div>
          <div v-if="session.can('finance.manage-receivables')" class="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" @click="showSchedule = true">
              <CalendarRange class="mr-1.5 h-4 w-4" /> Rencana tagihan
            </Button>
            <Button size="sm" @click="showCreate = true">
              <FilePlus2 class="mr-1.5 h-4 w-4" /> Buat invoice
            </Button>
          </div>
        </div>
        <dl class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div>
            <dt class="text-xs text-muted-foreground">
              Nilai kontrak
            </dt>
            <dd><FinanceAmount :value="full.contractValueMinor" unavailable-label="Belum diisi" class="font-semibold" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Sudah ditagih
            </dt>
            <dd><FinanceAmount :value="full.receivable.invoicedMinor" class="font-semibold" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Sudah diterima
            </dt>
            <dd><FinanceAmount :value="full.receivable.receivedMinor" class="font-semibold text-success" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Sisa tagihan
            </dt>
            <dd>
              <FinanceAmount :value="full.receivable.outstandingMinor" class="font-semibold" />
              <span v-if="full.receivable.overdueMinor !== '0'" class="block text-xs font-medium text-destructive">
                <FinanceAmount :value="full.receivable.overdueMinor" /> terlambat
              </span>
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Belum ditagih
            </dt>
            <dd><FinanceAmount :value="full.receivable.uninvoicedMinor" unavailable-label="—" class="font-semibold" /></dd>
          </div>
        </dl>
        <p v-if="full.receivable.creditedMinor !== '0'" class="mt-2 text-xs text-muted-foreground">
          Termasuk credit note <FinanceAmount :value="full.receivable.creditedMinor" class="font-medium text-foreground" /> yang mengurangi tagihan.
        </p>

        <div class="mt-4 overflow-hidden rounded-lg border border-border">
          <div v-if="!openInvoices.length && !(plans.data.value?.length)" class="px-4 py-6 text-center text-sm text-muted-foreground">
            Belum ada invoice untuk project ini.
          </div>
          <div class="divide-y divide-border">
            <FinanceInvoiceRow
              v-for="inv in openInvoices"
              :key="inv.id"
              :invoice="inv"
              :today="today"
              :show-party="false"
              @open="selectedInvoice = inv.id"
            />
            <NuxtLink
              v-for="p in plans.data.value ?? []"
              :key="p.id"
              :to="`/finance/receivables?tab=plan&projectId=${projectId}`"
              class="flex items-center justify-between gap-4 px-4 py-3 text-sm transition-colors hover:bg-muted/40 sm:px-5"
            >
              <span class="min-w-0">
                <span class="block truncate font-medium text-muted-foreground">{{ p.label }}</span>
                <span class="text-xs text-muted-foreground">Rencana tagihan · belum ditagih</span>
              </span>
              <FinanceAmount :value="p.amountMinor" class="shrink-0 text-muted-foreground" />
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- Costs & profitability -->
      <section class="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-[15px] font-semibold">
            Biaya vendor & profitabilitas
          </h3>
          <Button v-if="session.can('finance.manage-payables')" size="sm" variant="outline" @click="showVendorCreate = true">
            <ReceiptText class="mr-1.5 h-4 w-4" /> Catat invoice vendor
          </Button>
        </div>
        <dl class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt class="text-xs text-muted-foreground">
              Pendapatan (ditagih)
            </dt>
            <dd><FinanceAmount :value="full.profitability.revenueMinor" class="font-semibold" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Biaya
            </dt>
            <dd>
              <FinanceAmount :value="full.profitability.costMinor" class="font-semibold" />
              <span class="block text-xs text-muted-foreground">vendor <FinanceAmount :value="full.payable.approvedMinor" /> · lain <FinanceAmount :value="full.projectExpensesMinor" /></span>
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Laba kotor
            </dt>
            <dd><FinanceAmount :value="full.profitability.grossProfitMinor" class="font-semibold" :class="full.profitability.grossProfitMinor.startsWith('-') && 'text-destructive'" /></dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Margin
            </dt>
            <dd class="font-semibold tabular-nums">
              {{ marginPct === null ? '—' : `${marginPct}%` }}
            </dd>
          </div>
        </dl>
        <p class="mt-2 text-xs text-muted-foreground">
          Dasar akrual: pendapatan = yang sudah ditagih dikurangi credit note; biaya = invoice vendor yang disetujui + pengeluaran project.
          <template v-if="full.payable.pendingReviewCount">
            {{ full.payable.pendingReviewCount }} invoice vendor yang belum direview belum dihitung.
          </template>
        </p>

        <div v-if="vendorInvoices.length" class="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border">
          <FinanceVendorInvoiceRow v-for="inv in vendorInvoices" :key="inv.id" :invoice="inv" :today="today" @open="selectedVendorInvoice = inv.id" />
        </div>
      </section>

      <!-- Closing -->
      <section v-if="settled !== undefined" class="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 class="flex items-center gap-2 text-[15px] font-semibold">
          <Lock class="h-4 w-4 text-muted-foreground" /> Tutup finance project
        </h3>
        <p v-if="settled" class="mt-2 flex items-center gap-2 text-sm text-success">
          <CheckCircle2 class="h-4 w-4" /> Finance project ini sudah ditutup.
        </p>
        <template v-else>
          <ul v-if="blockers.length" class="mt-3 space-y-1.5 text-sm">
            <li v-for="b in blockers" :key="b" class="flex gap-2 text-muted-foreground">
              <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" /> {{ b }}
            </li>
          </ul>
          <p v-else class="mt-2 text-sm text-muted-foreground">
            Semua tagihan lunas, tidak ada utang vendor atau rencana tagihan yang tersisa.
          </p>
          <Button v-if="canClose" class="mt-4" size="sm" :disabled="blockers.length > 0" @click="emit('close')">
            Tutup finance project
          </Button>
        </template>
      </section>
    </template>

    <FinanceInvoiceSheet v-model:invoice-id="selectedInvoice" />
    <FinanceVendorInvoiceSheet v-model:invoice-id="selectedVendorInvoice" />
    <FinanceInvoiceDialog v-model:open="showCreate" :project-id="projectId" @saved="inv => selectedInvoice = inv.id" />
    <FinanceScheduleDialog v-model:open="showSchedule" :project-id="projectId" />
    <FinanceVendorInvoiceDialog v-model:open="showVendorCreate" :project-id="projectId" @saved="inv => selectedVendorInvoice = inv.id" />
  </div>
</template>
