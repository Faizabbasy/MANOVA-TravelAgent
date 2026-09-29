<script setup lang="ts">
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronRight, Inbox, Loader2, SearchX, Undo2 } from 'lucide-vue-next'
import type { ApiTransactionKind, MovementDto, StatementList } from '~/types/api'
import type { PeriodPreset } from '~/lib/finance/types'
import { formatBusinessDate, formatBusinessDateLong, startOfMonth, todayJakarta } from '~/lib/finance/dates'
import { KIND_LABEL, movementSubtitle, movementTitle } from '~/lib/finance/labels'
import { cn } from '~/lib/utils'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Mutasi Rekening — Finance' })

/**
 * Account statement: only money that actually moved, newest first, filterable by period, account, direction
 * and project. Totals exclude internal transfers and cancelled pairs (the server computes them).
 */
const api = useApi()
const route = useRoute()
const lookups = useFinanceLookups()

const today = todayJakarta()
const preset = ref<PeriodPreset>('this-month')
const from = ref(startOfMonth(today))
const to = ref(today)
const accountId = ref<string | null>(typeof route.query.accountId === 'string' ? route.query.accountId : null)
const projectId = ref<string | null>(typeof route.query.projectId === 'string' ? route.query.projectId : null)
const direction = ref<'all' | 'in' | 'out'>('all')
/** Deep link filter (e.g. ?kind=expense from Utang Vendor). */
const kind = ref<ApiTransactionKind | null>(typeof route.query.kind === 'string' && route.query.kind in KIND_LABEL ? route.query.kind as ApiTransactionKind : null)
const showTransfers = ref(false)

const PAGE = 50
const statement = useFinanceQuery(() => api.finance.statement({
  from: from.value,
  to: to.value,
  accountId: accountId.value ?? undefined,
  projectId: projectId.value ?? undefined,
  direction: direction.value === 'all' ? undefined : direction.value,
  includeTransfers: showTransfers.value,
  kind: kind.value ?? undefined,
  limit: PAGE
}), { watch: [from, to, accountId, projectId, direction, showTransfers, kind] })

/** Extra pages appended by "Muat lebih banyak"; reset whenever the first page reloads. */
const more = ref<MovementDto[]>([])
const nextCursor = ref<string | null>(null)
const loadingMore = ref(false)
watch(() => statement.data.value, (page: StatementList | null) => {
  more.value = []
  nextCursor.value = page?.meta.pagination.nextCursor ?? null
})
async function loadMore () {
  if (!nextCursor.value || loadingMore.value) { return }
  loadingMore.value = true
  try {
    const page = await api.finance.statement({
      from: from.value,
      to: to.value,
      accountId: accountId.value ?? undefined,
      projectId: projectId.value ?? undefined,
      direction: direction.value === 'all' ? undefined : direction.value,
      includeTransfers: showTransfers.value,
      kind: kind.value ?? undefined,
      limit: PAGE,
      cursor: nextCursor.value
    })
    more.value = [...more.value, ...page.data]
    nextCursor.value = page.meta.pagination.nextCursor
  } finally {
    loadingMore.value = false
  }
}

const items = computed(() => [...(statement.data.value?.data ?? []), ...more.value])
const summary = computed(() => statement.data.value?.meta.summary ?? null)
const period = computed(() => statement.data.value?.meta.period ?? null)
const filtered = computed(() => !!accountId.value || !!projectId.value || direction.value !== 'all' || !!kind.value)

/** Group rows under a date heading (list is newest first). */
const groups = computed(() => {
  const out: { date: string; rows: MovementDto[] }[] = []
  for (const m of items.value) {
    const last = out[out.length - 1]
    if (last && last.date === m.effectiveDate) { last.rows.push(m) } else { out.push({ date: m.effectiveDate, rows: [m] }) }
  }
  return out
})

function dayLabel (date: string) {
  if (date === today) { return 'Hari ini' }
  return formatBusinessDateLong(date)
}

const selected = ref<string | null>(null)
const accountFilterOptions = computed(() => (lookups.accounts.data.value ?? []).map(a => ({ value: a.id, label: `${a.bankName} · ${a.code}` })))

function resetFilters () {
  accountId.value = null
  projectId.value = null
  direction.value = 'all'
  kind.value = null
}
</script>

<template>
  <FinancePage title="Mutasi Rekening" description="Uang yang benar-benar masuk dan keluar dari rekening perusahaan, dengan asal-usulnya.">
    <template #actions>
      <FinanceRecordMenu />
    </template>

    <!-- Filters -->
    <section class="space-y-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4" aria-label="Filter">
      <FinancePeriodPicker v-model:from="from" v-model:to="to" v-model:preset="preset" />
      <div class="flex flex-wrap items-center gap-2">
        <div class="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Arah uang">
          <button
            v-for="d in ([['all', 'Semua'], ['in', 'Masuk'], ['out', 'Keluar']] as const)"
            :key="d[0]"
            type="button"
            :aria-pressed="direction === d[0]"
            :class="cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors', direction === d[0] ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')"
            @click="direction = d[0]"
          >
            {{ d[1] }}
          </button>
        </div>
        <div class="w-full sm:w-56">
          <FinanceSelect v-model="accountId" :options="accountFilterOptions" clear-label="Semua rekening" placeholder="Semua rekening" aria-label="Rekening" />
        </div>
        <div class="w-full sm:w-64">
          <FinanceSelect v-model="projectId" :options="lookups.projectOptions.value" clear-label="Semua project" placeholder="Semua project" aria-label="Project" />
        </div>
        <button
          v-if="kind"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
          :aria-label="`Hapus filter ${KIND_LABEL[kind]}`"
          @click="kind = null"
        >
          Hanya: {{ KIND_LABEL[kind] }} <span aria-hidden="true">×</span>
        </button>
        <label class="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Checkbox v-model="showTransfers" />
          Tampilkan transfer antar rekening
        </label>
      </div>
    </section>

    <FinanceErrorState v-if="statement.error.value && !statement.data.value" :error="statement.error.value" @retry="statement.refresh" />

    <template v-else-if="!statement.loaded.value">
      <div class="grid gap-4 sm:grid-cols-3">
        <div v-for="i in 3" :key="i" class="h-24 animate-pulse rounded-xl bg-muted" />
      </div>
      <div class="h-96 animate-pulse rounded-xl bg-muted" />
    </template>

    <template v-else>
      <!-- Totals -->
      <section v-if="summary" class="grid grid-cols-2 gap-3 sm:grid-cols-3" :class="statement.pending.value && 'opacity-70 transition-opacity'" aria-label="Ringkasan periode">
        <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowDownLeft class="h-3.5 w-3.5 text-success" /> Uang masuk
          </p>
          <FinanceAmount :value="summary.inMinor" class="mt-1 block text-lg font-semibold text-success sm:text-xl" />
        </div>
        <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowUpRight class="h-3.5 w-3.5 text-destructive" /> Uang keluar
          </p>
          <FinanceAmount :value="summary.outMinor" class="mt-1 block text-lg font-semibold sm:text-xl" />
        </div>
        <div class="col-span-2 rounded-xl border border-border bg-card p-4 shadow-sm sm:col-span-1">
          <p class="text-xs text-muted-foreground">
            Selisih periode
          </p>
          <FinanceAmount
            :value="summary.netMinor"
            :direction="summary.netMinor.startsWith('-') ? null : 'in'"
            class="mt-1 block text-xl font-semibold"
            :class="summary.netMinor.startsWith('-') && 'text-destructive'"
          />
        </div>
      </section>
      <p v-if="summary && period" class="-mt-2 text-xs text-muted-foreground">
        {{ formatBusinessDate(period.from) }} – {{ formatBusinessDate(period.to) }} · {{ summary.count }} transaksi.
        Transfer antar rekening tidak dihitung sebagai masuk/keluar<template v-if="summary.reversedCount">
          ; {{ summary.reversedCount }} transaksi batal & pembatalannya juga tidak dihitung
        </template>.
      </p>

      <Card class="overflow-clip">
        <EmptyState v-if="!items.length && filtered" :icon="SearchX" title="Tidak ada transaksi yang cocok" description="Coba ubah filter atau periode.">
          <Button variant="outline" size="sm" @click="resetFilters">
            Hapus filter
          </Button>
        </EmptyState>
        <EmptyState v-else-if="!items.length" :icon="Inbox" title="Belum ada uang masuk atau keluar di periode ini" description="Transaksi yang dicatat akan muncul di sini, lengkap dengan rekening dan asal-usulnya." />

        <div v-else>
          <div v-for="group in groups" :key="group.date">
            <h3 class="sticky top-14 z-[1] border-b border-border bg-muted/70 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur sm:px-5">
              {{ dayLabel(group.date) }}
            </h3>
            <ul class="divide-y divide-border">
              <li v-for="m in group.rows" :key="m.id">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-5"
                  @click="selected = m.id"
                >
                  <span
                    class="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                    :class="m.isInternalTransfer || m.reversalOfId ? 'bg-muted text-muted-foreground' : m.direction === 'in' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'"
                    aria-hidden="true"
                  >
                    <Undo2 v-if="m.reversalOfId" class="h-4 w-4" />
                    <ArrowLeftRight v-else-if="m.isInternalTransfer" class="h-4 w-4" />
                    <ArrowDownLeft v-else-if="m.direction === 'in'" class="h-4 w-4" />
                    <ArrowUpRight v-else class="h-4 w-4" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="flex items-center gap-2">
                      <span class="truncate text-sm font-medium" :class="(m.reversedById || m.reversalOfId) && 'text-muted-foreground'">{{ movementTitle(m) }}</span>
                      <StatusBadge v-if="m.reversedById" label="Dibatalkan" tone="neutral" class="max-sm:hidden" />
                      <StatusBadge v-else-if="m.reversalOfId" label="Pembatalan" tone="neutral" class="max-sm:hidden" />
                    </span>
                    <span class="block truncate text-xs text-muted-foreground">{{ movementSubtitle(m) }}</span>
                  </span>
                  <span class="hidden w-40 shrink-0 truncate text-right text-xs text-muted-foreground md:block">
                    {{ m.account.code }}<template v-if="m.reference">
                      <br><span class="tabular-nums">{{ m.reference }}</span>
                    </template>
                  </span>
                  <FinanceAmount
                    :value="m.amountMinor"
                    :currency="m.currency"
                    :direction="m.direction"
                    :muted="!!m.reversedById"
                    :subdued="!!m.reversalOfId || m.isInternalTransfer"
                    class="shrink-0 text-right text-sm font-semibold sm:w-36"
                  />
                  <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                </button>
              </li>
            </ul>
          </div>
          <div v-if="nextCursor" class="border-t border-border p-3 text-center">
            <Button variant="ghost" size="sm" :disabled="loadingMore" @click="loadMore">
              <Loader2 v-if="loadingMore" class="mr-2 h-4 w-4 animate-spin" /> Muat lebih banyak
            </Button>
          </div>
        </div>
      </Card>
    </template>

    <FinanceMovementSheet v-model:movement-id="selected" />
  </FinancePage>
</template>
