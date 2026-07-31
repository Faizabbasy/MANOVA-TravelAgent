<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import {
  getServiceOrderById, getServiceOrderAmendments, getSupplierInvoicesByServiceOrder,
  updateServiceOrderStatus, getServiceOrderStatusTransitions, amendServiceOrder, reviewSupplierInvoice,
  getProjectById, getVendorById,
} from '~/data'
import { SERVICE_ORDER_STATUSES, SUPPLIER_INVOICE_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { ServiceOrderStatus, SupplierInvoiceStatus } from '~/types/procurement'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, canManage, canViewFinancials } = usePermissions()
const canManageProcurement = computed(() => canManage('procurement'))
const canViewProcurementFinancials = computed(() => canManageProcurement.value || canViewFinancials.value)
const { showToast } = useToast()

const serviceOrder = computed(() => getServiceOrderById(String(route.params.id)))
useHead({ title: computed(() => serviceOrder.value ? `Service Order ${serviceOrder.value.id}` : 'Service Order Tidak Ditemukan') })

const project = computed(() => (serviceOrder.value?.projectId ? getProjectById(serviceOrder.value.projectId) : undefined))
const vendor = computed(() => (serviceOrder.value ? getVendorById(serviceOrder.value.vendorId) : undefined))
const amendments = computed(() => (serviceOrder.value ? getServiceOrderAmendments(serviceOrder.value.id) : []))
const invoices = computed(() => (serviceOrder.value ? getSupplierInvoicesByServiceOrder(serviceOrder.value.id) : []))

/** "Fulfillment status timeline" (Wajib) — derivasi urutan literal, menandai tahap yang sudah dilewati vs berikutnya. */
const TIMELINE_STEPS: ServiceOrderStatus[] = ['draft', 'sent', 'acknowledged', 'fulfilled']
const timelineIndex = computed(() => {
  if (!serviceOrder.value) return -1
  if (serviceOrder.value.status === 'amended') return TIMELINE_STEPS.indexOf('acknowledged')
  if (serviceOrder.value.status === 'cancelled') return -1
  return TIMELINE_STEPS.indexOf(serviceOrder.value.status)
})

const summaryMetadata = computed(() => {
  if (!serviceOrder.value) return []
  return [
    { label: 'Project', value: project.value?.name ?? '— (engagement langsung)' },
    { label: 'Vendor', value: vendor.value?.name ?? serviceOrder.value.vendorId },
    { label: 'RFQ Asal', value: serviceOrder.value.rfqId ?? '— (engagement langsung)' },
    { label: 'Diakui Supplier', value: serviceOrder.value.acknowledgedAt ? formatDate(serviceOrder.value.acknowledgedAt) : 'Belum' },
    { label: 'Fulfilled', value: serviceOrder.value.fulfilledAt ? formatDate(serviceOrder.value.fulfilledAt) : 'Belum' },
    { label: 'Dibuat', value: formatDate(serviceOrder.value.createdAt) },
  ]
})

/* Status transitions */
const isCancelDialogOpen = ref(false)
const cancelReason = ref('')
function requestStatusChange(newStatus: ServiceOrderStatus) {
  if (!serviceOrder.value) return
  if (newStatus === 'cancelled') {
    cancelReason.value = ''
    isCancelDialogOpen.value = true
    return
  }
  const result = updateServiceOrderStatus(serviceOrder.value.id, newStatus, currentUser.value.id)
  if (result) showToast('Status Diperbarui', `Service Order kini berstatus "${findStatusOption(SERVICE_ORDER_STATUSES, newStatus).label}".`, 'success')
}
function submitCancel() {
  if (!serviceOrder.value || !cancelReason.value.trim()) return
  const result = updateServiceOrderStatus(serviceOrder.value.id, 'cancelled', currentUser.value.id, cancelReason.value.trim())
  isCancelDialogOpen.value = false
  if (result) showToast('Service Order Dibatalkan', 'Service Order kini berstatus "Cancelled".', 'success')
}

/* Amendment */
const isAmendOpen = ref(false)
const amendReason = ref('')
function submitAmend() {
  if (!serviceOrder.value || !amendReason.value.trim()) return
  const result = amendServiceOrder(serviceOrder.value.id, amendReason.value.trim(), currentUser.value.id)
  isAmendOpen.value = false
  amendReason.value = ''
  if (result) showToast('Service Order Diamandemen', 'Perubahan tercatat di riwayat amendment.', 'success')
}

/* Invoice review (internal) */
function reviewInvoice(invoiceId: string, status: SupplierInvoiceStatus, note?: string) {
  const result = reviewSupplierInvoice(invoiceId, status, currentUser.value.id, note)
  if (result) showToast('Invoice Direview', `Invoice kini berstatus "${findStatusOption(SUPPLIER_INVOICE_STATUSES, status).label}".`, 'success')
}
const isRejectInvoiceOpen = ref(false)
const pendingRejectInvoiceId = ref('')
const rejectInvoiceNote = ref('')
function openRejectInvoice(invoiceId: string) {
  pendingRejectInvoiceId.value = invoiceId
  rejectInvoiceNote.value = ''
  isRejectInvoiceOpen.value = true
}
function submitRejectInvoice() {
  if (!pendingRejectInvoiceId.value || !rejectInvoiceNote.value.trim()) return
  reviewInvoice(pendingRejectInvoiceId.value, 'rejected', rejectInvoiceNote.value.trim())
  isRejectInvoiceOpen.value = false
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!serviceOrder">
      <PageHeader title="Service Order Tidak Ditemukan" :breadcrumb="[{ label: 'Procurement', to: '/procurement?tab=service-orders' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Service Order tidak ditemukan" :description="`Service Order dengan ID '${route.params.id}' tidak ada di data demo saat ini.`">
          <Button @click="router.push('/procurement?tab=service-orders')">Kembali ke Daftar Service Order</Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('procurement')" module-label="modul Procurement" />

    <template v-else>
      <PageHeader :title="`Service Order ${serviceOrder.id}`" :breadcrumb="[{ label: 'Procurement', to: '/procurement?tab=service-orders' }, { label: serviceOrder.id }]">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="findStatusOption(SERVICE_ORDER_STATUSES, serviceOrder.status).label" :tone="findStatusOption(SERVICE_ORDER_STATUSES, serviceOrder.status).tone" />
            <template v-if="canManageProcurement">
              <Button v-if="['acknowledged', 'amended'].includes(serviceOrder.status)" size="sm" variant="outline" @click="isAmendOpen = true">Amend</Button>
              <Button
                v-for="next in getServiceOrderStatusTransitions(serviceOrder.status)" :key="next"
                size="sm" :variant="next === 'cancelled' ? 'destructive' : 'outline'"
                @click="requestStatusChange(next)"
              >{{ findStatusOption(SERVICE_ORDER_STATUSES, next).label }}</Button>
            </template>
          </div>
        </template>
      </PageHeader>

      <!-- Fulfillment status timeline -->
      <SectionCard title="Fulfillment Status Timeline">
        <div v-if="serviceOrder.status === 'cancelled'" class="text-sm text-destructive font-medium">Service Order dibatalkan{{ serviceOrder.statusReason ? ` — Alasan: ${serviceOrder.statusReason}` : '' }}.</div>
        <ol v-else class="flex flex-wrap items-center gap-2">
          <li v-for="(step, index) in TIMELINE_STEPS" :key="step" class="flex items-center gap-2">
            <span
              class="text-xs font-medium px-2.5 py-1 rounded-full border"
              :class="index <= timelineIndex ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground'"
            >{{ findStatusOption(SERVICE_ORDER_STATUSES, step).label }}</span>
            <span v-if="index < TIMELINE_STEPS.length - 1" class="text-muted-foreground">→</span>
          </li>
          <li v-if="serviceOrder.status === 'amended'" class="text-xs font-medium px-2.5 py-1 rounded-full border border-purple-500 text-purple-600">Amended (di luar jalur utama)</li>
        </ol>
      </SectionCard>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
      </SectionCard>

      <SectionCard title="Line Items">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(item, index) in serviceOrder.lineItems" :key="index">
              <TableCell class="text-foreground">{{ item.description }}</TableCell>
              <TableCell class="text-muted-foreground">{{ item.quantity }}</TableCell>
              <TableCell class="text-muted-foreground">{{ item.unit }}</TableCell>
            </TableRow>
            <TableEmpty v-if="serviceOrder.lineItems.length === 0" :colspan="3">Belum ada line item.</TableEmpty>
          </TableBody>
        </Table>
        <div class="grid gap-3 sm:grid-cols-2 mt-4">
          <div v-if="canViewProcurementFinancials" class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">Net Cost (Internal)</p>
            <p class="text-lg font-semibold text-foreground">{{ serviceOrder.netCostIdr !== undefined ? formatCurrencyIdr(serviceOrder.netCostIdr) : '—' }}</p>
          </div>
          <div class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">Sell Price</p>
            <p class="text-lg font-semibold text-foreground">{{ serviceOrder.sellPriceIdr !== undefined ? formatCurrencyIdr(serviceOrder.sellPriceIdr) : '—' }}</p>
          </div>
        </div>
        <p v-if="!canViewProcurementFinancials" class="mt-2 text-xs text-muted-foreground">Net cost internal tidak ditampilkan untuk role ini.</p>
      </SectionCard>

      <SectionCard title="Amendment History" description="Riwayat perubahan Service Order (append-only).">
        <ul v-if="amendments.length" class="divide-y divide-border">
          <li v-for="amendment in amendments" :key="amendment.id" class="py-2">
            <p class="text-sm text-foreground">{{ amendment.reason }}</p>
            <p class="text-xs text-muted-foreground">{{ formatDate(amendment.changedAt) }}</p>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada amendment tercatat" />
      </SectionCard>

      <SectionCard title="Supplier Invoice" description="Invoice yang diajukan supplier terhadap Service Order ini (preview/mock).">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jumlah</TableHead>
              <TableHead>Diajukan</TableHead>
              <TableHead>Catatan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead v-if="canManageProcurement">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="invoice in invoices" :key="invoice.id">
              <TableCell class="text-foreground">{{ formatCurrencyIdr(invoice.amountIdr) }}</TableCell>
              <TableCell class="text-muted-foreground">{{ formatDate(invoice.submittedAt) }}</TableCell>
              <TableCell class="text-muted-foreground">{{ invoice.note ?? '—' }}{{ invoice.reviewNote ? ` — Review: ${invoice.reviewNote}` : '' }}</TableCell>
              <TableCell><StatusBadge :label="findStatusOption(SUPPLIER_INVOICE_STATUSES, invoice.status).label" :tone="findStatusOption(SUPPLIER_INVOICE_STATUSES, invoice.status).tone" /></TableCell>
              <TableCell v-if="canManageProcurement">
                <div v-if="invoice.status === 'submitted' || invoice.status === 'under-review'" class="flex flex-wrap gap-1.5">
                  <Button v-if="invoice.status === 'submitted'" size="sm" variant="outline" @click="reviewInvoice(invoice.id, 'under-review')">Review</Button>
                  <Button size="sm" variant="outline" @click="reviewInvoice(invoice.id, 'approved')">Approve</Button>
                  <Button size="sm" variant="destructive" @click="openRejectInvoice(invoice.id)">Reject</Button>
                </div>
              </TableCell>
            </TableRow>
            <TableEmpty v-if="invoices.length === 0" :colspan="canManageProcurement ? 5 : 4">Belum ada invoice diajukan.</TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>

      <!-- Cancel dialog -->
      <Dialog v-model:open="isCancelDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Service Order</DialogTitle>
            <DialogDescription>Alasan wajib dicatat — akan tersimpan sebagai jejak historis di Activity & Changes project terkait (bila terhubung).</DialogDescription>
          </DialogHeader>
          <div class="space-y-1.5 py-2">
            <Label for="cancel-reason">Alasan</Label>
            <Input id="cancel-reason" v-model="cancelReason" placeholder="mis. Kebutuhan dibatalkan klien" />
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isCancelDialogOpen = false">Batal</Button>
            <Button variant="destructive" :disabled="!cancelReason.trim()" @click="submitCancel">Konfirmasi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Amend dialog -->
      <Dialog v-model:open="isAmendOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Amend Service Order</DialogTitle>
            <DialogDescription>Alasan amandemen wajib diisi — tercatat di riwayat amendment.</DialogDescription>
          </DialogHeader>
          <div class="space-y-1.5 py-2">
            <Label for="amend-reason">Alasan</Label>
            <Input id="amend-reason" v-model="amendReason" placeholder="mis. Penambahan jumlah kamar" />
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isAmendOpen = false">Batal</Button>
            <Button :disabled="!amendReason.trim()" @click="submitAmend">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Reject invoice dialog -->
      <Dialog v-model:open="isRejectInvoiceOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Invoice</DialogTitle>
            <DialogDescription>Catatan alasan penolakan wajib diisi.</DialogDescription>
          </DialogHeader>
          <div class="space-y-1.5 py-2">
            <Label for="reject-invoice-note">Catatan</Label>
            <Input id="reject-invoice-note" v-model="rejectInvoiceNote" placeholder="mis. Jumlah tidak sesuai kontrak" />
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isRejectInvoiceOpen = false">Batal</Button>
            <Button variant="destructive" :disabled="!rejectInvoiceNote.trim()" @click="submitRejectInvoice">Konfirmasi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
