<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Send } from 'lucide-vue-next'
import { getRfqById, getRfqsForVendor, getRfqResponseByVendor, getRfqClarifications, submitRfqResponse, addRfqClarificationMessage, getProjectById } from '~/data'
import { RFQ_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateTime } from '~/utils/format'
import type { RFQResponseLineItem } from '~/types/procurement'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, vendorScopeId } = usePermissions()
const { showToast } = useToast()

const rfq = computed(() => getRfqById(String(route.params.id)))
useHead({ title: computed(() => rfq.value ? `RFQ ${rfq.value.id}` : 'RFQ Tidak Ditemukan') })

/** Vendor isolation (Section 17) — hanya dapat diakses bila company diundang ke RFQ ini. */
const isInvited = computed(() => {
  if (!rfq.value || !vendorScopeId.value) { return false }
  return getRfqsForVendor(vendorScopeId.value).some(item => item.id === rfq.value!.id)
})

const project = computed(() => (rfq.value?.projectId ? getProjectById(rfq.value.projectId) : undefined))
const myResponse = computed(() => (rfq.value && vendorScopeId.value ? getRfqResponseByVendor(rfq.value.id, vendorScopeId.value) : undefined))
const clarifications = computed(() => (rfq.value && vendorScopeId.value ? getRfqClarifications(rfq.value.id, vendorScopeId.value) : []))

/* Per-line-item pricing response form */
const responseLines = ref<RFQResponseLineItem[]>([])
function seedResponseForm () {
  if (!rfq.value) { return }
  if (myResponse.value) {
    responseLines.value = myResponse.value.lineItems.map(item => ({ ...item }))
  } else {
    responseLines.value = rfq.value.lineItems.map(item => ({ description: item.description, quantity: item.quantity, unitPriceIdr: 0 }))
  }
}
watch(rfq, seedResponseForm, { immediate: true })
const responseNotes = ref('')
watch(myResponse, (value) => { responseNotes.value = value?.notes ?? '' }, { immediate: true })

const responseTotal = computed(() => responseLines.value.reduce((sum, item) => sum + item.unitPriceIdr * item.quantity, 0))
const canRespond = computed(() => rfq.value && !['closed'].includes(rfq.value.status) && (!myResponse.value || myResponse.value.status === 'submitted'))

function submitResponse () {
  if (!rfq.value || !vendorScopeId.value) { return }
  const result = submitRfqResponse({
    rfqId: rfq.value.id,
    vendorId: vendorScopeId.value,
    lineItems: responseLines.value,
    notes: responseNotes.value.trim() || undefined
  })
  if (result) { showToast('Respons Terkirim', 'Penawaran harga berhasil diajukan.', 'success') }
}

/* Clarification thread */
const newMessage = ref('')
function submitClarification () {
  if (!rfq.value || !vendorScopeId.value || !newMessage.value.trim()) { return }
  addRfqClarificationMessage({ rfqId: rfq.value.id, vendorId: vendorScopeId.value, from: 'supplier', message: newMessage.value.trim() })
  newMessage.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!rfq || !isInvited">
      <PageHeader title="RFQ Tidak Ditemukan" :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'RFQ Inbox', to: '/supplier/rfq' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="RFQ tidak ditemukan" :description="`RFQ dengan ID '${route.params.id}' tidak ada atau company Anda belum diundang.`">
          <Button @click="router.push('/supplier/rfq')">
            Kembali ke RFQ Inbox
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('supplier-portal') || !vendorScopeId" module-label="Supplier Portal" />

    <template v-else>
      <PageHeader :title="rfq.title" :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'RFQ Inbox', to: '/supplier/rfq' }, { label: rfq.id }]">
        <template #actions>
          <StatusBadge :label="findStatusOption(RFQ_STATUSES, rfq.status).label" :tone="findStatusOption(RFQ_STATUSES, rfq.status).tone" />
        </template>
      </PageHeader>

      <SectionCard>
        <p v-if="rfq.notes" class="text-sm text-foreground mb-4 whitespace-pre-line">
          {{ rfq.notes }}
        </p>
        <DetailMetadataList
          :items="[
            { label: 'Project', value: project?.name ?? '—' },
            { label: 'Jenis Layanan', value: findStatusOption(SERVICE_TYPES, rfq.serviceType).label },
            { label: 'Due Date', value: rfq.dueAt ? formatDate(rfq.dueAt) : '—' },
          ]"
        />
      </SectionCard>

      <SectionCard title="Kebutuhan (Line Items)">
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
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard title="Ajukan Penawaran Harga" description="Isi harga satuan per line item — total dihitung otomatis.">
        <div v-if="myResponse" class="mb-3">
          <StatusBadge
            :label="`Status respons Anda: ${myResponse.status}`"
            :tone="myResponse.status === 'selected' ? 'success' : myResponse.status === 'rejected' ? 'destructive' : 'info'"
          />
        </div>
        <div class="space-y-2">
          <div v-for="(line, index) in responseLines" :key="index" class="grid grid-cols-12 gap-2 items-center">
            <span class="col-span-5 text-sm text-foreground">{{ line.description }}</span>
            <span class="col-span-2 text-sm text-muted-foreground">Qty: {{ line.quantity }}</span>
            <div class="col-span-5 space-y-1">
              <Label :for="`price-${index}`" class="text-xs">Harga Satuan (Rp)</Label>
              <Input :id="`price-${index}`" v-model.number="line.unitPriceIdr" type="number" :disabled="!canRespond" />
            </div>
          </div>
        </div>
        <div class="space-y-1.5 mt-4">
          <Label for="response-notes">Catatan (opsional)</Label>
          <Input id="response-notes" v-model="responseNotes" :disabled="!canRespond" placeholder="mis. Sudah termasuk pajak" />
        </div>
        <div class="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div>
            <p class="text-xs text-muted-foreground">
              Total Penawaran
            </p>
            <p class="text-lg font-semibold text-foreground">
              {{ formatCurrencyIdr(responseTotal) }}
            </p>
          </div>
          <Button :disabled="!canRespond" @click="submitResponse">
            <Send class="h-4 w-4 mr-1.5" />{{ myResponse ? 'Perbarui Penawaran' : 'Kirim Penawaran' }}
          </Button>
        </div>
        <p v-if="!canRespond && rfq.status === 'closed'" class="mt-2 text-xs text-muted-foreground">
          RFQ ini sudah ditutup — penawaran tidak dapat diubah lagi.
        </p>
        <p v-else-if="!canRespond" class="mt-2 text-xs text-muted-foreground">
          Penawaran Anda sudah diputuskan ("{{ myResponse?.status }}") — tidak dapat diubah lagi.
        </p>
      </SectionCard>

      <SectionCard title="Clarification Thread" description="Ajukan pertanyaan atau balas klarifikasi dari tim Procurement.">
        <ul v-if="clarifications.length" class="space-y-3 mb-4">
          <li v-for="message in clarifications" :key="message.id" class="rounded-lg border border-border p-3">
            <div class="flex items-center justify-between gap-2 mb-1">
              <StatusBadge :label="message.from === 'procurement' ? 'Procurement' : 'Anda'" :tone="message.from === 'procurement' ? 'primary' : 'info'" />
              <span class="text-xs text-muted-foreground">{{ formatDateTime(message.createdAt) }}</span>
            </div>
            <p class="text-sm text-foreground">
              {{ message.message }}
            </p>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada pesan klarifikasi" />
        <div v-if="rfq.status !== 'closed'" class="flex items-center gap-2 mt-4">
          <Input v-model="newMessage" placeholder="Tulis pesan..." class="flex-1" />
          <Button :disabled="!newMessage.trim()" @click="submitClarification">
            Kirim
          </Button>
        </div>
      </SectionCard>
    </template>
  </div>
</template>
