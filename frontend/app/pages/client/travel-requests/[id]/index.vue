<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Copy } from 'lucide-vue-next'
import {
  getTravelRequestById, getTravelRequestActivities,
  getUserById, getQuotationByLead
} from '~/data'
import { clientAnswerClarificationOnServer, clientCancelTravelRequestOnServer, clientDuplicateTravelRequestOnServer, useClientRequestsSync } from '~/data/client-requests-sync'
import { createSaveGate } from '~/lib/save-gate'
import { TRAVEL_REQUEST_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatDateRange, formatCurrencyIdr } from '~/utils/format'

/** Travel Requests — Detail (Repair Phase Section 3). Isolasi: harus milik `clientScopeId` user login. */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { showToast } = useToast()

const travelRequest = computed(() => getTravelRequestById(String(route.params.id)))
const isOwnCompany = computed(() => Boolean(travelRequest.value && clientScopeId.value && travelRequest.value.clientPartyId === clientScopeId.value))
useHead({ title: computed(() => travelRequest.value ? travelRequest.value.requestName : 'Tidak Ditemukan') })

const activities = computed(() => (travelRequest.value ? getTravelRequestActivities(travelRequest.value.id).map(item => ({ ...item, actorName: item.actorName ?? getUserById(item.ownerId)?.name })) : []))
const serviceScopeOptions = computed(() => SERVICE_TYPES.filter(type => travelRequest.value?.serviceScope.includes(type.value)))

const canEdit = computed(() => travelRequest.value && ['draft', 'need-clarification'].includes(travelRequest.value.status))
const canCancel = computed(() => travelRequest.value && !['cancelled', 'closed', 'converted-to-lead'].includes(travelRequest.value.status))
const relatedQuotation = computed(() => (travelRequest.value?.leadId ? getQuotationByLead(travelRequest.value.leadId) : undefined))

/* S12c-3: every action goes to the server first; sales may have acted since the last load, so read again on open. */
const api = useApi()
const gate = createSaveGate((title, message, tone) => showToast(title, message, tone))
const requestsSync = useClientRequestsSync()
onMounted(() => { requestsSync.load(true) })

async function submitDuplicate () {
  if (!travelRequest.value) { return }
  const id = travelRequest.value.id
  const duplicate = await gate.run('Duplikat Gagal Dibuat', () => clientDuplicateTravelRequestOnServer(api, id))
  if (!duplicate) { return }
  showToast('Duplikat Dibuat', `Draft baru "${duplicate.requestName}" siap diedit.`, 'success')
  router.push(`/client/travel-requests/${duplicate.id}/edit`)
}

const isCancelDialogOpen = ref(false)
const cancelReason = ref('')
async function submitCancel () {
  if (!travelRequest.value || !cancelReason.value.trim()) { return }
  const id = travelRequest.value.id
  const result = await gate.run('Pembatalan Gagal', () => clientCancelTravelRequestOnServer(api, id, cancelReason.value.trim()))
  if (!result) { return }
  isCancelDialogOpen.value = false
  cancelReason.value = ''
  showToast('Travel Request Dibatalkan', `"${result.requestName}" telah dibatalkan.`, 'info')
}

const clarificationMessage = ref('')
async function submitClarificationResponse () {
  if (!travelRequest.value || !clarificationMessage.value.trim()) { return }
  const id = travelRequest.value.id
  const result = await gate.run('Jawaban Gagal Dikirim', () => clientAnswerClarificationOnServer(api, id, clarificationMessage.value.trim()))
  if (!result) { return }
  clarificationMessage.value = ''
  showToast('Jawaban Terkirim', `Status terbaru: ${findStatusOption(TRAVEL_REQUEST_STATUSES, result.status).label}.`, 'success')
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!travelRequest || !isOwnCompany">
      <PageHeader title="Tidak Ditemukan" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Tidak Ditemukan' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Travel Request tidak ditemukan" description="Permintaan ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/client/travel-requests')">
            Kembali ke Travel Requests
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <PageHeader
        :title="travelRequest.requestName"
        :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Request & Approval' }, { label: 'Travel Requests', to: '/client/travel-requests' }, { label: travelRequest.requestName }]"
      >
        <template #actions>
          <StatusBadge :label="findStatusOption(TRAVEL_REQUEST_STATUSES, travelRequest.status).label" :tone="findStatusOption(TRAVEL_REQUEST_STATUSES, travelRequest.status).tone" />
          <NuxtLink v-if="canEdit" :to="`/client/travel-requests/${travelRequest.id}/edit`">
            <Button size="sm" variant="outline">
              Edit
            </Button>
          </NuxtLink>
          <Button size="sm" variant="outline" :disabled="gate.saving.value" @click="submitDuplicate">
            <Copy class="h-4 w-4 mr-1.5" />Duplicate
          </Button>
          <ResponsiveFormSheet v-if="canCancel" v-model:open="isCancelDialogOpen" title="Batalkan Travel Request?" description="Alasan wajib diisi agar tim kami memahami keputusan Anda." content-class="max-w-md">
            <template #trigger>
              <Button size="sm" variant="destructive">
                Cancel
              </Button>
            </template>
            <div class="space-y-1.5 py-2">
              <Label for="cancel-reason">Alasan</Label>
              <Input id="cancel-reason" v-model="cancelReason" placeholder="mis. Rencana perjalanan dibatalkan internal" />
            </div>
            <template #footer>
              <Button variant="outline" @click="isCancelDialogOpen = false">
                Batal
              </Button>
              <Button variant="destructive" :disabled="gate.saving.value || !cancelReason.trim()" @click="submitCancel">
                Batalkan Permintaan
              </Button>
            </template>
          </ResponsiveFormSheet>
        </template>
      </PageHeader>

      <SectionCard v-if="relatedQuotation" title="Lead Terkait">
        <p class="text-sm text-foreground mb-2">
          Permintaan Anda telah dikonversi menjadi Lead dan quotation sedang/sudah tersedia.
        </p>
        <NuxtLink :to="`/client/quotations/${relatedQuotation.id}`" class="text-sm text-primary hover:underline">
          Lihat Lead &amp; Quotation →
        </NuxtLink>
      </SectionCard>

      <SectionCard v-if="travelRequest.status === 'need-clarification'" title="Respond to Clarification" description="Tim kami membutuhkan informasi tambahan sebelum dapat menyiapkan proposal.">
        <p v-if="travelRequest.clarificationNote" class="text-sm text-foreground mb-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
          <span class="font-medium">Pertanyaan tim kami:</span> {{ travelRequest.clarificationNote }}
        </p>
        <textarea v-model="clarificationMessage" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Jawab pertanyaan/klarifikasi yang diminta di sini..." />
        <Button class="mt-3" size="sm" :disabled="gate.saving.value || !clarificationMessage.trim()" @click="submitClarificationResponse">
          Kirim Jawaban
        </Button>
      </SectionCard>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="General Information">
          <DetailMetadataList
            :items="[
              { label: 'Trip Type', value: travelRequest.tripType || '—' },
              { label: 'Destinasi', value: travelRequest.destination },
              {
                label: 'Tanggal',
                value: travelRequest.travelStartDate && travelRequest.travelEndDate
                  ? formatDateRange(travelRequest.travelStartDate, travelRequest.travelEndDate)
                  : (travelRequest.dateFlexible ? 'Fleksibel' : 'Belum ditentukan'),
              },
              { label: 'Estimasi Peserta', value: travelRequest.estimatedParticipants ? `${travelRequest.estimatedParticipants} pax` : '—' },
              { label: 'Estimasi Budget', value: travelRequest.estimatedBudgetIdr ? formatCurrencyIdr(travelRequest.estimatedBudgetIdr) : '—' },
            ]"
          />
          <div v-if="travelRequest.purpose" class="mt-3 pt-3 border-t border-border">
            <p class="text-xs font-medium text-muted-foreground mb-1">
              Tujuan Perjalanan
            </p>
            <p class="text-sm text-foreground whitespace-pre-line">
              {{ travelRequest.purpose }}
            </p>
          </div>
          <div v-if="serviceScopeOptions.length" class="mt-3 pt-3 border-t border-border">
            <p class="text-xs font-medium text-muted-foreground mb-2">
              Layanan
            </p>
            <div class="flex flex-wrap gap-2">
              <StatusBadge v-for="type in serviceScopeOptions" :key="type.value" :label="type.label" :tone="type.tone" />
            </div>
          </div>
          <div v-if="travelRequest.additionalServicesNote" class="mt-3 pt-3 border-t border-border">
            <p class="text-xs font-medium text-muted-foreground mb-1">
              Additional Service
            </p>
            <p class="text-sm text-foreground whitespace-pre-line">
              {{ travelRequest.additionalServicesNote }}
            </p>
          </div>
        </SectionCard>

        <EntityAttachments entity-type="travel-request" :entity-id="travelRequest.id" portal title="Attachment" :readonly="!canEdit" />
      </div>

      <SectionCard title="Activity Timeline">
        <ActivityTimeline :items="activities" empty-label="Belum ada aktivitas" />
      </SectionCard>
    </template>
  </div>
</template>
