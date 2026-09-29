<script setup lang="ts">
import { AlertTriangle, Info, ShieldCheck } from 'lucide-vue-next'
import { newIdempotencyKey } from '~/lib/api/client'
import type { ApiSubjectType, RefundDetailDto, RefundStatusDto } from '~/types/api'
import { formatBusinessDate, formatBusinessDateLong, todayJakarta } from '~/lib/finance/dates'
import { INVOICE_TYPE_LABEL } from '~/lib/finance/labels'
import { formatMoneyMinor } from '~/lib/money'

/**
 * Cancel a booking or a whole project. Shows the server's preview first — policy, H-x, tier, what was actually
 * received, what is refunded and retained, what unpaid billing is written off — then records the case once.
 * No money moves here: Finance approves and pays the refund later. Admin sees the rule and percentages, never
 * amounts (server-decided).
 */
const props = defineProps<{ open: boolean; subject: { type: ApiSubjectType; id: string; label: string } }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; recorded: [value: { refund: RefundDetailDto | RefundStatusDto; reason: string }] }>()

const api = useApi()
const session = useServerSession()
const { showToast } = useToast()
const today = todayJakarta()
const form = reactive({ cancelDate: today, reason: '', manual: false, proposed: '', additional: '', additionalReason: '', showException: false })
let idempotencyKey = newIdempotencyKey()

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  idempotencyKey = newIdempotencyKey()
  Object.assign(form, { cancelDate: today, reason: '', manual: false, proposed: '', additional: '', additionalReason: '', showException: false })
})

const preview = useFinanceQuery(
  async () => (await api.finance.previewCancellation({ subjectType: props.subject.type, subjectId: props.subject.id, cancelDate: form.cancelDate })).data,
  { watch: [() => props.open, () => form.cancelDate, () => props.subject.id], enabled: () => props.open && !!form.cancelDate }
)
const p = computed(() => preview.data.value)
const full = computed(() => (p.value?.view === 'full' ? p.value : null))
const hardBlock = computed(() => p.value?.blockers.find(b => b.code === 'ACTIVE_CASE' || b.code === 'OVERLAPPING_CASE') ?? null)
const needsManual = computed(() => !!p.value && !p.value.canCalculate && !hardBlock.value)
const useManual = computed(() => needsManual.value || form.manual)
const isFinance = computed(() => session.can('finance.view-project-finance'))

// Inline policy assignment (Finance) when none is set yet.
const canAssign = computed(() => session.can('finance.manage-policy') && !!p.value?.blockers.some(b => b.code === 'NO_POLICY'))
const policies = useFinanceQuery(async () => (await api.finance.subjectPolicy(props.subject.type, props.subject.id)).data,
  { watch: [canAssign], enabled: () => props.open && canAssign.value })
const chosenPolicy = ref<string | null>(null)
const assign = useFinanceAction(() => api.finance.assignPolicy(props.subject.type, props.subject.id, { policyId: chosenPolicy.value! }))
async function assignPolicy () {
  if (!chosenPolicy.value) { return }
  if (await assign.run()) { showToast('Kebijakan ditetapkan', 'Pratinjau dihitung ulang dengan kebijakan itu.') }
}

const refundTotal = computed(() => {
  const f = full.value
  if (!f) { return null }
  if (useManual.value) { return form.proposed || '0' }
  return (BigInt(f.policyRefundMinor) + BigInt(form.additional || '0')).toString()
})

const action = useFinanceAction(() => api.finance.createCancellation({
  subjectType: props.subject.type,
  subjectId: props.subject.id,
  cancelDate: form.cancelDate,
  reason: form.reason.trim(),
  calculation: useManual.value ? 'manual' : 'policy',
  proposedRefundMinor: useManual.value && isFinance.value && form.proposed ? form.proposed : undefined,
  additionalRefundMinor: !useManual.value && form.showException && form.additional ? form.additional : undefined,
  additionalReason: !useManual.value && form.showException && form.additional ? form.additionalReason.trim() : undefined
}, idempotencyKey))

async function submit () {
  const res = await action.run()
  if (!res) { return }
  const refund = res.data
  showToast('Pembatalan dicatat', refund.status === 'approved'
    ? 'Tidak ada refund menurut kebijakan; kasus langsung selesai.'
    : `Kasus ${refund.id} menunggu persetujuan Finance. Belum ada uang yang keluar.`)
  emit('recorded', { refund, reason: form.reason.trim() })
  emit('update:open', false)
}

const disabled = computed(() => !p.value || !!hardBlock.value || form.reason.trim().length < 5 ||
  (form.showException && !!form.additional && form.additionalReason.trim().length < 5))
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="`Batalkan ${subject.label}`"
    description="Pratinjau dihitung dari kebijakan pembatalan dan uang yang benar-benar sudah diterima. Tidak ada uang yang keluar sampai refund disetujui dan dibayar Finance."
    submit-label="Catat pembatalan"
    tone="destructive"
    size="lg"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="disabled"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid gap-4 sm:grid-cols-[12rem_1fr] sm:items-end">
      <FinanceField id="cx-date" label="Tanggal pembatalan" :error="action.fieldError('cancelDate')">
        <FinanceDateInput id="cx-date" v-model="form.cancelDate" :max="today" />
      </FinanceField>
      <p v-if="p?.subject.departureDate" class="pb-2 text-sm text-muted-foreground">
        Berangkat {{ formatBusinessDateLong(p.subject.departureDate) }}
        <span v-if="p.daysBefore !== null" class="font-semibold text-foreground">· {{ p.daysBefore > 0 ? `H-${p.daysBefore}` : p.daysBefore === 0 ? 'hari keberangkatan' : `${-p.daysBefore} hari sesudah berangkat` }}</span>
      </p>
    </div>

    <div v-if="!p && !preview.error.value" class="space-y-2" role="status" aria-label="Menghitung pratinjau">
      <div class="h-20 animate-pulse rounded-lg bg-muted" />
      <div class="h-28 animate-pulse rounded-lg bg-muted" />
    </div>
    <FinanceErrorState v-else-if="preview.error.value && !p" :error="preview.error.value" compact @retry="preview.refresh" />

    <template v-else-if="p">
      <div v-if="hardBlock" class="flex gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive" role="alert">
        <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" /> {{ hardBlock.message }}
      </div>

      <!-- Policy -->
      <section v-if="p.policy" class="space-y-2">
        <p class="flex items-center gap-1.5 text-[13px] font-medium">
          <ShieldCheck class="h-4 w-4 text-primary" /> {{ p.policy.name }} <span class="font-normal text-muted-foreground">({{ p.policy.code }} v{{ p.policy.version }})</span>
        </p>
        <FinancePolicyTiers :tiers="p.policy.tiers" :active="p.tier" compact />
      </section>
      <div v-for="b in p.blockers.filter(x => x.code === 'NO_POLICY' || x.code === 'NO_DEPARTURE_DATE')" :key="b.code" class="flex gap-2 rounded-lg bg-warning/10 px-3 py-2.5 text-sm">
        <Info class="mt-0.5 h-4 w-4 shrink-0 text-warning" /> <span>{{ b.message }}</span>
      </div>
      <div v-if="canAssign && policies.data.value?.assignable.length" class="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-end">
        <FinanceField id="cx-policy" label="Tetapkan kebijakan sekarang" class="flex-1">
          <FinanceSelect
            id="cx-policy"
            v-model="chosenPolicy"
            :options="policies.data.value.assignable.map(x => ({ value: x.id, label: `${x.name} (${x.code} v${x.version})` }))"
            placeholder="Pilih kebijakan"
          />
        </FinanceField>
        <Button type="button" variant="outline" :disabled="!chosenPolicy || assign.pending.value" @click="assignPolicy">
          Tetapkan
        </Button>
      </div>

      <!-- Figures: Finance -->
      <section v-if="full && !hardBlock" class="space-y-3">
        <dl class="grid grid-cols-2 gap-3 rounded-xl border border-border p-4 text-sm sm:grid-cols-3">
          <div>
            <dt class="text-xs text-muted-foreground">
              DP sudah diterima
            </dt>
            <dd><FinanceAmount :value="full.basisMinor" class="font-semibold" /></dd>
          </div>
          <div v-if="!useManual">
            <dt class="text-xs text-muted-foreground">
              Refund ({{ (p.tier?.refundBp ?? 0) / 100 }}%)
            </dt>
            <dd><FinanceAmount :value="full.policyRefundMinor" class="font-semibold text-success" /></dd>
          </div>
          <div v-if="!useManual">
            <dt class="text-xs text-muted-foreground">
              Hangus / dipertahankan
            </dt>
            <dd><FinanceAmount :value="full.retainedMinor" class="font-semibold" /></dd>
          </div>
          <div v-if="full.writeOffMinor !== '0'" class="col-span-2 sm:col-span-3">
            <dt class="text-xs text-muted-foreground">
              Sisa tagihan yang dihapus (belum dibayar customer)
            </dt>
            <dd class="text-sm">
              <FinanceAmount :value="full.writeOffMinor" class="font-semibold" /> dari {{ full.writeOffs.length }} invoice
            </dd>
          </div>
        </dl>

        <ul class="space-y-1 text-xs text-muted-foreground">
          <li v-if="full.otherPaidMinor !== '0'">
            • Pembayaran di luar DP <FinanceAmount :value="full.otherPaidMinor" class="font-medium text-foreground" /> tidak termasuk basis kebijakan; bisa di-refund sebagai pengecualian beralasan.
          </li>
          <li v-if="p.plannedBillingCount">
            • {{ p.plannedBillingCount }} rencana tagihan akan dibatalkan.
          </li>
          <li v-if="p.draftInvoiceCount">
            • {{ p.draftInvoiceCount }} draft invoice tetap ada; hapus bila tidak dipakai.
          </li>
          <li v-if="full.unallocatedAdvanceMinor !== '0'">
            • Ada uang muka project <FinanceAmount :value="full.unallocatedAdvanceMinor" class="font-medium text-foreground" /> yang belum dialokasikan ke invoice — tidak ikut dihitung.
          </li>
          <li v-if="full.vendorOpenCount">
            • {{ full.vendorOpenCount }} invoice vendor masih terbuka (<FinanceAmount :value="full.vendorOpenMinor" />). Penalti/refund vendor dicatat terpisah, tidak di-netting.
          </li>
        </ul>

        <details v-if="full.sourcePayments.length" class="rounded-lg border border-border px-3 py-2 text-sm">
          <summary class="cursor-pointer select-none text-[13px] font-medium text-muted-foreground">
            Asal pembayaran ({{ full.sourcePayments.length }})
          </summary>
          <ul class="mt-2 divide-y divide-border">
            <li v-for="sp in full.sourcePayments" :key="sp.transactionId + sp.invoiceId" class="flex items-center justify-between gap-3 py-1.5 text-xs">
              <span>{{ formatBusinessDate(sp.effectiveDate) }} · {{ INVOICE_TYPE_LABEL[sp.invoiceType] }} {{ sp.invoiceNumber }} · {{ sp.transactionId }}</span>
              <FinanceAmount :value="sp.amountMinor" class="font-medium" />
            </li>
          </ul>
        </details>

        <!-- Manual / exception -->
        <div v-if="useManual" class="space-y-2 rounded-lg border border-border p-3">
          <p class="text-sm font-medium">
            Refund ditentukan manual
          </p>
          <p class="text-xs text-muted-foreground">
            Maksimal yang bisa dikembalikan: <FinanceAmount :value="full.maxRefundableMinor" class="font-medium text-foreground" />. Nominal final ditetapkan saat persetujuan.
          </p>
          <FinanceField id="cx-proposed" label="Usulan nominal refund" optional :error="action.fieldError('proposedRefundMinor')">
            <FinanceMoneyInput id="cx-proposed" v-model="form.proposed" />
          </FinanceField>
        </div>
        <template v-else>
          <button v-if="!form.showException" type="button" class="text-xs font-medium text-primary hover:underline" @click="form.showException = true">
            + Tambah refund di luar kebijakan (pengecualian)
          </button>
          <div v-else class="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
            <FinanceField id="cx-additional" label="Refund tambahan" :error="action.fieldError('additionalRefundMinor')">
              <FinanceMoneyInput id="cx-additional" v-model="form.additional" />
            </FinanceField>
            <FinanceField id="cx-additional-reason" label="Alasan pengecualian" :error="action.fieldError('additionalReason')">
              <Input id="cx-additional-reason" v-model="form.additionalReason" class="h-10" maxlength="500" placeholder="mis. Goodwill, disetujui direksi" />
            </FinanceField>
          </div>
        </template>
      </section>

      <!-- Status view (Admin) -->
      <p v-else-if="p.view === 'status' && !hardBlock" class="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
        <template v-if="p.tier">
          Sesuai kebijakan, customer mendapat refund {{ p.tier.refundBp / 100 }}% dari DP yang sudah dibayar. Nominalnya dihitung dan dibayar tim Finance.
        </template>
        <template v-else>
          Refund belum bisa dihitung otomatis. Tim Finance menentukan nominalnya saat menyetujui.
        </template>
        <template v-if="p.writeOffInvoiceCount">
          Sisa tagihan yang belum dibayar ({{ p.writeOffInvoiceCount }} invoice) dihapus.
        </template>
      </p>

      <FinanceField id="cx-reason" label="Alasan pembatalan" :error="action.fieldError('reason')" hint="Minimal 5 karakter. Tersimpan di jejak audit.">
        <FinanceTextarea id="cx-reason" v-model="form.reason" :rows="2" maxlength="500" placeholder="mis. Customer membatalkan perjalanan karena perubahan jadwal internal" />
      </FinanceField>
      <label v-if="isFinance && !needsManual && !hardBlock" class="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <Checkbox v-model="form.manual" /> Tentukan refund manual (abaikan kebijakan)
      </label>
    </template>

    <template v-if="refundTotal !== null && !hardBlock" #summary>
      <div class="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span class="text-muted-foreground">Refund yang diajukan</span>
        <FinanceAmount :value="refundTotal" class="text-base font-semibold" />
      </div>
      <p class="mt-1 text-xs text-muted-foreground">
        Belum ada uang keluar. {{ useManual ? 'Finance menetapkan nominal final saat menyetujui.' : refundTotal === '0' ? 'Tanpa refund, kasus langsung selesai.' : `Setelah disetujui, Finance membayar ${formatMoneyMinor(refundTotal)} dari rekening perusahaan.` }}
      </p>
    </template>
  </FinanceFormDialog>
</template>
