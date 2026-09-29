<script setup lang="ts">
import { CalendarClock, CheckCircle2, FileText, Pencil, Undo2, Wallet, XCircle } from 'lucide-vue-next'
import type { VendorInvoiceDetailDto } from '~/types/api'
import { MATCH_LABEL, vendorInvoiceTag } from '~/lib/finance/labels'
import { dueInfo, formatBusinessDate, formatBusinessDateLong, formatInstant, todayJakarta } from '~/lib/finance/dates'
import { getUserById } from '~/data'

/**
 * One vendor invoice: review (approve with the match result, or reject), then pay. Approval makes it payable
 * but moves no money; paying records the money out and settles the invoice.
 */
const props = defineProps<{ invoiceId: string | null }>()
const emit = defineEmits<{ 'update:invoiceId': [value: string | null] }>()

const api = useApi()
const session = useServerSession()
const { showToast } = useToast()
const today = todayJakarta()
const open = computed({ get: () => !!props.invoiceId, set: (v: boolean) => { if (!v) { emit('update:invoiceId', null) } } })

const detail = useFinanceQuery(async () => (await api.finance.getVendorInvoice(props.invoiceId!)).data,
  { watch: [() => props.invoiceId], enabled: () => !!props.invoiceId })
const inv = computed<VendorInvoiceDetailDto | null>(() => (detail.data.value?.id === props.invoiceId ? detail.data.value : null))

const canManage = computed(() => session.can('finance.manage-payables'))
const canPost = computed(() => session.can('finance.post-cash'))
const tag = computed(() => (inv.value ? vendorInvoiceTag(inv.value) : null))
const inReview = computed(() => inv.value?.status === 'submitted' || inv.value?.status === 'under_review')
const payable = computed(() => inv.value?.status === 'approved' && BigInt(inv.value.outstandingMinor) > 0n)
const due = computed(() => (inv.value ? dueInfo(inv.value.dueDate, today, !payable.value) : null))
const paidPct = computed(() => {
  const i = inv.value
  if (!i || BigInt(i.totalMinor) === 0n) { return 0 }
  return Number((BigInt(i.paidMinor) * 1000n) / BigInt(i.totalMinor)) / 10
})
const reviewer = computed(() => (inv.value?.reviewedBy ? (getUserById(inv.value.reviewedBy)?.name ?? inv.value.reviewedBy) : null))

const showEdit = ref(false)
const showPayment = ref(false)
const showApprove = ref(false)
const approveForm = reactive({ matchStatus: 'matched' as 'matched' | 'unmatched' | 'disputed', note: '' })
watch(showApprove, (v) => {
  if (!v) { return }
  approveAction.reset()
  approveForm.matchStatus = inv.value?.matchStatus ?? 'matched'
  approveForm.note = ''
})
const approveAction = useFinanceAction(() => api.finance.reviewVendorInvoice(inv.value!.id, { action: 'approve', matchStatus: approveForm.matchStatus, note: approveForm.note.trim() || undefined }))
async function approve () {
  if (!(await approveAction.run())) { return }
  showApprove.value = false
  showToast('Invoice vendor disetujui', `${inv.value?.vendorInvoiceNumber} siap dibayar.`)
}
const matchOptions = (Object.keys(MATCH_LABEL) as (keyof typeof MATCH_LABEL)[]).map(k => ({ value: k, label: MATCH_LABEL[k] }))

type ReasonKind = 'reject' | 'void' | 'expect'
const reasonKind = ref<ReasonKind | null>(null)
const reasonConfig = computed(() => {
  const i = inv.value
  if (!i || !reasonKind.value) { return null }
  if (reasonKind.value === 'reject') { return { title: `Tolak invoice ${i.vendorInvoiceNumber}?`, description: 'Invoice yang ditolak tidak akan dibayar. Vendor perlu mengirim invoice yang benar.', confirm: 'Tolak invoice', tone: 'destructive' as const } }
  if (reasonKind.value === 'void') { return { title: `Batalkan invoice ${i.vendorInvoiceNumber}?`, description: 'Invoice yang sudah disetujui tapi belum dibayar tidak lagi dihitung sebagai utang.', confirm: 'Batalkan invoice', tone: 'destructive' as const } }
  return { title: 'Perkiraan tanggal bayar', description: 'Kapan invoice ini direncanakan dibayar. Dipakai untuk proyeksi kas; jatuh tempo vendor tidak berubah.', confirm: 'Simpan perkiraan', dateLabel: 'Rencana dibayar', dateOptional: true, initialDate: i.expectedDate }
})
const reasonAction = useFinanceAction((value: { reason: string; date: string | null }): Promise<unknown> => {
  const i = inv.value!
  if (reasonKind.value === 'reject') { return api.finance.reviewVendorInvoice(i.id, { action: 'reject', reason: value.reason }) }
  if (reasonKind.value === 'void') { return api.finance.voidVendorInvoice(i.id, value.reason) }
  return api.finance.setVendorInvoiceExpectation(i.id, value.date, value.reason)
})
async function confirmReason (value: { reason: string; date: string | null }) {
  const label = reasonConfig.value?.confirm ?? ''
  if (!(await reasonAction.run(value))) { return }
  reasonKind.value = null
  showToast('Tersimpan', `${label} berhasil.`)
}
function openReason (kind: ReasonKind) { reasonAction.reset(); reasonKind.value = kind }
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
      <SheetHeader class="border-b border-border px-6 pb-5 pt-6 text-left">
        <SheetTitle class="sr-only">
          Detail invoice vendor
        </SheetTitle>
        <SheetDescription class="sr-only">
          Rincian tagihan dari vendor
        </SheetDescription>
        <div v-if="!inv" class="space-y-3" role="status" aria-label="Memuat">
          <div class="h-4 w-40 animate-pulse rounded bg-muted" />
          <div class="h-9 w-56 animate-pulse rounded bg-muted" />
        </div>
        <template v-else>
          <div class="flex flex-wrap items-center gap-2 pr-6">
            <StatusBadge v-if="tag" :label="tag.label" :tone="tag.tone" dot />
            <span class="text-xs text-muted-foreground">{{ inv.vendorInvoiceNumber }}</span>
          </div>
          <p class="mt-3 text-base font-semibold leading-snug">
            {{ inv.vendor.name }}
          </p>
          <NuxtLink v-if="inv.project" :to="`/project-orders/${inv.project.id}`" class="text-sm text-primary hover:underline">
            {{ inv.project.name ?? inv.project.id }}
          </NuxtLink>
          <div class="mt-4 flex items-end justify-between gap-4">
            <div>
              <p class="text-xs text-muted-foreground">
                {{ inv.status === 'approved' ? 'Sisa yang harus dibayar' : 'Total tagihan' }}
              </p>
              <FinanceAmount :value="inv.status === 'approved' ? inv.outstandingMinor : inv.totalMinor" :currency="inv.currency" class="block text-3xl font-semibold tracking-tight" />
            </div>
            <p v-if="inv.status === 'approved'" class="text-right text-xs text-muted-foreground">
              dari total<br><FinanceAmount :value="inv.totalMinor" class="font-medium text-foreground" />
            </p>
          </div>
          <div v-if="inv.status === 'approved'" class="mt-3">
            <div
              class="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              :aria-valuenow="paidPct"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Terbayar"
            >
              <div class="h-full rounded-full bg-success" :style="{ width: `${paidPct}%` }" />
            </div>
            <p class="mt-1.5 text-xs text-muted-foreground">
              Dibayar <FinanceAmount :value="inv.paidMinor" class="font-medium text-foreground" />
            </p>
          </div>
        </template>
      </SheetHeader>

      <FinanceErrorState v-if="detail.error.value && !inv" :error="detail.error.value" compact @retry="detail.refresh" />

      <div v-if="inv" class="flex-1 space-y-6 px-6 py-5">
        <div v-if="inReview" class="rounded-lg border border-chart-5/25 bg-chart-5/5 px-3 py-2.5 text-sm">
          Periksa invoice ini terhadap order/booking-nya. Setelah disetujui, invoice masuk daftar yang harus dibayar.
        </div>
        <div v-if="inv.status === 'rejected'" class="flex gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          <XCircle class="mt-0.5 h-4 w-4 shrink-0" /> Ditolak: “{{ inv.rejectedReason }}”
        </div>
        <div v-if="inv.status === 'void'" class="flex gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          <Undo2 class="mt-0.5 h-4 w-4 shrink-0" /> Dibatalkan: “{{ inv.voidReason }}”
        </div>

        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt class="text-xs text-muted-foreground">
              Tanggal invoice
            </dt>
            <dd class="font-medium">
              {{ formatBusinessDate(inv.invoiceDate) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Jatuh tempo
            </dt>
            <dd class="font-medium">
              {{ formatBusinessDate(inv.dueDate) }}
              <span v-if="due && due.tone !== 'muted'" class="block text-xs font-normal" :class="due.tone === 'destructive' ? 'text-destructive' : 'text-warning'">{{ due.label }}</span>
            </dd>
          </div>
          <div v-if="inv.matchStatus">
            <dt class="text-xs text-muted-foreground">
              Kecocokan
            </dt>
            <dd class="font-medium">
              {{ MATCH_LABEL[inv.matchStatus] }}
            </dd>
          </div>
          <div v-if="inv.serviceOrderId">
            <dt class="text-xs text-muted-foreground">
              Service order
            </dt>
            <dd class="font-medium">
              <NuxtLink :to="`/procurement/service-orders/${inv.serviceOrderId}`" class="text-primary hover:underline">
                {{ inv.serviceOrderId }}
              </NuxtLink>
            </dd>
          </div>
          <div v-if="reviewer" class="col-span-2">
            <dt class="text-xs text-muted-foreground">
              Direview
            </dt>
            <dd class="font-medium">
              {{ reviewer }}<span v-if="inv.reviewedAt" class="font-normal text-muted-foreground"> · {{ formatInstant(inv.reviewedAt) }}</span>
              <span v-if="inv.reviewNote" class="block text-xs font-normal text-muted-foreground">“{{ inv.reviewNote }}”</span>
            </dd>
          </div>
          <div v-if="inv.expectedDate" class="col-span-2 rounded-lg bg-muted/50 px-3 py-2">
            <dt class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock class="h-3.5 w-3.5" /> Rencana dibayar
            </dt>
            <dd class="font-medium">
              {{ formatBusinessDateLong(inv.expectedDate) }}
              <span v-if="inv.expectedReason" class="block text-xs font-normal text-muted-foreground">“{{ inv.expectedReason }}”</span>
            </dd>
          </div>
        </dl>

        <section v-if="inv.status === 'approved' || inv.payments.length">
          <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pembayaran
          </h3>
          <ul v-if="inv.payments.length" class="divide-y divide-border rounded-lg border border-border text-sm">
            <li v-for="p in inv.payments" :key="p.transactionId" class="flex items-center justify-between gap-4 px-3 py-2.5">
              <span class="min-w-0">
                <span class="block font-medium" :class="p.reversed && 'text-muted-foreground'">{{ formatBusinessDate(p.effectiveDate) }} · {{ p.account.code }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ p.reversed ? 'Dibatalkan — tidak dihitung' : (p.reference ?? p.transactionId) }}</span>
              </span>
              <FinanceAmount :value="p.amountMinor" direction="out" :muted="p.reversed" class="shrink-0 font-medium" />
            </li>
          </ul>
          <p v-else class="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
            Belum ada pembayaran.
          </p>
        </section>

        <p v-if="inv.notes" class="rounded-lg bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
          <FileText class="mr-1 inline h-3.5 w-3.5" /> {{ inv.notes }}
        </p>
      </div>

      <div v-if="inv && (canManage || canPost) && (inReview || inv.status === 'approved')" class="space-y-2 border-t border-border px-6 py-4">
        <template v-if="inReview && canManage">
          <Button class="w-full" @click="showApprove = true">
            <CheckCircle2 class="mr-2 h-4 w-4" /> Setujui untuk dibayar
          </Button>
          <div class="grid grid-cols-2 gap-2">
            <Button variant="outline" @click="showEdit = true">
              <Pencil class="mr-2 h-4 w-4" /> Ubah
            </Button>
            <Button variant="outline" class="text-destructive hover:text-destructive" @click="openReason('reject')">
              Tolak
            </Button>
          </div>
        </template>
        <template v-else-if="inv.status === 'approved'">
          <Button v-if="payable && canPost" class="w-full" @click="showPayment = true">
            <Wallet class="mr-2 h-4 w-4" /> Bayar invoice ini
          </Button>
          <div v-if="canManage && payable" class="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" @click="openReason('expect')">
              <CalendarClock class="mr-1.5 h-4 w-4" /> Rencana bayar
            </Button>
            <Button variant="outline" size="sm" class="text-destructive hover:text-destructive" :disabled="inv.paidMinor !== '0'" @click="openReason('void')">
              Batalkan
            </Button>
          </div>
          <p v-if="canManage && payable && inv.paidMinor !== '0'" class="text-xs text-muted-foreground">
            Sudah ada pembayaran — untuk membatalkan, batalkan dulu pembayarannya di Mutasi Rekening.
          </p>
        </template>
      </div>
    </SheetContent>
  </Sheet>

  <FinanceFormDialog
    v-model:open="showApprove"
    :title="`Setujui ${inv?.vendorInvoiceNumber ?? ''}?`"
    description="Setelah disetujui, invoice masuk daftar utang yang harus dibayar. Belum ada uang yang keluar."
    submit-label="Setujui"
    :pending="approveAction.pending.value"
    :error="approveAction.error.value"
    :submit-disabled="approveForm.matchStatus === 'disputed'"
    @submit="approve"
  >
    <FinanceField id="ap-match" label="Hasil pencocokan dengan order/booking" :error="approveAction.fieldError('matchStatus')">
      <FinanceSelect id="ap-match" :model-value="approveForm.matchStatus" :options="matchOptions" @update:model-value="v => v && (approveForm.matchStatus = v as typeof approveForm.matchStatus)" />
    </FinanceField>
    <p v-if="approveForm.matchStatus === 'disputed'" class="text-xs font-medium text-destructive" role="alert">
      Invoice yang tidak cocok tidak bisa disetujui. Tolak invoice ini atau selesaikan dulu dengan vendor.
    </p>
    <FinanceField id="ap-note" label="Catatan review" optional>
      <FinanceTextarea id="ap-note" v-model="approveForm.note" :rows="2" maxlength="1000" placeholder="mis. Sesuai rooming list final" />
    </FinanceField>
  </FinanceFormDialog>

  <FinanceReasonDialog
    v-if="reasonConfig"
    :open="!!reasonKind"
    :title="reasonConfig.title"
    :description="reasonConfig.description"
    :confirm-label="reasonConfig.confirm"
    :tone="reasonConfig.tone ?? 'default'"
    :date-label="reasonConfig.dateLabel"
    :date-optional="reasonConfig.dateOptional"
    :initial-date="reasonConfig.initialDate ?? null"
    :pending="reasonAction.pending.value"
    :error="reasonAction.error.value"
    @update:open="v => { if (!v) reasonKind = null }"
    @confirm="confirmReason"
  />

  <FinanceVendorInvoiceDialog v-model:open="showEdit" :invoice="inv" />
  <FinanceVendorPaymentDialog v-model:open="showPayment" :vendor-id="inv?.vendor.id" :vendor-invoice-id="inv?.id" />
</template>
