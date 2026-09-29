<script setup lang="ts">
import { AlarmClock, ArrowRight, CalendarRange, CheckCircle2, ClipboardCheck, FilePlus2, Loader2, ReceiptText, SearchX, Wallet } from 'lucide-vue-next'
import type { AdvanceDto, VendorInvoiceDto } from '~/types/api'
import { formatBusinessDate, shiftDate, todayJakarta } from '~/lib/finance/dates'
import { cn } from '~/lib/utils'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Utang Vendor — Finance' })

/**
 * Payables worklist: which vendor invoices need review, which must be paid and when. Invoices under review are
 * not yet debts; only approved ones are. Operating expenses without a vendor invoice live in the statement.
 */
const api = useApi()
const route = useRoute()
const session = useServerSession()
const lookups = useFinanceLookups()
const today = todayJakarta()

type Tab = 'outstanding' | 'overdue' | 'review' | 'paid' | 'all'
const TABS: Tab[] = ['outstanding', 'overdue', 'review', 'paid', 'all']
const tab = ref<Tab>(TABS.includes(route.query.tab as Tab) ? route.query.tab as Tab : 'outstanding')
const vendorId = ref<string | null>(typeof route.query.vendorId === 'string' ? route.query.vendorId : null)
const projectId = ref<string | null>(typeof route.query.projectId === 'string' ? route.query.projectId : null)
const filter = () => ({ vendorId: vendorId.value ?? undefined, projectId: projectId.value ?? undefined })
const filterWatch = [vendorId, projectId]
watch(tab, t => navigateTo({ query: { ...route.query, tab: t === 'outstanding' ? undefined : t } }, { replace: true }))

const totals = useFinanceQuery(async () => {
  const [all, open, overdue, dueSoon] = await Promise.all([
    api.finance.payables({ ...filter(), view: 'all', limit: 1 }),
    api.finance.payables({ ...filter(), view: 'outstanding', limit: 1 }),
    api.finance.payables({ ...filter(), view: 'overdue', limit: 1 }),
    api.finance.payables({ ...filter(), view: 'outstanding', dueTo: shiftDate(today, 7), limit: 1 })
  ])
  return { all: all.meta.summary, openCount: open.meta.summary.count, overdueCount: overdue.meta.summary.count, dueSoon: dueSoon.meta.summary }
}, { watch: filterWatch })

const PAGE = 50
const list = useFinanceQuery(async () => {
  const res = await api.finance.payables({ ...filter(), view: tab.value, limit: PAGE })
  return { items: res.data, next: res.meta.pagination.nextCursor }
}, { watch: [tab, ...filterWatch] })
const more = ref<VendorInvoiceDto[]>([])
const nextCursor = ref<string | null>(null)
const loadingMore = ref(false)
/** Bumped on every reload/filter change; a "load more" answer from an older generation is dropped. */
let generation = 0
watch([tab, ...filterWatch], () => { generation++ })
watch(() => list.data.value, (v) => { generation++; more.value = []; nextCursor.value = v?.next ?? null })
async function loadMore () {
  if (!nextCursor.value || loadingMore.value) { return }
  loadingMore.value = true
  const mine = generation
  try {
    const res = await api.finance.payables({ ...filter(), view: tab.value, limit: PAGE, cursor: nextCursor.value })
    if (mine !== generation) { return }
    more.value = [...more.value, ...res.data]
    nextCursor.value = res.meta.pagination.nextCursor
  } finally { loadingMore.value = false }
}
const items = computed(() => [...(list.data.value?.items ?? []), ...more.value])

const deposits = useFinanceQuery(async () => (await api.finance.advances({ type: 'vendor', vendorId: vendorId.value ?? undefined })).data, { watch: [vendorId] })

const tabs = computed(() => [
  { key: 'outstanding' as Tab, label: 'Perlu dibayar', count: totals.data.value?.openCount },
  { key: 'overdue' as Tab, label: 'Terlambat', count: totals.data.value?.overdueCount, alert: true },
  { key: 'review' as Tab, label: 'Perlu direview', count: totals.data.value?.all.pendingReviewCount, info: true },
  { key: 'paid' as Tab, label: 'Lunas', count: undefined },
  { key: 'all' as Tab, label: 'Semua', count: undefined }
])
const dueSoonOnly = computed(() => {
  const t = totals.data.value
  return t ? (BigInt(t.dueSoon.outstandingMinor) - BigInt(t.all.overdueMinor)).toString() : null
})

const selected = ref<string | null>(null)
const showCreate = ref(false)
const showPayment = ref(false)
const depositToApply = ref<AdvanceDto | null>(null)
const filtered = computed(() => !!vendorId.value || !!projectId.value)
function resetFilters () { vendorId.value = null; projectId.value = null }
</script>

<template>
  <FinancePage title="Utang Vendor" description="Tagihan dari vendor: mana yang perlu direview, mana yang harus dibayar, dan kapan.">
    <template #actions>
      <Button v-if="session.can('finance.post-cash')" variant="outline" @click="showPayment = true">
        <Wallet class="mr-2 h-4 w-4" /> Catat pembayaran
      </Button>
      <Button v-if="session.can('finance.manage-payables')" @click="showCreate = true">
        <FilePlus2 class="mr-2 h-4 w-4" /> Catat invoice vendor
      </Button>
    </template>

    <section class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Ringkasan utang">
      <div class="col-span-2 rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-1">
        <p class="text-xs text-muted-foreground">
          Sisa utang yang harus dibayar
        </p>
        <FinanceAmount v-if="totals.data.value" :value="totals.data.value.all.outstandingMinor" class="mt-1 block text-2xl font-semibold tracking-tight" />
        <div v-else class="mt-2 h-7 w-40 animate-pulse rounded bg-muted" />
        <p class="mt-0.5 text-xs text-muted-foreground">
          {{ totals.data.value?.openCount ?? '…' }} invoice disetujui
        </p>
      </div>
      <button type="button" class="rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-destructive/40" @click="tab = 'overdue'">
        <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlarmClock class="h-3.5 w-3.5 text-destructive" /> Terlambat
        </p>
        <FinanceAmount v-if="totals.data.value" :value="totals.data.value.all.overdueMinor" class="mt-1 block text-lg font-semibold" :class="totals.data.value.all.overdueMinor !== '0' && 'text-destructive'" />
        <div v-else class="mt-2 h-6 w-28 animate-pulse rounded bg-muted" />
        <p class="text-xs text-muted-foreground">
          {{ totals.data.value?.overdueCount ?? '…' }} invoice
        </p>
      </button>
      <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
        <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarRange class="h-3.5 w-3.5 text-warning" /> Jatuh tempo 7 hari
        </p>
        <FinanceAmount v-if="dueSoonOnly" :value="dueSoonOnly" class="mt-1 block text-lg font-semibold" />
        <div v-else class="mt-2 h-6 w-28 animate-pulse rounded bg-muted" />
        <p class="text-xs text-muted-foreground">
          s/d {{ formatBusinessDate(shiftDate(today, 7), { short: true, today }) }}
        </p>
      </div>
      <button type="button" class="col-span-2 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-chart-5/40 lg:col-span-1" @click="tab = 'review'">
        <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ClipboardCheck class="h-3.5 w-3.5 text-chart-5" /> Menunggu review
        </p>
        <FinanceAmount v-if="totals.data.value" :value="totals.data.value.all.pendingReviewMinor" class="mt-1 block text-lg font-semibold" />
        <div v-else class="mt-2 h-6 w-28 animate-pulse rounded bg-muted" />
        <p class="text-xs text-muted-foreground">
          {{ totals.data.value?.all.pendingReviewCount ?? '…' }} invoice · belum dihitung sebagai utang
        </p>
      </button>
    </section>

    <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div class="-mx-1 overflow-x-auto px-1">
        <div class="inline-flex min-w-max rounded-lg border border-border bg-card p-0.5 shadow-sm" role="tablist" aria-label="Kelompok invoice vendor">
          <button
            v-for="t in tabs"
            :key="t.key"
            type="button"
            role="tab"
            :aria-selected="tab === t.key"
            :class="cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors', tab === t.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')"
            @click="tab = t.key"
          >
            {{ t.label }}
            <span
              v-if="t.count !== undefined"
              :class="cn('rounded-full px-1.5 text-[11px] tabular-nums', tab === t.key ? 'bg-primary-foreground/20' : t.alert && t.count ? 'bg-destructive/10 text-destructive' : t.info && t.count ? 'bg-chart-5/10 text-chart-5' : 'bg-muted')"
            >{{ t.count }}</span>
          </button>
        </div>
      </div>
      <div class="grid gap-2 sm:grid-cols-2 xl:w-[32rem]">
        <FinanceSelect v-model="vendorId" :options="lookups.vendorOptions.value" clear-label="Semua vendor" placeholder="Semua vendor" aria-label="Vendor" />
        <FinanceSelect v-model="projectId" :options="lookups.projectOptions.value" clear-label="Semua project" placeholder="Semua project" aria-label="Project" />
      </div>
    </div>

    <Card class="overflow-clip">
      <FinanceErrorState v-if="list.error.value && !list.data.value" :error="list.error.value" @retry="list.refresh" />
      <div v-else-if="!list.loaded.value" class="space-y-2 p-4">
        <div v-for="i in 5" :key="i" class="h-14 animate-pulse rounded-lg bg-muted" />
      </div>
      <EmptyState v-else-if="!items.length && filtered" :icon="SearchX" title="Tidak ada invoice yang cocok" description="Coba ubah filter vendor atau project.">
        <Button variant="outline" size="sm" @click="resetFilters">
          Hapus filter
        </Button>
      </EmptyState>
      <EmptyState
        v-else-if="!items.length"
        :icon="CheckCircle2"
        :title="tab === 'review' ? 'Tidak ada invoice yang menunggu review' : tab === 'overdue' ? 'Tidak ada utang terlambat' : tab === 'outstanding' ? 'Semua utang sudah dibayar' : 'Belum ada invoice'"
      />
      <div v-else :class="list.pending.value && 'opacity-70 transition-opacity'">
        <div class="divide-y divide-border">
          <FinanceVendorInvoiceRow v-for="inv in items" :key="inv.id" :invoice="inv" :today="today" @open="selected = inv.id" />
        </div>
        <div v-if="nextCursor" class="border-t border-border p-3 text-center">
          <Button variant="ghost" size="sm" :disabled="loadingMore" @click="loadMore">
            <Loader2 v-if="loadingMore" class="mr-2 h-4 w-4 animate-spin" /> Muat lebih banyak
          </Button>
        </div>
      </div>
    </Card>

    <SectionCard v-if="deposits.data.value?.length" title="Deposit vendor belum dipakai" description="Uang yang sudah dibayar ke vendor tapi belum dialokasikan ke invoice." flush>
      <ul class="divide-y divide-border border-t border-border">
        <li v-for="d in deposits.data.value" :key="d.transactionId" class="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">
              {{ d.vendor?.name }}
            </p>
            <p class="text-xs text-muted-foreground">
              Dibayar {{ formatBusinessDate(d.effectiveDate, { short: true, today }) }} · {{ d.account.code }}
            </p>
          </div>
          <FinanceAmount :value="d.unallocatedMinor" class="text-sm font-semibold" />
          <Button v-if="session.can('finance.post-cash')" size="sm" variant="outline" @click="depositToApply = d">
            Pakai untuk invoice
          </Button>
        </li>
      </ul>
    </SectionCard>

    <NuxtLink
      to="/finance/statement?kind=expense"
      class="flex items-center justify-between gap-4 rounded-xl border border-dashed border-border px-5 py-4 text-sm transition-colors hover:bg-card"
    >
      <span class="flex items-center gap-3">
        <ReceiptText class="h-5 w-5 shrink-0 text-muted-foreground" />
        <span>
          <span class="block font-medium">Pengeluaran operasional tanpa invoice vendor</span>
          <span class="block text-xs text-muted-foreground">Sewa, gaji, iklan, software — dicatat langsung sebagai uang keluar di Mutasi Rekening.</span>
        </span>
      </span>
      <ArrowRight class="h-4 w-4 shrink-0 text-muted-foreground" />
    </NuxtLink>

    <FinanceVendorInvoiceSheet v-model:invoice-id="selected" />
    <FinanceVendorInvoiceDialog v-model:open="showCreate" :vendor-id="vendorId" :project-id="projectId" @saved="inv => selected = inv.id" />
    <FinanceVendorPaymentDialog v-model:open="showPayment" :vendor-id="vendorId" />
    <FinanceApplyAdvanceDialog :open="!!depositToApply" :advance="depositToApply" @update:open="v => { if (!v) depositToApply = null }" />
  </FinancePage>
</template>
