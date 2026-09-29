<script setup lang="ts">
import { AlarmClock, ArrowDownLeft, ArrowRight, ArrowUpRight, Landmark, ShieldAlert, TrendingDown, TrendingUp } from 'lucide-vue-next'
import type { FinanceOverviewFull } from '~/types/api'
import { formatBusinessDate, formatBusinessDateLong } from '~/lib/finance/dates'
import { formatMoneyMinor } from '~/lib/money'

/**
 * Finance on the app dashboard (Finance, Super Admin): the four answers a manager wants first — cash today,
 * cash in 30 days, what customers still owe, what we still owe — each linking to the screen with the detail.
 * Every figure comes from GET /finance/overview, the same numbers as the Finance menus.
 */
const props = defineProps<{ data: FinanceOverviewFull | null; loading: boolean; error: string | null }>()

const gap = computed(() => (props.data?.forecast.available ? props.data.forecast.gap : null))
</script>

<template>
  <section aria-labelledby="dash-finance-title">
    <div class="mb-3 flex items-center justify-between gap-2 px-0.5">
      <h2 id="dash-finance-title" class="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Keuangan<template v-if="data">
          — per {{ formatBusinessDateLong(data.asOf) }}
        </template>
      </h2>
      <NuxtLink to="/finance" class="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
        Buka Finance <ArrowRight class="h-3 w-3" />
      </NuxtLink>
    </div>

    <p v-if="error && !data" class="rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground" role="status">
      Ringkasan keuangan belum bisa dimuat: {{ error }}
    </p>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <!-- Cash today -->
      <NuxtLink to="/finance/accounts" class="group rounded-2xl border border-primary/[0.14] bg-gradient-to-br from-primary/[0.14] via-primary/[0.04] to-transparent p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
        <p class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Landmark class="h-3.5 w-3.5 text-primary" /> Saldo kas hari ini
        </p>
        <div v-if="loading && !data" class="mt-3 h-8 w-40 animate-pulse rounded bg-muted" />
        <template v-else-if="data">
          <FinanceAmount :value="data.cash.totalMinor" class="mt-2 block text-2xl font-semibold tracking-tight sm:text-[1.7rem]" />
          <p v-if="!data.cash.available" class="mt-1 flex items-center gap-1 text-xs text-warning">
            <ShieldAlert class="h-3.5 w-3.5 shrink-0" />
            {{ data.cash.reason === 'NO_ACCOUNTS' ? 'Belum ada rekening' : 'Belum lengkap — ada saldo awal belum diverifikasi' }}
          </p>
          <p v-else class="mt-1 text-xs text-muted-foreground">
            Semua rekening terverifikasi
          </p>
        </template>
      </NuxtLink>

      <!-- Forecast -->
      <NuxtLink
        to="/finance/cash-flow?horizon=30d"
        class="group rounded-2xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        :class="gap ? 'border-destructive/25 bg-gradient-to-br from-destructive/[0.12] via-destructive/[0.03] to-transparent' : 'border-success/[0.14] bg-gradient-to-br from-success/[0.12] via-success/[0.03] to-transparent'"
      >
        <p class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <component :is="gap ? TrendingDown : TrendingUp" class="h-3.5 w-3.5" :class="gap ? 'text-destructive' : 'text-success'" /> Perkiraan 30 hari
        </p>
        <div v-if="loading && !data" class="mt-3 h-8 w-40 animate-pulse rounded bg-muted" />
        <template v-else-if="data">
          <template v-if="data.forecast.available">
            <FinanceAmount :value="data.forecast.closingMinor" class="mt-2 block text-2xl font-semibold tracking-tight sm:text-[1.7rem]" :class="data.forecast.closingMinor.startsWith('-') && 'text-destructive'" />
            <p class="mt-1 text-xs" :class="gap ? 'font-medium text-destructive' : 'text-muted-foreground'">
              {{ gap ? `Minus mulai ${formatBusinessDate(gap.date, { short: true, today: data.asOf })}` : `Saldo per ${formatBusinessDate(data.forecast.periodEnd, { short: true, today: data.asOf })}` }}
            </p>
          </template>
          <template v-else>
            <p class="mt-2 text-base font-semibold text-muted-foreground">
              Belum tersedia
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ data.forecast.reason === 'NO_ACCOUNTS' ? 'Belum ada rekening' : 'Menunggu verifikasi saldo awal' }}
            </p>
          </template>
        </template>
      </NuxtLink>

      <!-- Receivables -->
      <NuxtLink :to="data?.receivables.overdueCount ? '/finance/receivables?tab=overdue' : '/finance/receivables'" class="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
        <p class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <ArrowDownLeft class="h-3.5 w-3.5 text-success" /> Tagihan customer
        </p>
        <div v-if="loading && !data" class="mt-3 h-8 w-40 animate-pulse rounded bg-muted" />
        <template v-else-if="data">
          <FinanceAmount :value="data.receivables.outstandingMinor" class="mt-2 block text-2xl font-semibold tracking-tight sm:text-[1.7rem]" />
          <p class="mt-1 flex items-center gap-1 text-xs" :class="data.receivables.overdueCount ? 'font-medium text-destructive' : 'text-muted-foreground'">
            <AlarmClock v-if="data.receivables.overdueCount" class="h-3.5 w-3.5 shrink-0" />
            {{ data.receivables.overdueCount ? `${formatMoneyMinor(data.receivables.overdueMinor)} terlambat (${data.receivables.overdueCount})` : `${data.receivables.openCount} invoice belum lunas` }}
          </p>
        </template>
      </NuxtLink>

      <!-- Payables -->
      <NuxtLink :to="data?.payables.overdueCount ? '/finance/payables?tab=overdue' : '/finance/payables'" class="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
        <p class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <ArrowUpRight class="h-3.5 w-3.5 text-destructive" /> Kewajiban ke vendor
        </p>
        <div v-if="loading && !data" class="mt-3 h-8 w-40 animate-pulse rounded bg-muted" />
        <template v-else-if="data">
          <FinanceAmount :value="data.payables.outstandingMinor" class="mt-2 block text-2xl font-semibold tracking-tight sm:text-[1.7rem]" />
          <p class="mt-1 flex items-center gap-1 text-xs" :class="data.payables.overdueCount ? 'font-medium text-destructive' : 'text-muted-foreground'">
            <AlarmClock v-if="data.payables.overdueCount" class="h-3.5 w-3.5 shrink-0" />
            {{ data.payables.overdueCount ? `${formatMoneyMinor(data.payables.overdueMinor)} lewat jatuh tempo (${data.payables.overdueCount})` : data.payables.pendingReviewCount ? `${data.payables.pendingReviewCount} invoice menunggu review` : 'Tidak ada yang terlambat' }}
          </p>
        </template>
      </NuxtLink>
    </div>
  </section>
</template>
