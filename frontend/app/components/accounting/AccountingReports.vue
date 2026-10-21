<script setup lang="ts">
import type { AccountingBalanceSheetDto, AccountingProfitLossDto, AccountingProjectContributionDto, AccountingReportSection } from '~/types/api'
import { formatMoneyMinor } from '~/lib/money'

/**
 * Owner summary from posted journals only: profit (before tax unless the tax profile is validated), what the
 * company owns/owes, and trip contribution. Unavailable figures stay unavailable — never shown as Rp 0.
 */
defineProps<{ profitLoss: AccountingProfitLossDto; balanceSheet: AccountingBalanceSheetDto; contribution: AccountingProjectContributionDto | null }>()

const sections = (bs: AccountingBalanceSheetDto): [string, AccountingReportSection | null][] => [['Yang dimiliki (aset)', bs.assets], ['Kewajiban', bs.liabilities], ['Modal', bs.equity]]
const status = (r: { basis: string; available: boolean }) => (!r.available ? 'Belum tersedia' : r.basis === 'rehearsal' ? 'Rehearsal · sementara' : 'Sementara')
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <section class="space-y-3 rounded-xl border bg-card p-5" aria-label="Laba rugi">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 class="text-lg font-semibold">
            Laba rugi
          </h2>
          <p class="text-sm text-muted-foreground">
            {{ profitLoss.from }} – {{ profitLoss.to }} · {{ profitLoss.currency }} · dasar pengakuan, bukan uang masuk/keluar
          </p>
        </div>
        <span class="rounded-md bg-muted px-3 py-1 text-sm">{{ status(profitLoss) }}</span>
      </div>
      <p v-if="!profitLoss.available || !profitLoss.revenue" class="rounded-lg bg-muted p-4 text-sm">
        Laba belum tersedia untuk periode ini.
      </p>
      <dl v-else class="space-y-2 text-sm">
        <div class="flex justify-between gap-3">
          <dt>Pendapatan diakui</dt><dd class="tabular-nums">
            {{ formatMoneyMinor(profitLoss.revenue.totalMinor) }}
          </dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt>Biaya langsung perjalanan</dt><dd class="tabular-nums">
            {{ formatMoneyMinor(profitLoss.directCost!.totalMinor) }}
          </dd>
        </div>
        <div class="flex justify-between gap-3 border-t pt-2 font-medium">
          <dt>Laba kotor</dt><dd class="tabular-nums">
            {{ formatMoneyMinor(profitLoss.grossProfitMinor!) }}
          </dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt>Biaya operasional perusahaan</dt><dd class="tabular-nums">
            {{ formatMoneyMinor(profitLoss.operatingExpense!.totalMinor) }}
          </dd>
        </div>
        <div class="flex justify-between gap-3 border-t pt-2 text-base font-semibold">
          <dt>Laba sebelum pajak</dt><dd class="tabular-nums">
            {{ formatMoneyMinor(profitLoss.profitBeforeTaxMinor!) }}
          </dd>
        </div>
        <div class="flex justify-between gap-3 text-muted-foreground">
          <dt>Laba setelah pajak</dt><dd>{{ profitLoss.netProfitMinor === null ? 'Belum tersedia' : formatMoneyMinor(profitLoss.netProfitMinor) }}</dd>
        </div>
      </dl>
      <ul v-if="profitLoss.reasons.length" class="space-y-1 text-xs text-muted-foreground" aria-label="Kelengkapan laba">
        <li v-for="r in profitLoss.reasons" :key="r.code">
          {{ r.message }}
        </li>
      </ul>
    </section>

    <section class="space-y-3 rounded-xl border bg-card p-5" aria-label="Posisi keuangan">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 class="text-lg font-semibold">
            Posisi keuangan
          </h2>
          <p class="text-sm text-muted-foreground">
            Per {{ balanceSheet.asOf }}
          </p>
        </div>
        <span class="rounded-md bg-muted px-3 py-1 text-sm">{{ status(balanceSheet) }}</span>
      </div>
      <p v-if="!balanceSheet.available || !balanceSheet.assets" class="rounded-lg bg-muted p-4 text-sm">
        Posisi keuangan belum tersedia.
      </p>
      <template v-else>
        <div v-for="[label, s] in sections(balanceSheet)" :key="label" class="text-sm">
          <h3 class="font-medium">
            {{ label }} <span class="float-right tabular-nums">{{ formatMoneyMinor(s!.totalMinor) }}</span>
          </h3>
          <ul class="mt-1 space-y-0.5 text-muted-foreground">
            <li v-for="l in s!.lines" :key="l.code" class="flex justify-between gap-3">
              <span>{{ l.name }}</span><span class="tabular-nums">{{ formatMoneyMinor(l.amountMinor) }}</span>
            </li>
          </ul>
        </div>
        <p class="flex justify-between gap-3 text-sm">
          <span>Hasil usaha sejak buku dimulai</span><span class="tabular-nums">{{ formatMoneyMinor(balanceSheet.currentResultMinor!) }}</span>
        </p>
        <p role="status" class="text-sm" :class="balanceSheet.balanced ? 'text-muted-foreground' : 'font-medium text-destructive'">
          {{ balanceSheet.balanced ? 'Aset = kewajiban + modal + hasil usaha.' : 'Posisi tidak seimbang — periksa jurnal dan saldo awal.' }}
        </p>
      </template>
    </section>

    <section v-if="contribution" class="space-y-3 rounded-xl border bg-card p-5 lg:col-span-2" aria-label="Keuntungan per perjalanan">
      <h2 class="text-lg font-semibold">
        Keuntungan per perjalanan
      </h2>
      <p class="text-sm text-muted-foreground">
        Kontribusi = pendapatan diakui − biaya langsung. Biaya kantor dihitung sekali di tingkat perusahaan, tidak dialokasikan diam-diam.
      </p>
      <p v-if="!contribution.available" class="rounded-lg bg-muted p-4 text-sm">
        Belum tersedia.
      </p>
      <p v-else-if="!contribution.items.length" class="text-sm text-muted-foreground">
        Belum ada pendapatan atau biaya perjalanan yang diakui pada periode ini.
      </p>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[560px] text-sm">
          <caption class="sr-only">
            Kontribusi per project atau order
          </caption>
          <thead>
            <tr class="border-b text-left">
              <th scope="col" class="py-2">
                Project / order
              </th><th scope="col" class="text-right">
                Pendapatan
              </th><th scope="col" class="text-right">
                Biaya langsung
              </th><th scope="col" class="text-right">
                Kontribusi
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in contribution.items" :key="`${i.projectId}:${i.salesOrderId}`" class="border-b">
              <th scope="row" class="py-2 text-left font-normal">
                <NuxtLink v-if="i.projectId" :to="`/project-orders/${i.projectId}`" class="underline">
                  {{ i.name ?? i.projectId }}
                </NuxtLink><span v-else>{{ i.name }}</span>
              </th>
              <td class="text-right tabular-nums">
                {{ formatMoneyMinor(i.revenueMinor) }}
              </td>
              <td class="text-right tabular-nums">
                {{ formatMoneyMinor(i.directCostMinor) }}
              </td>
              <td class="text-right font-medium tabular-nums">
                {{ formatMoneyMinor(i.contributionMinor) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="mt-2 text-xs text-muted-foreground">
          Pos tingkat perusahaan {{ formatMoneyMinor(contribution.companyMinor!) }} · total {{ formatMoneyMinor(contribution.totalMinor!) }} = laba sebelum pajak periode yang sama.
        </p>
      </div>
    </section>
  </div>
</template>
