<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, CheckCircle2, AlertTriangle } from 'lucide-vue-next'
import { getSupplierInvoiceReconciliationQueue, getServiceOrderById, getVendorById, getProjectById, updateSupplierInvoiceMatchStatus } from '~/data'
import { SUPPLIER_INVOICE_MATCH_STATUSES, SUPPLIER_INVOICE_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { SupplierInvoice } from '~/types/procurement'

/**
 * Reconciliation workspace (Section 20 — Project Finance, roadmap Section 00–24 baru, Wajib). Worklist mock
 * murni (D-006, bukan reconciliation engine nyata) — Supplier Invoice yang `matchStatus` eksplisit
 * `unmatched`/`disputed` (`getSupplierInvoiceReconciliationQueue`, `app/data/index.ts`), dengan aksi manual
 * "Mark Matched" (satu klik, pola sama transisi positif section lain) dan "Flag Disputed" (dialog, alasan
 * opsional dicatat sebagai `ActivityEntry`, TIDAK ada field baru di `SupplierInvoice` untuk menyimpan
 * catatan tsb — konsisten pola `updateSupplierInvoiceMatchStatus` di `app/data/index.ts`).
 */

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Reconciliation' })

const { canView, canManage } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()
const canManageFinance = computed(() => canManage('finance'))

const searchQuery = ref('')

function serviceOrderOf(invoice: SupplierInvoice) {
  return getServiceOrderById(invoice.serviceOrderId)
}
function projectOf(invoice: SupplierInvoice) {
  const so = serviceOrderOf(invoice)
  return so?.projectId ? getProjectById(so.projectId) : undefined
}
function vendorName(invoice: SupplierInvoice) {
  return getVendorById(invoice.vendorId)?.name ?? invoice.vendorId
}

const rows = computed(() => {
  let result = getSupplierInvoiceReconciliationQueue().map(invoice => ({
    invoice, project: projectOf(invoice), vendorLabel: vendorName(invoice),
  }))
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row => row.invoice.id.toLowerCase().includes(q) || row.vendorLabel.toLowerCase().includes(q) || (row.project?.name ?? '').toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.invoice.submittedAt.localeCompare(a.invoice.submittedAt))
})

const unmatchedCount = computed(() => rows.value.filter(row => row.invoice.matchStatus === 'unmatched').length)
const disputedCount = computed(() => rows.value.filter(row => row.invoice.matchStatus === 'disputed').length)

function markMatched(id: string) {
  const result = updateSupplierInvoiceMatchStatus(id, 'matched', currentUser.value.id)
  if (result) showToast('Supplier Invoice Matched', `${result.id} kini berstatus "Matched".`, 'success')
}

/* Flag Disputed */
const isDisputeOpen = ref(false)
const disputeTargetId = ref('')
const disputeNote = ref('')

function openDisputeDialog(id: string) {
  disputeTargetId.value = id
  disputeNote.value = ''
  isDisputeOpen.value = true
}

function submitDispute() {
  if (!disputeTargetId.value || !disputeNote.value.trim()) return
  const result = updateSupplierInvoiceMatchStatus(disputeTargetId.value, 'disputed', currentUser.value.id, disputeNote.value.trim())
  isDisputeOpen.value = false
  if (result) showToast('Supplier Invoice Disputed', `${result.id} ditandai "Disputed".`, 'info')
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Reconciliation"
      description="Worklist mock — Supplier Invoice (AP) yang belum matched, untuk ditriase manual sebelum Close Finance."
      :breadcrumb="[{ label: 'Finance', to: '/finance' }, { label: 'Reconciliation' }]"
    />

    <RoleAccessState v-if="!canView('finance')" module-label="modul Finance" />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard title="Unmatched" :value="String(unmatchedCount)" :icon="AlertTriangle" icon-color="warning" />
        <StatsCard title="Disputed" :value="String(disputedCount)" :icon="AlertTriangle" icon-color="destructive" />
      </div>

      <div class="relative max-w-sm w-full">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Cari Supplier Invoice, vendor, atau project..." class="pl-9" />
      </div>

      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier Invoice</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Jadwal Pembayaran</TableHead>
              <TableHead>Status Invoice</TableHead>
              <TableHead>Match Status</TableHead>
              <TableHead v-if="canManageFinance">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.invoice.id">
              <TableCell class="font-medium text-foreground">{{ row.invoice.id }}</TableCell>
              <TableCell class="text-muted-foreground">{{ row.vendorLabel }}</TableCell>
              <TableCell class="text-muted-foreground">{{ row.project?.name ?? '—' }}</TableCell>
              <TableCell class="text-foreground">{{ formatCurrencyIdr(row.invoice.amountIdr) }}</TableCell>
              <TableCell class="text-muted-foreground">{{ row.invoice.paymentScheduleDate ? formatDate(row.invoice.paymentScheduleDate) : 'Belum dijadwalkan' }}</TableCell>
              <TableCell><StatusBadge :label="findStatusOption(SUPPLIER_INVOICE_STATUSES, row.invoice.status).label" :tone="findStatusOption(SUPPLIER_INVOICE_STATUSES, row.invoice.status).tone" /></TableCell>
              <TableCell><StatusBadge :label="findStatusOption(SUPPLIER_INVOICE_MATCH_STATUSES, row.invoice.matchStatus!).label" :tone="findStatusOption(SUPPLIER_INVOICE_MATCH_STATUSES, row.invoice.matchStatus!).tone" /></TableCell>
              <TableCell v-if="canManageFinance">
                <div class="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" @click="markMatched(row.invoice.id)">
                    <CheckCircle2 class="h-3.5 w-3.5 mr-1" />Mark Matched
                  </Button>
                  <Button v-if="row.invoice.matchStatus !== 'disputed'" size="sm" variant="ghost" @click="openDisputeDialog(row.invoice.id)">Flag Disputed</Button>
                </div>
              </TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="canManageFinance ? 8 : 7">
              {{ searchQuery ? 'Tidak ada Supplier Invoice yang cocok dengan pencarian.' : 'Tidak ada Supplier Invoice yang perlu direkonsiliasi — seluruhnya sudah matched.' }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>

    <Dialog v-model:open="isDisputeOpen">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Flag Disputed</DialogTitle>
          <DialogDescription>Catatan wajib dicatat sebagai audit trail project terkait.</DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5 py-2">
          <Label for="dispute-note">Catatan</Label>
          <Input id="dispute-note" v-model="disputeNote" placeholder="mis. Jumlah tidak sesuai Service Order, menunggu konfirmasi vendor" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isDisputeOpen = false">Batal</Button>
          <Button variant="destructive" :disabled="!disputeNote.trim()" @click="submitDispute">Konfirmasi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
