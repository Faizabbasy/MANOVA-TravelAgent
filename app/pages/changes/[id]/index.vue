<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import {
  getChangeRequestById, getChangeRequestStatusTransitions,
  approveChangeRequest, rejectChangeRequest, markChangeRequestUnderReview, markChangeRequestImplemented,
  getProjectById, getUserById, getQuotationById
} from '~/data'
import { CHANGE_REQUEST_SOURCES, CHANGE_REQUEST_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'

/**
 * Change Request detail (Section 19, D-076) — before/after, dampak operasional/komersial/finansial/timeline,
 * approval action (Management/Super Admin, `canApprove('project')` — pola sama Section 14 lama, BUKAN rank
 * modul `changes`), link ke `ActivityEntry` (audit trail tetap satu sumber kebenaran) dan Additional
 * Quotation/Change Order (`linkedQuotationId`, opsional).
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, canApprove } = usePermissions()
const canApproveChangeRequest = computed(() => canApprove('project'))
const { showToast } = useToast()

const request = computed(() => getChangeRequestById(String(route.params.id)))
useHead({ title: computed(() => request.value ? `Change Request ${request.value.id}` : 'Change Request Tidak Ditemukan') })

const project = computed(() => (request.value ? getProjectById(request.value.projectId) : undefined))
const linkedQuotation = computed(() => (request.value?.linkedQuotationId ? getQuotationById(request.value.linkedQuotationId) : undefined))

const summaryMetadata = computed(() => {
  if (!request.value) { return [] }
  return [
    { label: 'Project', value: project.value?.name ?? request.value.projectId },
    { label: 'Sumber', value: findStatusOption(CHANGE_REQUEST_SOURCES, request.value.source).label },
    { label: 'Diajukan Oleh', value: getUserById(request.value.requestedBy)?.name ?? request.value.requestedBy },
    { label: 'Tanggal Diajukan', value: formatDate(request.value.submittedAt) },
    { label: 'Affected Entities', value: request.value.affectedEntities.length ? request.value.affectedEntities.map(e => `${e.entityType}:${e.entityId}`).join(', ') : '—' }
  ]
})

/* Status transitions */
const isRejectDialogOpen = ref(false)
const rejectionReason = ref('')

function handleUnderReview () {
  if (!request.value) { return }
  markChangeRequestUnderReview(request.value.id, currentUser.value.id)
  showToast('Change Request Direview', `${request.value.id} kini sedang direview.`)
}

function handleApprove () {
  if (!request.value) { return }
  const result = approveChangeRequest(request.value.id, currentUser.value.id)
  if (result) { showToast('Change Request Disetujui', `${result.id} disetujui.`, 'success') }
}

function openReject () {
  rejectionReason.value = ''
  isRejectDialogOpen.value = true
}

function submitReject () {
  if (!request.value || !rejectionReason.value.trim()) { return }
  const result = rejectChangeRequest(request.value.id, currentUser.value.id, rejectionReason.value.trim())
  isRejectDialogOpen.value = false
  if (result) { showToast('Change Request Ditolak', `${result.id} ditolak.`, 'info') }
}

function handleImplemented () {
  if (!request.value) { return }
  const result = markChangeRequestImplemented(request.value.id, currentUser.value.id)
  if (result) { showToast('Change Request Diimplementasikan', `${result.id} ditandai selesai diimplementasikan.`, 'success') }
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!request">
      <PageHeader title="Change Request Tidak Ditemukan" :breadcrumb="[{ label: 'Changes & Incidents', to: '/changes' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Change Request tidak ditemukan" :description="`Change Request dengan ID '${route.params.id}' tidak ada di data demo saat ini.`">
          <Button @click="router.push('/changes')">
            Kembali ke Changes & Incidents
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('changes')" module-label="modul Changes & Incidents" />

    <template v-else>
      <PageHeader :title="`Change Request ${request.id}`" :breadcrumb="[{ label: 'Changes & Incidents', to: '/changes' }, { label: request.id }]">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="findStatusOption(CHANGE_REQUEST_STATUSES, request.status).label" :tone="findStatusOption(CHANGE_REQUEST_STATUSES, request.status).tone" />
            <template v-if="canApproveChangeRequest">
              <Button v-if="getChangeRequestStatusTransitions(request.status).includes('under-review')" size="sm" variant="outline" @click="handleUnderReview">
                Mulai Review
              </Button>
              <Button v-if="getChangeRequestStatusTransitions(request.status).includes('approved')" size="sm" @click="handleApprove">
                Setujui
              </Button>
              <Button v-if="getChangeRequestStatusTransitions(request.status).includes('rejected')" size="sm" variant="destructive" @click="openReject">
                Tolak
              </Button>
              <Button v-if="getChangeRequestStatusTransitions(request.status).includes('implemented')" size="sm" variant="outline" @click="handleImplemented">
                Tandai Diimplementasikan
              </Button>
            </template>
          </div>
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
      </SectionCard>

      <SectionCard title="Before / After">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">
              Sebelum
            </p>
            <p class="text-sm text-foreground mt-1">
              {{ request.beforeSummary }}
            </p>
          </div>
          <div class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">
              Sesudah
            </p>
            <p class="text-sm text-foreground mt-1">
              {{ request.afterSummary }}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Dampak">
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <p class="text-xs text-muted-foreground">
              Dampak Operasional
            </p>
            <p class="text-sm text-foreground mt-1">
              {{ request.operationalImpact ?? '—' }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">
              Dampak Komersial
            </p>
            <p class="text-sm text-foreground mt-1">
              {{ request.commercialImpactIdr !== undefined ? formatCurrencyIdr(request.commercialImpactIdr) : '—' }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">
              Dampak Finansial (Catatan)
            </p>
            <p class="text-sm text-foreground mt-1">
              {{ request.financialImpactNote ?? '—' }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">
              Dampak Timeline
            </p>
            <p class="text-sm text-foreground mt-1">
              {{ request.timelineImpactNote ?? '—' }}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Additional Quotation / Change Order">
        <p v-if="linkedQuotation" class="text-sm text-foreground">
          {{ linkedQuotation.id }} — {{ formatCurrencyIdr(linkedQuotation.amountIdr) }}
        </p>
        <p v-else class="text-sm text-muted-foreground">
          Tidak ada quotation tambahan/change order yang ditautkan pada Change Request ini.
        </p>
      </SectionCard>

      <SectionCard title="Approval / Rejection">
        <div class="grid gap-3 sm:grid-cols-2 text-sm">
          <p class="text-muted-foreground">
            Disetujui/Ditolak Oleh: <span class="text-foreground">{{ request.approvedBy ? (getUserById(request.approvedBy)?.name ?? request.approvedBy) : '—' }}</span>
          </p>
          <p class="text-muted-foreground">
            Tanggal: <span class="text-foreground">{{ request.approvedAt ? formatDate(request.approvedAt) : '—' }}</span>
          </p>
        </div>
        <p v-if="request.rejectionReason" class="text-sm text-destructive mt-2">
          Alasan Penolakan: {{ request.rejectionReason }}
        </p>
        <p v-if="request.activityEntryId" class="text-xs text-muted-foreground mt-3">
          Tertaut ke Activity & Changes: <NuxtLink :to="`/project-orders/${request.projectId}?tab=activity-changes`" class="text-primary hover:underline">
            {{ request.activityEntryId }}
          </NuxtLink>
        </p>
      </SectionCard>

      <!-- Reject dialog -->
      <Dialog v-model:open="isRejectDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Change Request</DialogTitle>
            <DialogDescription>Alasan wajib dicatat — akan tersimpan sebagai jejak historis di Activity & Changes project terkait.</DialogDescription>
          </DialogHeader>
          <div class="space-y-1.5 py-2">
            <Label for="reject-reason">Alasan</Label>
            <Input id="reject-reason" v-model="rejectionReason" placeholder="mis. Di luar scope kontrak awal" />
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isRejectDialogOpen = false">
              Batal
            </Button>
            <Button variant="destructive" :disabled="!rejectionReason.trim()" @click="submitReject">
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
