<script setup lang="ts">
import { FileUp, Link2, Undo2 } from 'lucide-vue-next'
import { newIdempotencyKey } from '~/lib/api/client'
import { formatBusinessDate, startOfMonth, todayJakarta } from '~/lib/finance/dates'
import { CATEGORY_LABEL, KIND_LABEL } from '~/lib/finance/labels'
import { formatMoneyMinor } from '~/lib/money'
import type { ApiExpenseCategory, ApiTransactionKind, StatementLineDto, StatementMappingInput, StatementPreviewDto } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Cocokkan Rekening Koran — Finance' })

/**
 * Rekening koran: import the bank's CSV (preview first, re-import is harmless), then confirm each line against the
 * cash already recorded. Importing never creates money; a line without a source is recorded once from the line.
 */
const api = useApi()
const session = useServerSession()
const { showToast } = useToast()
const lookups = useFinanceLookups(() => true)
const today = todayJakarta()
const accountId = ref<string | null>(null)
const range = reactive({ from: startOfMonth(today), to: today })
watch(() => lookups.accountOptions.value, (o) => { if (!accountId.value && o.length) { accountId.value = o[0]!.value } }, { immediate: true })

const lines = useFinanceQuery(async () => (await api.finance.statementLines({ bankAccountId: accountId.value!, from: range.from, to: range.to })).data, {
  watch: [accountId, () => range.from, () => range.to], enabled: () => !!accountId.value
})

/* Import: explicit mapping, read-only preview, then one idempotent import. */
const upload = reactive({ open: false, fileName: '', csv: '' })
const mapping = reactive<StatementMappingInput>({ delimiter: ',', skipRows: 1, dateColumn: 0, dateFormat: 'DD/MM/YYYY', descriptionColumn: 1, debitColumn: 2, creditColumn: 3, numberStyle: 'id' })
const preview = ref<StatementPreviewDto | null>(null)
let importKey = newIdempotencyKey()
async function onFile (event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) { return }
  upload.fileName = file.name
  upload.csv = await file.text()
  preview.value = null
  importKey = newIdempotencyKey()
}
const input = () => ({ bankAccountId: accountId.value!, fileName: upload.fileName, csv: upload.csv, mapping: { ...mapping } })
const previewAction = useFinanceAction(async () => { preview.value = (await api.finance.previewStatement(input())).data })
const importAction = useFinanceAction(async () => (await api.finance.importStatement(input(), importKey)).data)
async function doImport () {
  const res = await importAction.run()
  if (!res) { return }
  showToast('Rekening koran diimpor', res.alreadyImported ? 'File ini sudah pernah diimpor; tidak ada baris baru.' : `${res.imported} baris baru, ${res.skippedDuplicates} sudah ada.`)
  Object.assign(upload, { open: false, fileName: '', csv: '' })
  preview.value = null
}

/* Per line: confirm a candidate, record a source from the line, or undo a match. */
const matchAction = useFinanceAction((line: StatementLineDto, transactionId: string, amountMinor: string) =>
  api.finance.matchStatementLine(line.id, [{ transactionId, amountMinor }]))
const recording = ref<StatementLineDto | null>(null)
const recordForm = reactive({ category: 'bank_fee' as string, memo: '' })
const recordAction = useFinanceAction(() => api.finance.recordFromStatementLine(recording.value!.id, { category: recording.value!.direction === 'out' ? recordForm.category : undefined, memo: recordForm.memo.trim() || undefined }))
async function submitRecord () { if (await recordAction.run()) { recording.value = null } }
const unmatching = ref<StatementLineDto | null>(null)
const unmatchAction = useFinanceAction((reason: string) => api.finance.unmatchStatementLine(unmatching.value!.id, reason))
async function confirmUnmatch (v: { reason: string }) { if (await unmatchAction.run(v.reason)) { unmatching.value = null } }

const left = (l: StatementLineDto) => (BigInt(l.amountMinor) - BigInt(l.matchedMinor)).toString()
const counts = computed(() => {
  const all = lines.data.value?.lines ?? []
  return { unmatched: all.filter(l => l.status !== 'matched').length, total: all.length }
})
const categoryOptions = (['bank_fee', 'tax', 'office', 'other'] as ApiExpenseCategory[]).map(c => ({ value: c, label: CATEGORY_LABEL[c] }))
const col = (v: number | undefined) => (v === undefined ? '' : String(v))
function setCol (key: 'dateColumn' | 'descriptionColumn' | 'debitColumn' | 'creditColumn' | 'amountColumn' | 'referenceColumn', value: string) {
  const n = value === '' ? undefined : Number(value)
  if (key === 'dateColumn' || key === 'descriptionColumn') { mapping[key] = n ?? 0 } else { mapping[key] = n }
}
</script>

<template>
  <FinancePage title="Cocokkan Rekening Koran" description="Impor rekening koran dan cocokkan dengan transaksi yang sudah tercatat. Impor tidak membuat transaksi uang.">
    <div class="flex flex-wrap items-end gap-3">
      <FinanceField id="rc-account" label="Rekening" class="min-w-56">
        <FinanceSelect id="rc-account" v-model="accountId" :options="lookups.accountOptions.value" />
      </FinanceField>
      <FinanceField id="rc-from" label="Dari">
        <FinanceDateInput id="rc-from" v-model="range.from" :max="range.to" />
      </FinanceField>
      <FinanceField id="rc-to" label="Sampai">
        <FinanceDateInput id="rc-to" v-model="range.to" />
      </FinanceField>
      <Button v-if="session.can('finance.post-cash')" size="sm" @click="upload.open = true">
        <FileUp class="mr-1.5 h-4 w-4" /> Impor CSV
      </Button>
    </div>

    <FinanceErrorState v-if="lines.error.value && !lines.data.value" :error="lines.error.value" @retry="lines.refresh" />
    <div v-else-if="!lines.data.value" class="h-32 animate-pulse rounded-xl bg-muted" />
    <template v-else>
      <p class="text-sm text-muted-foreground" role="status">
        {{ counts.unmatched }} dari {{ counts.total }} baris belum cocok · {{ lines.data.value.unmatchedCashCount }} transaksi kas pada periode ini belum muncul di rekening koran.
      </p>
      <section class="divide-y divide-border rounded-xl border border-border bg-card shadow-sm" aria-label="Baris rekening koran">
        <p v-if="!lines.data.value.lines.length" class="px-5 py-8 text-center text-sm text-muted-foreground">
          Belum ada baris rekening koran untuk rekening dan periode ini.
        </p>
        <div v-for="l in lines.data.value.lines" :key="l.id" class="space-y-2 px-5 py-3 text-sm">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate font-medium">
                {{ l.description || '(tanpa keterangan)' }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ formatBusinessDate(l.bookedOn) }} · {{ l.direction === 'in' ? 'masuk' : 'keluar' }}<template v-if="l.externalRef">
                  · ref {{ l.externalRef }}
                </template>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <FinanceAmount :value="l.amountMinor" class="font-medium" />
              <span class="rounded-md px-2 py-0.5 text-xs" :class="l.status === 'matched' ? 'bg-success/10 text-success' : l.status === 'partial' ? 'bg-warning/10 text-warning' : 'bg-muted'">
                {{ l.status === 'matched' ? 'Cocok' : l.status === 'partial' ? `Sisa ${formatMoneyMinor(left(l))}` : 'Belum cocok' }}
              </span>
              <Button
                v-if="l.status !== 'unmatched' && session.can('finance.post-cash')"
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :aria-label="`Batalkan pencocokan ${l.id}`"
                @click="unmatching = l"
              >
                <Undo2 class="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div v-if="l.status !== 'matched' && session.can('finance.post-cash')" class="flex flex-wrap gap-2">
            <Button
              v-for="c in l.candidates"
              :key="c.transactionId"
              size="sm"
              :variant="c.exactAmount ? 'default' : 'outline'"
              :disabled="matchAction.pending.value"
              @click="matchAction.run(l, c.transactionId, BigInt(c.openMinor) < BigInt(left(l)) ? c.openMinor : left(l))"
            >
              <Link2 class="mr-1.5 h-3.5 w-3.5" /> {{ KIND_LABEL[c.kind as ApiTransactionKind] ?? c.kind }} {{ formatBusinessDate(c.effectiveDate) }} · {{ formatMoneyMinor(c.openMinor) }}
            </Button>
            <Button v-if="l.status === 'unmatched'" size="sm" variant="ghost" @click="Object.assign(recordForm, { category: 'bank_fee', memo: l.description }); recording = l">
              Catat dari baris ini
            </Button>
          </div>
        </div>
      </section>
      <p v-if="matchAction.error.value" role="alert" class="text-sm text-destructive">
        {{ matchAction.error.value.message }}
      </p>
    </template>

    <FinanceFormDialog
      v-model:open="upload.open"
      title="Impor rekening koran (CSV)"
      description="Tentukan kolom sesuai file bank. Pratinjau tidak menyimpan apa pun; impor ulang file yang sama tidak menambah baris."
      submit-label="Impor"
      size="lg"
      :pending="importAction.pending.value"
      :error="importAction.error.value ?? previewAction.error.value"
      :submit-disabled="!preview || preview.errors.length > 0 || !preview.rows.length"
      @submit="doImport"
    >
      <div class="grid gap-3">
        <input type="file" accept=".csv,text/csv" aria-label="File CSV rekening koran" @change="onFile">
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label class="text-xs">Pemisah<select v-model="mapping.delimiter" class="mt-1 h-9 w-full rounded border bg-background px-2"><option value=",">Koma</option><option value=";">Titik koma</option><option value="&#9;">Tab</option></select></label>
          <label class="text-xs">Lewati baris<input v-model.number="mapping.skipRows" type="number" min="0" max="50" class="mt-1 h-9 w-full rounded border bg-background px-2"></label>
          <label class="text-xs">Format tanggal<select v-model="mapping.dateFormat" class="mt-1 h-9 w-full rounded border bg-background px-2"><option>DD/MM/YYYY</option><option>DD-MM-YYYY</option><option>YYYY-MM-DD</option></select></label>
          <label class="text-xs">Format angka<select v-model="mapping.numberStyle" class="mt-1 h-9 w-full rounded border bg-background px-2"><option value="id">1.234.567,00</option><option value="en">1,234,567.00</option></select></label>
          <label v-for="k in (['dateColumn', 'descriptionColumn', 'debitColumn', 'creditColumn', 'amountColumn', 'referenceColumn'] as const)" :key="k" class="text-xs">
            {{ { dateColumn: 'Kolom tanggal', descriptionColumn: 'Kolom keterangan', debitColumn: 'Kolom debit', creditColumn: 'Kolom kredit', amountColumn: 'Kolom nominal (±)', referenceColumn: 'Kolom referensi' }[k] }}
            <input
              :value="col(mapping[k])"
              type="number"
              min="0"
              max="50"
              class="mt-1 h-9 w-full rounded border bg-background px-2"
              @input="setCol(k, ($event.target as HTMLInputElement).value)"
            >
          </label>
        </div>
        <Button size="sm" variant="outline" :disabled="!upload.csv || !accountId || previewAction.pending.value" @click="previewAction.run()">
          Pratinjau
        </Button>
        <div v-if="preview" class="max-h-64 overflow-auto rounded border text-xs">
          <p class="p-2">
            {{ preview.rows.length }} baris · masuk {{ formatMoneyMinor(preview.totals.inMinor) }} · keluar {{ formatMoneyMinor(preview.totals.outMinor) }}
            · {{ preview.rows.filter(r => r.duplicate).length }} sudah ada
          </p>
          <p v-for="e in preview.errors" :key="e.lineNo" role="alert" class="px-2 text-destructive">
            Baris {{ e.lineNo }}: {{ e.message }}
          </p>
          <table class="w-full">
            <tbody>
              <tr v-for="r in preview.rows.slice(0, 50)" :key="r.lineNo" class="border-t" :class="r.duplicate && 'opacity-50'">
                <td class="p-1">
                  {{ r.bookedOn }}
                </td><td class="p-1">
                  {{ r.description }}
                </td><td class="p-1 text-right tabular-nums">
                  {{ r.direction === 'in' ? '+' : '−' }}{{ formatMoneyMinor(r.amountMinor) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </FinanceFormDialog>

    <FinanceFormDialog
      :open="!!recording"
      title="Catat transaksi dari baris ini"
      :description="recording ? `${recording.direction === 'in' ? 'Pemasukan lain' : 'Pengeluaran'} ${formatMoneyMinor(recording.amountMinor)} tanggal ${recording.bookedOn}. Untuk pembayaran customer/supplier, catat lewat form-nya lalu cocokkan.` : undefined"
      submit-label="Catat & cocokkan"
      :pending="recordAction.pending.value"
      :error="recordAction.error.value"
      @update:open="v => { if (!v) recording = null }"
      @submit="submitRecord"
    >
      <div class="grid gap-3">
        <FinanceField v-if="recording?.direction === 'out'" id="rc-category" label="Jenis biaya">
          <FinanceSelect id="rc-category" v-model="recordForm.category" :options="categoryOptions" />
        </FinanceField>
        <FinanceField id="rc-memo" label="Keterangan" optional>
          <FinanceTextarea id="rc-memo" v-model="recordForm.memo" :rows="2" maxlength="500" />
        </FinanceField>
      </div>
    </FinanceFormDialog>
    <FinanceReasonDialog
      :open="!!unmatching"
      title="Batalkan pencocokan"
      description="Riwayat pencocokan tetap tersimpan; transaksi kas dan jurnalnya tidak berubah."
      confirm-label="Batalkan pencocokan"
      tone="destructive"
      :pending="unmatchAction.pending.value"
      :error="unmatchAction.error.value"
      @update:open="v => { if (!v) unmatching = null }"
      @confirm="confirmUnmatch"
    />
  </FinancePage>
</template>
