<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import {
  getApprovalById, getProjectById, getUserById, getChangeRequestById, getActivitiesByProject
} from '~/data'
import { APPROVAL_STATUSES, APPROVAL_ENTITY_TYPES, CHANGE_REQUEST_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import { isApprovalExpired } from '~/utils/attention'
import { clientDecideApprovalOnServer, useClientRequestsSync } from '~/data/client-requests-sync'
import { createSaveGate } from '~/lib/save-gate'
import type { Approval } from '~/types/client-approval'

/**
 * Approval Center — Detail (Repair Phase Section 3 — Request & Commercial). Isolasi: `clientPartyId` harus
 * milik `clientScopeId` user login. "Financial impact" untuk `entityType: 'change-request'` SENGAJA tidak
 * menampilkan `commercialImpactIdr`/`financialImpactNote`/`operationalImpact` mentah (pola sanitasi sama
 * `/client/project-orders/[id]` tab Changes & Incidents — internal-only bahkan untuk request milik Client
 * sendiri) — hanya status ketersediaan dampak + `timelineImpactNote` (bukan komersial) yang aman ditampilkan.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { showToast } = useToast()

const approval = computed(() => getApprovalById(String(route.params.id)))
const isOwnCompany = computed(() => Boolean(approval.value && clientScopeId.value && approval.value.clientPartyId === clientScopeId.value))
useHead({ title: computed(() => approval.value ? `Approval — ${approval.value.title ?? approval.value.entityId}` : 'Tidak Ditemukan') })

const project = computed(() => (approval.value ? getProjectById(approval.value.projectId) : undefined))
const linkedChangeRequest = computed(() => (approval.value?.entityType === 'change-request' ? getChangeRequestById(approval.value.entityId) : undefined))
const decidedByUser = computed(() => (approval.value?.decidedBy ? getUserById(approval.value.decidedBy) : undefined))
const requestedByUser = computed(() => (approval.value?.requestedBy ? getUserById(approval.value.requestedBy) : undefined))

const auditActivities = computed(() => {
  if (!approval.value) { return [] }
  return getActivitiesByProject(approval.value.projectId)
    .filter(entry => entry.message.includes(approval.value!.id))
    .map(entry => ({ id: entry.id, message: entry.message, createdAt: entry.createdAt }))
})

const canDecide = computed(() => Boolean(approval.value && approval.value.status === 'pending' && !isApprovalExpired(approval.value)))

/* S12c-3: the decision is recorded on the server first; staff may have asked something new, so read again on open. */
const api = useApi()
const gate = createSaveGate((title, message, tone) => showToast(title, message, tone))
const requestsSync = useClientRequestsSync()
onMounted(() => { requestsSync.load(true) })
const decide = (decision: 'approve' | 'reject' | 'request-revision', input: { comment?: string; reason?: string }) => {
  const id = approval.value!.id
  return gate.run('Keputusan Gagal Disimpan', () => clientDecideApprovalOnServer(api, id, decision, input))
}
const label = (entityType: Approval['entityType']) => findStatusOption(APPROVAL_ENTITY_TYPES, entityType).label

const isApproveDialogOpen = ref(false)
const approveComment = ref('')
async function submitApprove () {
  if (!approval.value) { return }
  const result = await decide('approve', approveComment.value.trim() ? { comment: approveComment.value.trim() } : {})
  if (!result) { return }
  approveComment.value = ''
  isApproveDialogOpen.value = false
  showToast('Approval Disetujui', `${label(result.entityType)} telah Anda setujui.`, 'success')
}

const isRejectDialogOpen = ref(false)
const rejectReason = ref('')
async function submitReject () {
  if (!approval.value || !rejectReason.value.trim()) { return }
  const result = await decide('reject', { reason: rejectReason.value.trim() })
  if (!result) { return }
  rejectReason.value = ''
  isRejectDialogOpen.value = false
  showToast('Approval Ditolak', `${label(result.entityType)} telah Anda tolak.`, 'info')
}

const isRevisionDialogOpen = ref(false)
const revisionReason = ref('')
async function submitRevisionRequest () {
  if (!approval.value || !revisionReason.value.trim()) { return }
  const result = await decide('request-revision', { reason: revisionReason.value.trim() })
  if (!result) { return }
  revisionReason.value = ''
  isRevisionDialogOpen.value = false
  showToast('Revisi Diminta', `Permintaan revisi untuk ${label(result.entityType)} telah dikirim.`, 'success')
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!approval || !isOwnCompany">
      <PageHeader title="Tidak Ditemukan" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Tidak Ditemukan' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Approval tidak ditemukan" description="Approval ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/client/travel-requests#approvals')">
            Kembali ke Approval Center
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <PageHeader
        :title="approval.title ?? `${findStatusOption(APPROVAL_ENTITY_TYPES, approval.entityType).label} — ${approval.entityId}`"
        :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Request & Approval' }, { label: 'Approval Center', to: '/client/travel-requests#approvals' }, { label: approval.title ?? approval.entityId }]"
      >
        <template #actions>
          <StatusBadge
            :label="isApprovalExpired(approval) ? 'Expired' : findStatusOption(APPROVAL_STATUSES, approval.status).label"
            :tone="isApprovalExpired(approval) ? 'destructive' : findStatusOption(APPROVAL_STATUSES, approval.status).tone"
          />
        </template>
      </PageHeader>

      <SectionCard title="Ringkasan">
        <DetailMetadataList
          :items="[
            { label: 'Jenis', value: findStatusOption(APPROVAL_ENTITY_TYPES, approval.entityType).label },
            { label: 'Project', value: approval.projectName ?? project?.name ?? approval.projectId },
            { label: 'Diajukan Oleh', value: approval.requestedByName ?? requestedByUser?.name ?? approval.requestedBy },
            ...(approval.approvedAmountIdr !== undefined ? [{ label: 'Nominal', value: formatCurrencyIdr(approval.approvedAmountIdr) }] : []),
            ...(approval.expiresAt ? [{ label: 'Batas Waktu', value: formatDate(approval.expiresAt) }] : []),
            { label: 'Tanggal Pengajuan', value: formatDate(approval.requestedAt) },
          ]"
        />
        <p v-if="approval.description" class="text-sm text-foreground mt-4 pt-4 border-t border-border whitespace-pre-line">
          {{ approval.description }}
        </p>
      </SectionCard>

      <SectionCard v-if="linkedChangeRequest" title="Change Request Terkait">
        <DetailMetadataList
          :items="[
            { label: 'Status Change Request', value: findStatusOption(CHANGE_REQUEST_STATUSES, linkedChangeRequest.status).label },
            { label: 'Kondisi Sebelum', value: linkedChangeRequest.beforeSummary },
            { label: 'Perubahan Diajukan', value: linkedChangeRequest.afterSummary },
          ]"
        />
        <div class="mt-3 pt-3 border-t border-border grid gap-3 sm:grid-cols-2">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Financial Impact
            </p>
            <p class="text-sm text-foreground">
              Dampak finansial telah dihitung oleh tim kami dan disertakan dalam penawaran/penyesuaian invoice Anda.
            </p>
          </div>
          <div v-if="linkedChangeRequest.timelineImpactNote">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Timeline Impact
            </p>
            <p class="text-sm text-foreground">
              {{ linkedChangeRequest.timelineImpactNote }}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Supporting Document">
        <EmptyState title="Belum ada dokumen pendukung" description="Dokumen terkait approval ini akan tampil di sini bila tersedia." />
      </SectionCard>

      <SectionCard v-if="approval.status !== 'pending'" title="Keputusan">
        <DetailMetadataList
          :items="[
            { label: 'Keputusan', value: findStatusOption(APPROVAL_STATUSES, approval.status).label },
            { label: 'Diputuskan Oleh', value: decidedByUser?.name ?? approval.decidedBy ?? '—' },
            { label: 'Tanggal Keputusan', value: approval.decidedAt ? formatDate(approval.decidedAt) : '—' },
          ]"
        />
        <p v-if="approval.comment" class="text-sm text-muted-foreground mt-2">
          Catatan: {{ approval.comment }}
        </p>
        <p v-if="approval.reason" class="text-sm text-destructive mt-2">
          Alasan: {{ approval.reason }}
        </p>
      </SectionCard>

      <SectionCard v-if="canDecide" title="Keputusan Anda">
        <div class="flex flex-wrap gap-2">
          <ResponsiveFormSheet v-model:open="isApproveDialogOpen" title="Approve" description="Konfirmasi persetujuan Anda." content-class="max-w-md">
            <template #trigger>
              <Button>Approve</Button>
            </template>
            <div class="space-y-1.5 py-2">
              <Label for="approval-approve-comment">Catatan (opsional)</Label>
              <Input id="approval-approve-comment" v-model="approveComment" />
            </div>
            <template #footer>
              <Button variant="outline" @click="isApproveDialogOpen = false">
                Batal
              </Button>
              <Button :disabled="gate.saving.value" @click="submitApprove">
                Approve
              </Button>
            </template>
          </ResponsiveFormSheet>
          <ResponsiveFormSheet v-model:open="isRejectDialogOpen" title="Reject" description="Alasan wajib diisi." content-class="max-w-md">
            <template #trigger>
              <Button variant="outline">
                Reject
              </Button>
            </template>
            <div class="space-y-1.5 py-2">
              <Label for="approval-reject-reason">Alasan</Label>
              <Input id="approval-reject-reason" v-model="rejectReason" />
            </div>
            <template #footer>
              <Button variant="outline" @click="isRejectDialogOpen = false">
                Batal
              </Button>
              <Button variant="destructive" :disabled="gate.saving.value || !rejectReason.trim()" @click="submitReject">
                Reject
              </Button>
            </template>
          </ResponsiveFormSheet>
          <ResponsiveFormSheet v-model:open="isRevisionDialogOpen" title="Request Revision" description="Alasan wajib diisi." content-class="max-w-md">
            <template #trigger>
              <Button variant="ghost">
                Request Revision
              </Button>
            </template>
            <div class="space-y-1.5 py-2">
              <Label for="approval-revision-reason">Alasan</Label>
              <Input id="approval-revision-reason" v-model="revisionReason" />
            </div>
            <template #footer>
              <Button variant="outline" @click="isRevisionDialogOpen = false">
                Batal
              </Button>
              <Button :disabled="gate.saving.value || !revisionReason.trim()" @click="submitRevisionRequest">
                Kirim
              </Button>
            </template>
          </ResponsiveFormSheet>
        </div>
      </SectionCard>

      <SectionCard title="Audit History">
        <ActivityTimeline :items="auditActivities" empty-label="Belum ada riwayat keputusan" />
      </SectionCard>
    </template>
  </div>
</template>
