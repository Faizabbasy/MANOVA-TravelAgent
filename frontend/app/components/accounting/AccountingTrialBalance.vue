<script setup lang="ts">
import type { AccountingTrialBalanceDto } from '~/types/api'
import { formatMoneyMinor } from '~/lib/money'
defineProps<{ result: AccountingTrialBalanceDto }>()
</script>

<template>
  <section class="space-y-4 rounded-xl border bg-card p-5" aria-label="Hasil accounting">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold">
          Neraca saldo
        </h2>
        <p class="text-sm text-muted-foreground">
          Per {{ result.asOf }} · {{ result.currency }} · {{ result.timezone ?? 'Zona waktu belum diatur' }}
        </p>
      </div>
      <span class="rounded-md bg-muted px-3 py-1 text-sm">{{ result.basis === 'rehearsal' ? 'Rehearsal · sementara' : result.available ? 'Sementara' : 'Belum tersedia' }}</span>
    </div>
    <ul v-if="result.reasons.length" class="space-y-1 text-sm text-muted-foreground" aria-label="Kelengkapan accounting">
      <li v-for="reason in result.reasons" :key="reason.code">
        {{ reason.message }}
      </li>
    </ul>
    <p v-if="!result.available" class="rounded-lg bg-muted p-4 text-sm">
      Angka accounting belum tersedia. Lengkapi setup, kebijakan dan saldo awal terlebih dahulu.
    </p>
    <template v-else>
      <p role="status" class="text-sm">
        {{ result.balanced ? 'Total debit dan kredit seimbang.' : 'Ada selisih yang perlu diperiksa.' }} Laba setelah pajak belum tersedia.
      </p>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[540px] text-sm">
          <caption class="sr-only">
            Neraca saldo dari jurnal posted sampai tanggal laporan
          </caption>
          <thead>
            <tr class="border-b text-left">
              <th scope="col" class="py-2">
                Akun
              </th><th scope="col" class="text-right">
                Debit
              </th><th scope="col" class="text-right">
                Kredit
              </th><th scope="col" class="text-right">
                Saldo debit/(kredit)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in result.rows" :key="row.code" class="border-b">
              <th scope="row" class="py-2 text-left font-normal">
                {{ row.code }} · {{ row.name }}
              </th>
              <td class="text-right tabular-nums">
                {{ formatMoneyMinor(row.debitMinor) }}
              </td>
              <td class="text-right tabular-nums">
                {{ formatMoneyMinor(row.creditMinor) }}
              </td>
              <td class="text-right tabular-nums">
                {{ formatMoneyMinor(row.balanceMinor) }}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" class="py-3 text-left">
                Total
              </th><td class="text-right font-semibold">
                {{ result.totalDebitMinor === null ? 'Belum tersedia' : formatMoneyMinor(result.totalDebitMinor) }}
              </td><td class="text-right font-semibold">
                {{ result.totalCreditMinor === null ? 'Belum tersedia' : formatMoneyMinor(result.totalCreditMinor) }}
              </td><td />
            </tr>
          </tfoot>
        </table>
      </div>
    </template>
  </section>
</template>
