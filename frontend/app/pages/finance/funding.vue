<script setup lang="ts">
import { Building, Calculator, Landmark, PiggyBank } from 'lucide-vue-next'
import { newIdempotencyKey } from '~/lib/api/client'
import { formatBusinessDate, todayJakarta } from '~/lib/finance/dates'
import { formatMoneyMinor } from '~/lib/money'
import type { FundingOverviewDto } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Aset, Pinjaman & Modal — Finance' })

/**
 * Company-level money that is not trip income or cost: buying assets (capitalised, then depreciated monthly), loans
 * (principal is not expense) and owner money (equity per entity profile). One form per business fact.
 */
const api = useApi()
const session = useServerSession()
const { showToast } = useToast()
const today = todayJakarta()
type Dialog = 'asset' | 'loan' | 'repay' | 'contribution' | 'withdrawal' | 'depreciation'
const dialog = ref<Dialog | null>(null)
const overview = useFinanceQuery<FundingOverviewDto>(async () => (await api.finance.funding()).data)
const lookups = useFinanceLookups(() => dialog.value !== null)
const inventory = useFinanceQuery(async () => (await api.core.listAssets()).data, {
  enabled: () => dialog.value === 'asset', watch: [() => dialog.value === 'asset']
})

const open = computed({ get: () => dialog.value !== null, set: (v: boolean) => { if (!v) { dialog.value = null } } })
const form = reactive({
  accountId: null as string | null,
  assetId: null as string | null,
  amount: '',
  interest: '0',
  date: today,
  life: 36,
  lender: '',
  terms: '',
  loanId: null as string | null,
  memo: '',
  period: today.slice(0, 7)
})
let key = newIdempotencyKey()

function start (d: Dialog, loanId: string | null = null) {
  key = newIdempotencyKey()
  Object.assign(form, {
    accountId: lookups.accountOptions.value[0]?.value ?? null,
    assetId: null,
    amount: '',
    interest: '0',
    date: today,
    life: 36,
    lender: '',
    terms: '',
    loanId,
    memo: '',
    period: today.slice(0, 7)
  })
  command.reset()
  dialog.value = d
}
watch(() => lookups.accountOptions.value, (o) => { if (dialog.value && !form.accountId && o.length) { form.accountId = o[0]!.value } })

const capitalized = computed(() => new Set((overview.data.value?.assets ?? []).map(a => a.assetId)))
const assetOptions = computed(() => (inventory.data.value ?? []).filter(a => !capitalized.value.has(a.id)).map(a => ({ value: a.id, label: `${a.code} · ${a.name}` })))
const loanOptions = computed(() => (overview.data.value?.loans ?? []).filter(l => l.status === 'open').map(l => ({ value: l.id, label: `${l.lender} · sisa ${formatMoneyMinor(l.outstandingMinor)}` })))

const META: Record<Dialog, { title: string; description: string; submit: string }> = {
  asset: { title: 'Beli aset', description: 'Harga aset dicatat sebagai aset, bukan biaya; biayanya dibebankan bertahap lewat penyusutan.', submit: 'Catat pembelian' },
  loan: { title: 'Catat pinjaman', description: 'Dana pinjaman masuk rekening sebagai utang, bukan pendapatan.', submit: 'Catat pinjaman' },
  repay: { title: 'Bayar cicilan', description: 'Pokok mengurangi utang pinjaman; hanya bunga yang menjadi biaya.', submit: 'Bayar cicilan' },
  contribution: { title: 'Setor dana owner', description: 'Tambahan modal/dana owner, bukan pendapatan. Perlakuannya mengikuti bentuk usaha.', submit: 'Catat setoran' },
  withdrawal: { title: 'Ambil dana owner', description: 'Pengambilan dana owner, bukan biaya operasional.', submit: 'Catat pengambilan' },
  depreciation: { title: 'Hitung penyusutan', description: 'Membukukan penyusutan bulanan yang belum tercatat sampai bulan yang dipilih. Aman diulang: bulan yang sudah dicatat dilewati.', submit: 'Hitung' }
}

/** Every action answers with the months booked (depreciation) or null (a single cash fact). */
const command = useFinanceAction(async (): Promise<number | null> => {
  const d = dialog.value!
  if (d === 'asset') { await api.finance.purchaseAsset(form.assetId!, { bankAccountId: form.accountId!, costMinor: form.amount, acquiredOn: form.date, usefulLifeMonths: Number(form.life) }, key) } else if (d === 'loan') { await api.finance.receiveLoan({ lender: form.lender.trim(), principalMinor: form.amount, receivedOn: form.date, terms: form.terms.trim(), bankAccountId: form.accountId! }, key) } else if (d === 'repay') { await api.finance.repayLoan(form.loanId!, { bankAccountId: form.accountId!, principalMinor: form.amount || '0', interestMinor: form.interest || '0', effectiveDate: form.date }, key) } else if (d === 'depreciation') { return (await api.finance.runDepreciation(form.period, key)).data.booked.length } else { await api.finance.ownerFunds(d === 'contribution' ? 'contribution' : 'withdrawal', { bankAccountId: form.accountId!, amountMinor: form.amount, effectiveDate: form.date, memo: form.memo.trim() || undefined }, key) }
  return null
})
async function submit () {
  const d = dialog.value!
  const booked = await command.run()
  if (booked === undefined) { return }
  showToast(META[d].title, booked === null ? 'Tercatat dari rekening yang sama; jurnal terbentuk bila accounting aktif.' : `${booked} bulan penyusutan dibukukan.`)
  dialog.value = null
}
const disabled = computed(() => {
  const d = dialog.value
  if (d === 'depreciation') { return !/^\d{4}-\d{2}$/.test(form.period) }
  if (!form.accountId || !form.date) { return true }
  if (d === 'asset') { return !form.assetId || !form.amount || !(Number(form.life) >= 1) }
  if (d === 'loan') { return !form.amount || form.lender.trim().length < 2 || form.terms.trim().length < 5 }
  if (d === 'repay') { return !form.loanId || (BigInt(form.amount || '0') + BigInt(form.interest || '0')) <= 0n }
  return !form.amount
})
</script>

<template>
  <FinancePage title="Aset, Pinjaman & Modal" description="Pembelian aset dan penyusutan, pinjaman, serta dana owner — bukan pendapatan atau biaya perjalanan.">
    <div v-if="session.can('finance.post-cash')" class="flex flex-wrap gap-2">
      <Button size="sm" @click="start('asset')">
        <Building class="mr-1.5 h-4 w-4" /> Beli aset
      </Button>
      <Button size="sm" variant="outline" @click="start('loan')">
        <Landmark class="mr-1.5 h-4 w-4" /> Catat pinjaman
      </Button>
      <Button size="sm" variant="outline" @click="start('contribution')">
        <PiggyBank class="mr-1.5 h-4 w-4" /> Setor dana owner
      </Button>
      <Button size="sm" variant="outline" @click="start('withdrawal')">
        Ambil dana owner
      </Button>
      <Button v-if="session.can('finance.close-period')" size="sm" variant="outline" @click="start('depreciation')">
        <Calculator class="mr-1.5 h-4 w-4" /> Hitung penyusutan
      </Button>
    </div>

    <FinancePrepaidExpenses />
    <FinanceCompanyExpenses />
    <FinanceErrorState v-if="overview.error.value && !overview.data.value" :error="overview.error.value" @retry="overview.refresh" />
    <div v-else-if="!overview.data.value" class="h-32 animate-pulse rounded-xl bg-muted" />
    <template v-else>
      <section class="rounded-xl border border-border bg-card shadow-sm" aria-label="Aset tetap">
        <h2 class="border-b border-border px-5 py-3 text-[15px] font-semibold">
          Aset tetap
        </h2>
        <p v-if="!overview.data.value.assets.length" class="px-5 py-6 text-sm text-muted-foreground">
          Belum ada aset yang dicatat dibeli. Kartu inventaris saja tidak dihitung sebagai pembelian.
        </p>
        <div v-else class="divide-y divide-border">
          <div v-for="a in overview.data.value.assets" :key="a.assetId" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <div class="min-w-0">
              <p class="font-medium">
                {{ a.name }}
              </p>
              <p class="text-xs text-muted-foreground">
                Dibeli {{ formatBusinessDate(a.acquiredOn) }} · umur {{ a.usefulLifeMonths }} bulan · disusutkan sampai {{ a.lastPeriod ?? '—' }}
              </p>
            </div>
            <div class="text-right">
              <FinanceAmount :value="a.bookValueMinor" class="block font-medium" />
              <span class="text-xs text-muted-foreground">harga <FinanceAmount :value="a.costMinor" /> · akumulasi <FinanceAmount :value="a.accumulatedMinor" /></span>
            </div>
          </div>
        </div>
      </section>
      <section class="rounded-xl border border-border bg-card shadow-sm" aria-label="Pinjaman">
        <h2 class="border-b border-border px-5 py-3 text-[15px] font-semibold">
          Pinjaman
        </h2>
        <p v-if="!overview.data.value.loans.length" class="px-5 py-6 text-sm text-muted-foreground">
          Tidak ada pinjaman.
        </p>
        <div v-else class="divide-y divide-border">
          <div v-for="l in overview.data.value.loans" :key="l.id" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <div class="min-w-0">
              <p class="font-medium">
                {{ l.lender }}<span v-if="l.status === 'repaid'" class="text-xs font-normal text-muted-foreground"> · lunas</span>
              </p>
              <p class="truncate text-xs text-muted-foreground">
                {{ formatBusinessDate(l.receivedOn) }} · {{ l.terms }}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-right">
                <FinanceAmount :value="l.outstandingMinor" class="block font-medium" />
                <span class="text-xs text-muted-foreground">dari <FinanceAmount :value="l.principalMinor" /></span>
              </span>
              <Button v-if="l.status === 'open' && session.can('finance.post-cash')" size="sm" variant="outline" @click="start('repay', l.id)">
                Bayar cicilan
              </Button>
            </div>
          </div>
        </div>
      </section>
    </template>

    <FinanceFormDialog
      v-if="dialog"
      v-model:open="open"
      :title="META[dialog].title"
      :description="META[dialog].description"
      :submit-label="META[dialog].submit"
      :pending="command.pending.value"
      :error="command.error.value"
      :submit-disabled="disabled"
      @submit="submit"
    >
      <div class="grid gap-4">
        <FinanceField v-if="dialog === 'depreciation'" id="fd-period" label="Sampai bulan (YYYY-MM)" :error="command.fieldError('throughPeriod')">
          <Input id="fd-period" v-model="form.period" type="month" :max="today.slice(0, 7)" />
        </FinanceField>
        <template v-else>
          <FinanceField v-if="dialog === 'asset'" id="fd-asset" label="Aset dari inventaris" :error="command.fieldError('assetId')">
            <FinanceSelect id="fd-asset" v-model="form.assetId" :options="assetOptions" placeholder="Pilih aset" />
          </FinanceField>
          <FinanceField v-if="dialog === 'repay'" id="fd-loan" label="Pinjaman" :error="command.fieldError('loanId')">
            <FinanceSelect id="fd-loan" v-model="form.loanId" :options="loanOptions" />
          </FinanceField>
          <template v-if="dialog === 'loan'">
            <FinanceField id="fd-lender" label="Pemberi pinjaman" :error="command.fieldError('lender')">
              <Input id="fd-lender" v-model="form.lender" maxlength="200" />
            </FinanceField>
            <FinanceField id="fd-terms" label="Syarat (bunga, tenor, jadwal)" :error="command.fieldError('terms')">
              <FinanceTextarea id="fd-terms" v-model="form.terms" :rows="2" maxlength="1000" />
            </FinanceField>
          </template>
          <FinanceField id="fd-account" :label="dialog === 'loan' || dialog === 'contribution' ? 'Masuk ke rekening' : 'Dari rekening'" :error="command.fieldError('bankAccountId')">
            <FinanceSelect id="fd-account" v-model="form.accountId" :options="lookups.accountOptions.value" />
          </FinanceField>
          <div class="grid gap-4 sm:grid-cols-2">
            <FinanceField id="fd-amount" :label="dialog === 'asset' ? 'Harga perolehan' : dialog === 'repay' ? 'Pokok' : 'Nominal'" :error="command.fieldError(dialog === 'asset' ? 'costMinor' : dialog === 'repay' || dialog === 'loan' ? 'principalMinor' : 'amountMinor')">
              <FinanceMoneyInput id="fd-amount" v-model="form.amount" />
            </FinanceField>
            <FinanceField id="fd-date" label="Tanggal" :error="command.fieldError('effectiveDate') ?? command.fieldError('acquiredOn') ?? command.fieldError('receivedOn')">
              <FinanceDateInput id="fd-date" v-model="form.date" :max="today" />
            </FinanceField>
          </div>
          <FinanceField v-if="dialog === 'repay'" id="fd-interest" label="Bunga" :error="command.fieldError('interestMinor')">
            <FinanceMoneyInput id="fd-interest" v-model="form.interest" />
          </FinanceField>
          <FinanceField v-if="dialog === 'asset'" id="fd-life" label="Umur manfaat (bulan)" :error="command.fieldError('usefulLifeMonths')" hint="Kebijakan penyusutan perusahaan tetap perlu divalidasi.">
            <Input id="fd-life" v-model.number="form.life" type="number" min="1" max="600" />
          </FinanceField>
          <FinanceField v-if="dialog === 'contribution' || dialog === 'withdrawal'" id="fd-memo" label="Catatan" optional>
            <FinanceTextarea id="fd-memo" v-model="form.memo" :rows="2" maxlength="500" />
          </FinanceField>
        </template>
      </div>
    </FinanceFormDialog>
  </FinancePage>
</template>
