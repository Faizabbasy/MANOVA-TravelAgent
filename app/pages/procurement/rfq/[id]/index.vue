<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Send, Plus } from 'lucide-vue-next'
import {
  getRfqById, getRfqInvitations, getRfqResponses, getRfqResponseByVendor, getRfqClarifications,
  sendRfqToVendors, moveRfqStatus, getRfqStatusTransitions,
  selectRfqVendor, closeRfq, addRfqClarificationMessage,
  getProjectById, getVendorById, VENDORS,
  getServiceOrdersByRfq, createServiceOrder
} from '~/data'
import { RFQ_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateTime } from '~/utils/format'
import type { RFQStatus } from '~/types/procurement'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, canManage } = usePermissions()
const canManageProcurement = computed(() => canManage('procurement'))
const { showToast } = useToast()

const rfq = computed(() => getRfqById(String(route.params.id)))
useHead({ title: computed(() => rfq.value ? `RFQ ${rfq.value.id}` : 'RFQ Tidak Ditemukan') })

const project = computed(() => (rfq.value?.projectId ? getProjectById(rfq.value.projectId) : undefined))
const invitations = computed(() => (rfq.value ? getRfqInvitations(rfq.value.id) : []))
const responses = computed(() => (rfq.value ? getRfqResponses(rfq.value.id) : []))

function vendorName (id: string) {
  return getVendorById(id)?.name ?? id
}

const summaryMetadata = computed(() => {
  if (!rfq.value) { return [] }
  return [
    { label: 'Project', value: project.value?.name ?? '— (belum terhubung project)' },
    { label: 'Jenis Layanan', value: findStatusOption(SERVICE_TYPES, rfq.value.serviceType).label },
    { label: 'Due Date', value: rfq.value.dueAt ? formatDate(rfq.value.dueAt) : '—' },
    { label: 'Vendor Diundang', value: `${invitations.value.length} vendor` },
    { label: 'Respons Masuk', value: `${responses.value.length} respons` },
    { label: 'Dibuat', value: formatDate(rfq.value.createdAt) }
  ]
})

/* Kirim ke vendor (draft -> sent) */
const isSendOpen = ref(false)
const selectedVendorIds = ref<string[]>([])
const candidateVendors = computed(() => (rfq.value ? VENDORS.filter(v => v.serviceType === rfq.value!.serviceType) : []))
function openSendDialog () {
  selectedVendorIds.value = []
  isSendOpen.value = true
}
function toggleVendorSelection (vendorId: string, checked: boolean) {
  if (checked) { selectedVendorIds.value.push(vendorId) } else { selectedVendorIds.value = selectedVendorIds.value.filter(id => id !== vendorId) }
}
function submitSend () {
  if (!rfq.value || selectedVendorIds.value.length === 0) { return }
  const result = sendRfqToVendors(rfq.value.id, selectedVendorIds.value)
  isSendOpen.value = false
  if (result) { showToast('RFQ Terkirim', `RFQ dikirim ke ${selectedVendorIds.value.length} vendor.`, 'success') }
}

/* Transisi status manual (comparison/clarification/selected/closed) */
function requestStatusChange (newStatus: RFQStatus) {
  if (!rfq.value) { return }
  if (newStatus === 'closed') {
    const result = closeRfq(rfq.value.id)
    if (result) { showToast('RFQ Ditutup', 'RFQ kini berstatus "Closed".', 'success') }
    return
  }
  const result = moveRfqStatus(rfq.value.id, newStatus)
  if (result) { showToast('Status Diperbarui', `RFQ kini berstatus "${findStatusOption(RFQ_STATUSES, newStatus).label}".`, 'success') }
}

/* Formal Select action */
const isSelectOpen = ref(false)
const pendingSelectVendorId = ref('')
function openSelectDialog (vendorId: string) {
  pendingSelectVendorId.value = vendorId
  isSelectOpen.value = true
}
function confirmSelect () {
  if (!rfq.value || !pendingSelectVendorId.value) { return }
  const result = selectRfqVendor(rfq.value.id, pendingSelectVendorId.value, currentUser.value.id)
  isSelectOpen.value = false
  if (result) { showToast('Vendor Terpilih', `${vendorName(pendingSelectVendorId.value)} ditetapkan sebagai vendor terpilih.`, 'success') }
}

/* Handoff RFQ -> Service Order (setelah vendor terpilih) */
const relatedServiceOrders = computed(() => (rfq.value ? getServiceOrdersByRfq(rfq.value.id) : []))
function createServiceOrderFromRfq () {
  if (!rfq.value || !rfq.value.selectedVendorId) { return }
  const winningResponse = getRfqResponseByVendor(rfq.value.id, rfq.value.selectedVendorId)
  const serviceOrder = createServiceOrder({
    rfqId: rfq.value.id,
    vendorId: rfq.value.selectedVendorId,
    projectId: rfq.value.projectId,
    lineItems: rfq.value.lineItems.map(item => ({ description: item.description, quantity: item.quantity, unit: item.unit })),
    sellPriceIdr: winningResponse?.totalAmountIdr
  })
  showToast('Service Order Dibuat', `Service Order ${serviceOrder.id} dibuat dari RFQ ini.`, 'success')
  navigateTo(`/procurement/service-orders/${serviceOrder.id}`)
}

/* Clarification thread per vendor — default ke vendor dengan thread aktif (bila ada), lalu vendor terpilih, lalu vendor pertama yang diundang. */
const activeClarificationVendorId = computed(() => {
  if (!rfq.value) { return '' }
  const vendorWithThread = getRfqClarifications(rfq.value.id)[0]?.vendorId
  return vendorWithThread ?? rfq.value.selectedVendorId ?? invitations.value[0]?.vendorId ?? ''
})
const selectedClarificationVendorId = ref('')
const clarificationVendorId = computed({
  get: () => selectedClarificationVendorId.value || activeClarificationVendorId.value,
  set: value => (selectedClarificationVendorId.value = value)
})
const clarificationMessages = computed(() => (rfq.value && clarificationVendorId.value ? getRfqClarifications(rfq.value.id, clarificationVendorId.value) : []))
const newClarificationMessage = ref('')
function submitClarification () {
  if (!rfq.value || !clarificationVendorId.value || !newClarificationMessage.value.trim()) { return }
  addRfqClarificationMessage({ rfqId: rfq.value.id, vendorId: clarificationVendorId.value, from: 'procurement', message: newClarificationMessage.value.trim() })
  newClarificationMessage.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!rfq">
      <PageHeader title="RFQ Tidak Ditemukan" :breadcrumb="[{ label: 'Procurement', to: '/procurement' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="RFQ tidak ditemukan" :description="`RFQ dengan ID '${route.params.id}' tidak ada di data demo saat ini.`">
          <Button @click="router.push('/procurement')">
            Kembali ke Daftar Procurement
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('procurement')" module-label="modul Procurement" />

    <template v-else>
      <PageHeader :title="rfq.title" :breadcrumb="[{ label: 'Procurement', to: '/procurement' }, { label: rfq.id }]">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="findStatusOption(RFQ_STATUSES, rfq.status).label" :tone="findStatusOption(RFQ_STATUSES, rfq.status).tone" />
            <template v-if="canManageProcurement">
              <Button v-if="rfq.status === 'draft'" size="sm" variant="outline" @click="openSendDialog">
                <Send class="h-4 w-4 mr-1.5" />Kirim ke Vendor
              </Button>
              <Button
                v-for="next in getRfqStatusTransitions(rfq.status)"
                :key="next"
                size="sm"
                variant="outline"
                @click="requestStatusChange(next)"
              >
                {{ findStatusOption(RFQ_STATUSES, next).label }}
              </Button>
            </template>
          </div>
        </template>
      </PageHeader>

      <SectionCard>
        <p v-if="rfq.notes" class="text-sm text-foreground mb-4 whitespace-pre-line">
          {{ rfq.notes }}
        </p>
        <DetailMetadataList :items="summaryMetadata" />
      </SectionCard>

      <SectionCard title="Line Items" description="Kebutuhan yang dikirim ke seluruh vendor yang diundang.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(item, index) in rfq.lineItems" :key="index">
              <TableCell class="text-foreground">
                {{ item.description }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ item.quantity }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ item.unit }}
              </TableCell>
            </TableRow>
            <TableEmpty v-if="rfq.lineItems.length === 0" :colspan="3">
              Belum ada line item.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard title="Vendor Diundang dan Status Respons">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Diundang</TableHead>
              <TableHead>Status Respons</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="invitation in invitations" :key="invitation.id">
              <TableCell class="font-medium text-foreground">
                {{ vendorName(invitation.vendorId) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDate(invitation.invitedAt) }}
              </TableCell>
              <TableCell><StatusBadge :label="invitation.status" :tone="invitation.status === 'responded' ? 'success' : invitation.status === 'declined' ? 'destructive' : 'warning'" /></TableCell>
            </TableRow>
            <TableEmpty v-if="invitations.length === 0" :colspan="3">
              RFQ belum dikirim ke vendor manapun.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard title="Side-by-Side Comparison" description="Perbandingan respons harga seluruh vendor, diurutkan dari harga terendah.">
        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Total Penawaran</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead>Diajukan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead v-if="canManageProcurement">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="response in responses" :key="response.id">
                <TableCell class="font-medium text-foreground">
                  {{ vendorName(response.vendorId) }}
                </TableCell>
                <TableCell class="text-foreground">
                  {{ formatCurrencyIdr(response.totalAmountIdr) }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ response.notes ?? '—' }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ formatDate(response.submittedAt) }}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    :label="response.status"
                    :tone="response.status === 'selected' ? 'success' : response.status === 'rejected' ? 'destructive' : 'info'"
                  />
                </TableCell>
                <TableCell v-if="canManageProcurement">
                  <Button
                    v-if="['responses-in', 'comparison', 'clarification'].includes(rfq.status) && response.status === 'submitted'"
                    size="sm"
                    variant="outline"
                    @click="openSelectDialog(response.vendorId)"
                  >
                    Select
                  </Button>
                </TableCell>
              </TableRow>
              <TableEmpty v-if="responses.length === 0" :colspan="canManageProcurement ? 6 : 5">
                Belum ada respons vendor.
              </TableEmpty>
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <SectionCard v-if="rfq.status === 'selected' || rfq.status === 'closed'" title="Service Order" description="Handoff formal dari RFQ ke Service Order setelah vendor terpilih.">
        <template v-if="canManageProcurement && relatedServiceOrders.length === 0" #actions>
          <Button size="sm" variant="outline" @click="createServiceOrderFromRfq">
            Buat Service Order
          </Button>
        </template>
        <ul v-if="relatedServiceOrders.length" class="divide-y divide-border">
          <li v-for="so in relatedServiceOrders" :key="so.id" class="py-2">
            <NuxtLink :to="`/procurement/service-orders/${so.id}`" class="text-sm font-medium text-primary hover:underline">
              {{ so.id }} — {{ vendorName(so.vendorId) }}
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada Service Order dibuat dari RFQ ini" />
      </SectionCard>

      <SectionCard title="Clarification Thread" description="Thread klarifikasi per vendor.">
        <template #actions>
          <select v-if="invitations.length" v-model="clarificationVendorId" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option v-for="invitation in invitations" :key="invitation.vendorId" :value="invitation.vendorId">
              {{ vendorName(invitation.vendorId) }}
            </option>
          </select>
        </template>
        <ul v-if="clarificationMessages.length" class="space-y-3 mb-4">
          <li v-for="message in clarificationMessages" :key="message.id" class="rounded-lg border border-border p-3">
            <div class="flex items-center justify-between gap-2 mb-1">
              <StatusBadge :label="message.from === 'procurement' ? 'Procurement' : 'Supplier'" :tone="message.from === 'procurement' ? 'primary' : 'info'" />
              <span class="text-xs text-muted-foreground">{{ formatDateTime(message.createdAt) }}</span>
            </div>
            <p class="text-sm text-foreground">
              {{ message.message }}
            </p>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada pesan klarifikasi untuk vendor ini" />
        <div v-if="canManageProcurement && clarificationVendorId" class="flex items-center gap-2 mt-4">
          <Input v-model="newClarificationMessage" placeholder="Tulis pesan klarifikasi ke vendor..." class="flex-1" />
          <Button :disabled="!newClarificationMessage.trim()" @click="submitClarification">
            <Plus class="h-4 w-4 mr-1.5" />Kirim
          </Button>
        </div>
      </SectionCard>

      <!-- Kirim ke vendor dialog -->
      <Dialog v-model:open="isSendOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Kirim RFQ ke Vendor</DialogTitle>
            <DialogDescription>Pilih vendor dengan jenis layanan yang sesuai ({{ findStatusOption(SERVICE_TYPES, rfq.serviceType).label }}).</DialogDescription>
          </DialogHeader>
          <div class="space-y-2 py-2 max-h-64 overflow-y-auto">
            <label v-for="vendor in candidateVendors" :key="vendor.id" class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <Checkbox :model-value="selectedVendorIds.includes(vendor.id)" @update:model-value="checked => toggleVendorSelection(vendor.id, Boolean(checked))" />
              {{ vendor.name }}
            </label>
            <p v-if="candidateVendors.length === 0" class="text-xs text-muted-foreground">
              Tidak ada vendor dengan jenis layanan yang sesuai.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isSendOpen = false">
              Batal
            </Button>
            <Button :disabled="selectedVendorIds.length === 0" @click="submitSend">
              Kirim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Formal select confirmation -->
      <Dialog v-model:open="isSelectOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Pilih Vendor Ini?</DialogTitle>
            <DialogDescription>{{ vendorName(pendingSelectVendorId) }} akan ditetapkan sebagai vendor terpilih. Respons vendor lain otomatis ditolak.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="isSelectOpen = false">
              Batal
            </Button>
            <Button @click="confirmSelect">
              Konfirmasi Pilih
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
