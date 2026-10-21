<script setup lang="ts">
import { formatMoneyMinor } from '~/lib/money'
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Pemeriksaan jurnal accounting' })
const route = useRoute()
const api = useApi()
const session = useServerSession()
const journal = useFinanceQuery(async () => (await api.accounting.journal(String(route.params.id))).data, { watch: [() => route.params.id], enabled: () => session.can('accounting.view-posting-detail') })
</script>

<template>
  <FinancePage title="Pemeriksaan jurnal" capability="accounting.view-posting-detail">
    <NuxtLink to="/finance/accounting" class="text-sm underline">
      Kembali ke accounting
    </NuxtLink>
    <FinanceErrorState v-if="journal.error.value" :error="journal.error.value" @retry="journal.refresh" />
    <p v-else-if="!journal.loaded.value" role="status">
      Memuat jurnal…
    </p>
    <section v-else-if="journal.data.value" class="space-y-4 rounded-xl border bg-card p-5">
      <h2 class="text-lg font-semibold">
        {{ journal.data.value.id }} · {{ journal.data.value.description }}
      </h2>
      <p class="text-sm">
        {{ journal.data.value.effectiveDate }} · {{ journal.data.value.status }} · policy {{ journal.data.value.policyId }} v{{ journal.data.value.policyVersion }}
      </p>
      <p class="text-sm">
        Sumber {{ journal.data.value.sourceType }} / {{ journal.data.value.sourceId }} · versi {{ journal.data.value.sourceVersion }} · {{ journal.data.value.eventKind }}
      </p>
      <NuxtLink v-if="journal.data.value.sourceType === 'financial_transaction'" :to="`/finance/statement?transactionId=${journal.data.value.sourceId}`" class="text-sm underline">
        Buka mutasi sumber
      </NuxtLink>
      <p v-if="journal.data.value.correctionReason" class="text-sm">
        Alasan koreksi: {{ journal.data.value.correctionReason }}
      </p>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[500px] text-sm">
          <caption class="sr-only">
            Baris jurnal dan dimensi sumber
          </caption>
          <thead>
            <tr class="border-b text-left">
              <th scope="col">
                Akun / sumber
              </th><th scope="col" class="text-right">
                Debit
              </th><th scope="col" class="text-right">
                Kredit
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(line, index) in journal.data.value.lines" :key="index" class="border-b">
              <th scope="row" class="py-3 text-left font-normal">
                {{ line.accountCode }} · {{ line.accountName }}<p class="text-xs text-muted-foreground">
                  {{ [line.bankAccountId, line.projectId, line.salesOrderId, line.partyId, line.vendorId, line.employeeId].filter(Boolean).join(' · ') }}
                </p>
              </th><td class="text-right">
                {{ formatMoneyMinor(line.debitMinor) }}
              </td><td class="text-right">
                {{ formatMoneyMinor(line.creditMinor) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-xs text-muted-foreground">
        Jurnal posted terkunci. Koreksi dilakukan lewat transaksi sumber dengan jejak reversal. Request {{ journal.data.value.requestId }}
      </p>
    </section>
  </FinancePage>
</template>
