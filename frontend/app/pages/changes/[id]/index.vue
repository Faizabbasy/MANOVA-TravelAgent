<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import {
  getChangeRequestById,
  getProjectById, getUserById, getQuotationById
} from '~/data'
import { CHANGE_REQUEST_SOURCES, CHANGE_REQUEST_STATUSES, findStatusOption } from '~/constants/status'
import {
  approveChangeRequestOnServer, implementChangeRequestOnServer, rejectChangeRequestOnServer, reviewChangeRequestOnServer, sendChangeRequestToClientOnServer, staffChangeRequestActions
} from '~/data/changes-sync'
import { createSaveGate } from '~/lib/save-gate'
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
const { canView, can } = usePermissions()
/* S8: the same capabilities the server checks — review/decide (`review-change`), mark implemented (`log-change`). */
const canApproveChangeRequest = computed(() => can('project-order.review-change'))
const canLogChange = computed(() => can('project-order.log-change'))
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

/* S8: the server decides the request and its change entry in the project log together. */
const api = useApi()
const { saving: isSaving, run: save } = createSaveGate(showToast)

async function handleUnderReview () {
  if (!request.value) { return }
  const id = request.value.id
  const result = await save('Gagal Memulai Review', () => reviewChangeRequestOnServer(api, id))
  if (result) { showToast('Change Request Direview', `${result.id} kini sedang direview.`) }
}

async function handleApprove () {
  if (!request.value) { return }
  const id = request.value.id
  const result = await save('Change Request Gagal Disetujui', () => approveChangeRequestOnServer(api, id))
  if (result) { showToast('Change Request Disetujui', `${result.id} disetujui.`, 'success') }
}

function openReject () {
  rejectionReason.value = ''
  isRejectDialogOpen.value = true
}

async function submitReject () {
  if (!request.value || !rejectionReason.value.trim()) { return }
  const id = request.value.id
  const reason = rejectionReason.value.trim()
  const result = await save('Change Request Gagal Ditolak', () => rejectChangeRequestOnServer(api, id, reason))
  if (!result) { return }
  isRejectDialogOpen.value = false
  showToast('Change Request Ditolak', `${result.id} ditolak.`, 'info')
}

/* S12b-2: the staff buttons follow the server's rules (a client request with a cost goes to the client). */
const actions = computed(() => (request.value ? staffChangeRequestActions(request.value) : { review: false, sendToClient: false, approve: false, reject: false, implement: false }))
const isImpactDialogOpen = ref(false)
const impactCommercial = ref<number | null>(null)
const impactFee = ref<number | null>(null)
const impactTimeline = ref('')
const impactHasCost = computed(() => (impactCommercial.value ?? 0) > 0 || (impactFee.value ?? 0) > 0)

function openImpact () {
  impactCommercial.value = request.value?.commercialImpactIdr ?? null
  impactFee.value = request.value?.cancellationFeeIdr ?? null
  impactTimeline.value = request.value?.timelineImpactNote ?? ''
  isImpactDialogOpen.value = true
}

async function submitImpact () {
  if (!request.value || !impactHasCost.value) { return }
  const id = request.value.id
  const minor = (v: number | null) => (v && v > 0 ? String(Math.round(v)) : '0')
  const result = await save('Dampak Gagal Dikirim', () => sendChangeRequestToClientOnServer(api, id, {
    commercialImpactMinor: minor(impactCommercial.value),
    cancellationFeeMinor: minor(impactFee.value),
    ...(impactTimeline.value.trim() ? { timelineImpactNote: impactTimeline.value.trim() } : {})
  }))
  if (!result) { return }
  isImpactDialogOpen.value = false
  showToast('Dampak Dikirim ke Client', `${result.id} menunggu persetujuan client.`, 'success')
}

async function handleImplemented () {
  if (!request.value) { return }
  const id = request.value.id
  const result = await save('Gagal Menandai Implementasi', () => implementChangeRequestOnServer(api, id))
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
            <template v-if="canApproveChangeRequest || canLogChange">
              <Button v-if="canApproveChangeRequest && actions.review" size="sm" variant="outline" :disabled="isSaving" @click="handleUnderReview">
                Mulai Review
              </Button>
              <Button v-if="canApproveChangeRequest && actions.sendToClient" size="sm" variant="outline" :disabled="isSaving" @click="openImpact">
                Kirim Dampak ke Client
              </Button>
              <Button v-if="canApproveChangeRequest && actions.approve" size="sm" :disabled="isSaving" @click="handleApprove">
                Setujui
              </Button>
              <Button v-if="canApproveChangeRequest && actions.reject" size="sm" variant="destructive" :disabled="isSaving" @click="openReject">
                Tolak
              </Button>
              <Button v-if="canLogChange && actions.implement" size="sm" variant="outline" :disabled="isSaving" @click="handleImplemented">
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
          <div v-if="request.cancellationFeeIdr !== undefined">
            <p class="text-xs text-muted-foreground">
              Biaya Pembatalan
            </p>
            <p class="text-sm text-foreground mt-1">
              {{ formatCurrencyIdr(request.cancellationFeeIdr) }}
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
      <ResponsiveFormSheet
        v-model:open="isRejectDialogOpen"
        title="Tolak Change Request"
        description="Alasan wajib dicatat — akan tersimpan sebagai jejak historis di Activity & Changes project terkait."
        content-class="max-w-md"
      >
        <div class="space-y-1.5 py-2">
          <Label for="reject-reason">Alasan</Label>
          <Input id="reject-reason" v-model="rejectionReason" placeholder="mis. Di luar scope kontrak awal" />
        </div>
        <template #footer>
          <Button variant="outline" @click="isRejectDialogOpen = false">
            Batal
          </Button>
          <Button variant="destructive" :disabled="!rejectionReason.trim() || isSaving" @click="submitReject">
            Konfirmasi
          </Button>
        </template>
      </ResponsiveFormSheet>

      <!-- S12b-2: send the impact of a client's request to the client -->
      <ResponsiveFormSheet
        v-model:open="isImpactDialogOpen"
        title="Kirim Dampak ke Client"
        description="Client akan diminta menyetujui atau menolak biaya ini sebelum perubahan dilaksanakan. Tanpa biaya, setujui langsung."
        content-class="max-w-md"
      >
        <div class="space-y-4 py-2">
          <div class="space-y-1.5">
            <Label for="impact-commercial">Dampak Komersial (Rp)</Label>
            <CurrencyInput id="impact-commercial" v-model="impactCommercial" placeholder="mis. 2500000" />
          </div>
          <div class="space-y-1.5">
            <Label for="impact-fee">Biaya Pembatalan (Rp)</Label>
            <CurrencyInput id="impact-fee" v-model="impactFee" placeholder="mis. 750000" />
          </div>
          <div class="space-y-1.5">
            <Label for="impact-timeline">Dampak Jadwal (opsional)</Label>
            <Input id="impact-timeline" v-model="impactTimeline" placeholder="mis. Check-in mundur 1 hari" />
          </div>
        </div>
        <template #footer>
          <Button variant="outline" @click="isImpactDialogOpen = false">
            Batal
          </Button>
          <Button :disabled="!impactHasCost || isSaving" @click="submitImpact">
            Kirim ke Client
          </Button>
        </template>
      </ResponsiveFormSheet>
    </template>
  </div>
</template>
