<script setup lang="ts">
import {
  AlertTriangle, ArrowDownLeft, ArrowRight, ArrowUpRight, CheckCircle2, ChevronDown, CircleHelp, Info, Landmark, ShieldAlert, TrendingDown
} from 'lucide-vue-next'
import type { CashFlowHorizon, CashFlowItem, CashFlowProjection, CashFlowRow } from '~/types/api'
import { contributorItems, EXCLUDED, HORIZON_OPTIONS, itemsOfPeriod, lowestRow, periodLabel } from '~/lib/finance/cashflow'
import { formatBusinessDate, formatBusinessDateLong, todayJakarta } from '~/lib/finance/dates'
import { formatMoneyMinor } from '~/lib/money'
import { cn } from '~/lib/utils'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Cash Flow — Finance' })

/**
 * Cash Flow: what the cash will look like 30 days to 12 months from now. Opening = verified cash today;
 * money in = customer invoices still outstanding; money out = approved vendor invoices still unpaid and
 * approved refunds not yet paid. Every figure comes from GET /finance/cash-flow; this page only presents it,
 * with the reasons (dates, labels, what is left out) next to the numbers.
 */
const api = useApi()
const route = useRoute()
const lookups = useFinanceLookups()
const today = todayJakarta()

const HORIZONS = HORIZON_OPTIONS.map(h => h.value)
const q = (key: string) => (typeof route.query[key] === 'string' ? route.query[key] as string : null)
const horizon = ref<CashFlowHorizon>(HORIZONS.includes(q('horizon') as CashFlowHorizon) ? q('horizon') as CashFlowHorizon : '3m')
const projectId = ref<string | null>(q('projectId'))
const accountId = ref<string | null>(projectId.value ? null : q('accountId'))
// One view at a time: a project's net flow or one account's cash, never both.
watch(projectId, (v) => { if (v) { accountId.value = null } })
watch(accountId, (v) => { if (v) { projectId.value = null } })
watch([horizon, projectId, accountId], () => navigateTo({
  query: { ...route.query, horizon: horizon.value === '3m' ? undefined : horizon.value, projectId: projectId.value ?? undefined, accountId: accountId.value ?? undefined }
}, { replace: true }))

/** Optional minimum cash for the "low cash" warning; remembered in this browser only. */
const FLOOR_KEY = 'manova-cashflow-floor'
const floorInput = ref('')
const floor = ref('')
onMounted(() => {
  try {
    const stored = (localStorage.getItem(FLOOR_KEY) ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 16)
    floorInput.value = stored
    floor.value = stored
  } catch {}
})
let floorTimer: ReturnType<typeof setTimeout> | undefined
watch(floorInput, (v) => {
  clearTimeout(floorTimer)
  floorTimer = setTimeout(() => {
    floor.value = v
    try { if (v) { localStorage.setItem(FLOOR_KEY, v) } else { localStorage.removeItem(FLOOR_KEY) } } catch {}
  }, 600)
})

const cf = useFinanceQuery(async () => (await api.finance.cashFlow({
  horizon: horizon.value,
  projectId: projectId.value ?? undefined,
  accountId: accountId.value ?? undefined,
  minimumCashMinor: floor.value && floor.value !== '0' ? floor.value : undefined
})).data, { watch: [horizon, projectId, accountId, floor] })

const flow = computed<CashFlowProjection | null>(() => (cf.data.value?.available ? cf.data.value : null))
const unavailable = computed(() => (cf.data.value && !cf.data.value.available ? cf.data.value : null))
const scopeType = computed(() => flow.value?.scope.type ?? (projectId.value ? 'project' : accountId.value ? 'account' : 'company'))
const isProject = computed(() => scopeType.value === 'project')
const balanceLabel = computed(() => (isProject.value ? 'Arus bersih kumulatif' : 'Perkiraan saldo'))

const accountOptions = computed(() => (lookups.accounts.data.value ?? []).filter(a => a.isActive).map(a => ({
  value: a.id,
  label: `${a.bankName} · ${a.code}`,
  hint: a.opening.status === 'verified' ? undefined : 'belum terverifikasi'
})))

// ── Headline ─────────────────────────────────────────────────────────────────────────────────────────────
const gap = computed(() => flow.value?.warnings.find(w => w.code === 'CASH_GAP') ?? null)
const lowCash = computed(() => flow.value?.warnings.find(w => w.code === 'LOW_CASH') ?? null)
const overdueIn = computed(() => flow.value?.warnings.find(w => w.code === 'OVERDUE_INCOMING') ?? null)
const disputedIn = computed(() => flow.value?.warnings.find(w => w.code === 'DISPUTED_INCOMING') ?? null)
const advancesNetted = computed(() => flow.value?.warnings.find(w => w.code === 'ADVANCES_NETTED') ?? null)
const overdueText = computed(() => {
  const w = overdueIn.value
  if (!w || w.code !== 'OVERDUE_INCOMING') { return '' }
  const where = w.inFirstPeriodCount === w.count ? 'di periode pertama' : w.inFirstPeriodCount ? `${w.inFirstPeriodCount} di periode pertama` : 'sesuai tanggal perkiraan barunya'
  return `${w.count} tagihan terlambat (${formatMoneyMinor(w.amountMinor)}) tetap dihitung, ${where}`
})
/** Shown when a refetch failed: the figures on screen still belong to the previous choice. */
const staleNote = computed(() => {
  const f = flow.value
  if (!f) { return '' }
  const label = HORIZON_OPTIONS.find(h => h.value === f.horizon)?.label ?? f.horizon
  return `Angka di bawah masih dari pilihan sebelumnya (${label}${f.scope.name ? `, ${f.scope.name}` : ''}).`
})
const lowest = computed(() => (flow.value ? lowestRow(flow.value.rows) : null))
const change = computed(() => (flow.value ? (BigInt(flow.value.closingMinor) - BigInt(flow.value.openingCashMinor)).toString() : null))
const horizonLong = computed(() => HORIZON_OPTIONS.find(h => h.value === horizon.value)!.long)

// ── Table & drill-down ───────────────────────────────────────────────────────────────────────────────────
const selected = ref<number | null>(null)
watch(() => cf.data.value, () => { selected.value = null })
function toggle (i: number) { selected.value = selected.value === i ? null : i }
function selectFromChart (i: number) {
  selected.value = i
  nextTick(() => {
    const el = [document.getElementById(`cf-period-${i}`), document.getElementById(`cf-period-m-${i}`)].find(e => e && e.offsetParent !== null)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}
function rowFlag (r: CashFlowRow): { label: string; tone: string } | null {
  if (isProject.value) { return null }
  if (BigInt(r.lowestMinor) < 0n) { return { label: 'Minus', tone: 'bg-destructive/10 text-destructive' } }
  if (lowCash.value && BigInt(r.lowestMinor) < BigInt(lowCash.value.floorMinor)) { return { label: 'Di bawah minimum', tone: 'bg-warning/15 text-warning' } }
  return null
}

// Sheets for the source records.
const invoiceId = ref<string | null>(null)
const vendorInvoiceId = ref<string | null>(null)
const refundId = ref<string | null>(null)
function openItem (item: CashFlowItem) {
  if (item.source === 'customer_invoice') { invoiceId.value = item.id } else if (item.source === 'vendor_invoice') { vendorInvoiceId.value = item.id } else { refundId.value = item.id }
}
function resetView () { projectId.value = null; accountId.value = null }
</script>

<template>
  <FinancePage
    title="Cash Flow"
    description="Perkiraan saldo kas ke depan: saldo hari ini, ditambah tagihan customer yang belum dibayar, dikurangi utang vendor dan refund yang belum dibayar."
    capability="finance.view-cash-flow"
  >
    <!-- Controls -->
    <div class="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <div class="-mx-1 overflow-x-auto px-1">
        <div class="inline-flex min-w-max rounded-lg border border-border bg-card p-0.5 shadow-sm" role="group" aria-label="Rentang perkiraan">
          <button
            v-for="h in HORIZON_OPTIONS"
            :key="h.value"
            type="button"
            :aria-pressed="horizon === h.value"
            :class="cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', horizon === h.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')"
            @click="horizon = h.value"
          >
            {{ h.label }}
          </button>
        </div>
      </div>
      <div class="grid gap-2 sm:grid-cols-3 xl:w-[46rem]">
        <FinanceSelect v-model="accountId" :options="accountOptions" clear-label="Semua rekening" placeholder="Semua rekening" aria-label="Rekening" />
        <FinanceSelect v-model="projectId" :options="lookups.projectOptions.value" clear-label="Semua project" placeholder="Semua project" aria-label="Project" />
        <div class="relative" :title="isProject ? 'Tidak berlaku untuk arus bersih project' : 'Beri peringatan bila saldo diperkirakan turun di bawah angka ini'">
          <label for="cf-floor" class="pointer-events-none absolute -top-2 left-2 z-10 bg-background px-1 text-[10px] font-medium text-muted-foreground">Peringatan saldo minimum (opsional)</label>
          <FinanceMoneyInput id="cf-floor" v-model="floorInput" :disabled="isProject" />
        </div>
      </div>
    </div>

    <FinanceErrorState v-if="cf.error.value && !cf.data.value" :error="cf.error.value" @retry="cf.refresh" />

    <div v-else-if="!cf.loaded.value" class="space-y-4" role="status" aria-label="Memuat perkiraan">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div v-for="i in 4" :key="i" class="h-24 animate-pulse rounded-xl bg-muted" />
      </div>
      <div class="h-80 animate-pulse rounded-2xl bg-muted" />
    </div>

    <!-- Not available: never a fake zero -->
    <Card v-else-if="unavailable" class="p-6 sm:p-8">
      <div class="mx-auto max-w-xl text-center">
        <span class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-warning/15 text-warning">
          <ShieldAlert class="h-6 w-6" />
        </span>
        <h2 class="mt-4 text-lg font-semibold">
          Perkiraan belum tersedia
        </h2>
        <p v-if="unavailable.reason === 'NO_ACCOUNTS'" class="mt-2 text-sm text-muted-foreground">
          Belum ada rekening. Perkiraan dimulai dari saldo rekening yang sudah terverifikasi.
        </p>
        <p v-else class="mt-2 text-sm text-muted-foreground">
          Perkiraan dimulai dari saldo hari ini, dan saldo ini belum lengkap karena saldo awal rekening berikut belum diverifikasi:
        </p>
        <ul v-if="unavailable.missingAccounts.length" class="mt-4 flex flex-wrap justify-center gap-2">
          <li v-for="a in unavailable.missingAccounts" :key="a.id">
            <NuxtLink :to="`/finance/accounts/${a.id}`" class="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted/50">
              <Landmark class="h-4 w-4 text-muted-foreground" /> {{ a.code }}
            </NuxtLink>
          </li>
        </ul>
        <Button as-child class="mt-5">
          <NuxtLink to="/finance/accounts">
            {{ unavailable.reason === 'NO_ACCOUNTS' ? 'Tambah rekening' : 'Buka Rekening & Saldo' }}
          </NuxtLink>
        </Button>
        <p v-if="unavailable.scope.type === 'company'" class="mt-4 text-xs text-muted-foreground">
          Sementara itu, arus bersih per project tetap bisa dilihat lewat filter project.
        </p>
      </div>
    </Card>

    <template v-else-if="flow">
      <FinanceErrorState v-if="cf.error.value" :error="cf.error.value" compact @retry="cf.refresh" />
      <p v-if="cf.error.value" class="-mt-2 text-xs text-muted-foreground">
        {{ staleNote }}
      </p>
      <div :class="(cf.pending.value || cf.error.value) && 'opacity-70 transition-opacity'" class="space-y-4">
        <!-- Scope notes -->
        <div v-if="flow.scope.type === 'project'" class="flex gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <Info class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            <span class="font-medium">Arus bersih project {{ flow.scope.name }}</span>, dimulai dari nol. Ini bukan saldo rekening — uang project ada di rekening perusahaan.
            Pengeluaran yang tidak dikaitkan ke project tidak ikut.
            <button type="button" class="font-medium text-primary hover:underline" @click="resetView">
              Lihat seluruh perusahaan
            </button>
          </p>
        </div>
        <div v-else-if="flow.scope.type === 'account' && flow.unassigned" class="flex gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <Info class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Saldo <span class="font-medium">{{ flow.scope.name }}</span> saja. Tagihan dan utang belum ditetapkan akan masuk/keluar lewat rekening mana, jadi tidak dihitung di sini
            <template v-if="flow.unassigned.count">
              ({{ flow.unassigned.count }} kewajiban: masuk {{ formatMoneyMinor(flow.unassigned.incomingMinor) }}, keluar {{ formatMoneyMinor(flow.unassigned.outgoingMinor) }})
            </template>.
            <button type="button" class="font-medium text-primary hover:underline" @click="resetView">
              Lihat seluruh perusahaan
            </button>
          </p>
        </div>

        <!-- Headline figures -->
        <section class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Ringkasan perkiraan">
          <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p class="text-xs text-muted-foreground">
              {{ isProject ? 'Titik awal' : 'Saldo hari ini' }}
            </p>
            <FinanceAmount :value="flow.openingCashMinor" class="mt-1 block whitespace-nowrap text-base font-semibold sm:text-xl" />
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ isProject ? 'arus bersih mulai dari nol' : `terverifikasi, per ${formatBusinessDate(flow.asOf, { short: true, today })}` }}
            </p>
          </div>
          <div class="rounded-xl border bg-card p-4 shadow-sm" :class="flow.closingMinor.startsWith('-') ? 'border-destructive/40' : 'border-border'">
            <p class="text-xs text-muted-foreground">
              {{ isProject ? 'Arus bersih' : 'Perkiraan saldo' }} {{ formatBusinessDate(flow.periodEnd, { short: true, today }) }}
            </p>
            <FinanceAmount :value="flow.closingMinor" class="mt-1 block whitespace-nowrap text-base font-semibold sm:text-xl" :class="flow.closingMinor.startsWith('-') && 'text-destructive'" />
            <p v-if="change && !isProject" class="mt-0.5 text-xs text-muted-foreground">
              <span :class="change.startsWith('-') ? 'text-destructive' : 'text-success'">{{ change.startsWith('-') ? '−' : '+' }}{{ formatMoneyMinor(change.replace('-', '')) }}</span> dari hari ini
            </p>
          </div>
          <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowDownLeft class="h-3.5 w-3.5 text-success" /> Uang masuk diperkirakan
            </p>
            <FinanceAmount :value="flow.totals.incomingMinor" class="mt-1 block whitespace-nowrap text-base font-semibold text-success sm:text-xl" />
            <p class="mt-0.5 text-xs text-muted-foreground">
              <template v-if="flow.totals.overdueIncomingMinor !== '0'">
                <span class="text-destructive">{{ formatMoneyMinor(flow.totals.overdueIncomingMinor) }} terlambat</span> ·
              </template>
              tagihan customer
            </p>
          </div>
          <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowUpRight class="h-3.5 w-3.5 text-destructive" /> Uang keluar diperkirakan
            </p>
            <FinanceAmount :value="flow.totals.outgoingMinor" class="mt-1 block whitespace-nowrap text-base font-semibold sm:text-xl" />
            <p class="mt-0.5 text-xs text-muted-foreground">
              utang vendor<template v-if="flow.totals.refundOutgoingMinor !== '0'">
                + refund {{ formatMoneyMinor(flow.totals.refundOutgoingMinor) }}
              </template>
            </p>
          </div>
        </section>

        <!-- Gap / low cash / all good -->
        <section v-if="gap || lowCash" class="rounded-xl border px-4 py-4 sm:px-5" :class="gap ? 'border-destructive/30 bg-destructive/5' : 'border-warning/40 bg-warning/10'" role="alert">
          <div class="flex gap-3">
            <TrendingDown class="mt-0.5 h-5 w-5 shrink-0" :class="gap ? 'text-destructive' : 'text-warning'" />
            <div class="min-w-0 flex-1">
              <p v-if="gap" class="text-sm font-semibold text-destructive">
                Saldo diperkirakan minus mulai {{ formatBusinessDateLong(gap.date) }}: {{ formatMoneyMinor(gap.balanceMinor) }}
              </p>
              <p v-else-if="lowCash" class="text-sm font-semibold">
                Saldo diperkirakan di bawah minimum {{ formatMoneyMinor(lowCash.floorMinor) }} mulai {{ formatBusinessDateLong(lowCash.date) }}: {{ formatMoneyMinor(lowCash.balanceMinor) }}
              </p>
              <p v-if="gap" class="mt-0.5 text-xs text-muted-foreground">
                Titik terendah {{ formatMoneyMinor(gap.lowestMinor) }} pada {{ formatBusinessDate(gap.lowestDate, { short: true, today }) }}.
                <template v-if="lowCash">
                  Di bawah minimum {{ formatMoneyMinor(lowCash.floorMinor) }} sejak {{ formatBusinessDate(lowCash.date, { short: true, today }) }}.
                </template>
                Ini peringatan saja — tidak ada pembayaran atau booking yang dibatalkan otomatis.
              </p>
              <p class="mt-3 text-xs font-medium text-muted-foreground">
                Pengeluaran terbesar sebelum tanggal itu
              </p>
              <FinanceCashFlowItems class="mt-1.5" :items="contributorItems(flow, (gap ?? lowCash)!.contributors)" :today="today" @open="openItem" />
            </div>
          </div>
        </section>
        <p v-else-if="!isProject && lowest" class="flex items-center gap-2 rounded-lg bg-success/10 px-4 py-2.5 text-sm">
          <CheckCircle2 class="h-4 w-4 shrink-0 text-success" />
          Saldo tetap positif {{ horizonLong }}. Titik terendah {{ formatMoneyMinor(lowest.lowestMinor) }} pada {{ formatBusinessDate(lowest.lowestDate, { short: true, today }) }}.
        </p>

        <div v-if="overdueIn || disputedIn || advancesNetted" class="flex flex-wrap gap-2 text-xs">
          <NuxtLink v-if="overdueIn" to="/finance/receivables?tab=overdue" class="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 font-medium text-destructive hover:underline">
            <AlertTriangle class="h-3.5 w-3.5" /> {{ overdueText }}
          </NuxtLink>
          <span v-if="advancesNetted" class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
            <Info class="h-3.5 w-3.5" /> Uang muka {{ formatMoneyMinor(advancesNetted.amountMinor) }} sudah di saldo, jadi mengurangi {{ advancesNetted.count }} tagihan customer yang sama
          </span>
          <span v-if="disputedIn" class="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 font-medium text-warning">
            <AlertTriangle class="h-3.5 w-3.5" /> {{ disputedIn.count }} tagihan sengketa ({{ formatMoneyMinor(disputedIn.amountMinor) }}) tetap dihitung
          </span>
        </div>

        <!-- Chart + table, side by side in one card so the numbers can be checked -->
        <Card class="overflow-clip">
          <div class="border-b border-border px-5 py-4">
            <h2 class="text-[15px] font-semibold">
              Per periode
            </h2>
            <p class="text-xs text-muted-foreground">
              {{ formatBusinessDate(flow.periodStart, { today }) }} – {{ formatBusinessDate(flow.periodEnd, { today }) }} · klik periode untuk melihat rinciannya
            </p>
          </div>
          <div class="px-3 pb-2 pt-4 sm:px-5">
            <FinanceCashFlowChart :rows="flow.rows" :today="today" :selected="selected" :balance-label="balanceLabel" @select="selectFromChart" />
          </div>
          <!-- Phones: one line per period; tap for the detail -->
          <ul class="divide-y divide-border border-t border-border sm:hidden">
            <li v-for="(r, i) in flow.rows" :id="`cf-period-m-${i}`" :key="r.startDate">
              <button
                type="button"
                class="flex w-full items-center gap-3 px-4 py-3 text-left"
                :class="selected === i && 'bg-primary/5'"
                :aria-expanded="selected === i"
                :aria-controls="`cf-detail-m-${i}`"
                @click="toggle(i)"
              >
                <span class="min-w-0 flex-1">
                  <span class="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {{ periodLabel(r, today) }}
                    <span v-if="rowFlag(r)" class="rounded-full px-1.5 py-0.5 text-[11px] font-medium" :class="rowFlag(r)!.tone">{{ rowFlag(r)!.label }}</span>
                  </span>
                  <span class="block text-xs text-muted-foreground">
                    <span :class="r.incomingMinor !== '0' && 'text-success'">+{{ formatMoneyMinor(r.incomingMinor) }}</span> · −{{ formatMoneyMinor(r.outgoingMinor) }}
                  </span>
                </span>
                <span class="text-right">
                  <span class="block text-[11px] text-muted-foreground">{{ isProject ? 'Akhir' : 'Saldo akhir' }}</span>
                  <span class="block whitespace-nowrap text-sm font-semibold tabular-nums" :class="r.closingMinor.startsWith('-') && 'text-destructive'">{{ formatMoneyMinor(r.closingMinor) }}</span>
                </span>
                <ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground transition-transform" :class="selected === i && 'rotate-180'" />
              </button>
              <div v-if="selected === i" :id="`cf-detail-m-${i}`" class="bg-muted/20 px-3 pb-3 pt-1">
                <p v-if="!itemsOfPeriod(flow, i).length" class="px-1 py-2 text-sm text-muted-foreground">
                  Tidak ada tagihan atau utang yang jatuh di periode ini.
                </p>
                <FinanceCashFlowItems v-else :items="itemsOfPeriod(flow, i)" :today="today" @open="openItem" />
              </div>
            </li>
            <li class="flex items-center justify-between gap-3 bg-muted/30 px-4 py-3 text-sm font-semibold">
              <span>{{ isProject ? 'Arus bersih' : 'Saldo akhir' }} {{ formatBusinessDate(flow.periodEnd, { short: true, today }) }}</span>
              <span class="whitespace-nowrap tabular-nums" :class="flow.closingMinor.startsWith('-') && 'text-destructive'">{{ formatMoneyMinor(flow.closingMinor) }}</span>
            </li>
          </ul>
          <div class="hidden overflow-x-auto border-t border-border sm:block">
            <table class="w-full min-w-[40rem] whitespace-nowrap text-sm">
              <thead class="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" class="px-5 py-2.5 text-left font-medium">
                    Periode
                  </th>
                  <th scope="col" class="px-3 py-2.5 text-right font-medium">
                    {{ isProject ? 'Awal' : 'Saldo awal' }}
                  </th>
                  <th scope="col" class="px-3 py-2.5 text-right font-medium">
                    Masuk
                  </th>
                  <th scope="col" class="px-3 py-2.5 text-right font-medium">
                    Keluar
                  </th>
                  <th scope="col" class="px-3 py-2.5 text-right font-medium">
                    {{ isProject ? 'Akhir' : 'Saldo akhir' }}
                  </th>
                  <th scope="col" class="w-10 px-3 py-2.5">
                    <span class="sr-only">Rincian</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(r, i) in flow.rows" :key="r.startDate">
                  <tr
                    :id="`cf-period-${i}`"
                    class="cursor-pointer border-t border-border transition-colors hover:bg-muted/40"
                    :class="selected === i && 'bg-primary/5'"
                    @click="toggle(i)"
                  >
                    <td class="px-5 py-3">
                      <button type="button" class="font-medium focus-visible:underline focus-visible:outline-none" :aria-expanded="selected === i" :aria-controls="`cf-detail-${i}`" @click.stop="toggle(i)">
                        {{ periodLabel(r, today) }}
                      </button>
                      <span v-if="rowFlag(r)" class="ml-2 rounded-full px-1.5 py-0.5 text-[11px] font-medium" :class="rowFlag(r)!.tone">{{ rowFlag(r)!.label }}</span>
                    </td>
                    <td class="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {{ formatMoneyMinor(r.openingMinor) }}
                    </td>
                    <td class="px-3 py-3 text-right tabular-nums" :class="r.incomingMinor !== '0' ? 'text-success' : 'text-muted-foreground'">
                      {{ r.incomingMinor === '0' ? '—' : `+${formatMoneyMinor(r.incomingMinor)}` }}
                    </td>
                    <td class="px-3 py-3 text-right tabular-nums" :class="r.outgoingMinor === '0' && 'text-muted-foreground'">
                      {{ r.outgoingMinor === '0' ? '—' : `−${formatMoneyMinor(r.outgoingMinor)}` }}
                    </td>
                    <td class="px-3 py-3 text-right font-semibold tabular-nums" :class="r.closingMinor.startsWith('-') && 'text-destructive'">
                      {{ formatMoneyMinor(r.closingMinor) }}
                    </td>
                    <td class="px-3 py-3 text-muted-foreground">
                      <ChevronDown class="h-4 w-4 transition-transform" :class="selected === i && 'rotate-180'" />
                    </td>
                  </tr>
                  <tr v-if="selected === i" :id="`cf-detail-${i}`" class="bg-muted/20">
                    <td colspan="6" class="px-3 pb-3 pt-1 sm:px-5">
                      <p v-if="!itemsOfPeriod(flow, i).length" class="px-2 py-3 text-sm text-muted-foreground">
                        Tidak ada tagihan atau utang yang jatuh di periode ini.
                      </p>
                      <FinanceCashFlowItems v-else class="whitespace-normal" :items="itemsOfPeriod(flow, i)" :today="today" @open="openItem" />
                    </td>
                  </tr>
                </template>
              </tbody>
              <tfoot class="border-t-2 border-border bg-muted/30 font-semibold">
                <tr>
                  <td class="px-5 py-3">
                    Total {{ HORIZON_OPTIONS.find(h => h.value === flow!.horizon)?.label }}
                  </td>
                  <td class="px-3 py-3 text-right tabular-nums">
                    {{ formatMoneyMinor(flow.openingCashMinor) }}
                  </td>
                  <td class="px-3 py-3 text-right tabular-nums text-success">
                    +{{ formatMoneyMinor(flow.totals.incomingMinor) }}
                  </td>
                  <td class="px-3 py-3 text-right tabular-nums">
                    −{{ formatMoneyMinor(flow.totals.outgoingMinor) }}
                  </td>
                  <td class="px-3 py-3 text-right tabular-nums" :class="flow.closingMinor.startsWith('-') && 'text-destructive'">
                    {{ formatMoneyMinor(flow.closingMinor) }}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <!-- Account view: obligations without an account, listed for reference -->
        <SectionCard v-if="flow.scope.type === 'account' && flow.items.length" title="Tagihan & utang tanpa rekening" description="Belum ditetapkan rekeningnya, jadi tidak dihitung pada saldo rekening ini." flush>
          <div class="border-t border-border p-3 sm:px-5">
            <FinanceCashFlowItems :items="flow.items" :today="today" @open="openItem" />
          </div>
        </SectionCard>

        <!-- What is deliberately left out -->
        <SectionCard v-if="flow.excluded.length" title="Tidak dihitung dalam perkiraan" :description="flow.scope.type === 'account' ? 'Angka untuk seluruh perusahaan. Uang yang nyata atau direncanakan, tapi sengaja tidak dimasukkan.' : 'Uang yang nyata atau direncanakan, tapi sengaja tidak dimasukkan — supaya perkiraan tidak terlalu optimis.'" flush>
          <ul class="divide-y divide-border border-t border-border">
            <li v-for="e in flow.excluded" :key="e.code">
              <NuxtLink :to="EXCLUDED[e.code].to" class="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-medium">{{ EXCLUDED[e.code].title }} <span class="font-normal text-muted-foreground">· {{ e.count }}</span></span>
                  <span class="block text-xs text-muted-foreground">{{ EXCLUDED[e.code].detail }}<template v-if="e.undeterminedCount"> {{ e.undeterminedCount }} kasus nominalnya belum ditentukan Finance.</template></span>
                </span>
                <FinanceAmount :value="e.amountMinor" class="shrink-0 text-sm font-semibold text-muted-foreground" />
                <ArrowRight class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </NuxtLink>
            </li>
          </ul>
        </SectionCard>

        <!-- How it is calculated -->
        <details class="group rounded-xl border border-border bg-card px-5 py-4 text-sm">
          <summary class="flex cursor-pointer list-none items-center gap-2 font-medium">
            <CircleHelp class="h-4 w-4 text-muted-foreground" /> Cara menghitung
            <ChevronDown class="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <ul class="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>Saldo akhir periode = saldo awal + uang masuk − uang keluar. Saldo awal periode berikutnya = saldo akhir periode sebelumnya.</li>
            <li>Uang masuk: sisa tagihan customer yang sudah terbit. Uang keluar: sisa invoice vendor yang sudah disetujui, dan refund yang disetujui tapi belum dibayar.</li>
            <li>Tanggal: memakai tanggal perkiraan bayar bila dicatat, selain itu jatuh tempo. Yang sudah lewat dihitung di periode pertama dan diberi label.</li>
            <li>Pembayaran yang sudah dicatat sudah masuk ke saldo hari ini dan mengurangi sisa tagihannya, jadi tidak dihitung dua kali. Uang muka customer yang belum dialokasikan juga mengurangi tagihan customer yang sama (mulai dari yang paling awal).</li>
            <li>Deposit ke vendor tidak dikurangkan dari utang vendor, supaya perkiraan tetap hati-hati.</li>
            <li>Transfer antar rekening tidak mengubah saldo perusahaan; hanya biaya transfernya yang mengurangi.</li>
            <li>Nilai tidak dikalikan peluang. Label "Sesuai jatuh tempo", "Tanggal perkiraan", dan "Terlambat" hanya menjelaskan asal tanggalnya.</li>
            <li>30 hari dibagi per minggu mulai besok. 3/6/12 bulan = sisa bulan ini lalu bulan kalender penuh. Semua tanggal memakai waktu Jakarta.</li>
          </ul>
        </details>
      </div>
    </template>

    <FinanceInvoiceSheet v-model:invoice-id="invoiceId" />
    <FinanceVendorInvoiceSheet v-model:invoice-id="vendorInvoiceId" />
    <FinanceRefundSheet v-model:refund-id="refundId" />
  </FinancePage>
</template>
