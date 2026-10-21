<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import { todayJakarta } from '~/lib/finance/dates'
import type { CompanyExpenseInput, CompanyScheduleInput, VendorInvoiceDetailDto } from '~/types/api'
const api = useApi(); const session = useServerSession(); const today = todayJakarta()
const evidenceId = ref<string|null>(null)
const { showToast } = useToast()
const cursor = ref<string|null>(null); const mode = ref<'schedule'|'expense'|null>(null)
const data = useFinanceQuery(async () => (await api.finance.companyExpenses(cursor.value ?? undefined)).data, { watch: [cursor] })
const lookups = useFinanceLookups(() => mode.value !== null)
let key = newIdempotencyKey(); let previous = ''
function requestKey (body:unknown) { const fingerprint = JSON.stringify(body); if (fingerprint !== previous) { previous = fingerprint; key = newIdempotencyKey() } return key }
const save = useFinanceAction((input:CompanyScheduleInput|CompanyExpenseInput) => 'contractRef' in input ? api.finance.createCompanySchedule(input, requestKey(input)) : api.finance.recordCompanyExpense(input, requestKey(input)))
async function submit (input:CompanyScheduleInput|CompanyExpenseInput) { if (await save.run(input)) { mode.value = null; cursor.value = null; showToast('Sumber biaya tersimpan. Tidak ada pembayaran uang.', 'success') } }
const choice = reactive({ type: '' as 'match'|'void'|'stop'|'', id: '', invoice: '', reason: '', fromMonth: today.slice(0, 7), confirmed: false })
const action = useFinanceAction(() => {
  const payload = { ...choice }; const k = requestKey(payload)
  if (choice.type === 'match') { return api.finance.matchCompanyInvoice(choice.id, choice.invoice, k) }
  if (choice.type === 'void') { return api.finance.voidCompanyExpense(choice.id, choice.reason, k) }
  return api.finance.stopCompanySchedule(choice.id, { fromMonth: choice.fromMonth, reason: choice.reason }, k)
})
function select (type:'match'|'void'|'stop', id:string) { Object.assign(choice, { type, id, invoice: '', reason: '', confirmed: false }); action.reset() }
async function execute () { if (!choice.confirmed) { return } if (await action.run()) { choice.type = ''; showToast('Perubahan tersimpan; jejak sumber tetap ada.', 'success') } }
const invoiceId = ref<string|null>(null); const createInvoice = ref(false); const invoiceVendor = ref<string|null>(null)
function newInvoice (vendorId:string, expenseId:string) { invoiceVendor.value = vendorId; select('match', expenseId); createInvoice.value = true }
function invoiceSaved (invoice:VendorInvoiceDetailDto) { choice.invoice = invoice.id; createInvoice.value = false }
</script>
<template>
  <section id="biaya-rutin" class="space-y-4 rounded-xl border bg-card p-5" aria-label="Biaya rutin dan belum ditagih">
    <h2 class="text-lg font-semibold">
      Biaya rutin & belum ditagih
    </h2>
    <p class="text-sm text-muted-foreground">
      Rencana masuk forecast. Biaya yang telah terjadi menjadi beban/accrual. Invoice asli mengganti accrual; pembayaran tetap lewat Utang Vendor existing.
    </p>
    <div v-if="session.can('finance.manage-payables')" class="flex flex-wrap gap-2">
      <Button variant="outline" @click="mode='schedule';save.reset()">
        Tambah rencana rutin
      </Button><Button variant="outline" @click="mode='expense';save.reset()">
        Biaya sudah terjadi
      </Button>
    </div>
    <FinanceErrorState v-if="mode && lookups.references.error.value" :error="lookups.references.error.value" compact @retry="lookups.references.refresh" />
    <p v-else-if="mode && !lookups.references.data.value" role="status">
      Memuat vendor…
    </p>
    <p v-else-if="mode && !lookups.vendorOptions.value.length" class="text-sm">
      Belum ada vendor. Lengkapi vendor sebenarnya sebelum mencatat kontrak.
    </p>
    <FinanceCompanyExpenseForm
      v-if="mode"
      :key="mode"
      :mode="mode"
      :today="today"
      :vendors="lookups.vendorOptions.value"
      :schedules="data.data.value?.schedules ?? []"
      :pending="save.pending.value"
      :error="save.error.value?.message"
      :field-errors="save.error.value?.fieldErrors"
      @schedule="submit"
      @expense="submit"
      @cancel="mode=null"
    />
    <FinanceErrorState v-if="data.error.value" :error="data.error.value" @retry="data.refresh" />
    <p v-else-if="!data.data.value" role="status">
      Memuat sumber biaya…
    </p>
    <template v-else>
      <p v-if="data.data.value.schedulesTruncated" role="alert" class="text-sm">
        Hanya 100 jadwal pertama ditampilkan. Batas ini perlu diperluas sebelum pemakaian volume lebih besar.
      </p>
      <div v-for="s in data.data.value.schedules" :key="s.id" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
        <span>{{ s.description }} · {{ s.vendorName }} · <FinanceAmount :value="s.amountMinor" />/bulan · {{ s.startMonth }} × {{ s.months }} bulan <span v-if="s.stopsOn">· dihentikan mulai {{ s.stopsOn }}</span></span><Button v-if="!s.stopsOn && session.can('finance.manage-payables')" size="sm" variant="outline" @click="select('stop',s.id)">
          Hentikan rencana
        </Button>
      </div>
      <p v-if="!data.data.value.items.length" class="text-sm text-muted-foreground">
        Belum ada biaya terjadi pada halaman ini.
      </p>
      <article v-for="e in data.data.value.items" :key="e.id" class="space-y-2 rounded-lg border p-3 text-sm">
        <p class="font-medium">
          {{ e.description }} · {{ e.vendorName }} · <FinanceAmount :value="e.amountMinor" /> · {{ e.status==='void' ? 'dibatalkan' : e.basis==='estimate' ? 'estimasi andal' : 'aktual' }}
        </p>
        <p class="text-xs text-muted-foreground">
          Terjadi {{ e.incurredOn }} · jatuh tempo {{ e.dueDate }}
        </p>
        <div class="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" @click="evidenceId=e.id">
            Bukti asli
          </Button>
          <Button v-if="e.invoiceId" size="sm" variant="outline" @click="invoiceId=e.invoiceId">
            Buka invoice & bayar
          </Button>
          <template v-else-if="e.status==='recorded' && session.can('finance.manage-payables')">
            <Button size="sm" variant="outline" @click="select('match',e.id)">
              Tautkan invoice existing
            </Button><Button size="sm" variant="outline" @click="newInvoice(e.vendorId,e.id)">
              Catat invoice asli
            </Button><Button size="sm" variant="outline" @click="select('void',e.id)">
              Batalkan biaya
            </Button>
          </template>
        </div>
        <AccountingSourceStatus source-type="company_expense" :source-id="e.id" />
      </article>
      <div class="flex gap-2">
        <Button v-if="cursor" size="sm" variant="outline" @click="cursor=null">
          Halaman pertama
        </Button><Button v-if="data.data.value.pagination.nextCursor" size="sm" variant="outline" @click="cursor=data.data.value!.pagination.nextCursor">
          Berikutnya
        </Button>
      </div>
      <form v-if="choice.type" class="space-y-3 rounded-lg border p-4" @submit.prevent="execute">
        <p class="font-medium">
          {{ choice.type==='match' ? 'Tautkan & setujui invoice asli' : choice.type==='void' ? 'Batalkan pencatatan biaya' : 'Hentikan bulan rencana yang belum terjadi' }} · {{ choice.id }}
        </p>
        <label v-if="choice.type==='match'" class="block text-sm">Invoice vendor belum disetujui<select v-model="choice.invoice" required :disabled="action.pending.value" class="block h-10 w-full rounded-md border bg-background px-3"><option value="" disabled>Pilih invoice asli</option><option v-for="i in data.data.value.invoices.filter(i=>i.vendorId===data.data.value!.items.find(e=>e.id===choice.id)?.vendorId)" :key="i.id" :value="i.id">{{ i.number }} · {{ i.amountMinor }}</option></select></label>
        <label v-if="choice.type==='stop'" class="block text-sm">Hentikan mulai bulan<input v-model="choice.fromMonth" type="month" required class="block h-10 rounded-md border bg-background px-3"></label>
        <label v-if="choice.type!=='match'" class="block text-sm">Alasan<input v-model="choice.reason" required minlength="5" maxlength="200" class="block h-10 w-full rounded-md border bg-background px-3"></label>
        <label class="flex gap-2 text-sm"><input v-model="choice.confirmed" type="checkbox" required><span>Saya sudah memeriksa sumber dan dampaknya. Tindakan ini tidak memindahkan uang.</span></label>
        <FinanceErrorState v-if="action.error.value" :error="action.error.value" compact />
        <Button type="submit" :disabled="action.pending.value || !choice.confirmed">
          Konfirmasi pencatatan
        </Button><Button type="button" variant="outline" :disabled="action.pending.value" @click="choice.type=''">
          Batal
        </Button>
      </form>
    </template>
    <FinanceVendorInvoiceDialog v-model:open="createInvoice" :vendor-id="invoiceVendor" @saved="invoiceSaved" />
    <FinanceVendorInvoiceSheet v-model:invoice-id="invoiceId" />
    <PrivateEvidenceSheet v-model:source-id="evidenceId" source-type="company_expense" :can-upload="session.can('finance.post-cash')" />
  </section>
</template>
