<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, FileX, Plus } from 'lucide-vue-next'
import {
  INVOICES, PROJECTS, getProjectById, getPaymentsByInvoice, getInvoiceOutstandingIdr, getCreditNotesByInvoice,
  createInvoice, recordPayment, voidInvoice, issueCreditNote
} from '~/data'
import { INVOICE_STATUSES, INVOICE_CURRENCIES, INVOICE_TYPES, CREDIT_NOTE_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import { isInvoiceOverdue, invoiceAgingDays } from '~/utils/attention'
import type { Invoice, InvoiceCurrency, InvoiceType } from '~/types/finance'

/**
 * Invoices (Section 15 lama — list/detail/aging; Section 20 — D-077, menambah Create Invoice/Record
 * Payment/Issue Credit Note/Void Invoice). List/search/filter/aging existing TIDAK diubah — seluruhnya
 * aditif di atas dialog detail yang sudah ada.
 */

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Invoices' })

const { canView, canManage } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()
const canManageFinance = computed(() => canManage('finance'))

const searchQuery = ref('')
const statusFilter = ref('all')

function projectName (projectId: string) {
  return getProjectById(projectId)?.name ?? projectId
}

function agingLabel (invoice: Invoice) {
  if (invoice.status === 'paid') { return 'Lunas' }
  if (invoice.status === 'void') { return 'Void' }
  const days = invoiceAgingDays(invoice)
  if (days < 0) { return `${Math.abs(days)} hari overdue` }
  if (days === 0) { return 'Jatuh tempo hari ini' }
  return `Jatuh tempo dalam ${days} hari`
}

const rows = computed(() => {
  let result = INVOICES.map(invoice => ({ invoice, projectLabel: projectName(invoice.projectId) }))

  if (statusFilter.value !== 'all') {
    result = result.filter(row => row.invoice.status === statusFilter.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row => row.invoice.label.toLowerCase().includes(q) || row.projectLabel.toLowerCase().includes(q))
  }
  return result
})

const isDetailOpen = ref(false)
const selectedInvoice = ref<Invoice | null>(null)
const selectedPayments = computed(() => selectedInvoice.value ? getPaymentsByInvoice(selectedInvoice.value.id) : [])
const selectedCreditNotes = computed(() => selectedInvoice.value ? getCreditNotesByInvoice(selectedInvoice.value.id) : [])
const selectedOutstanding = computed(() => selectedInvoice.value ? getInvoiceOutstandingIdr(selectedInvoice.value.id) : 0)
const canVoidSelected = computed(() => !!selectedInvoice.value && selectedInvoice.value.status !== 'paid' && selectedInvoice.value.status !== 'void')
const canRecordPaymentSelected = computed(() => !!selectedInvoice.value && selectedInvoice.value.status !== 'paid' && selectedInvoice.value.status !== 'void' && selectedOutstanding.value > 0)

function openDetail (invoice: Invoice) {
  selectedInvoice.value = invoice
  isDetailOpen.value = true
}

/* Create Invoice */
const isCreateOpen = ref(false)
const newProjectId = ref('')
const newLabel = ref('')
const newAmount = ref<number | null>(null)
const newCurrency = ref<InvoiceCurrency>('IDR')
const newInvoiceType = ref<InvoiceType>('progress')
const newDueAt = ref('')
const newFxRate = ref<number | null>(null)

function resetCreateForm () {
  newProjectId.value = ''
  newLabel.value = ''
  newAmount.value = null
  newCurrency.value = 'IDR'
  newInvoiceType.value = 'progress'
  newDueAt.value = ''
  newFxRate.value = null
}

function submitCreateInvoice () {
  if (!newProjectId.value || !newLabel.value.trim() || !newAmount.value || !newDueAt.value) { return }
  const invoice = createInvoice({
    projectId: newProjectId.value,
    label: newLabel.value.trim(),
    amountIdr: newAmount.value,
    currency: newCurrency.value,
    invoiceType: newInvoiceType.value,
    dueAt: newDueAt.value,
    exchangeRateSnapshot: newCurrency.value !== 'IDR' && newFxRate.value
      ? { rate: newFxRate.value, baseCurrency: 'IDR', capturedAt: new Date().toISOString().slice(0, 10) }
      : undefined
  })
  if (!invoice) { showToast('Gagal Membuat Invoice', 'Periksa kembali project, label, jumlah, dan jatuh tempo.', 'error'); return }
  resetCreateForm()
  isCreateOpen.value = false
  showToast('Invoice Dibuat', `${invoice.id} tercatat berstatus "Belum Dibayar".`, 'success')
}

/* Record Payment */
const isPaymentOpen = ref(false)
const paymentAmount = ref<number | null>(null)
const paymentMethod = ref('bank-transfer')

function openPaymentDialog () {
  paymentAmount.value = selectedOutstanding.value
  paymentMethod.value = 'bank-transfer'
  isPaymentOpen.value = true
}

function submitPayment () {
  if (!selectedInvoice.value || !paymentAmount.value || paymentAmount.value <= 0) { return }
  const payment = recordPayment({
    invoiceId: selectedInvoice.value.id,
    amountIdr: paymentAmount.value,
    recordedBy: currentUser.value.id,
    method: paymentMethod.value || undefined
  })
  isPaymentOpen.value = false
  if (payment) { showToast('Payment Dicatat', `${payment.id} sebesar ${formatCurrencyIdr(payment.amountIdr)} tercatat.`, 'success') } else { showToast('Gagal Mencatat Payment', 'Invoice tidak eligible menerima payment (sudah lunas/void) atau jumlah tidak valid.', 'error') }
}

/* Void Invoice */
const isVoidOpen = ref(false)
const voidReason = ref('')

function submitVoid () {
  if (!selectedInvoice.value || !voidReason.value.trim()) { return }
  const result = voidInvoice(selectedInvoice.value.id, voidReason.value.trim(), currentUser.value.id)
  isVoidOpen.value = false
  voidReason.value = ''
  if (result) { showToast('Invoice Divoid', `${result.id} kini berstatus "Void".`, 'info'); isDetailOpen.value = false } else { showToast('Gagal Void Invoice', 'Invoice yang sudah lunas atau sudah void tidak dapat divoid lagi.', 'error') }
}

/* Issue Credit Note */
const isCreditNoteOpen = ref(false)
const creditNoteAmount = ref<number | null>(null)
const creditNoteReason = ref('')

function openCreditNoteDialog () {
  creditNoteAmount.value = null
  creditNoteReason.value = ''
  isCreditNoteOpen.value = true
}

function submitCreditNote () {
  if (!selectedInvoice.value || !creditNoteAmount.value || !creditNoteReason.value.trim()) { return }
  const note = issueCreditNote({
    invoiceId: selectedInvoice.value.id,
    amountIdr: creditNoteAmount.value,
    reason: creditNoteReason.value.trim()
  })
  isCreditNoteOpen.value = false
  if (note) { showToast('Credit Note Diterbitkan', `${note.id} senilai ${formatCurrencyIdr(note.amountIdr)} diterbitkan.`, 'success') } else { showToast('Gagal Menerbitkan Credit Note', 'Periksa kembali jumlah dan alasan.', 'error') }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Invoices"
      description="Daftar invoice lintas-project, termasuk status outstanding dan aging."
      :breadcrumb="[{ label: 'Finance', to: '/finance' }, { label: 'Invoices' }]"
    >
      <template v-if="canManageFinance" #actions>
        <Dialog v-model:open="isCreateOpen">
          <DialogTrigger as-child>
            <Button size="sm">
              <Plus class="h-4 w-4 mr-1.5" />Buat Invoice
            </Button>
          </DialogTrigger>
          <DialogScrollContent class="max-w-lg">
            <DialogHeader>
              <DialogTitle>Buat Invoice Baru</DialogTitle>
              <DialogDescription>Invoice baru terbit berstatus "Belum Dibayar".</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="inv-project">Project</Label>
                <select id="inv-project" v-model="newProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="" disabled>
                    Pilih project
                  </option>
                  <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                    {{ project.name }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="inv-label">Label</Label>
                <Input id="inv-label" v-model="newLabel" placeholder="mis. Invoice Termin 2" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="inv-amount">Jumlah (Rp)</Label>
                  <Input id="inv-amount" v-model.number="newAmount" type="number" />
                </div>
                <div class="space-y-1.5">
                  <Label for="inv-due">Jatuh Tempo</Label>
                  <Input id="inv-due" v-model="newDueAt" type="date" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="inv-currency">Currency</Label>
                  <select id="inv-currency" v-model="newCurrency" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="option in INVOICE_CURRENCIES" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="inv-type">Tipe</Label>
                  <select id="inv-type" v-model="newInvoiceType" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="option in INVOICE_TYPES" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
              </div>
              <div v-if="newCurrency !== 'IDR'" class="space-y-1.5">
                <Label for="inv-fx">Exchange Rate Snapshot (1 {{ newCurrency }} = ? IDR)</Label>
                <Input id="inv-fx" v-model.number="newFxRate" type="number" placeholder="mis. 15600" />
                <p class="text-xs text-muted-foreground">
                  Mock snapshot — dicatat sekali saat invoice diterbitkan, tidak mengikuti kurs pasar nyata.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isCreateOpen = false">
                Batal
              </Button>
              <Button :disabled="!newProjectId || !newLabel.trim() || !newAmount || !newDueAt" @click="submitCreateInvoice">
                Simpan
              </Button>
            </DialogFooter>
          </DialogScrollContent>
        </Dialog>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('finance')" module-label="modul Finance" />

    <template v-else>
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari invoice atau project..." class="pl-9" />
        </div>
        <select
          v-model="statusFilter"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="all">
            Semua Status
          </option>
          <option v-for="status in INVOICE_STATUSES" :key="status.value" :value="status.value">
            {{ status.label }}
          </option>
        </select>
      </div>

      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Jatuh Tempo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aging</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.invoice.id" class="cursor-pointer hover:bg-muted/50" @click="openDetail(row.invoice)">
              <TableCell class="font-medium text-foreground">
                {{ row.invoice.label }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.projectLabel }}
              </TableCell>
              <TableCell>
                <div class="flex flex-col gap-1">
                  <StatusBadge :label="findStatusOption(INVOICE_TYPES, row.invoice.invoiceType).label" :tone="findStatusOption(INVOICE_TYPES, row.invoice.invoiceType).tone" />
                  <span v-if="row.invoice.currency !== 'IDR'" class="text-xs text-muted-foreground">{{ row.invoice.currency }}</span>
                </div>
              </TableCell>
              <TableCell>{{ formatCurrencyIdr(row.invoice.amountIdr) }}</TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDate(row.invoice.dueAt) }}
              </TableCell>
              <TableCell>
                <StatusBadge
                  :label="findStatusOption(INVOICE_STATUSES, row.invoice.status).label"
                  :tone="findStatusOption(INVOICE_STATUSES, row.invoice.status).tone"
                />
              </TableCell>
              <TableCell :class="isInvoiceOverdue(row.invoice) ? 'text-destructive' : 'text-muted-foreground'">
                {{ agingLabel(row.invoice) }}
              </TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="7">
              {{ searchQuery || statusFilter !== 'all' ? 'Tidak ada invoice yang cocok dengan filter.' : 'Belum ada invoice.' }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>

    <Dialog v-model:open="isDetailOpen">
      <DialogScrollContent class="max-w-lg">
        <template v-if="selectedInvoice">
          <DialogHeader>
            <DialogTitle>{{ selectedInvoice.label }}</DialogTitle>
            <DialogDescription>{{ projectName(selectedInvoice.projectId) }}</DialogDescription>
          </DialogHeader>
          <DetailMetadataList
            :items="[
              { label: 'Jumlah', value: formatCurrencyIdr(selectedInvoice.amountIdr) },
              { label: 'Currency', value: selectedInvoice.currency + (selectedInvoice.exchangeRateSnapshot ? ` (1 ${selectedInvoice.currency} = ${formatCurrencyIdr(selectedInvoice.exchangeRateSnapshot.rate)}, snapshot ${formatDate(selectedInvoice.exchangeRateSnapshot.capturedAt)})` : '') },
              { label: 'Tipe', value: findStatusOption(INVOICE_TYPES, selectedInvoice.invoiceType).label },
              { label: 'Diterbitkan', value: formatDate(selectedInvoice.issuedAt) },
              { label: 'Jatuh Tempo', value: formatDate(selectedInvoice.dueAt) },
              { label: 'Outstanding', value: formatCurrencyIdr(selectedOutstanding) },
              { label: 'Aging', value: agingLabel(selectedInvoice) },
            ]"
          />

          <template v-if="selectedInvoice.status === 'void'">
            <p class="text-xs text-destructive mt-3">
              Invoice divoid pada {{ formatDate(selectedInvoice.voidedAt ?? '') }}. Alasan: {{ selectedInvoice.voidReason }}
            </p>
          </template>

          <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2">
            Riwayat Pembayaran
          </p>
          <ul v-if="selectedPayments.length" class="divide-y divide-border">
            <li v-for="payment in selectedPayments" :key="payment.id" class="py-2 flex items-center justify-between gap-3">
              <span class="text-sm text-foreground">{{ formatCurrencyIdr(payment.amountIdr) }}<span v-if="payment.method" class="text-xs text-muted-foreground"> ({{ payment.method }})</span></span>
              <span class="text-xs text-muted-foreground">{{ formatDate(payment.receivedAt) }}</span>
            </li>
          </ul>
          <EmptyState v-else :icon="FileX" title="Belum ada payment tercatat" />

          <template v-if="selectedCreditNotes.length">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2">
              Credit Note
            </p>
            <ul class="divide-y divide-border">
              <li v-for="note in selectedCreditNotes" :key="note.id" class="py-2 flex items-center justify-between gap-3">
                <span class="text-sm text-foreground">{{ note.id }} — {{ formatCurrencyIdr(note.amountIdr) }}</span>
                <StatusBadge :label="findStatusOption(CREDIT_NOTE_STATUSES, note.status).label" :tone="findStatusOption(CREDIT_NOTE_STATUSES, note.status).tone" />
              </li>
            </ul>
          </template>

          <DialogFooter v-if="canManageFinance" class="flex-wrap gap-2 mt-4">
            <Button v-if="canRecordPaymentSelected" size="sm" @click="openPaymentDialog">
              Record Payment
            </Button>
            <Button size="sm" variant="outline" :disabled="selectedInvoice.status === 'void'" @click="openCreditNoteDialog">
              Issue Credit Note
            </Button>
            <Button v-if="canVoidSelected" size="sm" variant="destructive" @click="isVoidOpen = true">
              Void Invoice
            </Button>
            <p v-else class="text-xs text-muted-foreground w-full">
              Invoice yang sudah lunas atau sudah void tidak dapat divoid.
            </p>
          </DialogFooter>
        </template>
      </DialogScrollContent>
    </Dialog>

    <!-- Record Payment dialog -->
    <Dialog v-model:open="isPaymentOpen">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>Mock ledger update — bukan payment gateway nyata.</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-2">
          <div class="space-y-1.5">
            <Label for="pay-amount">Jumlah (Rp)</Label>
            <Input id="pay-amount" v-model.number="paymentAmount" type="number" />
            <p class="text-xs text-muted-foreground">
              Outstanding saat ini: {{ formatCurrencyIdr(selectedOutstanding) }}
            </p>
          </div>
          <div class="space-y-1.5">
            <Label for="pay-method">Metode</Label>
            <select id="pay-method" v-model="paymentMethod" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="bank-transfer">
                Bank Transfer
              </option>
              <option value="credit-card">
                Credit Card
              </option>
              <option value="cash">
                Cash
              </option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isPaymentOpen = false">
            Batal
          </Button>
          <Button :disabled="!paymentAmount || paymentAmount <= 0" @click="submitPayment">
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Void Invoice dialog -->
    <Dialog v-model:open="isVoidOpen">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Void Invoice</DialogTitle>
          <DialogDescription>Transisi terminal — alasan wajib dicatat.</DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5 py-2">
          <Label for="void-reason">Alasan</Label>
          <Input id="void-reason" v-model="voidReason" placeholder="mis. Invoice diterbitkan duplikat" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isVoidOpen = false">
            Batal
          </Button>
          <Button variant="destructive" :disabled="!voidReason.trim()" @click="submitVoid">
            Konfirmasi Void
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Issue Credit Note dialog -->
    <Dialog v-model:open="isCreditNoteOpen">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Issue Credit Note</DialogTitle>
          <DialogDescription>Mengurangi outstanding invoice tanpa mengubah jumlah invoice asli.</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-2">
          <div class="space-y-1.5">
            <Label for="cn-amount">Jumlah (Rp)</Label>
            <Input id="cn-amount" v-model.number="creditNoteAmount" type="number" />
          </div>
          <div class="space-y-1.5">
            <Label for="cn-reason">Alasan</Label>
            <Input id="cn-reason" v-model="creditNoteReason" placeholder="mis. Penyesuaian billing" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isCreditNoteOpen = false">
            Batal
          </Button>
          <Button :disabled="!creditNoteAmount || !creditNoteReason.trim()" @click="submitCreditNote">
            Terbitkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
