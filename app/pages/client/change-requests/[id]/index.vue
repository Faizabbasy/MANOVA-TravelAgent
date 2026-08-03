<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Paperclip } from 'lucide-vue-next'
import {
  getChangeRequestById, getProjectById, getUserById,
  getChangeRequestComments, addChangeRequestComment,
  getChangeRequestAttachments, addChangeRequestAttachmentMock,
  getChangeRequestActivityHistory,
  approveChangeRequestImpact, rejectChangeRequestImpact, cancelChangeRequest,
  CANCELLABLE_CHANGE_REQUEST_STATUSES
} from '~/data'
import { CHANGE_REQUEST_STATUSES, CHANGE_REQUEST_TYPES, findStatusOption } from '~/constants/status'
import { formatDate } from '~/utils/format'

/**
 * Change Request — Detail (Repair Phase Section 5 — Execution & Changes, Master Prompt bagian B). Impact
 * Review (Cost/Timeline/Cancellation Fee) hanya terisi setelah `runChangeRequestMockReview` selesai
 * (status `costing` ke atas) — field kosong sebelum itu ditampilkan sebagai "Belum tersedia", BUKAN 0/blank
 * yang menyesatkan (larangan Master Prompt "angka yang tidak terhubung").
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const request = computed(() => getChangeRequestById(String(route.params.id)))
const project = computed(() => (request.value ? getProjectById(request.value.projectId) : undefined))
const isOwnCompany = computed(() => Boolean(project.value && clientScopeId.value && project.value.partyId === clientScopeId.value))
useHead({ title: computed(() => request.value ? `Change Request ${request.value.id}` : 'Tidak Ditemukan') })

const requester = computed(() => (request.value ? getUserById(request.value.requestedBy) : undefined))

const EXECUTION_STEPS = ['submitted', 'under-review', 'availability-check', 'costing', 'waiting-client-approval', 'in-execution', 'implemented'] as const
const stepIndex = computed(() => (request.value ? EXECUTION_STEPS.indexOf(request.value.status as typeof EXECUTION_STEPS[number]) : -1))
const isTerminalOutcome = computed(() => request.value && ['rejected', 'cancelled', 'not-feasible'].includes(request.value.status))

const hasImpact = computed(() => request.value && ['costing', 'waiting-client-approval', 'in-execution', 'implemented', 'rejected'].includes(request.value.status))
const canDecide = computed(() => request.value?.status === 'waiting-client-approval')
const canCancel = computed(() => request.value && CANCELLABLE_CHANGE_REQUEST_STATUSES.includes(request.value.status))

function handleApprove () {
  if (!request.value) { return }
  const result = approveChangeRequestImpact(request.value.id, currentUser.value.id)
  if (result) { showToast('Perubahan Disetujui', 'Tim kami akan mulai mengeksekusi perubahan ini.', 'success') }
}

const isRejectOpen = ref(false)
const rejectReason = ref('')
function submitReject () {
  if (!request.value || !rejectReason.value.trim()) { return }
  const result = rejectChangeRequestImpact(request.value.id, currentUser.value.id, rejectReason.value.trim())
  rejectReason.value = ''
  isRejectOpen.value = false
  if (result) { showToast('Perubahan Ditolak', 'Estimasi dampak telah Anda tolak.', 'info') }
}

const isCancelOpen = ref(false)
const cancelReason = ref('')
function submitCancel () {
  if (!request.value || !cancelReason.value.trim()) { return }
  const result = cancelChangeRequest(request.value.id, cancelReason.value.trim())
  cancelReason.value = ''
  isCancelOpen.value = false
  if (result) { showToast('Change Request Dibatalkan', 'Permintaan perubahan Anda telah dibatalkan.', 'info') }
}

const comments = computed(() => (request.value ? getChangeRequestComments(request.value.id) : []))
const newComment = ref('')
function submitComment () {
  if (!request.value || !newComment.value.trim()) { return }
  addChangeRequestComment(request.value.id, currentUser.value.id, newComment.value.trim())
  newComment.value = ''
  showToast('Komentar Ditambahkan', 'Komentar Anda berhasil disimpan.', 'success')
}

const attachments = computed(() => (request.value ? getChangeRequestAttachments(request.value.id) : []))
const newAttachmentName = ref('')
function submitAttachment () {
  if (!request.value || !newAttachmentName.value.trim()) { return }
  addChangeRequestAttachmentMock(request.value.id, newAttachmentName.value.trim(), currentUser.value.id)
  newAttachmentName.value = ''
  showToast('Attachment Ditambahkan', 'Metadata lampiran tercatat (mock, bukan file nyata).', 'success')
}

const activityHistory = computed(() => (request.value ? getChangeRequestActivityHistory(request.value.id, request.value.projectId).map(entry => ({ id: entry.id, message: entry.message, createdAt: entry.createdAt })) : []))
</script>

<template>
  <div class="space-y-6">
    <template v-if="!request || !isOwnCompany">
      <PageHeader title="Tidak Ditemukan" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Tidak Ditemukan' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Change Request tidak ditemukan" description="Permintaan perubahan ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/client/change-requests')">
            Kembali ke Change Requests
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <PageHeader
        :title="`Change Request — ${project?.name ?? request.projectId}`"
        :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Travel Management' }, { label: 'Change Requests', to: '/client/change-requests' }, { label: request.id }]"
      >
        <template #actions>
          <StatusBadge :label="findStatusOption(CHANGE_REQUEST_STATUSES, request.status).label" :tone="findStatusOption(CHANGE_REQUEST_STATUSES, request.status).tone" />
          <Dialog v-model:open="isCancelOpen">
            <DialogTrigger as-child>
              <Button v-if="canCancel" size="sm" variant="ghost">
                Batalkan
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Batalkan Change Request</DialogTitle>
                <DialogDescription>Alasan wajib diisi.</DialogDescription>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="cr-cancel-reason">Alasan</Label>
                <Input id="cr-cancel-reason" v-model="cancelReason" />
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isCancelOpen = false">
                  Tutup
                </Button>
                <Button variant="destructive" :disabled="!cancelReason.trim()" @click="submitCancel">
                  Batalkan Permintaan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </template>
      </PageHeader>

      <SectionCard title="Ringkasan">
        <DetailMetadataList
          :items="[
            { label: 'Project', value: project?.name ?? request.projectId },
            { label: 'Jenis Perubahan', value: request.changeType ? findStatusOption(CHANGE_REQUEST_TYPES, request.changeType).label : 'Lainnya' },
            { label: 'Diajukan Oleh', value: requester?.name ?? request.requestedBy },
            { label: 'Tanggal Pengajuan', value: formatDate(request.submittedAt) },
          ]"
        />
        <div class="mt-4 pt-4 border-t border-border grid gap-3 sm:grid-cols-2">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Kondisi Saat Ini
            </p>
            <p class="text-sm text-foreground">
              {{ request.beforeSummary }}
            </p>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Perubahan Diminta
            </p>
            <p class="text-sm text-foreground">
              {{ request.afterSummary }}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard v-if="!isTerminalOutcome" title="Execution Progress">
        <ol class="flex flex-wrap gap-2">
          <li v-for="(step, index) in EXECUTION_STEPS" :key="step">
            <StatusBadge
              :label="findStatusOption(CHANGE_REQUEST_STATUSES, step).label"
              :tone="index < stepIndex ? 'success' : index === stepIndex ? 'primary' : 'neutral'"
            />
          </li>
        </ol>
      </SectionCard>
      <SectionCard v-else title="Status Akhir">
        <StatusBadge :label="findStatusOption(CHANGE_REQUEST_STATUSES, request.status).label" :tone="findStatusOption(CHANGE_REQUEST_STATUSES, request.status).tone" />
        <p v-if="request.rejectionReason" class="text-sm text-muted-foreground mt-2">
          Alasan: {{ request.rejectionReason }}
        </p>
        <p v-if="request.cancelReason" class="text-sm text-muted-foreground mt-2">
          Alasan pembatalan: {{ request.cancelReason }}
        </p>
      </SectionCard>

      <SectionCard title="Impact Review">
        <template v-if="hasImpact">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Financial Impact
            </p>
            <p class="text-sm text-foreground">
              Dampak finansial (termasuk biaya pembatalan bila berlaku) telah dihitung oleh tim kami dan disertakan dalam penawaran/penyesuaian invoice Anda.
            </p>
          </div>
          <div v-if="request.timelineImpactNote" class="mt-3 pt-3 border-t border-border">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Timeline Impact
            </p>
            <p class="text-sm text-foreground">
              {{ request.timelineImpactNote }}
            </p>
          </div>
        </template>
        <EmptyState v-else title="Impact review belum tersedia" description="Estimasi dampak biaya dan jadwal akan tampil di sini setelah tim kami menyelesaikan pengecekan ketersediaan dan penghitungan biaya." />
      </SectionCard>

      <SectionCard v-if="canDecide" title="Keputusan Anda">
        <p class="text-sm text-muted-foreground mb-3">
          Setujui untuk melanjutkan eksekusi perubahan, atau tolak bila estimasi dampak tidak sesuai.
        </p>
        <div class="flex flex-wrap gap-2">
          <Button @click="handleApprove">
            Approve
          </Button>
          <Dialog v-model:open="isRejectOpen">
            <DialogTrigger as-child>
              <Button variant="outline">
                Reject
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Reject Impact</DialogTitle>
                <DialogDescription>Alasan wajib diisi.</DialogDescription>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="cr-reject-reason">Alasan</Label>
                <Input id="cr-reject-reason" v-model="rejectReason" />
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isRejectOpen = false">
                  Batal
                </Button>
                <Button variant="destructive" :disabled="!rejectReason.trim()" @click="submitReject">
                  Reject
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </SectionCard>

      <SectionCard title="Comments">
        <ul v-if="comments.length" class="divide-y divide-border mb-3">
          <li v-for="comment in comments" :key="comment.id" class="py-2">
            <p class="text-sm text-foreground">
              {{ comment.body }}
            </p>
            <p class="text-xs text-muted-foreground mt-0.5">
              {{ getUserById(comment.authorId)?.name ?? comment.authorId }} · {{ formatDate(comment.createdAt) }}
            </p>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada komentar" />
        <div class="flex gap-2 mt-3">
          <Input v-model="newComment" placeholder="Tulis komentar..." class="flex-1" @keyup.enter="submitComment" />
          <Button :disabled="!newComment.trim()" @click="submitComment">
            Kirim
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Attachments">
        <ul v-if="attachments.length" class="divide-y divide-border mb-3">
          <li v-for="attachment in attachments" :key="attachment.id" class="py-2 flex items-center gap-2 text-sm text-foreground">
            <Paperclip class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {{ attachment.fileName }}
            <span class="text-xs text-muted-foreground ml-auto shrink-0">{{ formatDate(attachment.uploadedAt) }}</span>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada lampiran" />
        <div class="flex gap-2 mt-3">
          <Input v-model="newAttachmentName" placeholder="Nama file (mock, mis. foto-kondisi.jpg)" class="flex-1" @keyup.enter="submitAttachment" />
          <Button :disabled="!newAttachmentName.trim()" @click="submitAttachment">
            Tambah
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Activity History">
        <ActivityTimeline :items="activityHistory" empty-label="Belum ada riwayat aktivitas" />
      </SectionCard>
    </template>
  </div>
</template>
