<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import {
  getApprovalById, getProjectById, getUserById, getChangeRequestById, getActivitiesByProject,
  approveClientApproval, rejectClientApproval, requestClientApprovalRevision
} from '~/data'
import { APPROVAL_STATUSES, APPROVAL_ENTITY_TYPES, CHANGE_REQUEST_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate } from '~/utils/format'
import { isApprovalExpired } from '~/utils/attention'

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
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const approval = computed(() => getApprovalById(String(route.params.id)))
const isOwnCompany = computed(() => Boolean(approval.value && clientScopeId.value && approval.value.clientPartyId === clientScopeId.value))
useHead({ title: computed(() => approval.value ? `Approval — ${approval.value.entityId}` : 'Tidak Ditemukan') })

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

const isApproveDialogOpen = ref(false)
const approveComment = ref('')
function submitApprove () {
  if (!approval.value) { return }
  const result = approveClientApproval(approval.value.id, currentUser.value.id, approveComment.value.trim() || undefined)
  approveComment.value = ''
  isApproveDialogOpen.value = false
  if (result) { showToast('Approval Disetujui', `${findStatusOption(APPROVAL_ENTITY_TYPES, result.entityType).label} telah Anda setujui.`, 'success') }
}

const isRejectDialogOpen = ref(false)
const rejectReason = ref('')
function submitReject () {
  if (!approval.value || !rejectReason.value.trim()) { return }
  const result = rejectClientApproval(approval.value.id, currentUser.value.id, rejectReason.value.trim())
  rejectReason.value = ''
  isRejectDialogOpen.value = false
  if (result) { showToast('Approval Ditolak', `${findStatusOption(APPROVAL_ENTITY_TYPES, result.entityType).label} telah Anda tolak.`, 'info') }
}

const isRevisionDialogOpen = ref(false)
const revisionReason = ref('')
function submitRevisionRequest () {
  if (!approval.value || !revisionReason.value.trim()) { return }
  const result = requestClientApprovalRevision(approval.value.id, currentUser.value.id, revisionReason.value.trim())
  revisionReason.value = ''
  isRevisionDialogOpen.value = false
  if (result) { showToast('Revisi Diminta', `Permintaan revisi untuk ${findStatusOption(APPROVAL_ENTITY_TYPES, result.entityType).label} telah dikirim.`, 'success') }
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!approval || !isOwnCompany">
      <PageHeader title="Tidak Ditemukan" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Tidak Ditemukan' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Approval tidak ditemukan" description="Approval ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/client/approvals')">
            Kembali ke Approval Center
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <PageHeader
        :title="`${findStatusOption(APPROVAL_ENTITY_TYPES, approval.entityType).label} — ${approval.entityId}`"
        :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Request & Commercial' }, { label: 'Approval Center', to: '/client/approvals' }, { label: approval.entityId }]"
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
            { label: 'Project', value: project?.name ?? approval.projectId },
            { label: 'Diajukan Oleh', value: requestedByUser?.name ?? approval.requestedBy },
            { label: 'Tanggal Pengajuan', value: formatDate(approval.requestedAt) },
          ]"
        />
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
          <Dialog v-model:open="isApproveDialogOpen">
            <DialogTrigger as-child>
              <Button>Approve</Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Approve</DialogTitle>
                <DialogDescription>Konfirmasi persetujuan Anda.</DialogDescription>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="approval-approve-comment">Catatan (opsional)</Label>
                <Input id="approval-approve-comment" v-model="approveComment" />
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isApproveDialogOpen = false">
                  Batal
                </Button>
                <Button @click="submitApprove">
                  Approve
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog v-model:open="isRejectDialogOpen">
            <DialogTrigger as-child>
              <Button variant="outline">
                Reject
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Reject</DialogTitle>
                <DialogDescription>Alasan wajib diisi.</DialogDescription>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="approval-reject-reason">Alasan</Label>
                <Input id="approval-reject-reason" v-model="rejectReason" />
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isRejectDialogOpen = false">
                  Batal
                </Button>
                <Button variant="destructive" :disabled="!rejectReason.trim()" @click="submitReject">
                  Reject
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog v-model:open="isRevisionDialogOpen">
            <DialogTrigger as-child>
              <Button variant="ghost">
                Request Revision
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Request Revision</DialogTitle>
                <DialogDescription>Alasan wajib diisi.</DialogDescription>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="approval-revision-reason">Alasan</Label>
                <Input id="approval-revision-reason" v-model="revisionReason" />
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isRevisionDialogOpen = false">
                  Batal
                </Button>
                <Button :disabled="!revisionReason.trim()" @click="submitRevisionRequest">
                  Kirim
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </SectionCard>

      <SectionCard title="Audit History">
        <ActivityTimeline :items="auditActivities" empty-label="Belum ada riwayat keputusan" />
      </SectionCard>
    </template>
  </div>
</template>
