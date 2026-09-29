<script setup lang="ts">
import { AlarmClock, CalendarRange, CheckCircle2, FilePlus2, FileText, Loader2, PiggyBank, Plus, SearchX, Wallet } from 'lucide-vue-next'
import type { AdvanceDto, BillingScheduleItemDto, CustomerInvoiceDto } from '~/types/api'
import { formatBusinessDate, shiftDate, todayJakarta } from '~/lib/finance/dates'
import { INVOICE_TYPE_LABEL } from '~/lib/finance/labels'
import { cn } from '~/lib/utils'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Piutang Customer — Finance' })

/**
 * Receivables worklist: which customers must pay, when, and how much is left — ordered by the nearest due
 * date so the next action is on top. Drafts and planned terms are listed separately: neither is a receivable.
 */
const api = useApi()
const route = useRoute()
const session = useServerSession()
const { showToast } = useToast()
const lookups = useFinanceLookups()
const today = todayJakarta()

type Tab = 'outstanding' | 'overdue' | 'draft' | 'plan' | 'paid'
const tab = ref<Tab>((['outstanding', 'overdue', 'draft', 'plan', 'paid'] as Tab[]).includes(route.query.tab as Tab) ? route.query.tab as Tab : 'outstanding')
const partyId = ref<string | null>(typeof route.query.partyId === 'string' ? route.query.partyId : null)
const projectId = ref<string | null>(typeof route.query.projectId === 'string' ? route.query.projectId : null)
const filter = () => ({ partyId: partyId.value ?? undefined, projectId: projectId.value ?? undefined })
const filterWatch = [partyId, projectId]

// Header figures (always "all open invoices" for the current customer/project filter).
const totals = useFinanceQuery(async () => {
  const [open, overdue, dueSoon] = await Promise.all([
    api.finance.receivables({ ...filter(), settlement: 'outstanding', limit: 1 }),
    api.finance.receivables({ ...filter(), settlement: 'overdue', limit: 1 }),
    api.finance.receivables({ ...filter(), settlement: 'outstanding', dueTo: shiftDate(today, 7), limit: 1 })
  ])
  return { open: open.meta.summary, overdueCount: overdue.meta.summary.count, dueSoon: dueSoon.meta.summary }
}, { watch: filterWatch })

// The active list.
const PAGE = 50
const list = useFinanceQuery(async () => {
  if (tab.value === 'draft') { return { items: (await api.finance.listCustomerInvoices({ ...filter(), status: 'draft', limit: 100 })).data, next: null } }
  if (tab.value === 'plan') { return { items: [] as CustomerInvoiceDto[], next: null } }
  const res = await api.finance.receivables({ ...filter(), settlement: tab.value, limit: PAGE })
  return { items: res.data, next: res.meta.pagination.nextCursor }
}, { watch: [tab, ...filterWatch] })

const more = ref<CustomerInvoiceDto[]>([])
const nextCursor = ref<string | null>(null)
const loadingMore = ref(false)
watch(() => list.data.value, (v) => { more.value = []; nextCursor.value = v?.next ?? null })
async function loadMore () {
  if (!nextCursor.value || loadingMore.value || tab.value === 'draft' || tab.value === 'plan') { return }
  loadingMore.value = true
  try {
    const res = await api.finance.receivables({ ...filter(), settlement: tab.value, limit: PAGE, cursor: nextCursor.value })
    more.value = [...more.value, ...res.data]
    nextCursor.value = res.meta.pagination.nextCursor
  } finally { loadingMore.value = false }
}
const items = computed(() => [...(list.data.value?.items ?? []), ...more.value])

const drafts = useFinanceQuery(async () => (await api.finance.listCustomerInvoices({ ...filter(), status: 'draft', limit: 100 })).data, { watch: filterWatch })
const plans = useFinanceQuery(async () => {
  const all = (await api.finance.listBillingSchedule({ projectId: projectId.value ?? undefined, status: 'planned' })).data
  if (!partyId.value) { return all }
  const projectIds = new Set(lookups.projectsOfParty(partyId.value).map(p => p.value))
  return all.filter(s => projectIds.has(s.project.id))
}, { watch: [...filterWatch, () => lookups.projects.value.length] })
const advances = useFinanceQuery(async () => (await api.finance.advances({ type: 'customer', partyId: partyId.value ?? undefined })).data, { watch: [partyId] })

const tabs = computed(() => [
  { key: 'outstanding' as Tab, label: 'Belum lunas', count: totals.data.value?.open.count },
  { key: 'overdue' as Tab, label: 'Terlambat', count: totals.data.value?.overdueCount, alert: true },
  { key: 'draft' as Tab, label: 'Draft', count: drafts.data.value?.length },
  { key: 'plan' as Tab, label: 'Rencana tagihan', count: plans.data.value?.length },
  { key: 'paid' as Tab, label: 'Lunas', count: undefined }
])
watch(tab, t => navigateTo({ query: { ...route.query, tab: t === 'outstanding' ? undefined : t } }, { replace: true }))

const dueSoonOnly = computed(() => {
  const t = totals.data.value
  if (!t) { return null }
  return (BigInt(t.dueSoon.outstandingMinor) - BigInt(t.open.overdueMinor)).toString()
})
const advanceTotal = computed(() => (advances.data.value ?? []).reduce((s, a) => s + BigInt(a.unallocatedMinor), 0n).toString())

// ── Actions ──────────────────────────────────────────────────────────────────────────────────────────────
const selectedInvoice = ref<string | null>(null)
const showCreate = ref(false)
const showSchedule = ref(false)
const showReceipt = ref(false)
const advanceToApply = ref<AdvanceDto | null>(null)
const cancelTarget = ref<BillingScheduleItemDto | null>(null)

const fromPlan = useFinanceAction(async (item: BillingScheduleItemDto) =>
  (await api.finance.createInvoiceDraft({ billingScheduleItemId: item.id, dueDate: item.plannedDate >= today ? item.plannedDate : shiftDate(today, 14) })).data)
async function invoicePlan (item: BillingScheduleItemDto) {
  const draft = await fromPlan.run(item)
  if (!draft) {
    if (fromPlan.error.value) { showToast('Belum bisa membuat invoice', fromPlan.error.value.message, 'error') }
    return
  }
  showToast('Draft invoice dibuat', `Dari rencana "${item.label}". Periksa lalu terbitkan.`)
  selectedInvoice.value = draft.id
}
const cancelPlan = useFinanceAction((id: string, reason: string) => api.finance.cancelScheduleItem(id, reason))
async function confirmCancelPlan (value: { reason: string }) {
  if (!cancelTarget.value || !(await cancelPlan.run(cancelTarget.value.id, value.reason))) { return }
  showToast('Rencana dibatalkan', `${cancelTarget.value.label} tidak akan ditagih.`)
  cancelTarget.value = null
}

const filtered = computed(() => !!partyId.value || !!projectId.value)
function resetFilters () { partyId.value = null; projectId.value = null }
</script>

<template>
  <FinancePage title="Piutang Customer" description="Tagihan ke customer: siapa harus bayar, kapan, dan berapa sisanya.">
    <template #actions>
      <Button v-if="session.can('finance.post-cash')" variant="outline" @click="showReceipt = true">
        <Wallet class="mr-2 h-4 w-4" /> Catat pembayaran
      </Button>
      <Button v-if="session.can('finance.manage-receivables')" @click="showCreate = true">
        <FilePlus2 class="mr-2 h-4 w-4" /> Buat invoice
      </Button>
    </template>

    <!-- Totals -->
    <section class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Ringkasan piutang">
      <div class="col-span-2 rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-1">
        <p class="text-xs text-muted-foreground">
          Sisa tagihan belum dibayar
        </p>
        <FinanceAmount v-if="totals.data.value" :value="totals.data.value.open.outstandingMinor" class="mt-1 block text-2xl font-semibold tracking-tight" />
        <div v-else class="mt-2 h-7 w-40 animate-pulse rounded bg-muted" />
        <p class="mt-0.5 text-xs text-muted-foreground">
          {{ totals.data.value?.open.count ?? '…' }} invoice terbuka
        </p>
      </div>
      <button type="button" class="rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-destructive/40" @click="tab = 'overdue'">
        <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlarmClock class="h-3.5 w-3.5 text-destructive" /> Terlambat
        </p>
        <FinanceAmount v-if="totals.data.value" :value="totals.data.value.open.overdueMinor" class="mt-1 block text-lg font-semibold" :class="totals.data.value.open.overdueMinor !== '0' && 'text-destructive'" />
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
      <div class="col-span-2 rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-1">
        <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <PiggyBank class="h-3.5 w-3.5 text-primary" /> Uang muka belum dipakai
        </p>
        <FinanceAmount :value="advances.data.value ? advanceTotal : null" unavailable-label="…" class="mt-1 block text-lg font-semibold" />
        <p class="text-xs text-muted-foreground">
          {{ advances.data.value?.length ?? 0 }} penerimaan
        </p>
      </div>
    </section>

    <!-- Tabs + filters -->
    <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div class="-mx-1 overflow-x-auto px-1">
        <div class="inline-flex min-w-max rounded-lg border border-border bg-card p-0.5 shadow-sm" role="tablist" aria-label="Kelompok tagihan">
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
              :class="cn('rounded-full px-1.5 text-[11px] tabular-nums', tab === t.key ? 'bg-primary-foreground/20' : t.alert && t.count ? 'bg-destructive/10 text-destructive' : 'bg-muted')"
            >{{ t.count }}</span>
          </button>
        </div>
      </div>
      <div class="grid gap-2 sm:grid-cols-2 xl:w-[32rem]">
        <FinanceSelect v-model="partyId" :options="lookups.partyOptions.value" clear-label="Semua customer" placeholder="Semua customer" aria-label="Customer" />
        <FinanceSelect v-model="projectId" :options="partyId ? lookups.projectsOfParty(partyId) : lookups.projectOptions.value" clear-label="Semua project" placeholder="Semua project" aria-label="Project" />
      </div>
    </div>

    <!-- Planned terms -->
    <Card v-if="tab === 'plan'" class="overflow-clip">
      <div class="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <p class="text-sm text-muted-foreground">
          Termin yang belum ditagih. Buat invoice saat waktunya tiba.
        </p>
        <Button v-if="session.can('finance.manage-receivables')" size="sm" variant="outline" @click="showSchedule = true">
          <Plus class="mr-1.5 h-4 w-4" /> Tambah rencana
        </Button>
      </div>
      <FinanceErrorState v-if="plans.error.value" :error="plans.error.value" compact @retry="plans.refresh" />
      <LoadingState v-else-if="!plans.loaded.value" :rows="3" class="px-5" />
      <EmptyState v-else-if="!plans.data.value?.length" :icon="CalendarRange" title="Tidak ada rencana tagihan" description="Rencanakan termin (DP, pelunasan) per project agar tidak ada yang lupa ditagih." />
      <ul v-else class="divide-y divide-border">
        <li v-for="p in plans.data.value" :key="p.id" class="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">
              {{ p.label }} <span class="font-normal text-muted-foreground">· {{ INVOICE_TYPE_LABEL[p.invoiceType] }}</span>
            </p>
            <p class="truncate text-xs text-muted-foreground">
              {{ p.project.name }} · rencana {{ formatBusinessDate(p.plannedDate, { short: true, today }) }}
              <span v-if="p.plannedDate < today" class="font-medium text-warning"> (sudah lewat)</span>
            </p>
          </div>
          <FinanceAmount :value="p.amountMinor" class="text-sm font-semibold" />
          <div v-if="session.can('finance.manage-receivables')" class="flex gap-2">
            <Button size="sm" :disabled="fromPlan.pending.value" @click="invoicePlan(p)">
              <FileText class="mr-1.5 h-4 w-4" /> Buat invoice
            </Button>
            <Button size="sm" variant="ghost" class="text-muted-foreground" @click="cancelPlan.reset(); cancelTarget = p">
              Batalkan
            </Button>
          </div>
        </li>
      </ul>
    </Card>

    <!-- Invoices -->
    <Card v-else class="overflow-clip">
      <FinanceErrorState v-if="list.error.value && !list.data.value" :error="list.error.value" @retry="list.refresh" />
      <div v-else-if="!list.loaded.value" class="space-y-2 p-4">
        <div v-for="i in 5" :key="i" class="h-14 animate-pulse rounded-lg bg-muted" />
      </div>
      <EmptyState v-else-if="!items.length && filtered" :icon="SearchX" title="Tidak ada tagihan yang cocok" description="Coba ubah filter customer atau project.">
        <Button variant="outline" size="sm" @click="resetFilters">
          Hapus filter
        </Button>
      </EmptyState>
      <EmptyState
        v-else-if="!items.length"
        :icon="tab === 'overdue' || tab === 'outstanding' ? CheckCircle2 : FileText"
        :title="tab === 'overdue' ? 'Tidak ada tagihan terlambat' : tab === 'outstanding' ? 'Semua tagihan sudah lunas' : tab === 'draft' ? 'Tidak ada draft' : 'Belum ada invoice lunas'"
        :description="tab === 'draft' ? 'Draft invoice yang belum diterbitkan akan muncul di sini.' : undefined"
      />
      <div v-else :class="list.pending.value && 'opacity-70 transition-opacity'">
        <div class="divide-y divide-border">
          <FinanceInvoiceRow v-for="inv in items" :key="inv.id" :invoice="inv" :today="today" @open="selectedInvoice = inv.id" />
        </div>
        <div v-if="nextCursor" class="border-t border-border p-3 text-center">
          <Button variant="ghost" size="sm" :disabled="loadingMore" @click="loadMore">
            <Loader2 v-if="loadingMore" class="mr-2 h-4 w-4 animate-spin" /> Muat lebih banyak
          </Button>
        </div>
      </div>
    </Card>

    <!-- Advances -->
    <SectionCard v-if="advances.data.value?.length" title="Uang muka customer belum dipakai" description="Uang yang sudah diterima tapi belum dialokasikan ke invoice. Pakai saat invoice-nya terbit." flush>
      <ul class="divide-y divide-border border-t border-border">
        <li v-for="a in advances.data.value" :key="a.transactionId" class="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">
              {{ a.party?.name }}
            </p>
            <p class="text-xs text-muted-foreground">
              Diterima {{ formatBusinessDate(a.effectiveDate, { short: true, today }) }} · {{ a.account.code }}<template v-if="a.projectId">
                · {{ a.projectId }}
              </template>
            </p>
          </div>
          <FinanceAmount :value="a.unallocatedMinor" class="text-sm font-semibold" />
          <Button v-if="session.can('finance.post-cash')" size="sm" variant="outline" @click="advanceToApply = a">
            Pakai untuk invoice
          </Button>
        </li>
      </ul>
    </SectionCard>

    <FinanceInvoiceSheet v-model:invoice-id="selectedInvoice" />
    <FinanceInvoiceDialog v-model:open="showCreate" :project-id="projectId" @saved="inv => selectedInvoice = inv.id" />
    <FinanceScheduleDialog v-model:open="showSchedule" :project-id="projectId" />
    <FinanceReceiptDialog v-model:open="showReceipt" :party-id="partyId" />
    <FinanceApplyAdvanceDialog :open="!!advanceToApply" :advance="advanceToApply" @update:open="v => { if (!v) advanceToApply = null }" />
    <FinanceReasonDialog
      :open="!!cancelTarget"
      :title="`Batalkan rencana ${cancelTarget?.label ?? ''}?`"
      description="Termin ini tidak akan ditagih dan tidak lagi dihitung sebagai 'belum ditagih'."
      confirm-label="Batalkan rencana"
      tone="destructive"
      :pending="cancelPlan.pending.value"
      :error="cancelPlan.error.value"
      @update:open="v => { if (!v) cancelTarget = null }"
      @confirm="confirmCancelPlan"
    />
  </FinancePage>
</template>
