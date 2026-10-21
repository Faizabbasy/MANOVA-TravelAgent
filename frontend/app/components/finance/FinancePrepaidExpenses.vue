<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import { todayJakarta } from '~/lib/finance/dates'
import type { PrepaidExpenseInput } from '~/types/api'

const api = useApi()
const session = useServerSession()
const { showToast } = useToast()
const today = todayJakarta()
const cursor = ref<string | null>(null)
const list = useFinanceQuery(async () => (await api.finance.prepaidExpenses({ asOf: today, ...(cursor.value ? { cursor: cursor.value } : {}) })).data, { watch: [cursor] })
const showForm = ref(false)
const evidenceId = ref<string|null>(null)
const lookups = useFinanceLookups(() => showForm.value)
const lastMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 0)).toISOString().slice(0, 7)
const through = ref(lastMonth)
let paymentKey = newIdempotencyKey(); let paymentBody = ''
const pay = useFinanceAction((input: PrepaidExpenseInput) => {
  const body = JSON.stringify(input)
  if (body !== paymentBody) { paymentBody = body; paymentKey = newIdempotencyKey() }
  return api.finance.payPrepaidExpense(input, paymentKey)
})
const fields = computed(() => Object.fromEntries(['bankAccountId', 'amountMinor', 'effectiveDate', 'description', 'evidenceRef', 'startMonth', 'months', 'method'].map(k => [k, pay.fieldError(k)]).filter((e): e is [string, string] => e[1] !== null)))
async function submit (input: PrepaidExpenseInput) {
  if (await pay.run(input)) { showForm.value = false; cursor.value = null; showToast('Pembayaran dan jadwal tercatat. Beban dibukukan per bulan manfaat.', 'success') }
}
let runKey = newIdempotencyKey(); let runPeriod = ''
const amortize = useFinanceAction(() => {
  if (runPeriod !== through.value) { runPeriod = through.value; runKey = newIdempotencyKey() }
  return api.finance.runPrepaidAmortization(through.value, runKey)
})
async function run () {
  const result = await amortize.run()
  if (result) { runKey = newIdempotencyKey(); showToast(`${result.data.booked.length} bulan biaya dibukukan. Tidak ada kas keluar tambahan.`, 'success') }
}
</script>

<template>
  <section id="biaya-dibayar-di-muka" class="space-y-4 rounded-xl border bg-card p-5" aria-label="Biaya kantor dibayar di muka">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold">
          Biaya kantor dibayar di muka
        </h2>
        <p class="text-sm text-muted-foreground">
          Sewa, asuransi, atau langganan beberapa bulan. Satu pembayaran, beban sesuai bulan manfaat.
        </p>
      </div>
      <Button v-if="session.can('finance.post-cash') && !showForm" variant="outline" size="sm" @click="showForm = true; pay.reset()">
        Bayar di muka
      </Button>
    </div>
    <FinanceErrorState v-if="showForm && lookups.accounts.error.value" :error="lookups.accounts.error.value" compact @retry="lookups.accounts.refresh" />
    <p v-else-if="showForm && !lookups.accounts.data.value" role="status" class="text-sm text-muted-foreground">
      Memuat rekening pembayaran…
    </p>
    <p v-else-if="showForm && !lookups.accountOptions.value.length" class="text-sm text-muted-foreground">
      Belum ada rekening aktif dengan saldo awal terverifikasi. <NuxtLink to="/finance/accounts" class="underline">
        Lengkapi rekening
      </NuxtLink> sebelum mencatat pembayaran.
    </p>
    <FinancePrepaidExpenseForm
      v-if="showForm"
      :today="today"
      :accounts="lookups.accountOptions.value"
      :pending="pay.pending.value"
      :error="pay.error.value?.message"
      :field-errors="fields"
      @submit="submit"
      @cancel="showForm = false"
    />
    <FinanceErrorState v-if="list.error.value" :error="list.error.value" compact @retry="list.refresh" />
    <p v-else-if="!list.data.value" role="status" class="text-sm text-muted-foreground">
      Memuat jadwal…
    </p>
    <template v-else>
      <p class="text-xs text-muted-foreground">
        Posisi sumber per {{ list.data.value.asOf }} · angka ini bukan konfirmasi jurnal telah posted; periksa status sumber.
      </p>
      <p v-if="!list.data.value.items.length" class="text-sm text-muted-foreground">
        Belum ada jadwal pada halaman ini.
      </p>
      <ul class="divide-y">
        <li v-for="p in list.data.value.items" :key="p.id" class="space-y-2 py-3 text-sm">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="font-medium">
                {{ p.description }} · {{ p.status === 'reversed' ? 'dibatalkan' : p.status === 'completed' ? 'selesai dibebankan' : 'berjalan' }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ p.startMonth }} · {{ p.months }} bulan · bukti {{ p.evidenceRef }}
              </p>
            </div>
            <div class="text-right">
              <p>Sisa manfaat <FinanceAmount :value="p.remainingMinor" /></p>
              <p class="text-xs text-muted-foreground">
                Dibebankan <FinanceAmount :value="p.amortizedMinor" /> dari <FinanceAmount :value="p.totalMinor" />
              </p>
            </div>
          </div>
          <NuxtLink :to="`/finance/statement?transactionId=${encodeURIComponent(p.transactionId)}`" class="underline">
            Buka pembayaran & pembatalan
          </NuxtLink>
          <AccountingSourceStatus source-type="financial_transaction" :source-id="p.transactionId" />
          <Button size="sm" variant="outline" @click="evidenceId=p.id">
            Bukti asli
          </Button>
        </li>
      </ul>
      <div class="flex gap-2">
        <Button v-if="cursor" size="sm" variant="outline" @click="cursor = null">
          Halaman pertama
        </Button>
        <Button v-if="list.data.value.pagination.nextCursor" size="sm" variant="outline" @click="cursor = list.data.value!.pagination.nextCursor">
          Berikutnya
        </Button>
      </div>
    </template>
    <form v-if="session.can('finance.close-period')" class="flex flex-wrap items-end gap-3 border-t pt-4" @submit.prevent="run">
      <label class="space-y-1 text-sm">Bebankan sampai bulan manfaat yang sudah berakhir
        <input
          v-model="through"
          name="prepaidThroughPeriod"
          type="month"
          :max="lastMonth"
          required
          class="block h-10 rounded-md border bg-background px-3"
          :disabled="amortize.pending.value"
        >
      </label>
      <Button type="submit" :disabled="amortize.pending.value || !through">
        Bebankan bulanan
      </Button>
      <p class="w-full text-xs text-muted-foreground">
        Aman diulang: bulan yang sudah dicatat dilewati. Tidak melakukan pembayaran.
      </p>
      <p v-if="amortize.error.value" role="alert" class="w-full text-sm text-destructive">
        {{ amortize.error.value.message }}
      </p>
    </form>
    <PrivateEvidenceSheet v-model:source-id="evidenceId" source-type="prepaid_expense" :can-upload="session.can('finance.post-cash')" />
  </section>
</template>
