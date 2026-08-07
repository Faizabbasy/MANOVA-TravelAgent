<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Send } from 'lucide-vue-next'
import { getServiceOrderById, getServiceOrderAmendments, getSupplierInvoicesByServiceOrder, updateServiceOrderStatus, submitSupplierInvoice, getProjectById } from '~/data'
import { SERVICE_ORDER_STATUSES, SUPPLIER_INVOICE_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, vendorScopeId } = usePermissions()
const { showToast } = useToast()

const serviceOrder = computed(() => getServiceOrderById(String(route.params.id)))
useHead({ title: computed(() => serviceOrder.value ? `Service Order ${serviceOrder.value.id}` : 'Service Order Tidak Ditemukan') })

/** Vendor isolation (Section 17) — hanya dapat diakses bila Service Order ini milik `vendorScopeId`. */
const isOwn = computed(() => !!serviceOrder.value && !!vendorScopeId.value && serviceOrder.value.vendorId === vendorScopeId.value)

const project = computed(() => (serviceOrder.value?.projectId ? getProjectById(serviceOrder.value.projectId) : undefined))
const amendments = computed(() => (serviceOrder.value ? getServiceOrderAmendments(serviceOrder.value.id) : []))
const invoices = computed(() => (serviceOrder.value ? getSupplierInvoicesByServiceOrder(serviceOrder.value.id) : []))

/** "Acknowledge a sent Service Order" (Wajib) — hanya dari status `sent`. */
function acknowledge () {
  if (!serviceOrder.value) { return }
  const result = updateServiceOrderStatus(serviceOrder.value.id, 'acknowledged', currentUser.value.id)
  if (result) { showToast('Service Order Diakui', 'Service Order berhasil diakui (acknowledged).', 'success') }
}

/** "Update fulfillment status" (Wajib) — dari `acknowledged`/`amended` ke `fulfilled`. */
function markFulfilled () {
  if (!serviceOrder.value) { return }
  const result = updateServiceOrderStatus(serviceOrder.value.id, 'fulfilled', currentUser.value.id)
  if (result) { showToast('Fulfillment Diperbarui', 'Service Order kini berstatus "Fulfilled".', 'success') }
}

/* "Invoice Submission preview form" (Wajib, resolusi Q12) */
const invoiceAmount = ref<number | null>(null)
const invoiceNote = ref('')
function submitInvoice () {
  if (!serviceOrder.value || !vendorScopeId.value || !invoiceAmount.value) { return }
  const result = submitSupplierInvoice({
    serviceOrderId: serviceOrder.value.id,
    vendorId: vendorScopeId.value,
    amountIdr: invoiceAmount.value,
    note: invoiceNote.value.trim() || undefined
  })
  if (result) {
    showToast('Invoice Diajukan', 'Invoice preview berhasil diajukan untuk direview internal.', 'success')
    invoiceAmount.value = null
    invoiceNote.value = ''
  }
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!serviceOrder || !isOwn">
      <PageHeader title="Service Order Tidak Ditemukan" :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Service Orders', to: '/supplier/orders#service-orders' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Service Order tidak ditemukan" :description="`Service Order dengan ID '${route.params.id}' tidak ada atau bukan milik company Anda.`">
          <Button @click="router.push('/supplier/orders#service-orders')">
            Kembali ke Service Order Inbox
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('supplier-portal') || !vendorScopeId" module-label="Supplier Portal" />

    <template v-else>
      <PageHeader :title="`Service Order ${serviceOrder.id}`" :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Service Orders', to: '/supplier/orders#service-orders' }, { label: serviceOrder.id }]">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="findStatusOption(SERVICE_ORDER_STATUSES, serviceOrder.status).label" :tone="findStatusOption(SERVICE_ORDER_STATUSES, serviceOrder.status).tone" />
            <Button v-if="serviceOrder.status === 'sent'" size="sm" @click="acknowledge">
              Acknowledge
            </Button>
            <Button v-if="['acknowledged', 'amended'].includes(serviceOrder.status)" size="sm" variant="outline" @click="markFulfilled">
              Tandai Fulfilled
            </Button>
          </div>
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList
          :items="[
            { label: 'Project', value: project?.name ?? '— (engagement langsung)' },
            { label: 'RFQ Asal', value: serviceOrder.rfqId ?? '— (engagement langsung)' },
            { label: 'Diakui', value: serviceOrder.acknowledgedAt ? formatDate(serviceOrder.acknowledgedAt) : 'Belum' },
            { label: 'Fulfilled', value: serviceOrder.fulfilledAt ? formatDate(serviceOrder.fulfilledAt) : 'Belum' },
          ]"
        />
      </SectionCard>

      <SectionCard title="Line Items">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Sell Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(item, index) in serviceOrder.lineItems" :key="index">
              <TableCell class="text-foreground">
                {{ item.description }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ item.quantity }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ item.unit }}
              </TableCell>
              <TableCell class="text-foreground">
                {{ index === 0 && serviceOrder.sellPriceIdr !== undefined ? formatCurrencyIdr(serviceOrder.sellPriceIdr) : '—' }}
              </TableCell>
            </TableRow>
            <TableEmpty v-if="serviceOrder.lineItems.length === 0" :colspan="4">
              Belum ada line item.
            </TableEmpty>
          </TableBody>
        </Table>
        <p class="mt-2 text-xs text-muted-foreground">
          Internal cost/margin MANOVA tidak ditampilkan di Supplier Portal — hanya sell price (nilai yang disepakati dengan company Anda).
        </p>
      </SectionCard>

      <SectionCard title="Amendment History">
        <ul v-if="amendments.length" class="divide-y divide-border">
          <li v-for="amendment in amendments" :key="amendment.id" class="py-2">
            <p class="text-sm text-foreground">
              {{ amendment.reason }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ formatDate(amendment.changedAt) }}
            </p>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada amendment tercatat" />
      </SectionCard>

      <SectionCard title="Invoice Submission" description="Ajukan invoice preview (mock) untuk Service Order yang sudah fulfilled — tidak ada payment gateway nyata.">
        <div v-if="serviceOrder.status === 'fulfilled'" class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 items-end">
          <div class="space-y-1.5 sm:col-span-1">
            <Label for="invoice-amount">Jumlah (Rp)</Label>
            <Input id="invoice-amount" v-model.number="invoiceAmount" type="number" placeholder="mis. 4200000" />
          </div>
          <div class="space-y-1.5 sm:col-span-1">
            <Label for="invoice-note">Catatan (opsional)</Label>
            <Input id="invoice-note" v-model="invoiceNote" placeholder="mis. Invoice final" />
          </div>
          <Button :disabled="!invoiceAmount" @click="submitInvoice">
            <Send class="h-4 w-4 mr-1.5" />Ajukan Invoice
          </Button>
        </div>
        <p v-else class="text-xs text-muted-foreground mb-4">
          Invoice hanya dapat diajukan setelah Service Order berstatus "Fulfilled".
        </p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jumlah</TableHead>
              <TableHead>Diajukan</TableHead>
              <TableHead>Catatan</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="invoice in invoices" :key="invoice.id">
              <TableCell class="text-foreground">
                {{ formatCurrencyIdr(invoice.amountIdr) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDate(invoice.submittedAt) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ invoice.note ?? '—' }}{{ invoice.reviewNote ? ` — Review: ${invoice.reviewNote}` : '' }}
              </TableCell>
              <TableCell><StatusBadge :label="findStatusOption(SUPPLIER_INVOICE_STATUSES, invoice.status).label" :tone="findStatusOption(SUPPLIER_INVOICE_STATUSES, invoice.status).tone" /></TableCell>
            </TableRow>
            <TableEmpty v-if="invoices.length === 0" :colspan="4">
              Belum ada invoice diajukan.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
