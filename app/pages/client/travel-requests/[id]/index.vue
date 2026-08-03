<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Copy } from 'lucide-vue-next'
import {
  getTravelRequestById, getTravelRequestActivities, getTravelRequestAttachments,
  duplicateTravelRequest, cancelTravelRequest, respondToTravelRequestClarification,
  getUserById
} from '~/data'
import { TRAVEL_REQUEST_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatDateRange, formatCurrencyIdr, formatDate } from '~/utils/format'

/** Travel Requests — Detail (Repair Phase Section 3). Isolasi: harus milik `clientScopeId` user login. */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const travelRequest = computed(() => getTravelRequestById(String(route.params.id)))
const isOwnCompany = computed(() => Boolean(travelRequest.value && clientScopeId.value && travelRequest.value.clientPartyId === clientScopeId.value))
useHead({ title: computed(() => travelRequest.value ? travelRequest.value.requestName : 'Tidak Ditemukan') })

const activities = computed(() => (travelRequest.value ? getTravelRequestActivities(travelRequest.value.id).map(item => ({ ...item, actorName: getUserById(item.ownerId)?.name })) : []))
const attachments = computed(() => (travelRequest.value ? getTravelRequestAttachments(travelRequest.value.id) : []))
const serviceScopeOptions = computed(() => SERVICE_TYPES.filter(type => travelRequest.value?.serviceScope.includes(type.value)))

const canEdit = computed(() => travelRequest.value && ['draft', 'need-clarification'].includes(travelRequest.value.status))
const canCancel = computed(() => travelRequest.value && !['cancelled', 'closed', 'converted-to-opportunity'].includes(travelRequest.value.status))

function submitDuplicate () {
  if (!travelRequest.value) { return }
  const duplicate = duplicateTravelRequest(travelRequest.value.id, currentUser.value.id)
  if (!duplicate) { return }
  showToast('Duplikat Dibuat', `Draft baru "${duplicate.requestName}" siap diedit.`, 'success')
  router.push(`/client/travel-requests/${duplicate.id}/edit`)
}

const isCancelDialogOpen = ref(false)
const cancelReason = ref('')
function submitCancel () {
  if (!travelRequest.value || !cancelReason.value.trim()) { return }
  const result = cancelTravelRequest(travelRequest.value.id, currentUser.value.id, cancelReason.value.trim())
  isCancelDialogOpen.value = false
  cancelReason.value = ''
  if (result) { showToast('Travel Request Dibatalkan', `"${result.requestName}" telah dibatalkan.`, 'info') }
}

const clarificationMessage = ref('')
function submitClarificationResponse () {
  if (!travelRequest.value || !clarificationMessage.value.trim()) { return }
  const result = respondToTravelRequestClarification(travelRequest.value.id, currentUser.value.id, clarificationMessage.value.trim())
  clarificationMessage.value = ''
  if (result) { showToast('Jawaban Terkirim', `Status terbaru: ${findStatusOption(TRAVEL_REQUEST_STATUSES, result.status).label}.`, 'success') }
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
        :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Request & Commercial' }, { label: 'Travel Requests', to: '/client/travel-requests' }, { label: travelRequest.requestName }]"
      >
        <template #actions>
          <StatusBadge :label="findStatusOption(TRAVEL_REQUEST_STATUSES, travelRequest.status).label" :tone="findStatusOption(TRAVEL_REQUEST_STATUSES, travelRequest.status).tone" />
          <NuxtLink v-if="canEdit" :to="`/client/travel-requests/${travelRequest.id}/edit`">
            <Button size="sm" variant="outline">
              Edit
            </Button>
          </NuxtLink>
          <Button size="sm" variant="outline" @click="submitDuplicate">
            <Copy class="h-4 w-4 mr-1.5" />Duplicate
          </Button>
          <Dialog v-if="canCancel" v-model:open="isCancelDialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="destructive">
                Cancel
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Batalkan Travel Request?</DialogTitle>
                <DialogDescription>Alasan wajib diisi agar tim kami memahami keputusan Anda.</DialogDescription>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="cancel-reason">Alasan</Label>
                <Input id="cancel-reason" v-model="cancelReason" placeholder="mis. Rencana perjalanan dibatalkan internal" />
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isCancelDialogOpen = false">
                  Batal
                </Button>
                <Button variant="destructive" :disabled="!cancelReason.trim()" @click="submitCancel">
                  Batalkan Permintaan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </template>
      </PageHeader>

      <SectionCard v-if="travelRequest.opportunityId" title="Opportunity Terkait">
        <p class="text-sm text-foreground mb-2">
          Permintaan Anda telah dikonversi menjadi Opportunity dan quotation sedang/sudah tersedia.
        </p>
        <NuxtLink :to="`/client/opportunities/${travelRequest.opportunityId}`" class="text-sm text-primary hover:underline">
          Lihat Opportunity &amp; Quotation →
        </NuxtLink>
      </SectionCard>

      <SectionCard v-if="travelRequest.status === 'need-clarification'" title="Respond to Clarification" description="Tim kami membutuhkan informasi tambahan sebelum dapat menyiapkan proposal.">
        <textarea v-model="clarificationMessage" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Jawab pertanyaan/klarifikasi yang diminta di sini..." />
        <Button class="mt-3" size="sm" :disabled="!clarificationMessage.trim()" @click="submitClarificationResponse">
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
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Tujuan Perjalanan
            </p>
            <p class="text-sm text-foreground whitespace-pre-line">
              {{ travelRequest.purpose }}
            </p>
          </div>
          <div v-if="serviceScopeOptions.length" class="mt-3 pt-3 border-t border-border">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Layanan
            </p>
            <div class="flex flex-wrap gap-2">
              <StatusBadge v-for="type in serviceScopeOptions" :key="type.value" :label="type.label" :tone="type.tone" />
            </div>
          </div>
          <div v-if="travelRequest.additionalServicesNote" class="mt-3 pt-3 border-t border-border">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Additional Service
            </p>
            <p class="text-sm text-foreground whitespace-pre-line">
              {{ travelRequest.additionalServicesNote }}
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Attachment">
          <ul v-if="attachments.length" class="divide-y divide-border">
            <li v-for="attachment in attachments" :key="attachment.id" class="py-2 flex items-center justify-between gap-2">
              <span class="text-sm text-foreground truncate">{{ attachment.fileName }}</span>
              <span class="text-xs text-muted-foreground shrink-0">{{ formatDate(attachment.uploadedAt) }}</span>
            </li>
          </ul>
          <EmptyState v-else title="Belum ada attachment" />
        </SectionCard>
      </div>

      <SectionCard title="Activity Timeline">
        <ActivityTimeline :items="activities" empty-label="Belum ada aktivitas" />
      </SectionCard>
    </template>
  </div>
</template>
