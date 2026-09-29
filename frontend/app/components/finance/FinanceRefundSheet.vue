<script setup lang="ts">
import { CheckCircle2, ShieldCheck, Wallet, XCircle } from 'lucide-vue-next'
import type { RefundDetailDto } from '~/types/api'
import { formatBusinessDate, formatBusinessDateLong, formatInstant } from '~/lib/finance/dates'
import { INVOICE_TYPE_LABEL } from '~/lib/finance/labels'
import { refundTag, subjectLabel } from '~/lib/finance/refunds'
import { tierLabel } from '~/lib/finance/policy'
import { formatMoneyMinor } from '~/lib/money'

/**
 * One cancellation case: what the rule said, what was received, what is refunded and retained, and where it
 * stands — decide (approve/reject) and pay. Approval moves no money; paying does, once per submission.
 */
const props = defineProps<{ refundId: string | null }>()
const emit = defineEmits<{ 'update:refundId': [value: string | null] }>()

const api = useApi()
const session = useServerSession()
const { showToast } = useToast()
const open = computed({ get: () => !!props.refundId, set: (v: boolean) => { if (!v) { emit('update:refundId', null) } } })

const detail = useFinanceQuery(async () => (await api.finance.getRefund(props.refundId!)).data,
  { watch: [() => props.refundId], enabled: () => !!props.refundId })
const rf = computed<RefundDetailDto | null>(() => {
  const d = detail.data.value
  return d && d.id === props.refundId && d.view === 'full' ? d as RefundDetailDto : null
})
const tag = computed(() => (rf.value ? refundTag(rf.value) : null))
const paidPct = computed(() => {
  const r = rf.value
  if (!r || BigInt(r.refundableMinor) === 0n) { return 0 }
  return Number((BigInt(r.settledMinor) * 1000n) / BigInt(r.refundableMinor)) / 10
})

const showApprove = ref(false)
const showReject = ref(false)
const showSettle = ref(false)
const approveForm = reactive({ amount: '', note: '' })
watch(showApprove, (v) => {
  if (!v || !rf.value) { return }
  approve.reset()
  approveForm.amount = rf.value.calculation === 'manual' ? (rf.value.refundableMinor === '0' ? '' : rf.value.refundableMinor) : rf.value.refundableMinor
  approveForm.note = ''
})
const maxManual = computed(() => (rf.value ? (BigInt(rf.value.basisMinor) + BigInt(rf.value.otherPaidMinor)).toString() : '0'))
const approve = useFinanceAction(() => api.finance.approveRefund(rf.value!.id, {
  refundMinor: rf.value!.calculation === 'manual' ? (approveForm.amount || '0') : undefined,
  note: approveForm.note.trim() || undefined
}))
async function submitApprove () {
  if (!(await approve.run())) { return }
  showApprove.value = false
  showToast('Refund disetujui', 'Belum ada uang keluar. Bayar refund saat transfer ke customer dilakukan.')
}
const reject = useFinanceAction((reason: string) => api.finance.rejectRefund(rf.value!.id, reason))
async function submitReject (value: { reason: string }) {
  if (!(await reject.run(value.reason))) { return }
  showReject.value = false
  showToast('Refund ditolak', 'Pembatalan tetap tercatat; tidak ada refund untuk kasus ini.')
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
      <SheetHeader class="border-b border-border px-6 pb-5 pt-6 text-left">
        <SheetTitle class="sr-only">
          Detail kasus refund
        </SheetTitle>
        <SheetDescription class="sr-only">
          Pembatalan dan refund customer
        </SheetDescription>
        <div v-if="!rf" class="space-y-3" role="status" aria-label="Memuat">
          <div class="h-4 w-40 animate-pulse rounded bg-muted" />
          <div class="h-9 w-56 animate-pulse rounded bg-muted" />
        </div>
        <template v-else>
          <div class="flex flex-wrap items-center gap-2 pr-6">
            <StatusBadge v-if="tag" :label="tag.label" :tone="tag.tone" dot />
            <span class="text-xs text-muted-foreground">{{ rf.id }} · {{ subjectLabel(rf.subject) }}</span>
          </div>
          <p class="mt-3 text-base font-semibold leading-snug">
            {{ rf.party.name }}
          </p>
          <NuxtLink :to="`/project-orders/${rf.project.id}`" class="text-sm text-primary hover:underline">
            {{ rf.project.name }}
          </NuxtLink>
          <div class="mt-4 flex items-end justify-between gap-4">
            <div>
              <p class="text-xs text-muted-foreground">
                {{ rf.status === 'approved' ? 'Sisa refund yang harus dibayar' : 'Refund diajukan' }}
              </p>
              <FinanceAmount :value="rf.status === 'approved' ? rf.outstandingMinor : rf.refundableMinor" class="block text-3xl font-semibold tracking-tight" />
            </div>
            <p v-if="rf.status === 'approved'" class="text-right text-xs text-muted-foreground">
              dari refund<br><FinanceAmount :value="rf.refundableMinor" class="font-medium text-foreground" />
            </p>
          </div>
          <div v-if="rf.status === 'approved' && rf.refundableMinor !== '0'" class="mt-3">
            <div
              class="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              :aria-valuenow="paidPct"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Sudah dibayar"
            >
              <div class="h-full rounded-full bg-success" :style="{ width: `${paidPct}%` }" />
            </div>
          </div>
        </template>
      </SheetHeader>

      <FinanceErrorState v-if="detail.error.value && !rf" :error="detail.error.value" compact @retry="detail.refresh" />

      <div v-if="rf" class="flex-1 space-y-6 px-6 py-5">
        <div v-if="rf.status === 'rejected'" class="flex gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          <XCircle class="mt-0.5 h-4 w-4 shrink-0" /> Ditolak: “{{ rf.rejectReason }}”
        </div>

        <section class="space-y-2">
          <h3 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pembatalan
          </h3>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt class="text-xs text-muted-foreground">
                Dibatalkan
              </dt>
              <dd class="font-medium">
                {{ formatBusinessDateLong(rf.cancelDate) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">
                Berangkat
              </dt>
              <dd class="font-medium">
                {{ formatBusinessDate(rf.departureDate) }}<span v-if="rf.daysBefore !== null" class="text-muted-foreground"> · H{{ rf.daysBefore >= 0 ? `-${rf.daysBefore}` : `+${-rf.daysBefore}` }}</span>
              </dd>
            </div>
            <div class="col-span-2">
              <dt class="text-xs text-muted-foreground">
                Alasan
              </dt>
              <dd>“{{ rf.reason }}” <span class="text-xs text-muted-foreground">— {{ rf.requestedBy.name }}, {{ formatInstant(rf.requestedAt) }}</span></dd>
            </div>
          </dl>
        </section>

        <section class="space-y-2">
          <h3 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Perhitungan
          </h3>
          <p v-if="rf.policy" class="text-sm leading-relaxed">
            <ShieldCheck class="mr-1 inline h-4 w-4 align-[-3px] text-primary" />{{ rf.policy.name }}
            <span class="text-muted-foreground">({{ rf.policy.code }} v{{ rf.policy.version }})<template v-if="rf.tier"> · {{ tierLabel(rf.tier) }}: refund {{ rf.tier.refundBp / 100 }}%</template></span>
          </p>
          <p v-else class="text-sm text-muted-foreground">
            Manual — tanpa kebijakan otomatis.
          </p>
          <dl class="divide-y divide-border rounded-lg border border-border text-sm">
            <div class="flex justify-between gap-3 px-3 py-2">
              <dt class="text-muted-foreground">
                DP sudah diterima (basis)
              </dt>
              <dd><FinanceAmount :value="rf.basisMinor" class="font-medium" /></dd>
            </div>
            <div v-if="rf.calculation === 'policy'" class="flex justify-between gap-3 px-3 py-2">
              <dt class="text-muted-foreground">
                Refund menurut kebijakan
              </dt>
              <dd><FinanceAmount :value="rf.policyRefundMinor" class="font-medium" /></dd>
            </div>
            <div v-if="rf.additionalRefundMinor !== '0'" class="px-3 py-2">
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">
                  Refund tambahan (pengecualian)
                </dt>
                <dd><FinanceAmount :value="rf.additionalRefundMinor" class="font-medium" /></dd>
              </div>
              <p class="text-xs text-muted-foreground">
                “{{ rf.additionalReason }}”
              </p>
            </div>
            <div class="flex justify-between gap-3 px-3 py-2">
              <dt class="text-muted-foreground">
                Hangus / dipertahankan
              </dt>
              <dd><FinanceAmount :value="rf.retainedMinor" class="font-medium" /></dd>
            </div>
            <div v-if="rf.writtenOffMinor !== '0'" class="flex justify-between gap-3 px-3 py-2">
              <dt class="text-muted-foreground">
                Sisa tagihan dihapus
              </dt>
              <dd><FinanceAmount :value="rf.writtenOffMinor" class="font-medium" /></dd>
            </div>
            <div v-if="rf.otherPaidMinor !== '0'" class="flex justify-between gap-3 px-3 py-2">
              <dt class="text-muted-foreground">
                Dibayar di luar DP
              </dt>
              <dd><FinanceAmount :value="rf.otherPaidMinor" class="font-medium" /></dd>
            </div>
          </dl>
          <details v-if="rf.sourcePayments.length" class="text-sm">
            <summary class="cursor-pointer select-none text-xs font-medium text-muted-foreground">
              Asal pembayaran ({{ rf.sourcePayments.length }})
            </summary>
            <ul class="mt-2 space-y-1 text-xs">
              <li v-for="sp in rf.sourcePayments" :key="sp.transactionId + sp.invoiceId" class="flex justify-between gap-3">
                <span class="text-muted-foreground">{{ formatBusinessDate(sp.effectiveDate) }} · {{ INVOICE_TYPE_LABEL[sp.invoiceType] }} {{ sp.invoiceNumber }}</span>
                <FinanceAmount :value="sp.amountMinor" />
              </li>
            </ul>
          </details>
        </section>

        <section v-if="rf.status === 'approved'" class="space-y-2">
          <h3 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pembayaran refund
          </h3>
          <ul v-if="rf.settlements.length" class="divide-y divide-border rounded-lg border border-border text-sm">
            <li v-for="s in rf.settlements" :key="s.transactionId" class="flex items-center justify-between gap-4 px-3 py-2.5">
              <span class="min-w-0">
                <span class="block font-medium" :class="s.reversed && 'text-muted-foreground'">{{ formatBusinessDate(s.effectiveDate) }} · {{ s.account.code }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ s.reversed ? 'Dibatalkan — tidak dihitung' : (s.reference ?? s.transactionId) }}</span>
              </span>
              <FinanceAmount :value="s.amountMinor" direction="out" :muted="s.reversed" class="shrink-0 font-medium" />
            </li>
          </ul>
          <p v-else-if="rf.refundableMinor !== '0'" class="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
            Belum ada refund yang dibayar.
          </p>
          <p v-else class="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 class="h-4 w-4 text-success" /> Tidak ada refund untuk kasus ini.
          </p>
        </section>

        <section v-if="rf.creditNotes.length" class="space-y-2">
          <h3 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Dampak ke invoice
          </h3>
          <ul class="space-y-1.5 text-xs">
            <li v-for="c in rf.creditNotes" :key="c.id" class="flex justify-between gap-3">
              <span class="text-muted-foreground">{{ c.effect === 'reduce_receivable' ? 'Sisa tagihan dihapus' : 'Refund (mengurangi pendapatan)' }} · {{ c.invoice.number ?? c.invoice.id }}</span>
              <FinanceAmount :value="c.amountMinor" />
            </li>
          </ul>
        </section>

        <p v-if="rf.decidedBy && rf.status !== 'requested'" class="text-xs text-muted-foreground">
          Diputuskan {{ rf.decidedBy.name }}{{ rf.decidedAt ? `, ${formatInstant(rf.decidedAt)}` : '' }}{{ rf.decisionNote ? ` — “${rf.decisionNote}”` : '' }}
        </p>
      </div>

      <div v-if="rf && rf.status === 'requested' && session.can('finance.approve-refund')" class="grid grid-cols-2 gap-2 border-t border-border px-6 py-4">
        <Button variant="outline" class="text-destructive hover:text-destructive" @click="reject.reset(); showReject = true">
          Tolak
        </Button>
        <Button @click="showApprove = true">
          <CheckCircle2 class="mr-2 h-4 w-4" /> Setujui
        </Button>
      </div>
      <div v-else-if="rf && rf.status === 'approved' && rf.outstandingMinor !== '0' && session.can('finance.settle-refund')" class="border-t border-border px-6 py-4">
        <Button class="w-full" @click="showSettle = true">
          <Wallet class="mr-2 h-4 w-4" /> Bayar refund
        </Button>
      </div>
    </SheetContent>
  </Sheet>

  <FinanceFormDialog
    v-model:open="showApprove"
    :title="`Setujui refund ${rf?.id ?? ''}?`"
    description="Refund dicatat sebagai kewajiban ke customer dan mengurangi pendapatan project. Uang baru keluar saat refund dibayar."
    submit-label="Setujui refund"
    :pending="approve.pending.value"
    :error="approve.error.value"
    :submit-disabled="rf?.calculation === 'manual' && !approveForm.amount"
    @submit="submitApprove"
  >
    <FinanceField v-if="rf?.calculation === 'manual'" id="ap-refund" label="Nominal refund final" :error="approve.fieldError('refundMinor')" :hint="`Maksimal ${formatMoneyMinor(maxManual)} (uang yang diterima dari customer). Isi 0 bila tidak ada refund.`">
      <FinanceMoneyInput id="ap-refund" v-model="approveForm.amount" />
    </FinanceField>
    <p v-else class="text-sm">
      Refund sesuai kebijakan: <FinanceAmount :value="rf?.refundableMinor ?? null" class="font-semibold" />
    </p>
    <FinanceField id="ap-note" label="Catatan" optional>
      <FinanceTextarea id="ap-note" v-model="approveForm.note" :rows="2" maxlength="500" />
    </FinanceField>
  </FinanceFormDialog>

  <FinanceReasonDialog
    :open="showReject"
    :title="`Tolak refund ${rf?.id ?? ''}?`"
    description="Pembatalan tetap tercatat (sisa tagihan tetap dihapus), tapi tidak ada refund. Bila nominalnya yang salah, tolak lalu catat ulang pembatalannya."
    confirm-label="Tolak refund"
    tone="destructive"
    :pending="reject.pending.value"
    :error="reject.error.value"
    @update:open="v => showReject = v"
    @confirm="submitReject"
  />

  <FinanceRefundSettleDialog v-model:open="showSettle" :refund="rf" />
</template>
