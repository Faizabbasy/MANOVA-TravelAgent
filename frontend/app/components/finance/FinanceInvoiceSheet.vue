<script setup lang="ts">
import { AlertTriangle, CalendarClock, FileText, Pencil, Scale, Send, Trash2, Undo2, Wallet } from 'lucide-vue-next'
import type { CustomerInvoiceDetailDto } from '~/types/api'
import { customerInvoiceTag, INVOICE_TYPE_LABEL } from '~/lib/finance/labels'
import { dueInfo, formatBusinessDate, formatBusinessDateLong, shiftDate, todayJakarta } from '~/lib/finance/dates'
import { formatMoneyMinor } from '~/lib/money'

/**
 * One customer invoice: what is owed, what was paid and how, and the next action for its state. Draft → edit /
 * issue / delete. Issued → record payment, promised date, credit note, dispute, void. Every figure is the
 * server's; this panel never re-computes a balance.
 */
const props = defineProps<{ invoiceId: string | null }>()
const emit = defineEmits<{ 'update:invoiceId': [value: string | null] }>()

const api = useApi()
const session = useServerSession()
const { showToast } = useToast()
const today = todayJakarta()
const open = computed({ get: () => !!props.invoiceId, set: (v: boolean) => { if (!v) { emit('update:invoiceId', null) } } })

const detail = useFinanceQuery(async () => (await api.finance.getCustomerInvoice(props.invoiceId!)).data,
  { watch: [() => props.invoiceId], enabled: () => !!props.invoiceId })
const inv = computed<CustomerInvoiceDetailDto | null>(() => (detail.data.value?.id === props.invoiceId ? detail.data.value : null))

const canManage = computed(() => session.can('finance.manage-receivables'))
const canPost = computed(() => session.can('finance.post-cash'))
const tag = computed(() => (inv.value ? customerInvoiceTag(inv.value) : null))
const paidPct = computed(() => {
  const i = inv.value
  if (!i || BigInt(i.totalMinor) === 0n) { return 0 }
  return Number(((BigInt(i.paidMinor) + BigInt(i.creditedMinor)) * 1000n) / BigInt(i.totalMinor)) / 10
})
const due = computed(() => (inv.value ? dueInfo(inv.value.dueDate, today, inv.value.settlement === 'paid' || inv.value.settlement === 'credited') : dueInfo(null, today)))
const isOpenIssued = computed(() => inv.value?.status === 'issued' && BigInt(inv.value.outstandingMinor) > 0n)

// ── Dialog state ─────────────────────────────────────────────────────────────────────────────────────────
const showEdit = ref(false)
const showPayment = ref(false)
const showIssue = ref(false)
const showDelete = ref(false)
type ReasonKind = 'void' | 'dispute' | 'undispute' | 'expect' | 'credit' | `voidCredit:${string}`
const reasonKind = ref<ReasonKind | null>(null)

const issueForm = reactive({ issueDate: today, dueDate: '' })
watch(showIssue, (v) => {
  if (!v || !inv.value) { return }
  issueAction.reset()
  issueForm.issueDate = today
  issueForm.dueDate = inv.value.dueDate ?? shiftDate(today, 14)
})
const issueAction = useFinanceAction(() => api.finance.issueInvoice(inv.value!.id, { issueDate: issueForm.issueDate, dueDate: issueForm.dueDate }))
async function issue () {
  const res = await issueAction.run()
  if (!res) { return }
  showIssue.value = false
  showToast('Invoice diterbitkan', `${res.data.number} kini tercatat sebagai tagihan ke ${res.data.party.name}.`)
  for (const w of res.meta.warnings ?? []) { showToast('Perlu diperhatikan', w.message, 'warning') }
}

const deleteAction = useFinanceAction(() => api.finance.deleteInvoiceDraft(inv.value!.id))
async function removeDraft () {
  if (!(await deleteAction.run())) { return }
  showDelete.value = false
  showToast('Draft dihapus', 'Draft invoice sudah dihapus.')
  emit('update:invoiceId', null)
}

const reasonConfig = computed(() => {
  const i = inv.value
  const k = reasonKind.value
  if (!i || !k) { return null }
  if (k === 'void') {
    return { title: `Batalkan invoice ${i.number ?? ''}?`, description: 'Invoice yang dibatalkan tidak lagi dihitung sebagai tagihan. Invoice yang sudah ada pembayarannya tidak bisa dibatalkan — gunakan credit note.', confirm: 'Batalkan invoice', tone: 'destructive' as const }
  }
  if (k === 'dispute') { return { title: 'Tandai invoice sebagai sengketa', description: 'Customer mempersoalkan tagihan ini. Invoice tetap tercatat, tapi ditandai agar tidak ditagih seperti biasa.', confirm: 'Tandai sengketa' } }
  if (k === 'undispute') { return { title: 'Selesaikan sengketa', description: 'Tagihan kembali ditagih seperti biasa.', confirm: 'Selesaikan sengketa' } }
  if (k === 'expect') {
    return { title: 'Perkiraan tanggal bayar', description: 'Tanggal yang dijanjikan customer. Dipakai untuk proyeksi kas; jatuh tempo resmi tidak berubah.', confirm: 'Simpan perkiraan', dateLabel: 'Perkiraan dibayar', dateOptional: true, initialDate: i.expectedDate }
  }
  if (k === 'credit') {
    return { title: 'Terbitkan credit note', description: `Mengurangi sisa tagihan tanpa uang keluar (mis. diskon atau kompensasi). Maksimal sisa tagihan: ${formatMoneyMinor(i.outstandingMinor)}.`, confirm: 'Terbitkan credit note', amountLabel: 'Nominal pengurang' }
  }
  return { title: 'Batalkan credit note?', description: 'Sisa tagihan invoice bertambah kembali sebesar credit note ini.', confirm: 'Batalkan credit note', tone: 'destructive' as const }
})

const reasonAction = useFinanceAction((value: { reason: string; date: string | null; amount: string }): Promise<unknown> => {
  const i = inv.value!
  const k = reasonKind.value!
  if (k === 'void') { return api.finance.voidInvoice(i.id, value.reason) }
  if (k === 'dispute' || k === 'undispute') { return api.finance.setInvoiceDispute(i.id, k === 'dispute', value.reason) }
  if (k === 'expect') { return api.finance.setInvoiceExpectation(i.id, value.date, value.reason) }
  if (k === 'credit') { return api.finance.issueCreditNote({ invoiceId: i.id, amountMinor: value.amount, reason: value.reason }) }
  return api.finance.voidCreditNote(k.slice('voidCredit:'.length), value.reason)
})
async function confirmReason (value: { reason: string; date: string | null; amount: string }) {
  const title = reasonConfig.value?.confirm ?? ''
  if (!(await reasonAction.run(value))) { return }
  reasonKind.value = null
  showToast('Tersimpan', `${title} berhasil.`)
}
function openReason (kind: ReasonKind) {
  reasonAction.reset()
  reasonKind.value = kind
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
      <SheetHeader class="border-b border-border px-6 pb-5 pt-6 text-left">
        <SheetTitle class="sr-only">
          Detail invoice
        </SheetTitle>
        <SheetDescription class="sr-only">
          Rincian tagihan customer
        </SheetDescription>
        <div v-if="!inv" class="space-y-3" role="status" aria-label="Memuat">
          <div class="h-4 w-40 animate-pulse rounded bg-muted" />
          <div class="h-9 w-56 animate-pulse rounded bg-muted" />
          <div class="h-2 w-full animate-pulse rounded bg-muted" />
        </div>
        <template v-else>
          <div class="flex flex-wrap items-center gap-2 pr-6">
            <StatusBadge v-if="tag" :label="tag.label" :tone="tag.tone" dot />
            <span class="text-xs text-muted-foreground">{{ INVOICE_TYPE_LABEL[inv.invoiceType] }} · {{ inv.number ?? 'Belum bernomor' }}</span>
          </div>
          <p class="mt-3 text-base font-semibold leading-snug">
            {{ inv.party.name }}
          </p>
          <NuxtLink :to="`/project-orders/${inv.project.id}`" class="text-sm text-primary hover:underline">
            {{ inv.project.name }}
          </NuxtLink>

          <div class="mt-4 flex items-end justify-between gap-4">
            <div>
              <p class="text-xs text-muted-foreground">
                {{ inv.status === 'draft' ? 'Total draft' : 'Sisa tagihan' }}
              </p>
              <FinanceAmount :value="inv.status === 'draft' ? inv.totalMinor : inv.outstandingMinor" :currency="inv.currency" class="block text-3xl font-semibold tracking-tight" />
            </div>
            <p v-if="inv.status !== 'draft'" class="text-right text-xs text-muted-foreground">
              dari total<br><FinanceAmount :value="inv.totalMinor" class="font-medium text-foreground" />
            </p>
          </div>
          <div v-if="inv.status === 'issued'" class="mt-3">
            <div
              class="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              :aria-valuenow="paidPct"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Terbayar"
            >
              <div class="h-full rounded-full bg-success transition-all" :style="{ width: `${paidPct}%` }" />
            </div>
            <p class="mt-1.5 flex justify-between text-xs text-muted-foreground">
              <span>Dibayar <FinanceAmount :value="inv.paidMinor" class="font-medium text-foreground" /></span>
              <span v-if="inv.creditedMinor !== '0'">Credit note <FinanceAmount :value="inv.creditedMinor" class="font-medium text-foreground" /></span>
            </p>
          </div>
        </template>
      </SheetHeader>

      <FinanceErrorState v-if="detail.error.value && !inv" :error="detail.error.value" compact @retry="detail.refresh" />

      <div v-if="inv" class="flex-1 space-y-6 px-6 py-5">
        <div v-if="inv.status === 'void'" class="flex gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          <Undo2 class="mt-0.5 h-4 w-4 shrink-0" /> Dibatalkan: “{{ inv.voidReason }}”
        </div>
        <div v-if="inv.isDisputed" class="flex gap-2 rounded-lg bg-chart-4/10 px-3 py-2.5 text-sm">
          <Scale class="mt-0.5 h-4 w-4 shrink-0 text-chart-4" />
          <span>Sengketa: “{{ inv.disputeReason }}”</span>
        </div>

        <!-- Dates -->
        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt class="text-xs text-muted-foreground">
              Diterbitkan
            </dt>
            <dd class="font-medium">
              {{ formatBusinessDate(inv.issueDate) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Jatuh tempo
            </dt>
            <dd class="font-medium">
              {{ formatBusinessDate(inv.dueDate) }}
              <span v-if="inv.status === 'issued' && due.tone !== 'muted'" class="block text-xs font-normal" :class="due.tone === 'destructive' ? 'text-destructive' : 'text-warning'">
                {{ due.label }}
              </span>
            </dd>
          </div>
          <div v-if="inv.expectedDate" class="col-span-2 rounded-lg bg-muted/50 px-3 py-2">
            <dt class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock class="h-3.5 w-3.5" /> Dijanjikan bayar
            </dt>
            <dd class="font-medium">
              {{ formatBusinessDateLong(inv.expectedDate) }}
              <span v-if="inv.expectedReason" class="block text-xs font-normal text-muted-foreground">“{{ inv.expectedReason }}”</span>
            </dd>
          </div>
        </dl>

        <!-- Lines -->
        <section>
          <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Rincian
          </h3>
          <ul class="divide-y divide-border rounded-lg border border-border text-sm">
            <li v-for="line in inv.lines" :key="line.position" class="flex items-start justify-between gap-4 px-3 py-2.5">
              <span class="min-w-0">{{ line.description }}</span>
              <FinanceAmount :value="line.amountMinor" class="shrink-0 font-medium" />
            </li>
            <li v-if="!inv.lines.length" class="px-3 py-2.5 text-muted-foreground">
              Belum ada rincian.
            </li>
          </ul>
        </section>

        <!-- Payments -->
        <section v-if="inv.status !== 'draft'">
          <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pembayaran
          </h3>
          <ul v-if="inv.payments.length" class="divide-y divide-border rounded-lg border border-border text-sm">
            <li v-for="p in inv.payments" :key="p.transactionId" class="flex items-center justify-between gap-4 px-3 py-2.5">
              <span class="min-w-0">
                <span class="block font-medium" :class="p.reversed && 'text-muted-foreground'">{{ formatBusinessDate(p.effectiveDate) }} · {{ p.account.code }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ p.reversed ? 'Dibatalkan — tidak dihitung' : (p.reference ?? p.transactionId) }}</span>
              </span>
              <FinanceAmount :value="p.amountMinor" direction="in" :muted="p.reversed" class="shrink-0 font-medium" />
            </li>
          </ul>
          <p v-else class="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
            Belum ada pembayaran.
          </p>
        </section>

        <!-- Credit notes -->
        <section v-if="inv.creditNotes.length">
          <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Credit note
          </h3>
          <ul class="divide-y divide-border rounded-lg border border-border text-sm">
            <li v-for="cn in inv.creditNotes" :key="cn.id" class="flex items-center justify-between gap-3 px-3 py-2.5">
              <span class="min-w-0">
                <span class="block truncate" :class="cn.status === 'void' && 'text-muted-foreground line-through'">{{ cn.reason }}</span>
                <span class="text-xs text-muted-foreground">{{ cn.status === 'void' ? 'Dibatalkan' : cn.id }}</span>
              </span>
              <span class="flex shrink-0 items-center gap-2">
                <FinanceAmount :value="cn.amountMinor" direction="out" :muted="cn.status === 'void'" class="font-medium" />
                <Button v-if="cn.status === 'issued' && canManage" variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="openReason(`voidCredit:${cn.id}`)">
                  Batalkan
                </Button>
              </span>
            </li>
          </ul>
        </section>

        <p v-if="inv.notes" class="rounded-lg bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
          <FileText class="mr-1 inline h-3.5 w-3.5" /> {{ inv.notes }}
        </p>
      </div>

      <!-- Actions -->
      <div v-if="inv && (canManage || canPost)" class="space-y-2 border-t border-border px-6 py-4">
        <template v-if="inv.status === 'draft' && canManage">
          <Button class="w-full" @click="showIssue = true">
            <Send class="mr-2 h-4 w-4" /> Terbitkan invoice
          </Button>
          <div class="grid grid-cols-2 gap-2">
            <Button variant="outline" @click="showEdit = true">
              <Pencil class="mr-2 h-4 w-4" /> Ubah draft
            </Button>
            <Button variant="outline" class="text-destructive hover:text-destructive" @click="deleteAction.reset(); showDelete = true">
              <Trash2 class="mr-2 h-4 w-4" /> Hapus
            </Button>
          </div>
        </template>

        <template v-else-if="inv.status === 'issued'">
          <Button v-if="isOpenIssued && canPost" class="w-full" @click="showPayment = true">
            <Wallet class="mr-2 h-4 w-4" /> Catat pembayaran
          </Button>
          <div v-if="canManage" class="grid grid-cols-2 gap-2">
            <Button v-if="isOpenIssued" variant="outline" size="sm" @click="openReason('expect')">
              <CalendarClock class="mr-1.5 h-4 w-4" /> Perkiraan bayar
            </Button>
            <Button v-if="isOpenIssued" variant="outline" size="sm" @click="openReason('credit')">
              Credit note
            </Button>
            <Button v-if="isOpenIssued" variant="outline" size="sm" @click="openReason(inv.isDisputed ? 'undispute' : 'dispute')">
              <Scale class="mr-1.5 h-4 w-4" /> {{ inv.isDisputed ? 'Selesaikan sengketa' : 'Tandai sengketa' }}
            </Button>
            <Button variant="outline" size="sm" class="text-destructive hover:text-destructive" @click="openReason('void')">
              Batalkan invoice
            </Button>
          </div>
        </template>
      </div>
    </SheetContent>
  </Sheet>

  <!-- Issue -->
  <FinanceFormDialog
    v-model:open="showIssue"
    :title="`Terbitkan invoice ${inv?.party.name ?? ''}`"
    description="Setelah terbit, invoice mendapat nomor resmi, isinya terkunci, dan dihitung sebagai tagihan. Tidak ada uang yang bergerak."
    submit-label="Terbitkan"
    :pending="issueAction.pending.value"
    :error="issueAction.error.value"
    :submit-disabled="!issueForm.dueDate"
    @submit="issue"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <FinanceField id="iss-date" label="Tanggal terbit" :error="issueAction.fieldError('issueDate')">
        <FinanceDateInput id="iss-date" v-model="issueForm.issueDate" :max="today" />
      </FinanceField>
      <FinanceField id="iss-due" label="Jatuh tempo" :error="issueAction.fieldError('dueDate')">
        <FinanceDateInput id="iss-due" v-model="issueForm.dueDate" :min="issueForm.issueDate" />
      </FinanceField>
    </div>
    <template #summary>
      <div class="flex items-baseline justify-between text-sm">
        <span class="text-muted-foreground">Total ditagih</span>
        <FinanceAmount :value="inv?.totalMinor ?? null" class="font-semibold" />
      </div>
    </template>
  </FinanceFormDialog>

  <!-- Delete draft -->
  <FinanceFormDialog
    v-model:open="showDelete"
    title="Hapus draft ini?"
    description="Draft belum pernah diterbitkan, jadi aman dihapus. Rencana tagihan terkait (jika ada) kembali bisa ditagih."
    submit-label="Hapus draft"
    tone="destructive"
    :pending="deleteAction.pending.value"
    :error="deleteAction.error.value"
    @submit="removeDraft"
  >
    <p class="flex items-center gap-2 text-sm text-muted-foreground">
      <AlertTriangle class="h-4 w-4 text-warning" /> Total draft {{ formatMoneyMinor(inv?.totalMinor ?? '0') }}
    </p>
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
    :amount-label="reasonConfig.amountLabel"
    :pending="reasonAction.pending.value"
    :error="reasonAction.error.value"
    @update:open="v => { if (!v) reasonKind = null }"
    @confirm="confirmReason"
  />

  <FinanceInvoiceDialog v-model:open="showEdit" :invoice="inv" />
  <FinanceReceiptDialog v-model:open="showPayment" :party-id="inv?.party.id" :invoice-id="inv?.id" :project-id="inv?.project.id" />
</template>
