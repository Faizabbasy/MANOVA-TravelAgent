<script setup lang="ts">
import {
  AlarmClock, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, CalendarRange, CheckCircle2, ClipboardCheck,
  FileClock, Landmark, PiggyBank, ShieldAlert, Undo2, Wallet
} from 'lucide-vue-next'
import type { Component } from 'vue'
import type { MovementDto } from '~/types/api'
import { formatBusinessDate, formatBusinessDateLong, shiftDate, startOfMonth, todayJakarta } from '~/lib/finance/dates'
import { movementSubtitle, movementTitle } from '~/lib/finance/labels'
import { buildBalanceTrend } from '~/lib/finance/trend'
import { formatMoneyMinor } from '~/lib/money'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Finance' })

/**
 * Finance dashboard: how much cash there is today and what needs attention — in that order. One big number,
 * a few supporting figures, then a prioritised list of things to do with the reason and a link to act.
 * Every figure comes from the API (no mock history).
 */
const api = useApi()
const session = useServerSession()
const today = todayJakarta()
const monthStart = startOfMonth(today)
const trendFrom = shiftDate(today, -29)

const cash = useFinanceQuery(async () => {
  const [position, accounts] = await Promise.all([api.finance.cashPosition(), api.finance.listAccounts()])
  return { position: position.data, accounts: accounts.data }
})

/** Daily balance for the last 30 days, from each verified account's ledger. */
const trend = useFinanceQuery(async () => {
  const accounts = (await api.finance.listAccounts()).data.filter(a => a.opening.status === 'verified' && (a.isActive || a.balance.currentMinor !== '0'))
  const ledgers = await Promise.all(accounts.map(a => api.finance.accountLedger(a.id, { from: trendFrom, to: today })))
  const usable = ledgers.map(l => l.data).flatMap(l => (l.available ? [l] : []))
  const series = buildBalanceTrend(usable, trendFrom, today)
  return { dates: series.dates, totals: series.totals.map(t => t.toString()) }
})

const flows = useFinanceQuery(async () => {
  const [month, recent] = await Promise.all([
    api.finance.statement({ from: monthStart, to: today, includeTransfers: false, limit: 1 }),
    api.finance.statement({ from: shiftDate(today, -60), to: today, limit: 8 })
  ])
  return { month: month.meta.summary, recent: recent.data }
})

const obligations = useFinanceQuery(async () => {
  const [arOpen, arOverdue, arDue30, arDue7, apAll, apOverdue, apDue30, drafts, plans, advances, refunds] = await Promise.all([
    api.finance.receivables({ settlement: 'outstanding', limit: 1 }),
    api.finance.receivables({ settlement: 'overdue', limit: 3 }),
    api.finance.receivables({ settlement: 'outstanding', dueTo: shiftDate(today, 30), limit: 1 }),
    api.finance.receivables({ settlement: 'outstanding', dueTo: shiftDate(today, 7), limit: 1 }),
    api.finance.payables({ view: 'all', limit: 1 }),
    api.finance.payables({ view: 'overdue', limit: 3 }),
    api.finance.payables({ view: 'outstanding', dueTo: shiftDate(today, 30), limit: 1 }),
    api.finance.listCustomerInvoices({ status: 'draft', limit: 100 }),
    api.finance.listBillingSchedule({ status: 'planned' }),
    api.finance.advances({ type: 'customer' }),
    api.finance.refunds({ view: 'open', limit: 1 })
  ])
  return {
    ar: arOpen.meta.summary,
    arOverdue: { summary: arOverdue.meta.summary, items: arOverdue.data },
    arDue30: arDue30.meta.summary.outstandingMinor,
    arDue7Count: arDue7.meta.summary.count - arOverdue.meta.summary.count,
    ap: apAll.meta.summary,
    apOverdue: { summary: apOverdue.meta.summary, items: apOverdue.data },
    apDue30: apDue30.meta.summary.outstandingMinor,
    draftCount: drafts.data.length,
    draftCapped: drafts.data.length >= 100,
    latePlans: plans.data.filter(p => p.plannedDate <= today),
    advanceTotal: advances.data.reduce((s, a) => s + BigInt(a.unallocatedMinor), 0n).toString(),
    advanceCount: advances.data.length,
    refunds: refunds.meta.summary
  }
})

// ── Hero ─────────────────────────────────────────────────────────────────────────────────────────────────
const position = computed(() => cash.data.value?.position ?? null)
const pendingAccounts = computed(() => (cash.data.value?.accounts ?? []).filter(a => a.isActive && a.opening.status !== 'verified'))
const trendDelta = computed(() => {
  const t = trend.data.value
  if (!t || t.totals.length < 2) { return null }
  return (BigInt(t.totals[t.totals.length - 1]!) - BigInt(t.totals[0]!)).toString()
})

// ── Attention list (most urgent first) ───────────────────────────────────────────────────────────────────
interface Attention { key: string; icon: Component; tone: 'destructive' | 'warning' | 'info'; title: string; detail: string; to: string; cta: string }
const attention = computed<Attention[]>(() => {
  const out: Attention[] = []
  const o = obligations.data.value
  if (pendingAccounts.value.length) {
    const canVerify = session.can('finance.approve-opening-balance')
    out.push({
      key: 'opening',
      icon: ShieldAlert,
      tone: 'warning',
      title: `${pendingAccounts.value.length} rekening belum terverifikasi`,
      detail: `${pendingAccounts.value.map(a => a.code).join(', ')} — saldonya belum ikut total kas ${canVerify ? 'sampai Anda memverifikasi saldo awalnya' : 'sampai Super Admin memverifikasi saldo awalnya'}.`,
      to: '/finance/accounts',
      cta: canVerify ? 'Verifikasi' : 'Lihat rekening'
    })
  }
  if (!o) { return out }
  if (o.arOverdue.summary.count) {
    const names = [...new Set(o.arOverdue.items.map(i => i.party.name))].slice(0, 2).join(', ')
    out.push({
      key: 'ar-overdue',
      icon: AlarmClock,
      tone: 'destructive',
      title: `${o.arOverdue.summary.count} tagihan customer terlambat · ${formatMoneyMinor(o.arOverdue.summary.overdueMinor)}`,
      detail: `Paling lama: ${names}${o.arOverdue.summary.count > 2 ? ', dan lainnya' : ''}. Hubungi customer atau catat janji bayarnya.`,
      to: '/finance/receivables?tab=overdue',
      cta: 'Tagih'
    })
  }
  if (o.refunds.toPayCount) {
    out.push({
      key: 'refund-pay',
      icon: Wallet,
      tone: 'warning',
      title: `${o.refunds.toPayCount} refund disetujui belum dibayar · ${formatMoneyMinor(o.refunds.toPayMinor)}`,
      detail: 'Customer menunggu uangnya kembali. Refund baru mengurangi saldo saat dibayar.',
      to: '/finance/refunds?tab=to_pay',
      cta: 'Bayar refund'
    })
  }
  if (o.refunds.requestedCount) {
    out.push({
      key: 'refund-decide',
      icon: Undo2,
      tone: 'info',
      title: `${o.refunds.requestedCount} pembatalan menunggu keputusan refund`,
      detail: 'Periksa perhitungan kebijakan, lalu setujui atau tolak.',
      to: '/finance/refunds',
      cta: 'Putuskan'
    })
  }
  if (o.apOverdue.summary.count) {
    const names = [...new Set(o.apOverdue.items.map(i => i.vendor.name))].slice(0, 2).join(', ')
    out.push({
      key: 'ap-overdue',
      icon: AlarmClock,
      tone: 'destructive',
      title: `${o.apOverdue.summary.count} invoice vendor lewat jatuh tempo · ${formatMoneyMinor(o.apOverdue.summary.overdueMinor)}`,
      detail: `${names}. Bayar atau catat rencana bayarnya agar hubungan dengan vendor tetap baik.`,
      to: '/finance/payables?tab=overdue',
      cta: 'Bayar'
    })
  }
  if (o.ap.pendingReviewCount) {
    out.push({
      key: 'ap-review',
      icon: ClipboardCheck,
      tone: 'info',
      title: `${o.ap.pendingReviewCount} invoice vendor menunggu review · ${formatMoneyMinor(o.ap.pendingReviewMinor)}`,
      detail: 'Belum dihitung sebagai utang dan belum bisa dibayar sampai disetujui.',
      to: '/finance/payables?tab=review',
      cta: 'Review'
    })
  }
  if (o.latePlans.length) {
    out.push({
      key: 'plans',
      icon: FileClock,
      tone: 'warning',
      title: `${o.latePlans.length} rencana tagihan sudah waktunya ditagih`,
      detail: `${o.latePlans.slice(0, 2).map(p => `${p.label} ${p.project.name}`).join(', ')}. Buat invoice-nya agar tidak terlupa.`,
      to: '/finance/receivables?tab=plan',
      cta: 'Buat invoice'
    })
  }
  if (o.arDue7Count > 0) {
    out.push({
      key: 'ar-soon',
      icon: CalendarRange,
      tone: 'info',
      title: `${o.arDue7Count} tagihan customer jatuh tempo 7 hari lagi`,
      detail: 'Kirim pengingat sebelum jatuh tempo.',
      to: '/finance/receivables',
      cta: 'Lihat'
    })
  }
  if (o.draftCount) {
    out.push({
      key: 'drafts',
      icon: FileClock,
      tone: 'info',
      title: `${o.draftCapped ? '100+' : o.draftCount} draft invoice belum diterbitkan`,
      detail: 'Draft belum dihitung sebagai tagihan.',
      to: '/finance/receivables?tab=draft',
      cta: 'Periksa'
    })
  }
  if (o.advanceCount) {
    out.push({
      key: 'advance',
      icon: PiggyBank,
      tone: 'info',
      title: `Uang muka customer ${formatMoneyMinor(o.advanceTotal)} belum dipakai`,
      detail: 'Alokasikan ke invoice saat invoice-nya terbit.',
      to: '/finance/receivables',
      cta: 'Alokasikan'
    })
  }
  return out
})
const toneClass: Record<Attention['tone'], string> = {
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-primary/10 text-primary'
}

const selectedMovement = ref<string | null>(null)
function isNeutral (m: MovementDto) { return m.isInternalTransfer || !!m.reversalOfId }
</script>

<template>
  <FinancePage title="Finance" description="Kas hari ini dan apa yang perlu diperhatikan." :breadcrumb="[{ label: 'Finance' }]">
    <template #actions>
      <FinanceRecordMenu />
    </template>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <!-- Hero: cash today -->
      <section class="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 lg:col-span-2" aria-labelledby="hero-title">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p id="hero-title" class="text-sm text-muted-foreground">
              {{ position?.available ? 'Saldo tersedia' : 'Saldo rekening terverifikasi' }} per {{ formatBusinessDateLong(today) }}
            </p>
            <div v-if="!position" class="mt-2 h-10 w-64 animate-pulse rounded-lg bg-muted" />
            <FinanceAmount v-else :value="position.totalMinor" class="mt-1 block text-4xl font-semibold tracking-tight sm:text-[2.75rem]" />
            <p v-if="trendDelta" class="mt-1.5 text-sm text-muted-foreground">
              <FinanceAmount :value="trendDelta" :direction="trendDelta.startsWith('-') ? null : 'in'" :class="trendDelta.startsWith('-') ? 'font-medium text-destructive' : 'font-medium'" />
              dibanding 30 hari lalu (<FinanceAmount :value="trend.data.value!.totals[0]!" />)
            </p>
          </div>
          <NuxtLink to="/finance/accounts" class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            <Landmark class="h-4 w-4" /> Rekening
          </NuxtLink>
        </div>

        <div v-if="position && !position.available" class="mt-4 flex gap-2 rounded-lg bg-warning/10 px-3 py-2.5 text-sm">
          <ShieldAlert class="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span v-if="position.reason === 'NO_ACCOUNTS'">Belum ada rekening. <NuxtLink to="/finance/accounts" class="font-medium text-primary hover:underline">Tambahkan rekening</NuxtLink> untuk mulai mencatat kas.</span>
          <span v-else>Belum termasuk {{ pendingAccounts.map(a => a.code).join(', ') }} — saldo awalnya belum diverifikasi, jadi angka ini belum lengkap.</span>
        </div>

        <div class="mt-5">
          <FinanceBalanceChart v-if="trend.data.value && trend.data.value.dates.length > 1" :dates="trend.data.value.dates" :totals="trend.data.value.totals" />
          <p v-else-if="trend.error.value" class="flex h-44 items-center justify-center rounded-lg bg-muted/40 px-4 text-center text-xs text-muted-foreground sm:h-52" data-trend-error>
            Grafik saldo belum bisa dimuat: {{ trend.error.value.message }}
          </p>
          <div v-else class="h-44 animate-pulse rounded-lg bg-muted/60 sm:h-52" />
        </div>

        <ul v-if="position?.accounts.length" class="mt-4 flex flex-wrap gap-2" aria-label="Saldo per rekening">
          <li v-for="a in position.accounts" :key="a.id">
            <NuxtLink :to="`/finance/accounts/${a.id}`" class="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted/50">
              <span class="font-medium">{{ a.code }}</span>
              <FinanceAmount :value="a.currentMinor" unavailable-label="Belum terverifikasi" class="text-muted-foreground" />
            </NuxtLink>
          </li>
        </ul>
      </section>

      <!-- Attention (right column on desktop, after the figures on phones) -->
      <section class="rounded-2xl border border-border bg-card shadow-sm lg:col-start-3 lg:row-span-2 lg:row-start-1" aria-labelledby="attention-title">
        <div class="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="attention-title" class="text-[15px] font-semibold">
            Perlu perhatian
          </h2>
          <span v-if="attention.length" class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">{{ attention.length }}</span>
        </div>
        <div v-if="!obligations.loaded.value" class="space-y-3 p-5">
          <div v-for="i in 4" :key="i" class="h-16 animate-pulse rounded-lg bg-muted" />
        </div>
        <FinanceErrorState v-else-if="obligations.error.value && !obligations.data.value" :error="obligations.error.value" compact @retry="obligations.refresh" />
        <EmptyState v-else-if="!attention.length" :icon="CheckCircle2" title="Semua beres" description="Tidak ada tagihan terlambat, invoice menunggu review, atau rekening yang perlu diverifikasi." size="compact" />
        <ul v-else class="divide-y divide-border">
          <li v-for="item in attention" :key="item.key">
            <NuxtLink :to="item.to" class="group flex gap-3 px-5 py-4 transition-colors hover:bg-muted/40">
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg" :class="toneClass[item.tone]">
                <component :is="item.icon" class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium leading-snug">{{ item.title }}</span>
                <span class="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{{ item.detail }}</span>
                <span class="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  {{ item.cta }} <ArrowRight class="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <!-- Supporting figures -->
      <section class="grid grid-cols-2 gap-3 lg:col-span-2" aria-label="Ringkasan">
        <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowDownLeft class="h-3.5 w-3.5 text-success" /> Uang masuk bulan ini
          </p>
          <FinanceAmount v-if="flows.data.value" :value="flows.data.value.month.inMinor" class="mt-1 block text-lg font-semibold text-success sm:text-xl" />
          <div v-else class="mt-2 h-6 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowUpRight class="h-3.5 w-3.5 text-destructive" /> Uang keluar bulan ini
          </p>
          <FinanceAmount v-if="flows.data.value" :value="flows.data.value.month.outMinor" class="mt-1 block text-lg font-semibold sm:text-xl" />
          <div v-else class="mt-2 h-6 w-32 animate-pulse rounded bg-muted" />
        </div>
        <NuxtLink to="/finance/receivables" class="max-sm:col-span-2 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40">
          <p class="text-xs text-muted-foreground">
            Tagihan customer belum dibayar
          </p>
          <template v-if="obligations.data.value">
            <FinanceAmount :value="obligations.data.value.ar.outstandingMinor" class="mt-1 block text-lg font-semibold sm:text-xl" />
            <p class="mt-1 text-xs text-muted-foreground">
              <span v-if="obligations.data.value.ar.overdueMinor !== '0'" class="font-medium text-destructive">{{ formatMoneyMinor(obligations.data.value.ar.overdueMinor) }} terlambat · </span>
              {{ formatMoneyMinor(obligations.data.value.arDue30) }} jatuh tempo ≤ 30 hari
            </p>
          </template>
          <div v-else class="mt-2 h-6 w-32 animate-pulse rounded bg-muted" />
        </NuxtLink>
        <NuxtLink to="/finance/payables" class="max-sm:col-span-2 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40">
          <p class="text-xs text-muted-foreground">
            Kewajiban ke vendor
          </p>
          <template v-if="obligations.data.value">
            <FinanceAmount :value="obligations.data.value.ap.outstandingMinor" class="mt-1 block text-lg font-semibold sm:text-xl" />
            <p class="mt-1 text-xs text-muted-foreground">
              <span v-if="obligations.data.value.ap.overdueMinor !== '0'" class="font-medium text-destructive">{{ formatMoneyMinor(obligations.data.value.ap.overdueMinor) }} terlambat · </span>
              {{ formatMoneyMinor(obligations.data.value.apDue30) }} jatuh tempo ≤ 30 hari
            </p>
          </template>
          <div v-else class="mt-2 h-6 w-32 animate-pulse rounded bg-muted" />
        </NuxtLink>
      </section>

      <!-- Recent activity -->
      <section class="rounded-2xl border border-border bg-card shadow-sm lg:col-span-3" aria-labelledby="recent-title">
        <div class="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="recent-title" class="text-[15px] font-semibold">
            Aktivitas terbaru
          </h2>
          <NuxtLink to="/finance/statement" class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Semua mutasi <ArrowRight class="h-3.5 w-3.5" />
          </NuxtLink>
        </div>
        <div v-if="!flows.loaded.value" class="space-y-2 p-5">
          <div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-lg bg-muted" />
        </div>
        <EmptyState v-else-if="!flows.data.value?.recent.length" title="Belum ada transaksi" description="Uang masuk dan keluar yang dicatat akan muncul di sini." size="compact" />
        <ul v-else class="divide-y divide-border">
          <li v-for="m in flows.data.value.recent" :key="m.id">
            <button type="button" class="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40" @click="selectedMovement = m.id">
              <span
                class="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                :class="isNeutral(m) ? 'bg-muted text-muted-foreground' : m.direction === 'in' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'"
                aria-hidden="true"
              >
                <Undo2 v-if="m.reversalOfId" class="h-3.5 w-3.5" />
                <ArrowLeftRight v-else-if="m.isInternalTransfer" class="h-3.5 w-3.5" />
                <ArrowDownLeft v-else-if="m.direction === 'in'" class="h-3.5 w-3.5" />
                <ArrowUpRight v-else class="h-3.5 w-3.5" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium" :class="(m.reversedById || m.reversalOfId) && 'text-muted-foreground'">{{ movementTitle(m) }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ formatBusinessDate(m.effectiveDate, { short: true, today }) }} · {{ m.account.code }} · {{ movementSubtitle(m) }}</span>
              </span>
              <FinanceAmount :value="m.amountMinor" :direction="m.direction" :muted="!!m.reversedById" :subdued="isNeutral(m)" class="shrink-0 text-sm font-semibold" />
            </button>
          </li>
        </ul>
      </section>
    </div>

    <FinanceMovementSheet v-model:movement-id="selectedMovement" />
  </FinancePage>
</template>
