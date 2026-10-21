<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { newIdempotencyKey } from '~/lib/api/client'
import { startOfMonth, todayJakarta } from '~/lib/finance/dates'
import type { AccountingPolicyDto, AccountingPolicyInput, AccountingSetupInput, OpeningDecisionsInput, OpeningPlanDto } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Laporan & Cek Bulanan' })
const api = useApi()
const session = useServerSession()
const asOf = ref(todayJakarta())
const setup = useFinanceQuery(async () => (await api.accounting.setup()).data, { enabled: () => session.can('accounting.view-business-finance') })
const balance = useFinanceQuery(async () => (await api.accounting.trialBalance(asOf.value)).data, { watch: [asOf], enabled: () => session.can('accounting.view-business-finance') && !!asOf.value })
const reportFrom = ref(startOfMonth(todayJakarta()))
const reportsEnabled = () => session.can('accounting.view-business-finance') && !!asOf.value && !!reportFrom.value && reportFrom.value <= asOf.value
const reports = useFinanceQuery(async () => {
  const [profitLoss, balanceSheet, contribution] = await Promise.all([
    api.accounting.profitLoss(reportFrom.value, asOf.value), api.accounting.balanceSheet(asOf.value), api.accounting.projectContribution(reportFrom.value, asOf.value)
  ])
  return { profitLoss: profitLoss.data, balanceSheet: balanceSheet.data, contribution: contribution.data }
}, { watch: [asOf, reportFrom], enabled: reportsEnabled })
const exceptionCursor = ref<string | undefined>()
const exceptions = useFinanceQuery(() => api.accounting.exceptions({ limit: 25, cursor: exceptionCursor.value }), { watch: [exceptionCursor], enabled: () => session.can('accounting.view-business-finance') })
const cursor = ref<string | undefined>()
const journals = useFinanceQuery(() => api.accounting.journals({ limit: 25, cursor: cursor.value }), { watch: [cursor], enabled: () => session.can('accounting.view-posting-detail') })
const book = computed(() => setup.data.value?.book)
const setupKey = ref(newIdempotencyKey())
const saveSetup = useFinanceAction((input: AccountingSetupInput) => api.accounting.createSetup(input, setupKey.value))
const period = reactive({ startsOn: '', endsOn: '', reason: '' })
const periodKey = ref(newIdempotencyKey())
const savePeriod = useFinanceAction(() => api.accounting.createPeriod({ ...period }, periodKey.value))
async function submitPeriod () {
  if (await savePeriod.run()) { periodKey.value = newIdempotencyKey(); period.reason = '' }
}
const policyKey = ref(newIdempotencyKey())
const policyReset = ref(0)
let previousPolicy = ''
const savePolicy = useFinanceAction((input:AccountingPolicyInput) => {
  const next = JSON.stringify(input); if (next !== previousPolicy) { previousPolicy = next; policyKey.value = newIdempotencyKey() }
  return api.accounting.draftPolicy(input, policyKey.value)
})
async function submitPolicy (input:AccountingPolicyInput) {
  if (await savePolicy.run(input)) { policyKey.value = newIdempotencyKey(); previousPolicy = ''; policyReset.value++ }
}
const fixturePolicy = ref<AccountingPolicyDto|null>(null)
const fixtureOpen = computed({ get: () => !!fixturePolicy.value, set: (v:boolean) => { if (!v) { fixturePolicy.value = null } } })
let previousFixture = ''; let fixtureKey = newIdempotencyKey()
const useFixture = useFinanceAction((input:{reason:string;confirm:boolean}) => {
  const next = JSON.stringify({ id: fixturePolicy.value!.id, input }); if (next !== previousFixture) { previousFixture = next; fixtureKey = newIdempotencyKey() }
  return api.accounting.rehearsePolicy(fixturePolicy.value!.id, input, fixtureKey)
})
async function rehearsePolicy (input:{reason:string;confirm:boolean}) { if (await useFixture.run(input)) { fixturePolicy.value = null } }
const periodChange = reactive({ id: '', reason: '', confirmed: false })
const periodChangeKey = ref(newIdempotencyKey())
const changePeriod = useFinanceAction(async () => {
  const selected = setup.data.value?.periods.find(p => p.id === periodChange.id)
  if (!selected || !periodChange.confirmed) { return }
  const body = { version: selected.version, reason: periodChange.reason }
  return await (selected.status === 'closed'
    ? api.accounting.reopenRehearsalPeriod(selected.id, body, periodChangeKey.value)
    : api.accounting.lockRehearsalPeriod(selected.id, body, periodChangeKey.value))
})
async function submitPeriodChange () {
  if (await changePeriod.run()) { periodChangeKey.value = newIdempotencyKey(); periodChange.confirmed = false; periodChange.reason = '' }
}
const selectedPeriod = computed(() => setup.data.value?.periods.find(p => p.id === periodChange.id))
/* Cek bulanan: the period containing the report date by default. */
const reviewPeriodId = ref('')
watch(() => [setup.data.value?.periods, asOf.value] as const, ([periods, day]) => {
  if (!periods?.length || periods.some(p => p.id === reviewPeriodId.value)) { return }
  reviewPeriodId.value = (periods.find(p => p.startsOn <= day && p.endsOn >= day) ?? periods.at(-1)!).id
}, { immediate: true })
const monthly = useFinanceQuery(async () => (await api.accounting.periodReview(reviewPeriodId.value)).data, {
  watch: [reviewPeriodId], enabled: () => session.can('accounting.view-business-finance') && !!reviewPeriodId.value
})
const closeKey = ref(newIdempotencyKey())
const closeMonth = useFinanceAction((input: { version: number; reason: string; confirm: boolean }) => api.accounting.closePeriod(reviewPeriodId.value, input, closeKey.value))
async function submitClose (input: { version: number; reason: string; confirm: boolean }) {
  if (await closeMonth.run(input)) { closeKey.value = newIdempotencyKey() }
}
const retry = useFinanceAction((eventId: string) => api.accounting.retryException(eventId))
/* Saldo awal: preview from Finance facts; decisions re-preview; confirm posts once (rehearsal books only). */
const openingBase = useFinanceQuery(async () => (await api.accounting.openingPlan()).data, { enabled: () => session.can('accounting.view-business-finance') && !!book.value })
const openingDraft = ref<OpeningPlanDto | null>(null)
const openingPlan = computed(() => openingDraft.value ?? openingBase.data.value ?? null)
const previewOpening = useFinanceAction(async (decisions: OpeningDecisionsInput) => { openingDraft.value = (await api.accounting.previewOpening(decisions)).data })
const openingKey = ref(newIdempotencyKey())
const confirmOpening = useFinanceAction((input: { planHash: string; decisions: OpeningDecisionsInput; reason: string }) => api.accounting.confirmOpening(input, openingKey.value))
async function submitOpening (input: { planHash: string; decisions: OpeningDecisionsInput; reason: string }) {
  if (await confirmOpening.run(input)) { openingKey.value = newIdempotencyKey(); openingDraft.value = null }
}
</script>

<template>
  <FinancePage title="Laporan & Cek Bulanan" description="Periksa hasil dan kelengkapan dari aktivitas bisnis yang sama." capability="accounting.view-business-finance">
    <FinanceErrorState v-if="setup.error.value" :error="setup.error.value" @retry="setup.refresh" />
    <p v-else-if="!setup.loaded.value" role="status">
      Memuat profil accounting…
    </p>
    <template v-else>
      <AccountingSetupForm v-if="!book && session.can('accounting.manage-setup')" :pending="saveSetup.pending.value" :error="saveSetup.error.value?.message" @submit="saveSetup.run" />
      <p v-else-if="!book" class="rounded-xl border p-5">
        Profil belum dibuat. Super Admin dapat menyiapkan konfigurasi accounting.
      </p>
      <section v-else class="space-y-3 rounded-xl border bg-card p-5">
        <h2 class="text-lg font-semibold">
          {{ book.name }}
        </h2>
        <p class="text-sm">
          {{ book.purpose === 'rehearsal' ? 'Buku rehearsal — hasil percobaan' : 'Konfigurasi produksi' }} · mode {{ book.mode }} · mulai {{ book.cutoverDate }} · {{ book.currency }}
        </p>
        <p class="text-sm text-muted-foreground">
          Entitas: {{ book.entityType }} · standar: {{ book.accountingStandard }} · pajak: {{ book.taxStatus }}. Aktivasi produksi belum tersedia; saldo awal belum disahkan melalui halaman ini.
        </p>
      </section>
      <AccountingOpeningPlan
        v-if="book && openingPlan"
        :plan="openingPlan"
        :can-decide="session.can('accounting.manage-setup')"
        :pending="previewOpening.pending.value || confirmOpening.pending.value"
        :error="(confirmOpening.error.value ?? previewOpening.error.value)?.message ?? null"
        @preview="previewOpening.run"
        @confirm="submitOpening"
      />
      <nav class="flex flex-wrap gap-3 text-sm" aria-label="Aktivitas keuangan">
        <NuxtLink to="/finance/receivables" class="underline">
          Customer Bayar
        </NuxtLink>
        <NuxtLink to="/finance/payables" class="underline">
          Bayar Supplier
        </NuxtLink>
        <NuxtLink to="/finance/statement?kind=expense" class="underline">
          Catat Biaya
        </NuxtLink>
        <NuxtLink to="/finance/accounts" class="underline">
          Periksa Kas
        </NuxtLink>
      </nav>
      <div class="flex flex-wrap gap-3">
        <label class="block w-full max-w-xs text-sm">Laba dari tanggal
          <input v-model="reportFrom" type="date" required :max="asOf" class="mt-1 h-10 w-full rounded-md border bg-background px-3">
        </label>
        <label class="block w-full max-w-xs text-sm">Sampai / posisi per tanggal
          <input v-model="asOf" type="date" required class="mt-1 h-10 w-full rounded-md border bg-background px-3">
        </label>
      </div>
      <FinanceErrorState v-if="reports.error.value" :error="reports.error.value" @retry="reports.refresh" />
      <AccountingReports
        v-else-if="reports.data.value"
        :profit-loss="reports.data.value.profitLoss"
        :balance-sheet="reports.data.value.balanceSheet"
        :contribution="reports.data.value.contribution"
      />
      <p v-else-if="reportFrom > asOf" role="alert" class="text-sm text-destructive">
        Tanggal awal harus sebelum tanggal akhir.
      </p>
      <p v-else role="status">
        Memuat laba dan posisi keuangan…
      </p>
      <FinanceErrorState v-if="balance.error.value" :error="balance.error.value" @retry="balance.refresh" />
      <AccountingTrialBalance v-else-if="balance.data.value" :result="balance.data.value" />
      <p v-else role="status">
        Memuat laporan…
      </p>

      <label v-if="setup.data.value?.periods.length" class="block max-w-xs text-sm">Periode cek bulanan
        <select v-model="reviewPeriodId" class="mt-1 h-10 w-full rounded-md border bg-background px-3">
          <option v-for="p in setup.data.value.periods" :key="p.id" :value="p.id">{{ p.startsOn }} – {{ p.endsOn }} · {{ p.status }}</option>
        </select>
      </label>
      <FinanceErrorState v-if="monthly.error.value" :error="monthly.error.value" @retry="monthly.refresh" />
      <AccountingMonthlyReview
        v-else-if="monthly.data.value"
        :review="monthly.data.value"
        :can-close="session.can('accounting.close-period')"
        :pending="closeMonth.pending.value"
        :error="closeMonth.error.value?.message ?? null"
        @close="submitClose"
      />
      <p v-if="retry.error.value" role="alert" class="text-sm text-destructive">
        {{ retry.error.value.message }}
      </p>
      <section id="pekerjaan" class="space-y-3 rounded-xl border bg-card p-5">
        <h2 class="text-lg font-semibold">
          Pekerjaan accounting yang belum lengkap
        </h2>
        <FinanceErrorState v-if="exceptions.error.value" :error="exceptions.error.value" @retry="exceptions.refresh" />
        <p v-else-if="!exceptions.loaded.value" role="status">
          Memuat pekerjaan…
        </p>
        <p v-else-if="!exceptions.data.value?.data.length" class="text-sm text-muted-foreground">
          Belum ada exception sumber yang tertangkap. Ini belum membuktikan semua sumber bisnis sudah terintegrasi.
        </p>
        <ul v-else class="space-y-3 text-sm">
          <li v-for="item in exceptions.data.value.data" :key="item.id" :data-event-id="item.eventId" class="rounded-md bg-muted p-3">
            <p class="font-medium">
              {{ item.sourceId }} · {{ item.effectiveDate }}
            </p><p>{{ item.message }}</p>
            <Button
              v-if="session.can('accounting.manage-setup')"
              size="sm"
              variant="outline"
              class="mt-2"
              :disabled="retry.pending.value"
              @click="retry.run(item.eventId)"
            >
              Proses ulang setelah kebijakan dilengkapi
            </Button>
          </li>
        </ul>
        <div class="flex gap-3">
          <Button v-if="exceptionCursor" variant="outline" @click="exceptionCursor = undefined">
            Halaman pertama pekerjaan
          </Button><Button v-if="exceptions.data.value?.meta.pagination.nextCursor" variant="outline" @click="exceptionCursor = exceptions.data.value.meta.pagination.nextCursor">
            Pekerjaan berikutnya
          </Button>
        </div>
      </section>

      <details v-if="book && session.can('accounting.manage-setup')" class="space-y-4 rounded-xl border bg-card p-5">
        <summary class="cursor-pointer font-semibold">
          Pengaturan periode dan usulan kebijakan
        </summary>
        <p class="mt-4 text-sm text-muted-foreground">
          Kebijakan tersimpan sebagai draft berversi. Draft belum mengakui laba atau mengaktifkan aturan produksi.
        </p>
        <form class="mt-4 flex flex-wrap items-end gap-3" @submit.prevent="submitPeriod">
          <label class="text-sm">Awal periode<input v-model="period.startsOn" type="date" required class="mt-1 block h-10 rounded border bg-background px-3"></label>
          <label class="text-sm">Akhir periode<input v-model="period.endsOn" type="date" required class="mt-1 block h-10 rounded border bg-background px-3"></label>
          <label class="text-sm">Alasan<input v-model="period.reason" required minlength="5" maxlength="500" class="mt-1 block h-10 rounded border bg-background px-3"></label>
          <Button :disabled="savePeriod.pending.value" type="submit">
            Tambah periode
          </Button>
          <p v-if="savePeriod.error.value" role="alert" class="w-full text-sm text-destructive">
            {{ savePeriod.error.value.message }}
          </p>
        </form>
        <ul class="mt-4 space-y-1 text-sm">
          <li v-for="p in setup.data.value.periods" :key="p.id">
            {{ p.startsOn }} – {{ p.endsOn }} · {{ p.status }}
          </li>
        </ul>
        <AccountingPolicyProposalForm :purpose="book!.purpose" :pending="savePolicy.pending.value" :error="savePolicy.error.value?.message" :reset-token="policyReset" @save="submitPolicy" />
        <ul class="mt-4 space-y-2 text-sm">
          <li v-for="p in setup.data.value.policies" :key="p.id" :data-policy-id="p.id">
            {{ p.sourceKind }} · v{{ p.version }} · {{ p.validationStatus }} · {{ p.rationale }}
            <Button v-if="book?.purpose==='rehearsal' && p.validationStatus==='draft' && p.version===Math.max(...setup.data.value.policies.filter(v=>v.sourceKind===p.sourceKind).map(v=>v.version))" size="sm" variant="outline" @click="fixturePolicy=p;useFixture.reset()">
              Uji di rehearsal
            </Button>
          </li>
        </ul>
      </details>
      <form v-if="book?.purpose === 'rehearsal' && session.can('accounting.close-period')" class="space-y-3 rounded-xl border bg-card p-5" @submit.prevent="submitPeriodChange">
        <h2 class="font-semibold">
          Uji penguncian periode rehearsal
        </h2>
        <p class="text-sm text-muted-foreground">
          Penguncian menolak posting baru ke tanggal periode tersebut. Ini bukan penutupan bulanan produksi.
        </p>
        <label class="block text-sm">Periode<select v-model="periodChange.id" required class="mt-1 h-10 w-full rounded border bg-background px-3"><option value="" disabled>Pilih periode</option><option v-for="p in setup.data.value.periods" :key="p.id" :value="p.id">{{ p.startsOn }} – {{ p.endsOn }} · {{ p.status }}</option></select></label>
        <label class="block text-sm">Alasan<input v-model="periodChange.reason" required minlength="5" maxlength="500" class="mt-1 h-10 w-full rounded border bg-background px-3"></label>
        <label class="flex items-center gap-2 text-sm"><input v-model="periodChange.confirmed" required type="checkbox">Saya mengonfirmasi perubahan status periode rehearsal ini.</label>
        <Button :disabled="changePeriod.pending.value || !periodChange.confirmed || (selectedPeriod?.status === 'closed' && !session.can('accounting.reopen-period'))" type="submit">
          {{ selectedPeriod?.status === 'closed' ? 'Buka kembali periode rehearsal' : 'Kunci periode rehearsal' }}
        </Button>
        <p v-if="changePeriod.error.value" role="alert" class="text-sm text-destructive">
          {{ changePeriod.error.value.message }}
        </p>
      </form>
      <section v-if="session.can('accounting.view-posting-detail')" class="space-y-3 rounded-xl border bg-card p-5">
        <h2 class="text-lg font-semibold">
          Detail pemeriksaan
        </h2>
        <FinanceErrorState v-if="journals.error.value" :error="journals.error.value" @retry="journals.refresh" />
        <p v-else-if="!journals.loaded.value" role="status">
          Memuat jurnal…
        </p>
        <p v-else-if="!journals.data.value?.data.length" class="text-sm text-muted-foreground">
          Belum ada jurnal posted.
        </p>
        <ul v-else class="divide-y text-sm">
          <li v-for="j in journals.data.value.data" :key="j.id" class="py-3">
            <NuxtLink :to="`/finance/accounting/journals/${j.id}`" class="underline">
              {{ j.id }} · {{ j.description }}
            </NuxtLink><p>{{ j.effectiveDate }} · sumber {{ j.sourceId }} <span v-if="j.reversalOfId">· koreksi {{ j.reversalOfId }}</span></p>
          </li>
        </ul>
        <div class="flex gap-3">
          <Button v-if="cursor" variant="outline" @click="cursor = undefined">
            Halaman pertama
          </Button><Button v-if="journals.data.value?.meta.pagination.nextCursor" variant="outline" @click="cursor = journals.data.value.meta.pagination.nextCursor">
            Berikutnya
          </Button>
        </div>
      </section>
    </template>
    <Dialog v-model:open="fixtureOpen">
      <DialogContent class="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Uji usulan pada data fiktif</DialogTitle><DialogDescription>Versi TEST_ONLY untuk rehearsal terisolasi; keputusan produksi tetap terpisah.</DialogDescription></DialogHeader>
        <AccountingPolicyRehearsalForm
          v-if="fixturePolicy"
          :key="fixturePolicy.id"
          :policy="fixturePolicy"
          :pending="useFixture.pending.value"
          :error="useFixture.error.value?.message"
          @save="rehearsePolicy"
          @cancel="fixturePolicy=null"
        />
      </DialogContent>
    </Dialog>
  </FinancePage>
</template>
