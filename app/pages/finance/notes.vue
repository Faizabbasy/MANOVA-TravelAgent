<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Plus } from 'lucide-vue-next'
import { CREDIT_NOTES, DEBIT_NOTES, PROJECTS, INVOICES, getProjectById, issueDebitNote } from '~/data'
import { CREDIT_NOTE_STATUSES, DEBIT_NOTE_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'

/**
 * Credit/Debit Notes (Section 20 — Project Finance, roadmap Section 00–24 baru, D-077). List cross-project
 * 2-tab, pola halaman mengikuti `/changes` (query-param tab, Section 19). Credit Note dibuat dari dialog
 * detail Invoice (`/finance/invoices`) atau otomatis lewat hook `updateRefundRequestStatus` (Section 19) —
 * halaman ini murni read-only untuk Credit Note. Debit Note (project-scoped, tidak selalu terikat invoice
 * tertentu) punya action "Buat Debit Note" di sini.
 */

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Credit/Debit Notes' })

const route = useRoute()
const router = useRouter()
const { canView, canManage } = usePermissions()
const { showToast } = useToast()
const canManageFinance = computed(() => canManage('finance'))

type NotesTab = 'credit' | 'debit'
const activeTab = computed<NotesTab>({
  get: () => (route.query.tab === 'debit' ? 'debit' : 'credit'),
  set: value => router.replace({ query: { ...route.query, tab: value } })
})

function invoiceLabel (invoiceId?: string) {
  if (!invoiceId) { return '—' }
  return INVOICES.find(invoice => invoice.id === invoiceId)?.label ?? invoiceId
}

function projectOfInvoice (invoiceId?: string) {
  if (!invoiceId) { return undefined }
  const invoice = INVOICES.find(item => item.id === invoiceId)
  return invoice ? getProjectById(invoice.projectId) : undefined
}

/* Credit Notes */
const creditSearch = ref('')
const creditRows = computed(() => {
  let result = CREDIT_NOTES.map(note => ({ note, invoiceLabel: invoiceLabel(note.invoiceId), project: projectOfInvoice(note.invoiceId) }))
  if (creditSearch.value.trim()) {
    const q = creditSearch.value.toLowerCase()
    result = result.filter(row => row.note.id.toLowerCase().includes(q) || row.invoiceLabel.toLowerCase().includes(q) || (row.project?.name ?? '').toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.note.issuedAt.localeCompare(a.note.issuedAt))
})

/* Debit Notes */
const debitSearch = ref('')
const debitRows = computed(() => {
  let result = DEBIT_NOTES.map(note => ({ note, project: getProjectById(note.projectId) }))
  if (debitSearch.value.trim()) {
    const q = debitSearch.value.toLowerCase()
    result = result.filter(row => row.note.id.toLowerCase().includes(q) || (row.project?.name ?? '').toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.note.issuedAt.localeCompare(a.note.issuedAt))
})

/* Buat Debit Note */
const isCreateOpen = ref(false)
const newProjectId = ref('')
const newInvoiceId = ref('')
const newAmount = ref<number | null>(null)
const newReason = ref('')
const projectInvoices = computed(() => (newProjectId.value ? INVOICES.filter(invoice => invoice.projectId === newProjectId.value) : []))

function resetForm () {
  newProjectId.value = ''
  newInvoiceId.value = ''
  newAmount.value = null
  newReason.value = ''
}

function submitDebitNote () {
  if (!newProjectId.value || !newAmount.value || !newReason.value.trim()) { return }
  const note = issueDebitNote({
    projectId: newProjectId.value,
    invoiceId: newInvoiceId.value || undefined,
    amountIdr: newAmount.value,
    reason: newReason.value.trim()
  })
  if (!note) { showToast('Gagal Membuat Debit Note', 'Periksa kembali project, jumlah, dan alasan.', 'error'); return }
  resetForm()
  isCreateOpen.value = false
  showToast('Debit Note Diterbitkan', `${note.id} tercatat.`, 'success')
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Credit/Debit Notes"
      description="Credit Note (mengurangi outstanding invoice) dan Debit Note (tagihan tambahan informasional) lintas-project."
      :breadcrumb="[{ label: 'Finance', to: '/finance' }, { label: 'Credit/Debit Notes' }]"
    >
      <template v-if="canManageFinance && activeTab === 'debit'" #actions>
        <Dialog v-model:open="isCreateOpen">
          <DialogTrigger as-child>
            <Button size="sm">
              <Plus class="h-4 w-4 mr-1.5" />Buat Debit Note
            </Button>
          </DialogTrigger>
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Buat Debit Note Baru</DialogTitle>
              <DialogDescription>Murni informasional — TIDAK mengubah jumlah invoice mana pun secara otomatis.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="dn-project">Project</Label>
                <select id="dn-project" v-model="newProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="" disabled>
                    Pilih project
                  </option>
                  <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                    {{ project.name }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="dn-invoice">Invoice Terkait (opsional)</Label>
                <select id="dn-invoice" v-model="newInvoiceId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">
                    Tidak terkait invoice tertentu
                  </option>
                  <option v-for="invoice in projectInvoices" :key="invoice.id" :value="invoice.id">
                    {{ invoice.label }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="dn-amount">Jumlah (Rp)</Label>
                <Input id="dn-amount" v-model.number="newAmount" type="number" />
              </div>
              <div class="space-y-1.5">
                <Label for="dn-reason">Alasan</Label>
                <Input id="dn-reason" v-model="newReason" placeholder="mis. Biaya tambahan di luar quotation" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isCreateOpen = false">
                Batal
              </Button>
              <Button :disabled="!newProjectId || !newAmount || !newReason.trim()" @click="submitDebitNote">
                Terbitkan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('finance')" module-label="modul Finance" />

    <template v-else>
      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger value="credit">
            Credit Notes
          </TabsTrigger>
          <TabsTrigger value="debit">
            Debit Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credit">
          <div class="relative max-w-sm w-full mb-4">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="creditSearch" placeholder="Cari Credit Note, invoice, atau project..." class="pl-9" />
          </div>
          <SectionCard description="Dibuat manual dari dialog detail Invoice, atau otomatis saat Refund Request diproses (Section 19).">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Credit Note</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Diterbitkan</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in creditRows" :key="row.note.id">
                  <TableCell class="font-medium text-foreground">
                    {{ row.note.id }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.invoiceLabel }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.project?.name ?? '—' }}
                  </TableCell>
                  <TableCell class="text-foreground">
                    {{ formatCurrencyIdr(row.note.amountIdr) }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ formatDate(row.note.issuedAt) }}
                  </TableCell>
                  <TableCell class="text-muted-foreground max-w-[260px] truncate">
                    {{ row.note.reason }}
                  </TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(CREDIT_NOTE_STATUSES, row.note.status).label" :tone="findStatusOption(CREDIT_NOTE_STATUSES, row.note.status).tone" /></TableCell>
                </TableRow>
                <TableEmpty v-if="creditRows.length === 0" :colspan="7">
                  {{ creditSearch ? 'Tidak ada Credit Note yang cocok dengan pencarian.' : 'Belum ada Credit Note.' }}
                </TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="debit">
          <div class="relative max-w-sm w-full mb-4">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="debitSearch" placeholder="Cari Debit Note atau project..." class="pl-9" />
          </div>
          <SectionCard description="Murni informasional — TIDAK secara otomatis menambah jumlah invoice mana pun.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Debit Note</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Invoice Terkait</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Diterbitkan</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in debitRows" :key="row.note.id">
                  <TableCell class="font-medium text-foreground">
                    {{ row.note.id }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ row.project?.name ?? row.note.projectId }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ invoiceLabel(row.note.invoiceId) }}
                  </TableCell>
                  <TableCell class="text-foreground">
                    {{ formatCurrencyIdr(row.note.amountIdr) }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ formatDate(row.note.issuedAt) }}
                  </TableCell>
                  <TableCell class="text-muted-foreground max-w-[260px] truncate">
                    {{ row.note.reason }}
                  </TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(DEBIT_NOTE_STATUSES, row.note.status).label" :tone="findStatusOption(DEBIT_NOTE_STATUSES, row.note.status).tone" /></TableCell>
                </TableRow>
                <TableEmpty v-if="debitRows.length === 0" :colspan="7">
                  {{ debitSearch ? 'Tidak ada Debit Note yang cocok dengan pencarian.' : 'Belum ada Debit Note.' }}
                </TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
