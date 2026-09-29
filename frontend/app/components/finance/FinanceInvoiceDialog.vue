<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import type { ApiInvoiceType, CustomerInvoiceDetailDto } from '~/types/api'
import { todayJakarta } from '~/lib/finance/dates'
import { INVOICE_TYPE_LABEL } from '~/lib/finance/labels'

/**
 * Create or edit a customer invoice DRAFT. A draft is not a receivable and moves no money; issuing it (from the
 * invoice panel) freezes it and makes it collectable. The customer always comes from the project, so an invoice
 * can never be addressed to the wrong party.
 */
const props = defineProps<{ open: boolean; invoice?: CustomerInvoiceDetailDto | null; projectId?: string | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [invoice: CustomerInvoiceDetailDto] }>()

const api = useApi()
const { showToast } = useToast()
const lookups = useFinanceLookups(() => props.open && !props.invoice)
const today = todayJakarta()
const isEdit = computed(() => !!props.invoice)

interface Line { key: number; description: string; amount: string }
let lineKey = 0
const form = reactive({
  projectId: null as string | null,
  invoiceType: 'dp' as ApiInvoiceType,
  lines: [] as Line[],
  dueDate: '',
  expectedDate: '',
  notes: ''
})

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  const inv = props.invoice
  form.projectId = inv?.project.id ?? props.projectId ?? null
  form.invoiceType = inv?.invoiceType ?? 'dp'
  form.lines = inv?.lines.length
    ? inv.lines.map(l => ({ key: ++lineKey, description: l.description, amount: l.amountMinor }))
    : [{ key: ++lineKey, description: '', amount: '' }]
  form.dueDate = inv?.dueDate ?? ''
  form.expectedDate = inv?.expectedDate ?? ''
  form.notes = inv?.notes ?? ''
})

const typeOptions = (Object.keys(INVOICE_TYPE_LABEL) as ApiInvoiceType[]).map(t => ({ value: t, label: INVOICE_TYPE_LABEL[t] }))
const total = computed(() => form.lines.reduce((s, l) => s + BigInt(l.amount || '0'), 0n))

/** Commercial context of the project (Finance sees the full summary). */
const context = useFinanceQuery(
  async () => (await api.finance.projectSummary(form.projectId!)).data,
  { watch: [() => form.projectId, () => props.open], enabled: () => props.open && !!form.projectId }
)
const summary = computed(() => (context.data.value?.view === 'full' && context.data.value.projectId === form.projectId ? context.data.value : null))
const exceedsContract = computed(() => {
  const s = summary.value
  if (!s?.contractValueMinor || isEdit.value) { return false }
  return BigInt(s.receivable.invoicedMinor) - BigInt(s.receivable.creditedMinor) + total.value > BigInt(s.contractValueMinor)
})

function addLine () { form.lines.push({ key: ++lineKey, description: '', amount: '' }) }
function removeLine (key: number) { form.lines = form.lines.filter(l => l.key !== key) }

const action = useFinanceAction(async () => {
  const body = {
    invoiceType: form.invoiceType,
    lines: form.lines.filter(l => l.description.trim() || l.amount).map(l => ({ description: l.description.trim(), amountMinor: l.amount || '0' })),
    // Editing: send empty strings so a cleared field is cleared on the server (undefined = "keep").
    dueDate: props.invoice ? form.dueDate : (form.dueDate || undefined),
    expectedDate: props.invoice ? form.expectedDate : (form.expectedDate || undefined),
    notes: props.invoice ? form.notes.trim() : (form.notes.trim() || undefined)
  }
  if (props.invoice) { return (await api.finance.updateInvoiceDraft(props.invoice.id, body)).data }
  return (await api.finance.createInvoiceDraft({ ...body, projectId: form.projectId! })).data
})

async function submit () {
  const saved = await action.run()
  if (!saved) { return }
  showToast(isEdit.value ? 'Draft diperbarui' : 'Draft invoice dibuat', 'Draft belum dihitung sebagai piutang. Terbitkan saat siap dikirim ke customer.')
  emit('saved', saved)
  emit('update:open', false)
}

const lineError = (i: number, field: 'description' | 'amountMinor') => action.fieldError(`lines.${i}.${field}`)
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="isEdit ? `Ubah draft ${invoice?.project.name ?? ''}` : 'Buat invoice customer'"
    description="Disimpan sebagai draft dulu. Draft bisa diubah atau dihapus, dan belum dihitung sebagai tagihan sampai diterbitkan."
    :submit-label="isEdit ? 'Simpan draft' : 'Simpan sebagai draft'"
    size="lg"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="!form.projectId || total <= 0n"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid gap-4 sm:grid-cols-[1fr_12rem]">
      <FinanceField id="inv-project" label="Project" :error="action.fieldError('projectId')">
        <FinanceSelect
          v-if="!isEdit"
          id="inv-project"
          v-model="form.projectId"
          :options="lookups.projectOptions.value"
          placeholder="Pilih project"
        />
        <p v-else class="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-sm">
          {{ invoice?.project.name }} · {{ invoice?.party.name }}
        </p>
      </FinanceField>
      <FinanceField id="inv-type" label="Jenis tagihan" :error="action.fieldError('invoiceType')">
        <FinanceSelect id="inv-type" :model-value="form.invoiceType" :options="typeOptions" @update:model-value="v => v && (form.invoiceType = v as ApiInvoiceType)" />
      </FinanceField>
    </div>

    <div v-if="summary" class="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-xs">
      <div>
        <p class="text-muted-foreground">
          Nilai kontrak
        </p>
        <FinanceAmount :value="summary.contractValueMinor" unavailable-label="Belum diisi" class="font-semibold" />
      </div>
      <div>
        <p class="text-muted-foreground">
          Sudah ditagih
        </p>
        <FinanceAmount :value="summary.receivable.invoicedMinor" class="font-semibold" />
      </div>
      <div>
        <p class="text-muted-foreground">
          Belum ditagih
        </p>
        <FinanceAmount :value="summary.receivable.uninvoicedMinor" unavailable-label="—" class="font-semibold" />
      </div>
    </div>

    <div class="space-y-2">
      <p class="text-[13px] font-medium">
        Rincian tagihan
      </p>
      <div v-for="(line, i) in form.lines" :key="line.key" class="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_12rem_auto]">
        <div class="col-span-2 sm:col-span-1">
          <Input
            v-model="line.description"
            class="h-10"
            maxlength="300"
            :placeholder="i === 0 ? 'mis. DP 30% Korea Incentive Trip' : 'Keterangan'"
            :aria-label="`Keterangan baris ${i + 1}`"
            :aria-invalid="!!lineError(i, 'description') || undefined"
          />
          <p v-if="lineError(i, 'description')" class="mt-1 text-xs text-destructive">
            {{ lineError(i, 'description') }}
          </p>
        </div>
        <div>
          <FinanceMoneyInput v-model="line.amount" :aria-label="`Nominal baris ${i + 1}`" :invalid="!!lineError(i, 'amountMinor')" />
          <p v-if="lineError(i, 'amountMinor')" class="mt-1 text-xs text-destructive">
            {{ lineError(i, 'amountMinor') }}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="h-10 w-10 text-muted-foreground"
          :disabled="form.lines.length === 1"
          :aria-label="`Hapus baris ${i + 1}`"
          @click="removeLine(line.key)"
        >
          <Trash2 class="h-4 w-4" />
        </Button>
      </div>
      <p v-if="action.fieldError('lines')" class="text-xs font-medium text-destructive">
        {{ action.fieldError('lines') }}
      </p>
      <div class="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" size="sm" class="-ml-2 text-primary" @click="addLine">
          <Plus class="mr-1 h-4 w-4" /> Tambah baris
        </Button>
        <p class="text-sm">
          Total <FinanceAmount :value="total.toString()" class="ml-1 text-base font-semibold" />
        </p>
      </div>
      <p v-if="exceedsContract" class="rounded-lg bg-warning/10 px-3 py-2 text-xs text-foreground">
        Total tagihan project akan melebihi nilai kontrak. Tetap boleh (mis. ada tambahan layanan), tapi pastikan sudah disepakati customer.
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <FinanceField id="inv-due" label="Jatuh tempo" optional hint="Wajib diisi sebelum invoice diterbitkan." :error="action.fieldError('dueDate')">
        <FinanceDateInput id="inv-due" v-model="form.dueDate" :min="today" />
      </FinanceField>
      <FinanceField id="inv-expected" label="Perkiraan dibayar" optional hint="Jika customer sudah menjanjikan tanggal." :error="action.fieldError('expectedDate')">
        <FinanceDateInput id="inv-expected" v-model="form.expectedDate" />
      </FinanceField>
    </div>
    <FinanceField id="inv-notes" label="Catatan internal" optional>
      <FinanceTextarea id="inv-notes" v-model="form.notes" :rows="2" maxlength="1000" />
    </FinanceField>
  </FinanceFormDialog>
</template>
